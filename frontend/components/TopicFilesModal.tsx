"use client";

/**
 * Lists and deletes files for the active study topic via `/rag/files`. Passes Firebase
 * `user_id` so the API reads documents/<uid>/uploads/<topic>/.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getBackendBaseUrl } from "@/services/api";

type FileRow = { name: string; size: number };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type TopicFilesModalProps = {
  topic: string;
  userId: string;
  canDelete?: boolean;
  open: boolean;
  onClose: () => void;
};

export function TopicFilesModal({ topic, userId, canDelete = true, open, onClose }: TopicFilesModalProps) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    const t = topic.trim();
    const u = userId.trim();
    if (!t || !u) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ topic: t, user_id: u });
      const res = await fetch(`${getBackendBaseUrl()}/rag/files?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not load files.");
      }
      const list = Array.isArray(data.files) ? data.files : [];
      const normalized = list.filter(
        (f: unknown): f is FileRow =>
          typeof f === "object" &&
          f !== null &&
          "name" in f &&
          typeof (f as FileRow).name === "string",
      );
      if (normalized.length > 0) {
        setFiles(normalized);
      } else {
        // Hard fallback: if current uid/topic has no files, retry with cached professor owners.
        const ownerCacheValues = (() => {
          if (typeof window === "undefined") return [] as string[];
          try {
            const out = new Set<string>();
            for (let i = 0; i < localStorage.length; i += 1) {
              const key = localStorage.key(i) ?? "";
              if (!key.startsWith("scholarai_topic_professor_owner_")) continue;
              const raw = localStorage.getItem(key);
              if (!raw) continue;
              const parsed = JSON.parse(raw) as Record<string, string>;
              Object.values(parsed).forEach((id) => {
                if (id && id !== u) out.add(id);
              });
            }
            return Array.from(out);
          } catch {
            return [] as string[];
          }
        })();

        let fallbackFiles: FileRow[] = [];
        for (const fallbackUid of ownerCacheValues) {
          const fallbackParams = new URLSearchParams({ topic: t, user_id: fallbackUid });
          const fallbackRes = await fetch(`${getBackendBaseUrl()}/rag/files?${fallbackParams.toString()}`);
          const fallbackData = await fallbackRes.json().catch(() => ({}));
          if (!fallbackRes.ok) continue;
          const fallbackList = Array.isArray(fallbackData.files) ? fallbackData.files : [];
          const normalizedFallback = fallbackList.filter(
            (f: unknown): f is FileRow =>
              typeof f === "object" &&
              f !== null &&
              "name" in f &&
              typeof (f as FileRow).name === "string",
          );
          if (normalizedFallback.length > 0) {
            fallbackFiles = normalizedFallback;
            break;
          }
        }
        setFiles(fallbackFiles);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load files.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [topic, userId]);

  useEffect(() => {
    if (open && topic.trim() && userId.trim()) {
      void loadFiles();
    }
  }, [open, topic, userId, loadFiles]);

  const handleRemove = async (filename: string) => {
    if (!confirm(`Remove "${filename}" from this topic? The search index will be rebuilt.`)) return;
    setRemoving(filename);
    setError(null);
    try {
      const params = new URLSearchParams({
        topic: topic.trim(),
        user_id: userId.trim(),
        filename,
      });
      const res = await fetch(`${getBackendBaseUrl()}/rag/files?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Remove failed.");
      }
      await loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setRemoving(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-files-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 id="topic-files-title" className="text-lg font-semibold text-white">
            Files for this topic
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <p className="text-xs text-slate-500 line-clamp-2" title={topic}>
            Topic: <span className="text-slate-300">{topic.trim()}</span>
          </p>
          {loading && <p className="mt-4 text-sm text-slate-400">Loading…</p>}
          {error && (
            <p className="mt-4 text-sm text-rose-400">{error}</p>
          )}
          {!loading && !error && files.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">No files uploaded for this topic yet.</p>
          )}
          {!loading && files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100" title={f.name}>
                      {f.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(typeof f.size === "number" ? f.size : 0)}</p>
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      disabled={removing === f.name}
                      onClick={() => handleRemove(f.name)}
                      className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {removing === f.name ? "…" : "Remove"}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300">
                      Shared
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-700 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-600 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type TopicFilesButtonProps = {
  topic: string;
  userId: string;
  canDelete?: boolean;
  className?: string;
};

export function TopicFilesButton({ topic, userId, canDelete = true, className = "" }: TopicFilesButtonProps) {
  const [open, setOpen] = useState(false);
  const trimmed = topic.trim();
  const uid = userId.trim();
  if (!trimmed || !uid) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "shrink-0 rounded-xl border border-slate-600 bg-slate-900/80 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-violet-500/50 hover:bg-slate-800"
        }
      >
        Files
      </button>
      <TopicFilesModal
        topic={trimmed}
        userId={uid}
        canDelete={canDelete}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
