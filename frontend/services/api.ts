/**
 * API client for ScholarAI backend.
 * Base URL from env: NEXT_PUBLIC_API_URL
 */

const getBaseUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = {
  async chat(message: string, documentIds?: string[]) {
    const res = await fetch(`${getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, document_ids: documentIds }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createPlan(params: { subject: string; deadline?: string }) {
    const res = await fetch(`${getBaseUrl()}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async uploadDocument(formData: FormData) {
    const res = await fetch(`${getBaseUrl()}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
