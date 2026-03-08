"use client";

import { useRef, useState } from "react";

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  };

  const handleClear = () => setFiles([]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (dropped?.length) setFiles((prev) => [...prev, ...Array.from(dropped)]);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

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
        accept=".pdf,.doc,.docx,.txt,.md"
        className="hidden"
        onChange={handleChange}
        aria-label="Choose files to upload"
      />
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400" aria-hidden>
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-white">Drag and drop or click to upload</h2>
      <p className="mt-2 text-sm text-slate-400">PDF, slides, or text files. Connect backend /api/upload to enable.</p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-6 rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
      >
        Choose files
      </button>
      {files.length > 0 && (
        <div className="mt-8 text-left">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">Selected ({files.length})</p>
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
              <li key={`${file.name}-${i}`} className="truncate text-sm text-slate-400">
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
