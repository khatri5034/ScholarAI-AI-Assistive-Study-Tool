from __future__ import annotations

"""
Agent prompts + orchestration live here—not in `main.py`—so HTTP stays thin and prompt
text can evolve without redeploying route wiring.
"""

import os
from typing import Callable

from .model import call_model

# ------------------------
# RAG SETUP
# ------------------------
try:
    from services.rag import RAGService, format_rag_context
except Exception:
    # Relative import path when this package is loaded as `backend.agents` (e.g. tests).
    from ..services.rag import RAGService, format_rag_context

rag = None

try:
    rag = RAGService(documents_root=os.getenv("RAG_DOCUMENTS_ROOT", "documents"))
except Exception:
    # Degraded mode: import-time RAG failure should not brick the whole module for unit contexts.
    rag = None

# Caps chosen for Gemini context windows: leave headroom for instructions + student message.
_MAX_RAG_CONTEXT_CHARS = 48_000
# Planner/week modes pack long rubrics; smaller RAG slice trades some recall for reliability.
_PLANNER_RAG_CONTEXT_CHARS = 36_000
_PLANNER_RAG_TOP_K = 7

# Plain-text rules: UI renders student-facing strings without a markdown pipeline—models
# must not emit `**` or `#` that would look broken in ChatBox / StudyPlanner.
STUDENT_PLAIN_OUTPUT_RULES = """
OUTPUT FORMATTING (mandatory for everything you write to the student):
- Plain text only. Do NOT use markdown: no #, ##, or ### at the start of a line; no lines made only of ---, ***, or ___.
- Do NOT use double-asterisk "bold" (no **text**). Do NOT use *italic* or __underline__ markdown.
- Do NOT use markdown bullets (no "- " or "* " at the start of lines). Use numbered lines like "1." "2." or short paragraphs separated by a blank line.
- Major section titles: one line in ALL CAPS (e.g. EXAM, ANSWER KEY, STUDY PLAN OVERVIEW), then a blank line, then the body.
- To stress a word, use plain English ("Important:") or a single CAPITALIZED word sparingly—not asterisks.
- No code fences, no markdown tables.

VOICE (mandatory):
- Write like a sharp classmate explaining things over coffee: direct, concrete, human. No chatbot filler ("I'd be happy to", "Certainly!", "As an AI", "In conclusion").
- No corporate help-desk tone. Skip hedging stacks ("It is worth noting that…"). Say what you mean in plain words.
"""

PLANNER_OUTPUT_RULES = (
    STUDENT_PLAIN_OUTPUT_RULES
    + """
For study plans: use ALL CAPS section headers such as STUDY PLAN OVERVIEW and WEEK 1 — DETAILED STUDY GUIDE (one header line each), blank line, then numbered lines or short paragraphs.
"""
)

QUIZ_OUTPUT_RULES = (
    STUDENT_PLAIN_OUTPUT_RULES
    + """
For quizzes: use two sections in order. First line exactly: EXAM (all caps), blank line, then questions. Then first line exactly: ANSWER KEY (all caps), blank line, then numbered answers matching the exam. Leave a blank line between each numbered question for readability.
"""
)

_QUIZ_FORMAT_MCQ = (
    "4. Format — Exactly 8–10 numbered items. Every item is multiple choice only: four options labeled A, B, C, and D "
    "with exactly one best answer. Do not include short-answer or essay prompts.\n"
    "5. Tone — Upper-level undergraduate or early graduate difficulty: challenging, precise, fair — like a midterm or final, not a pop quiz.\n"
    "6. Answer key — After EXAM, the ANSWER KEY section must list each question number with the correct letter (A–D) plus one short line of justification where helpful.\n"
)

_QUIZ_FORMAT_SHORT = (
    "4. Format — Exactly 8–10 numbered items. Every item is short answer only: the student writes a few sentences "
    "(reasoning, derivation, comparison, or application). Do not use multiple-choice options or A–D lists.\n"
    "5. Tone — Upper-level undergraduate or early graduate difficulty: challenging, precise, fair — like a midterm or final, not a pop quiz.\n"
    "6. Answer key — After EXAM, the ANSWER KEY section must give concise model answers or numbered points that would earn full credit for each item.\n"
)

_QUIZ_FORMAT_MIXED = (
    "4. Format — 8–10 numbered items. Mix multiple choice (four options labeled A–D, one best answer) with short answer "
    "(a few sentences) where a professor would expect written reasoning. One question may be a brief scenario with sub-parts if it raises the rigor.\n"
    "5. Tone — Upper-level undergraduate or early graduate difficulty: challenging, precise, fair — like a midterm or final, not a pop quiz.\n"
    "6. Answer key — After EXAM, the ANSWER KEY section must give concise correct answers; for short answers, a brief model response or numbered required points (what earns full credit). For MC, state the letter plus one line of justification where helpful.\n"
)


# ------------------------
# LLM WRAPPER
# ------------------------
def llm(prompt: str) -> str:
    try:
        return call_model(prompt).strip()
    except Exception as e:
        # Prefix keeps agent code free of FastAPI imports while `main.py` maps errors to JSON fields.
        return f"LLM_ERROR: {e}"


# ------------------------
# RAG CONTEXT
# ------------------------
def get_context(
    user_input: str,
    user_id: str,
    topic: str,
    *,
    top_k: int | None = None,
    max_chars: int | None = None,
):
    if not rag:
        return None

    tk = top_k if top_k is not None else 6
    cap = max_chars if max_chars is not None else _MAX_RAG_CONTEXT_CHARS

    try:
        summary = rag.get_topic_summary(user_id, topic)
        chunks = rag.query(
            question=user_input,
            top_k=tk,
            user_folder=user_id,
            topic_folder=topic,
        )
        ctx = format_rag_context(chunks, summary=summary)
        if not ctx.strip():
            return None
        if len(ctx) > cap:
            ctx = (
                ctx[: cap - 120]
                + "\n\n[… reference material truncated for model limits …]"
            )
        return ctx

    except Exception:
        return None


def get_context_for_planner(user_input: str, user_id: str, topic: str):
    """Smaller retrieval bundle for planner modes (long system prompts)."""
    return get_context(
        user_input,
        user_id,
        topic,
        top_k=_PLANNER_RAG_TOP_K,
        max_chars=_PLANNER_RAG_CONTEXT_CHARS,
    )


# ------------------------
# INTENT DETECTION
# ------------------------
def detect_intent(user_input: str) -> str:
    prompt = f"""
Classify intent:
chat | planner | quiz | evaluate

Input: {user_input}
Return one word.
"""
    response = llm(prompt).lower()

    if "plan" in response:
        return "planner"
    elif "quiz" in response:
        return "quiz"
    elif "evaluate" in response:
        return "evaluate"
    else:
        return "chat"


# ------------------------
# AGENTS
# ------------------------
def chat_agent(user_input, user_id, topic, context):
    return llm(user_input)


def answer_agent(user_input, user_id, topic, context):
    if context:
        prompt = f"""
You are a study assistant.

Explain the topic clearly using the context below.

CONTEXT:
{context}

QUESTION:
{user_input}

RULES:
- Keep answer SHORT (5–8 lines max)
- Use bullet points
- Use clean structure like no **., __ or other markdown formatting
- bold out the key ideas
- Focus on key ideas only
- No long paragraphs
"""
    else:
        prompt = f"""
Explain this clearly in short bullet points:

{user_input}

RULES:
- Max 5–8 lines
- Simple explanation
"""
    return llm(prompt)


def plan_chat_agent(user_input, user_id, topic, context):
    """
    Follow-up Q&A after the student has a generated planner: combines plan excerpt in the
    user message with optional RAG chunks from course materials.
    """
    if context:
        prompt = f"""You are a supportive tutor. The student is viewing a generated study plan and asking follow-up questions about the plan, ideas, concepts, or how to study.

RETRIEVED COURSE MATERIAL (for grounding when relevant):
{context}

STUDENT MESSAGE (includes an excerpt of their current plan and their question):
{user_input}

RULES:
- Answer in clear language. Use short paragraphs and/or numbered lines as fits the question.
- Tie answers to their plan when relevant, and to the course material above when it helps.
- If they ask about a concept, explain it plainly and how it fits their week or roadmap.
- If something is not in the materials, say so briefly and still give general study advice.
- Do not rewrite their entire plan unless they ask for a revision.

{PLANNER_OUTPUT_RULES}
"""
    else:
        prompt = f"""You are a supportive tutor. The student has a study plan excerpt and a question below.

{user_input}

Answer clearly about the plan, concepts, and study strategies. Use numbered lines or short paragraphs. No course PDFs were retrieved—give general guidance tied to what they pasted.

{PLANNER_OUTPUT_RULES}
"""

    return llm(prompt)


def planner_agent(user_input, user_id, topic, context):
    """
    First-step planner: high-level overview plus first unit deep-dive only.
    Later units use `planner_week_agent` from the UI.
    """
    focus = (user_input or "").strip() or "General study schedule aligned to the course materials."
    if context:
        prompt = f"""You are an expert academic coach. Use the reference material to build a structured study roadmap.

REFERENCE MATERIAL:
{context}

STUDENT REQUEST / FOCUS: {focus}
TOPIC LABEL: {topic}

{PLANNER_OUTPUT_RULES}

CADENCE SELECTION (mandatory):
- Infer the study cadence from the student's request and focus:
  - If they asked for days (e.g., "3-day plan"), use DAY labels.
  - If they asked for weeks, use WEEK labels.
  - If unclear, use WEEK labels.

CONTENT — use two sections in this order (ALL CAPS title line, blank line, then body):

STUDY PLAN OVERVIEW
1. Goals, suggested pacing (by week or phase), and how the student should use this document.
2. A short roadmap: for each week or phase, one or two numbered lines only (no deep teaching here).

FIRST UNIT — DETAILED STUDY GUIDE
1. Key concepts, plain-language definitions, why they matter, and how ideas connect.
2. Deeper explanations for a motivated student (not label-only one-liners).
3. Short PRACTICE, SELF-CHECK, or REFLECTION prompts as numbered lines.
4. If cadence is DAY, title this as DAY 1 — DETAILED STUDY GUIDE.
5. If cadence is WEEK, title this as WEEK 1 — DETAILED STUDY GUIDE.
6. If cadence is neither clearly day nor week, title this as PHASE 1 — DETAILED STUDY GUIDE.

End with one short sentence that they can generate the next unit (Day 2 or Week 2, matching cadence) in the app—do not write unit 2+ content here.
"""
    else:
        prompt = f"""You are an expert academic coach.

STUDENT REQUEST / FOCUS: {focus}
TOPIC: {topic}

{PLANNER_OUTPUT_RULES}

CADENCE SELECTION (mandatory):
- If they asked for days, use DAY labels.
- If they asked for weeks, use WEEK labels.
- If unclear, use WEEK labels.

CONTENT — same two sections (ALL CAPS title, blank line, numbered lines or short paragraphs):

STUDY PLAN OVERVIEW
High-level goals, pacing, and a brief roadmap of weeks or phases (no deep detail here).

FIRST UNIT — DETAILED STUDY GUIDE
Full explanations, why concepts matter, connections, practice prompts—same depth as when reference material exists.

Title the detailed section as DAY 1, WEEK 1, or PHASE 1 to match selected cadence.
One closing sentence: the student can generate the next matching unit from the app next—do not include unit 2+ detail in this reply.
"""

    return llm(prompt)


def planner_week_agent(user_input, user_id, topic, context):
    """
    Subsequent steps: one unit at a time, full depth, grounded in RAG when available.
    """
    instruction = (user_input or "").strip()
    if not instruction:
        instruction = "Generate the next week's detailed study guide."
    if context:
        prompt = f"""You are an expert academic coach. The student already has a plan overview and prior unit guides. Produce ONLY the unit requested—do not repeat the full roadmap or rewrite earlier units in full.

REFERENCE MATERIAL:
{context}

TOPIC: {topic}

INSTRUCTION (which unit and any focus—follow it exactly):
{instruction}

{PLANNER_OUTPUT_RULES}

OPENING LINE — exactly one line in ALL CAPS, matching the requested cadence, for example:

WEEK 3 — DETAILED STUDY GUIDE

(use the correct unit label and number from the instruction, e.g., DAY 2, WEEK 3, PHASE 2). Blank line, then the body. Include:
1. Clear learning objectives for this unit only (numbered).
2. Thorough explanations of each major idea (why and how), not just terms — use numbered lines or short paragraphs.
3. Common pitfalls and how to avoid them (numbered).
4. Short practice, self-check, or reflection tasks (numbered).
5. At most one short paragraph linking backward to prior units (no duplication of their full content).

Write for deeper student understanding, like course notes plus a caring TA.
"""
    else:
        prompt = f"""You are an expert academic coach.

TOPIC: {topic}

INSTRUCTION:
{instruction}

{PLANNER_OUTPUT_RULES}

Output one section. First line only: ALL CAPS title [UNIT] [N] — DETAILED STUDY GUIDE (correct unit label and N from the instruction), blank line, then full depth: objectives, explanations, pitfalls, practice—same structure as when reference material exists. Use numbered lines, not markdown bullets.
"""

    return llm(prompt)


def quiz_agent(user_input, user_id, topic, context, *, quiz_format: str | None = None):
    fmt = (quiz_format or "").strip().lower()
    if fmt == "mcq":
        format_block = _QUIZ_FORMAT_MCQ
        reasoning_line = (
            "3. Reasoning — Design stems and distractors so the student must compare mechanisms, trade-offs, "
            "causal chains, or edge cases; wrong options should reflect plausible misconceptions.\n"
        )
        requirements_extra = (
            "- Every question is multiple choice (A–D) with one best answer; stems demand analysis, not glossary recall.\n"
            "- Original exam-quality wording throughout.\n"
        )
    elif fmt == "short_answer":
        format_block = _QUIZ_FORMAT_SHORT
        reasoning_line = (
            "3. Reasoning — Several items must explicitly ask why or how; include comparisons, limits of an approach, "
            "or application to a short hypothetical.\n"
        )
        requirements_extra = (
            "- Every question requires a short written response (a few sentences); no A–D options.\n"
            "- Original exam-quality prose throughout.\n"
        )
    else:
        format_block = _QUIZ_FORMAT_MIXED
        reasoning_line = (
            "3. Reasoning — Include several questions that explicitly ask why or how (causality, mechanisms, "
            "trade-offs, consequences, limits of an approach).\n"
        )
        requirements_extra = (
            "- 8–10 numbered questions; combine multiple choice (A–D) and short answer as appropriate for the subject.\n"
            "- Original exam-quality prose throughout.\n"
        )

    if context:
        prompt = f"""You are an experienced professor writing a formal written exam. The excerpts below define what topics may be assessed — they are not a script to quote.

REFERENCE MATERIAL (for topical coverage only):
{context}

FOCUS FROM THE STUDENT (may be empty; use as emphasis only):
{user_input}

{QUIZ_OUTPUT_RULES}

EXAM DESIGN RULES:
1. Depth over recall — Questions must require explaining relationships, justifying claims, comparing ideas, or applying concepts to a new situation. Avoid “what is the definition of…” unless paired with a follow-up that demands reasoning.
2. No verbatim reuse — Do not copy distinctive phrases, bullet lists, or sentence fragments from the excerpts. Every question and every answer choice must be new wording that could not be found by searching the text.
{reasoning_line}{format_block}
Keep the document clean and free of meta-commentary (“here is your quiz”).
"""
    else:
        prompt = f"""You are an experienced professor writing a formal exam on: {user_input}

{QUIZ_OUTPUT_RULES}

REQUIREMENTS:
- Test understanding, analysis, and reasoning — not trivia. Include why and how questions, comparisons, and at least one item that requires applying an idea to a hypothetical or edge case.
{requirements_extra}- End with the ANSWER KEY section (ALL CAPS header line as specified above).

Upper-undergraduate difficulty. No text copied from generic study guides — write as if you authored the course.
"""

    return llm(prompt)


def quiz_explain_agent(user_input, user_id, topic, context):
    if context:
        prompt = f"""You are a precise tutor helping a student understand one quiz item.

COURSE CONTEXT:
{context}

QUIZ ITEM + ANSWER KEY SNIPPET:
{user_input}

TASK:
1. Restate the correct answer briefly.
2. Explain why that answer is correct (concept + reasoning path).
3. For multiple-choice items, explain why each other option is wrong in one short line each.
4. End with one "watch out for this mistake" line.

Keep it concise and practical for study review.

{STUDENT_PLAIN_OUTPUT_RULES}
"""
    else:
        prompt = f"""You are a precise tutor helping a student understand one quiz item.

QUIZ ITEM + ANSWER KEY SNIPPET:
{user_input}

TASK:
1. Restate the correct answer briefly.
2. Explain why that answer is correct (concept + reasoning path).
3. For multiple-choice items, explain why each other option is wrong in one short line each.
4. End with one "watch out for this mistake" line.

Keep it concise and practical for study review.

{STUDENT_PLAIN_OUTPUT_RULES}
"""
    return llm(prompt)


def evaluator_agent(user_input, user_id, topic, context):
    prompt = f"""
Evaluate the student's answer.

Answer:
{user_input}

Give output in this format:

✔ Correct:
- ...

❌ Missing / Incorrect:
- ...

💡 Improve:
- ...

Keep it SHORT.
"""
    return llm(prompt)


# ------------------------
# ORCHESTRATOR
# ------------------------
def orchestrator(user_input: str, user_id: str, topic: str) -> str:
    if not user_input.strip():
        return "Say something—I can’t read your mind."

    context = get_context(user_input, user_id, topic)

    intent = detect_intent(user_input)

    handlers: dict[str, Callable] = {
        "chat": chat_agent,
        "planner": planner_agent,
        "quiz": quiz_agent,
        "quiz_explain": quiz_explain_agent,
        "evaluate": evaluator_agent,
    }

    response = handlers.get(intent, answer_agent)(
        user_input, user_id, topic, context
    )

    return f"[{intent.upper()}]\n\n{response}"
