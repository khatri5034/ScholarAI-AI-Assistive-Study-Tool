"use client";

import { useRef, useState } from "react";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".pptx", ".ppt"];

function getFileExt(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    const incoming = Array.from(selected);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = incoming.filter((f) => !existingNames.has(f.name));
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
    if (dropped?.length) setFiles((prev) => [...prev, ...Array.from(dropped)]);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleUpload = async () => {
    if (!files.length || isUploading) return;

    const invalidFiles = files.filter(
      (f) => !ALLOWED_EXTENSIONS.includes(getFileExt(f.name))
    );
    if (invalidFiles.length) {
      setUploadError(`Unsupported file(s): ${invalidFiles.map((f) => f.name).join(", ")}`);
      return;
    }

    setIsUploading(true);
    setResults([]);
    setUploadError(null);

    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file)); // note: "files" not "file"

      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${baseUrl}/rag/upload-multiple`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Upload failed.");
      }

      const data = await res.json();
      setResults(
        data.uploaded.map((name: string) => `✓ ${name}`)
      );
      if (data.errors?.length) {
        setUploadError(data.errors.map((e: any) => `${e.filename}: ${e.error}`).join("\n"));
      }
      // Optionally append chunk count
      if (data.indexed_chunks !== undefined) {
        setResults((prev) => [...prev, `Total chunks indexed: ${data.indexed_chunks}`]);
      }
    } catch (err: any) {
      setUploadError(err.message || "Something went wrong.");
    } finally {
      setIsUploading(false);
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
          {isUploading ? "Uploading..." : `Upload to ScholarAI${files.length ? ` (${files.length})` : ""}`}
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
