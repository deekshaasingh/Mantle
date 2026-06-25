"use client";

import { useState, useRef, useEffect } from "react";

const API = "http://localhost:4000";

type Status = "idle" | "processing" | "done" | "failed";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [taskId, setTaskId] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<any>(null);

  function pick(f: File | null) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("idle");
    setResult(null);
  }

  async function upload() {
    if (!file) return;
    setStatus("processing");
    setResult(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setTaskId(data.id);
      poll(data.id);
    } catch {
      setStatus("failed");
    }
  }

  function poll(id: string) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${id}`);
        const data = await res.json();
        if (data.status === "done") {
          clearInterval(pollRef.current);
          setStatus("done");
          setResult(data);
        } else if (data.status === "failed") {
          clearInterval(pollRef.current);
          setStatus("failed");
        }
      } catch {
        clearInterval(pollRef.current);
        setStatus("failed");
      }
    }, 500);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  return (
    <main className="page">
      <div className="depth" />
      <div className="wrap">
        <header className="head">
          <span className="dot" />
          <h1 className="logo">MANTLE</h1>
          <p className="tag">async media pipeline — heavy work runs beneath the surface</p>
        </header>

        <section className={`card ${status}`}>
          <div className="molten" />
          <div className="card-inner">
            {!preview ? (
              <button className="drop" onClick={() => inputRef.current?.click()}>
                <span className="plus">+</span>
                <span>Choose an image</span>
                <span className="hint">JPG or PNG</span>
              </button>
            ) : (
              <div className="stage">
                <img src={preview} alt="preview" className="thumb" />
                <div className="meta">
                  <div className="row">
                    <span className="k">file</span>
                    <span className="v">{file?.name}</span>
                  </div>
                  <div className="row">
                    <span className="k">status</span>
                    <span className={`badge ${status}`}>{status}</span>
                  </div>
                  {taskId && (
                    <div className="row">
                      <span className="k">task</span>
                      <span className="v mono">{taskId.slice(0, 12)}…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />

            {preview && status !== "done" && (
              <button className="go" onClick={upload} disabled={status === "processing"}>
                {status === "processing" ? "Processing beneath…" : "Process image"}
              </button>
            )}

            {status === "done" && result && (
              <div className="outputs">
                <p className="cooled">Cooled & ready — {Object.keys(result.processedFiles).length} sizes generated</p>
                <div className="files">
                  {Object.entries(result.processedFiles).map(([label, path]: any) => (
                    <div className="file" key={label}>
                      <span className="label">{label}</span>
                      <span className="path mono">{path}</span>
                    </div>
                  ))}
                </div>
                <button className="again" onClick={() => { setFile(null); setPreview(""); setStatus("idle"); setResult(null); }}>
                  Process another
                </button>
              </div>
            )}

            {status === "failed" && <p className="err">Processing failed. Try another image.</p>}
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0b0e14;
          color: #e8ecf4;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .depth {
          position: absolute;
          inset: 0;
          background: radial-gradient(120% 80% at 50% 120%, rgba(255,107,53,0.18), rgba(226,62,87,0.06) 40%, transparent 70%);
          pointer-events: none;
        }
        .wrap { position: relative; width: 100%; max-width: 520px; }
        .head { text-align: center; margin-bottom: 28px; }
        .dot {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          background: #4ecdc4; box-shadow: 0 0 12px #4ecdc4; margin-bottom: 14px;
        }
        .logo {
          font-size: 38px; font-weight: 800; letter-spacing: 0.18em; margin: 0;
          background: linear-gradient(180deg, #fff, #8b93a7);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .tag { color: #6b7280; font-size: 13px; margin: 8px 0 0; }
        .card {
          position: relative; border-radius: 20px; overflow: hidden;
          background: rgba(20,25,37,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .molten {
          position: absolute; inset: 0; opacity: 0; transition: opacity 0.6s;
          background: linear-gradient(120deg, #ff6b35, #e23e57, #ff6b35);
          background-size: 200% 200%;
          filter: blur(40px);
        }
        .card.processing .molten { opacity: 0.35; animation: churn 3s ease infinite; }
        @keyframes churn {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .card-inner { position: relative; padding: 28px; }
        .drop {
          width: 100%; border: 1.5px dashed rgba(255,255,255,0.15);
          background: transparent; color: #e8ecf4; border-radius: 14px;
          padding: 48px 20px; cursor: pointer; display: flex; flex-direction: column;
          align-items: center; gap: 8px; transition: border-color 0.2s, background 0.2s;
        }
        .drop:hover { border-color: rgba(255,107,53,0.5); background: rgba(255,107,53,0.04); }
        .plus { font-size: 32px; color: #ff6b35; }
        .hint { font-size: 12px; color: #6b7280; }
        .stage { display: flex; gap: 18px; align-items: center; }
        .thumb { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .meta { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .k { color: #6b7280; }
        .v { color: #e8ecf4; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
        .badge {
          font-family: ui-monospace, monospace; font-size: 11px; padding: 3px 10px;
          border-radius: 20px; text-transform: uppercase; letter-spacing: 0.08em;
        }
        .badge.idle { background: rgba(255,255,255,0.08); color: #8b93a7; }
        .badge.processing { background: rgba(255,107,53,0.15); color: #ff6b35; }
        .badge.done { background: rgba(78,205,196,0.15); color: #4ecdc4; }
        .badge.failed { background: rgba(226,62,87,0.15); color: #e23e57; }
        .go, .again {
          width: 100%; margin-top: 22px; padding: 14px; border-radius: 12px;
          border: none; cursor: pointer; font-size: 15px; font-weight: 600;
          background: linear-gradient(135deg, #ff6b35, #e23e57); color: #fff;
          transition: transform 0.15s, opacity 0.2s;
        }
        .go:hover, .again:hover { transform: translateY(-1px); }
        .go:disabled { opacity: 0.7; cursor: default; transform: none; }
        .again { background: rgba(255,255,255,0.08); }
        .outputs { margin-top: 22px; }
        .cooled { color: #4ecdc4; font-size: 14px; margin: 0 0 14px; }
        .files { display: flex; flex-direction: column; gap: 8px; }
        .file {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 14px; background: rgba(255,255,255,0.04);
          border-radius: 10px; font-size: 12px;
        }
        .label { color: #4ecdc4; text-transform: uppercase; letter-spacing: 0.06em; }
        .path { color: #8b93a7; }
        .err { color: #e23e57; font-size: 14px; margin: 18px 0 0; text-align: center; }
        @media (prefers-reduced-motion: reduce) {
          .card.processing .molten { animation: none; }
        }
      `}</style>
    </main>
  );
}