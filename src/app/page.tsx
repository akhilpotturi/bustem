"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Listing = {
  asin: string;
  url: string;
  title: string;
  brand?: string;
  price?: string;
  rating?: string;
  image?: string;
  score: number;
  scoreBreakdown: { 
    text: number; 
    image: number; 
    bonus: number 
  };
  reasons: string[];
  keyword: string;
};

type ProgressEvt = { 
  type: "progress"; 
  message: string; 
  seen: number; 
  emitted: number 
};

export default function Page() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressEvt | null>(null);
  const [results, setResults] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const sorted = useMemo(() => [...results].sort((a, b) => b.score - a.score), [results]);

  function stop() {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
  }

  function runScan() {
    setError(null);
    setResults([]);
    setProgress(null);

    const params = new URLSearchParams();
    params.set("pages", "4");
    params.set("maxPerPage", "24");
    params.set("minScore", "0.75");

    setRunning(true);
    const es = new EventSource(`/api/routes?${params.toString()}`);
    esRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as ProgressEvt;
      setProgress(data);
    });

    es.addEventListener("result", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {item: Listing};
      setResults((prev) => {
        const idx = prev.findIndex((x) => x.asin === data.item.asin);
        if (idx=== -1) return [...prev, data.item];
        if (prev[idx].score >= data.item.score) return prev;
        const copy = [...prev];
        copy[idx] = data.item;
        return copy;
      });
    });

    es.addEventListener("done", () => stop());

    es.addEventListener("error", () => {
      if (esRef.current) {
        setError("Stream disconnected.");
        stop();
      }
    });
  }

  useEffect(() => () => stop(), []);

  return (
    <main>
      <h1>Infringement Scanner: Comfrt x Amazon</h1>
      <p>
        Click <b>Run scan</b> to initiate Amazon scraping and surface listings that look similar to Comfrt products.
        Results stream in as they are found and are sorted from highest to lowest score.
      </p>

      <div className="controls">
        <button onClick={runScan} disabled={running}>Run scan</button>
        <button onClick={stop} disabled={!running} style={{ background: "white", color: "#111" }}>Stop</button>
        {running && <span className="badge">Running…</span>}
        {progress && <span className="label">{progress.message}</span>}
      </div>

      {error && <p style={{ color: "crimson" }}><b>Error:</b> {error} </p>}

      <div style={{ marginBottom: 10 }}>
        <span className="badge">Results: {sorted.length} </span>
      </div>

      <div className="grid">
        {sorted.map((r) => (
          <div key={r.asin} className="listing">
            <div className="listingHeader">
              {r.image ? (
                <img className="listingPicture" src={r.image} alt="" />
              ) : (
                <div className="listingPicture"/>
              )}
              <div>
                <p className="listingTitle">
                  <a href={r.url} target="_blank" rel="noreferrer">{r.title} </a>
                </p>

                <p className="label">
                  <span> ASIN: <b>{r.asin}</b> </span>
                </p>

                <p className="label">
                  {r.price ? <>Price: <b>{r.price}</b> </> : null}
                  {r.rating ? <> · Stars: <b>{r.rating}</b></> : null}
                </p>
                
                <div className="scoreBreakdown">
                  <span className="badge">keyword: {r.keyword}</span>
                  <span className="badge">text {Math.round(r.scoreBreakdown.text * 100)}%</span>
                  <span className="badge">image {Math.round(r.scoreBreakdown.image * 100)}%</span>
                  {r.scoreBreakdown.bonus > 0 ? <span className="badge">bonus {Math.round(r.scoreBreakdown.bonus * 100)}%</span> : null}
                </div>

                <p className="label" style={{ marginTop: 8 }}>
                  {r.reasons.slice(0, 3).join(" · ")}
                </p>

              </div>
            </div>

            <div className="listingFooter">
              <div>
                <div className="label">Infringement probability</div>
                <div className="score">{Math.round(r.score * 100)}%</div>
              </div>
              <a href={r.url} target="_blank" rel="noreferrer" className="badge">Open</a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
