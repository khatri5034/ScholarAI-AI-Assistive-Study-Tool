"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant" | "system"; content: string };

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="ml-4 mb-2 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 mb-2 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  code: ({ children, ...props }) => (
    <code {...props} className="rounded bg-slate-700 px-1 py-0.5 text-xs font-mono text-emerald-300">
      {children}
    </code>
  ),
  h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
};

type Props = {
  messages: ChatMessage[];
  isLoading?: boolean;
  userBubbleClass?: string;
  aiBubbleClass?: string;
  emptyState?: React.ReactNode;
  copiedIndex?: number | null;
  onCopy?: (text: string, idx: number) => void;
  onEdit?: (content: string, idx: number, role: "user" | "assistant" | "system") => void;
};

export function ChatMessages({
  messages,
  isLoading,
  userBubbleClass = "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-950/40",
  aiBubbleClass = "border border-slate-700/80 bg-slate-800/95 text-slate-100 shadow-black/30",
  emptyState,
  copiedIndex,
  onCopy,
  onEdit,
}: Props) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto rounded-lg p-3">
      {messages.length === 0 && emptyState}
      {messages.map((m, idx) => (
        <div
          key={idx}
          className={m.role === "user" ? "flex justify-end" : "flex w-full flex-col items-start"}
        >
          <div className={`group relative max-w-[85%] ${m.role === "user" ? "ml-auto text-right" : "text-left"}`}>
            <div
              tabIndex={0}
              className={`rounded-2xl px-3 py-2 text-sm shadow-md outline-none ring-indigo-400/40 focus-visible:ring-2 ${
                m.role === "user"
                  ? `${userBubbleClass} whitespace-pre-wrap`
                  : aiBubbleClass
              }`}
            >
              {m.role === "user" ? (
                m.content
              ) : (
                <ReactMarkdown components={markdownComponents}>
                  {m.content}
                </ReactMarkdown>
              )}
            </div>
            {(onCopy || onEdit) && (
              <div className={`mt-1 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {onCopy && (
                  <button
                    type="button"
                    onClick={() => onCopy(m.content, idx)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/95 text-slate-200 shadow-sm hover:bg-slate-800 hover:text-white"
                    aria-label="Copy message"
                    title="Copy"
                  >
                    {copiedIndex === idx ? (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="10" height="10" rx="2" />
                        <rect x="5" y="5" width="10" height="10" rx="2" />
                      </svg>
                    )}
                    <span className="sr-only">Copy</span>
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(m.content, idx, m.role)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/95 text-slate-200 shadow-sm hover:bg-slate-800 hover:text-white"
                    aria-label={m.role === "user" ? "Edit message" : "Load into input"}
                    title="Edit"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">Edit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex items-start">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/95 px-3 py-2 text-sm text-slate-400">
            …
          </div>
        </div>
      )}
    </div>
  );
}