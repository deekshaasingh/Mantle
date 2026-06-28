"use client";

import { useState, useRef, useEffect } from "react";

const API = "http://localhost:4000";

type JobStatus = "processing" | "done" | "failed";

type Job = {
  localId: string;
  name: string;
  preview: string;
  taskId?: string;
  status: JobStatus;
  result?: any;
};

function fmtBytes(b: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const TRANSFORMS = [
  { id: "grayscale", label: "Grayscale" },
  { id: "blur", label: "Blur" },
  { id: "rotate", label: "Rotate 90°" },
];

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(80);
  const [transforms, setTransforms] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollers = useRef<Record<string, any>>({});

  async function loadHistory() {
    try {
      const res = await fetch(`${API}/uploads`);
      setHistory(await res.json());
    } catch {}
  }

  useEffect(() => {
    loadHistory();
    return () => Object.values(pollers.current).forEach(clearInterval);
  }, []);

  function toggleTransform(id: string) {
    setTransforms((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function updateJob(localId: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.localId === localId ? { ...j, ...patch } : j)));
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newJobs: Job[] = Array.from(files).map((f) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      preview: URL.createObjectURL(f),
      status: "processing" as JobStatus,
    }));

    setJobs((prev) => [...newJobs, ...prev]);
    newJobs.forEach((job, i) => uploadOne(job, files[i]));
  }

  async function uploadOne(job: Job, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("format", format);
    fd.append("quality", String(quality));
    fd.append("transforms", transforms.join(","));

    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      updateJob(job.localId, { taskId: data.id });
      poll(job.localId, data.id);
    } catch {
      updateJob(job.localId, { status: "failed" });
    }
  }

  function poll(localId: string, taskId: string) {
    pollers.current[localId] = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${taskId}`);
        const data = await res.json();
        if (data.status === "done") {
          clearInterval(pollers.current[localId]);
          updateJob(localId, { status: "done", result: data });
          loadHistory();
        } else if (data.status === "failed") {
          clearInterval(pollers.current[localId]);
          updateJob(localId, { status: "failed" });
          loadHistory();
        }
      } catch {
        clearInterval(pollers.current[localId]);
        updateJob(localId, { status: "failed" });
      }
    }, 500);
  }

  function clearJobs() {
    Object.values(pollers.current).forEach(clearInterval);
    pollers.current = {};
    setJobs([]);
  }

  const processing = jobs.filter((j) => j.status === "processing").length;

  return (
    <main className="page">
      <div className="depth" />
      <div className="wrap">
        <header className="head">
          <span className="dot" />
          <h1 className="logo">MANTLE</h1>
          <p className="tag">async media pipeline</p>
          <p className="sub">drop in a batch — every image becomes its own background job, processed in parallel</p>
        </header>

        <section className="card">
          <div className="card-inner">
            <div className="options">
              <div className="opt">
                <span className="opt-label">Format</span>
                <div className="segmented">
                  {["webp", "jpg", "png"].map((f) => (
                    <button key={f} className={`seg ${format === f ? "active" : ""}`} onClick={() => setFormat(f)}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="opt">
                <span className="opt-label">Quality <span className="q-val">{quality}</span></span>
                <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="range" />
              </div>
              <div className="opt">
                <span className="opt-label">Transforms</span>
                <div className="chips">
                  {TRANSFORMS.map((t) => (
                    <button key={t.id} className={`chip ${transforms.includes(t.id) ? "active" : ""}`} onClick={() => toggleTransform(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className="drop" onClick={() => inputRef.current?.click()}>
              <span className="plus">+</span>
              <span className="drop-main">Choose images</span>
              <span className="hint">select one or many — JPG or PNG</span>
            </button>

            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
          </div>
        </section>

        {jobs.length > 0 && (
          <section className="queue">
            <div className="queue-head">
              <h2 className="queue-title">
                Batch — {jobs.length} {jobs.length === 1 ? "image" : "images"}
                {processing > 0 && <span className="proc-count"> · {processing} processing</span>}
              </h2>
              <button className="clear" onClick={clearJobs}>Clear</button>
            </div>

            <div className="jobs">
              {jobs.map((job) => (
                <div className={`job ${job.status}`} key={job.localId}>
                  <div className="job-molten" />
                  <img src={job.preview} alt="" className="job-thumb" />
                  <div className="job-body">
                    <div className="job-top">
                      <span className="job-name">{job.name}</span>
                      <span className={`badge ${job.status}`}>{job.status}</span>
                    </div>
                    {job.status === "done" && job.result ? (
                      <div className="job-stats">
                        <span>{job.result.width}×{job.result.height}</span>
                        <span>{fmtBytes(job.result.originalSize)} → {fmtBytes(job.result.processedSize)}</span>
                        <span className="accent">{job.result.savedPercent}% smaller</span>
                        <span className="muted">{job.result.processingMs}ms</span>
                        <a className="dl-link" href={`${API}/${job.result.processedFiles.desktop}`} target="_blank" rel="noreferrer" download>download</a>
                      </div>
                    ) : job.status === "failed" ? (
                      <span className="job-err">processing failed</span>
                    ) : (
                      <span className="job-wait">processing beneath…</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="history">
            <div className="hist-head">
              <h2 className="hist-title">Recent activity</h2>
              <span className="hist-count">{history.length} jobs</span>
            </div>
            <div className="grid">
              {history.map((item) => (
                <div className="cell" key={item._id}>
                  {item.processedFiles?.thumbnail ? (
                    <a href={`${API}/${item.processedFiles.thumbnail}`} target="_blank" rel="noreferrer" className="cell-link">
                      <img src={`${API}/${item.processedFiles.thumbnail}`} alt="" className="cell-img" />
                    </a>
                  ) : (
                    <div className="cell-img placeholder"><span className="ph-icon">⌗</span></div>
                  )}
                  <span className={`badge ${item.status} cell-badge`}>{item.status}</span>
                  {item.savedPercent > 0 && <span className="cell-saved">−{item.savedPercent}%</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .page { min-height: 100vh; background: #0b0e14; color: #e8ecf4; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; position: relative; overflow-x: hidden; display: flex; align-items: flex-start; justify-content: center; padding: 64px 24px 80px; }
        .depth { position: fixed; inset: 0; background: radial-gradient(120% 80% at 50% 120%, rgba(255,107,53,0.18), rgba(226,62,87,0.06) 40%, transparent 70%); pointer-events: none; }
        .wrap { position: relative; width: 100%; max-width: 560px; }
        .head { text-align: center; margin-bottom: 40px; }
        .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #4ecdc4; box-shadow: 0 0 16px #4ecdc4; margin-bottom: 20px; }
        .logo { font-size: 64px; font-weight: 800; letter-spacing: 0.16em; margin: 0; line-height: 1; background: linear-gradient(180deg, #fff, #7a8295); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .tag { color: #ff6b35; font-size: 13px; margin: 16px 0 0; text-transform: uppercase; letter-spacing: 0.22em; font-weight: 600; }
        .sub { color: #6b7280; font-size: 14px; margin: 10px auto 0; max-width: 400px; line-height: 1.5; }
        .card { position: relative; border-radius: 20px; overflow: hidden; background: rgba(20,25,37,0.7); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .card-inner { position: relative; padding: 28px; }
        .options { display: flex; flex-direction: column; gap: 18px; margin-bottom: 22px; }
        .opt { display: flex; flex-direction: column; gap: 10px; }
        .opt-label { font-size: 12px; color: #8b93a7; text-transform: uppercase; letter-spacing: 0.08em; }
        .q-val { color: #ff6b35; margin-left: 6px; font-family: ui-monospace, monospace; }
        .segmented { display: flex; gap: 6px; }
        .seg { flex: 1; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #8b93a7; transition: all 0.2s; }
        .seg.active { background: rgba(255,107,53,0.15); border-color: rgba(255,107,53,0.5); color: #ff6b35; }
        .range { width: 100%; accent-color: #ff6b35; }
        .chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #8b93a7; transition: all 0.2s; }
        .chip.active { background: rgba(78,205,196,0.15); border-color: rgba(78,205,196,0.5); color: #4ecdc4; }
        .drop { width: 100%; border: 1.5px dashed rgba(255,255,255,0.15); background: transparent; color: #e8ecf4; border-radius: 14px; padding: 48px 20px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: border-color 0.2s, background 0.2s; }
        .drop:hover { border-color: rgba(255,107,53,0.5); background: rgba(255,107,53,0.04); }
        .plus { font-size: 36px; color: #ff6b35; line-height: 1; }
        .drop-main { font-size: 16px; font-weight: 600; }
        .hint { font-size: 12px; color: #6b7280; }
        .badge { font-family: ui-monospace, monospace; font-size: 11px; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
        .badge.processing { background: rgba(255,107,53,0.15); color: #ff6b35; }
        .badge.done { background: rgba(78,205,196,0.15); color: #4ecdc4; }
        .badge.failed { background: rgba(226,62,87,0.15); color: #e23e57; }
        .queue { margin-top: 32px; }
        .queue-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
        .queue-title { font-size: 14px; color: #e8ecf4; margin: 0; font-weight: 600; }
        .proc-count { color: #ff6b35; font-weight: 400; }
        .clear { background: none; border: none; color: #6b7280; cursor: pointer; font-size: 12px; text-decoration: underline; }
        .jobs { display: flex; flex-direction: column; gap: 10px; }
        .job { position: relative; display: flex; gap: 14px; align-items: center; padding: 12px; background: rgba(20,25,37,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; }
        .job-molten { position: absolute; inset: 0; opacity: 0; transition: opacity 0.5s; background: linear-gradient(120deg, #ff6b35, #e23e57, #ff6b35); background-size: 200% 200%; filter: blur(36px); }
        .job.processing .job-molten { opacity: 0.3; animation: churn 3s ease infinite; }
        @keyframes churn { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .job-thumb { position: relative; width: 56px; height: 56px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .job-body { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .job-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .job-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .job-stats { display: flex; align-items: center; gap: 12px; font-size: 11px; color: #8b93a7; font-family: ui-monospace, monospace; flex-wrap: wrap; }
        .job-stats .accent { color: #4ecdc4; }
        .job-stats .muted { color: #6b7280; }
        .dl-link { color: #ff6b35; text-decoration: none; }
        .dl-link:hover { text-decoration: underline; }
        .job-wait { font-size: 11px; color: #ff6b35; }
        .job-err { font-size: 11px; color: #e23e57; }
        .history { margin-top: 48px; }
        .hist-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
        .hist-title { font-size: 13px; color: #8b93a7; text-transform: uppercase; letter-spacing: 0.12em; margin: 0; font-weight: 600; }
        .hist-count { font-size: 12px; color: #6b7280; font-family: ui-monospace, monospace; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .cell { position: relative; border-radius: 12px; overflow: hidden; }
        .cell-link { display: block; }
        .cell-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; transition: transform 0.3s ease; }
        .cell-link:hover .cell-img { transform: scale(1.08); }
        .placeholder { display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); }
        .ph-icon { color: rgba(255,255,255,0.15); font-size: 22px; }
        .cell-badge { position: absolute; bottom: 7px; left: 7px; font-size: 9px; padding: 2px 7px; backdrop-filter: blur(8px); }
        .cell-saved { position: absolute; top: 7px; right: 7px; font-size: 9px; padding: 2px 6px; border-radius: 20px; background: rgba(78,205,196,0.2); color: #4ecdc4; font-family: ui-monospace, monospace; backdrop-filter: blur(8px); }
        @media (max-width: 480px) { .logo { font-size: 48px; } .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (prefers-reduced-motion: reduce) { .job.processing .job-molten { animation: none; } }
      `}</style>
    </main>
  );
}