/**
 * Central place for backend URL + fetch helpers so components do not each guess how
 * to reach FastAPI—avoids subtle production/dev drift when rewrites or ports change.
 */

/**
 * API base URL for fetch().
 * In the browser, when `NEXT_PUBLIC_API_URL` is unset, same-origin `/agents/*` and
 * `/rag/*` go through Next.js dev rewrites — those proxies can time out on long LLM
 * calls (~30s) and surface as ECONNRESET / "socket hang up". In development we default
 * to calling FastAPI directly so quiz/RAG requests can finish. Production keeps
 * same-origin rewrites unless `NEXT_PUBLIC_API_URL` is set.
 * For LAN/mobile testing against a machine IP, set `NEXT_PUBLIC_API_URL` explicitly.
 */
export function getBackendBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "development") {
      return "http://127.0.0.1:8000";
    }
    return "";
  }
  return "http://127.0.0.1:8000";
}

function parseApiErrorBody(text: string): string {
  if (!text) return "Request failed";
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          typeof e === "object" && e !== null && "msg" in e
            ? String((e as { msg: string }).msg)
            : JSON.stringify(e)
        )
        .join("; ");
    }
  } catch {
    /* not JSON */
  }
  return text;
}

/** `answer` = RAG-grounded Q&A (answer_agent). `chat` = chat_agent (no context in multi_agents). */
export type AgentMode =
  | "auto"
  | "chat"
  | "answer"
  | "planner"
  | "planner_week"
  | "plan_chat"
  | "quiz"
  | "evaluate";

export type AgentRunResponse = {
  intent: string;
  answer: string;
  rag_used: boolean;
  error: string | null;
  /** Present when error is set: backend LLM/API reason (truncated). */
  error_detail?: string | null;
};

export const api = {
  /**
   * Multi-agent pipeline: RAG context + routed agent (Gemini).
   * Requires Firebase `userId` and current study `topic` (same as upload/index).
   */
  async runAgent(params: {
    message: string;
    userId: string;
    topic: string;
    mode?: AgentMode;
    /** When mode is `quiz`: `mcq` or `short_answer`. */
    quiz_format?: "mcq" | "short_answer";
  }): Promise<AgentRunResponse> {
    const { message, userId, topic, mode = "auto", quiz_format } = params;
    const base = getBackendBaseUrl();
    const body: Record<string, unknown> = {
      message,
      user_id: userId,
      topic,
      mode,
    };
    if (mode === "quiz" && quiz_format) {
      body.quiz_format = quiz_format;
    }
    let res: Response;
    try {
      res = await fetch(`${base}/agents/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e: unknown) {
      const hint =
        base === ""
          ? " Is the FastAPI server running on port 8000?"
          : " Is FastAPI running and reachable at this URL? (Try NEXT_PUBLIC_API_URL if using a remote API.)";
      throw new Error(
        e instanceof Error && e.message === "Failed to fetch"
          ? `Could not reach backend.${hint}`
          : e instanceof Error
            ? e.message
            : "Network error"
      );
    }
    const text = await res.text();
    if (!res.ok) {
      throw new Error(parseApiErrorBody(text) || `Request failed (${res.status})`);
    }
    return JSON.parse(text) as AgentRunResponse;
  },

  async chat(message: string, documentIds?: string[]) {
    const base = getBackendBaseUrl();
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, document_ids: documentIds }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createPlan(params: { subject: string; deadline?: string }) {
    const base = getBackendBaseUrl();
    const res = await fetch(`${base}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async uploadDocument(formData: FormData) {
    const base = getBackendBaseUrl();
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
