"use client";

/**
 * Upload UI: sends Firebase `user_id` + `topic` so files land under
 * documents/<uid>/uploads/<topic>/ and indexes under faiss_index/<topic>/.
 */

import { useRef, useState } from "react";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { getBackendBaseUrl } from "@/services/api";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".pptx", ".ppt"];

function getFileExt(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export function UploadZone() {
  const { studyTopic } = useStudyTopic();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "indexing">("idle");
  const [results, setResults] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    const incoming = Array.from(selected);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const newFiles = incoming.filter((f) => !existing.has(f.name));
      return [...prev, ...newFiles];
    });

    e.target.value = "";
  };

  const handleClear = () => {
    setFiles([]);
    setResults([]);
    setUploadError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (dropped?.length) {
      setFiles((prev) => [...prev, ...Array.from(dropped)]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleUpload = async () => {
    if (!files.length || isUploading) return;

    const invalidFiles = files.filter(
      (f) => !ALLOWED_EXTENSIONS.includes(getFileExt(f.name))
    );

    if (invalidFiles.length) {
      setUploadError(
        `I only ingest .pdf, .txt, .doc/.docx, .ppt/.pptx—skip these: ${invalidFiles.map((f) => f.name).join(", ")}`
      );
      return;
    }

    if (!studyTopic?.trim()) {
      setUploadError("Pick a study topic on Home first—I file everything under that label.");
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setUploadError("Log in—I don’t upload into anonymous limbo.");
      return;
    }

    setIsUploading(true);
    setUploadPhase("uploading");
    setResults([]);
    setUploadError(null);

    const formatApiError = (data: unknown, fallback: string) => {
      if (!data || typeof data !== "object") return fallback;
      const d = data as { detail?: unknown };
      if (typeof d.detail === "string") return d.detail;
      if (Array.isArray(d.detail)) {
        return d.detail
          .map((e: unknown) =>
            typeof e === "object" && e !== null && "msg" in e
              ? String((e as { msg: string }).msg)
              : JSON.stringify(e)
          )
          .join("; ");
      }
      return fallback;
    };

    try {
      const baseUrl = getBackendBaseUrl();
      const form = new FormData();
      // FastAPI: declare File before Form; append file parts first in multipart.
      files.forEach((file) => form.append("files", file));
      form.append("topic", studyTopic.trim());
      form.append("user_id", uid);

      const uploadRes = await fetch(`${baseUrl}/rag/upload-multiple`, {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        throw new Error(formatApiError(data, "Upload failed on the server."));
      }

      const uploadData = await uploadRes.json();
      const names: string[] = Array.isArray(uploadData.uploaded) ? uploadData.uploaded : [];

      setResults(names.map((name: string) => `✓ Uploaded: ${name}`));

      setUploadPhase("indexing");
      setResults((prev) => [...prev, "Indexing… first run can crawl for a minute, be patient."]);

      const indexParams = new URLSearchParams({
        topic: studyTopic.trim(),
        user_id: uid,
      });
      const indexRes = await fetch(`${baseUrl}/rag/index?${indexParams.toString()}`, {
        method: "POST",
      });

      if (!indexRes.ok) {
        const data = await indexRes.json().catch(() => ({}));
        throw new Error(formatApiError(data, "Indexing failed on the server."));
      }

      const indexData = await indexRes.json();

      setResults((prev) => [
        ...prev.filter((line) => !line.startsWith("Indexing")),
        `Indexed chunks: ${indexData.indexed_chunks ?? 0}`,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something random broke—sorry.";
      const network =
        message === "Failed to fetch" ||
        message.includes("NetworkError") ||
        message.includes("Load failed");
      setUploadError(
        network
          ? `${message} I usually point at FastAPI on :8000—spin that up or check next.config rewrites. Base URL I’m using: ${getBackendBaseUrl() || "(same-origin /rag)"}.`
          : message
      );
    } finally {
      setIsUploading(false);
      setUploadPhase("idle");
    }
  };



  return (
    <div
      className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-12 text-center transition hover:border-indigo-500/40 hover:bg-slate-900/60"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.doc,.docx,.pptx,.ppt"
        className="hidden"
        onChange={handleChange}
        aria-label="Choose files to upload"
      />

      {/* Icon */}
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400" aria-hidden>
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </span>

      <h2 className="mt-4 font-display text-lg font-semibold text-white">
        Drag and drop or click to upload
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        PDF, Word, PowerPoint, or text files
      </p>
      {studyTopic?.trim() ? (
        <p className="mt-3 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-200/90">
          Files are stored under your account and topic:{" "}
          <span className="font-medium text-white">{studyTopic.trim()}</span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-amber-400/90">
          Select a study topic on Home before uploading (required for folder organization).
        </p>
      )}

      {/* Buttons */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          className="rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
        >
          Choose files
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!files.length || isUploading}
          className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-6 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          {isUploading
            ? uploadPhase === "indexing"
              ? "Indexing…"
              : "Uploading…"
            : `Upload to ScholarAI${files.length ? ` (${files.length})` : ""}`}
        </button>
      </div>

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="mt-8 text-left">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">
              Selected ({files.length})
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              Clear all
            </button>
          </div>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center justify-between text-sm text-slate-400">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="ml-2 shrink-0 text-slate-500 hover:text-rose-400 transition"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success results */}
      {results.length > 0 && (
        <ul className="mt-4 space-y-1 text-left">
          {results.map((r, i) => (
            <li key={i} className="text-sm text-emerald-300">{r}</li>
          ))}
        </ul>
      )}

      {/* Errors */}
      {uploadError && (
        <p className="mt-4 whitespace-pre-line text-sm text-rose-400">
          {uploadError}
        </p>
      )}
    </div>
  );
}
