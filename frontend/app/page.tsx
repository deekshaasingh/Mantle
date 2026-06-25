"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      setResult("Please choose an image first.");
      return;
    }

    setLoading(true);
    setResult("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(`Success! Processed image saved as: ${data.output}`);
    } catch (err) {
      setResult("Upload failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Mantle — Image Uploader</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="border p-2 rounded"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Processing..." : "Upload & Resize"}
      </button>

      {result && <p className="text-center max-w-md">{result}</p>}
    </main>
  );
}