"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, Search, AlertTriangle, RefreshCw, Globe, Sparkles } from "lucide-react";

interface AgentProgressProps {
  location: string;
  bhk: string;
  onComplete?: () => void;
}

const SEARCH_STAGES = [
  { min: 0, max: 20, icon: "🔍", label: "Discovering listings" },
  { min: 20, max: 40, icon: "🌐", label: "Searching property sites" },
  { min: 40, max: 70, icon: "🤖", label: "AI extracting details" },
  { min: 70, max: 90, icon: "📊", label: "Validating & persisting" },
  { min: 90, max: 100, icon: "✨", label: "Generating AI insights" },
];

function getCurrentStage(progress: number) {
  return SEARCH_STAGES.find((s) => progress >= s.min && progress < s.max) || SEARCH_STAGES[SEARCH_STAGES.length - 1];
}

export function AgentProgress({ location, bhk, onComplete }: AgentProgressProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Connecting to Griha AI Agent...");
  const [logs, setLogs] = useState<string[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  // Refs to avoid stale closures in WS callbacks
  const isCompleteRef = useRef(false);
  const progressRef = useRef(0);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startPolling = useCallback(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    setError(null);
    setStatus("Connecting to Griha AI Agent...");
    setLogs((prev) => [...prev, "Starting search task"]);

    fetch(`${apiBase}/api/scrape/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, bhk }),
    })
      .then((r) => r.json())
      .then(({ job_id }) => {
        if (!job_id) throw new Error("No job_id returned");
        if (!isMounted) return;

        setStatus("Connected! Starting live search...");

        pollInterval = setInterval(async () => {
          try {
            const res = await fetch(`${apiBase}/api/scrape/status/${job_id}`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.progress !== undefined) {
              setProgress(data.progress);
              progressRef.current = data.progress;
            }
            if (data.status) {
              setStatus(data.status);
              setLogs((prev) => [...prev, data.status]);
            }
            if (data.found_count !== undefined) {
              setFoundCount(data.found_count);
            }

            if (data.done || data.progress >= 100) {
              if (pollInterval) clearInterval(pollInterval);
              isCompleteRef.current = true;
              setIsComplete(true);
              setTimeout(() => {
                if (isMounted) onComplete?.();
              }, 2500);
            }

            if (data.error) {
              if (pollInterval) clearInterval(pollInterval);
              setError(data.error);
              setLogs((prev) => [...prev, "⚠️ Error occurred"]);
            }
          } catch {
            // keep polling on transient errors
          }
        }, 2000);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError("Connection error. The backend may not be running.");
        setLogs((prev) => [...prev, "⚠️ Connection failed"]);
      });

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [location, bhk, onComplete]);

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [retryCount, startPolling]);

  const handleRetry = () => {
    isCompleteRef.current = false;
    progressRef.current = 0;
    setError(null);
    setProgress(0);
    setStatus("Reconnecting...");
    setFoundCount(0);
    setIsComplete(false);
    setLogs([]);
    setRetryCount((c) => c + 1);
  };

  const stage = getCurrentStage(progress);

  return (
    <div className="w-full max-w-2xl mx-auto bg-surface border border-border-custom rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-border-custom bg-cream">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-playfair text-2xl text-charcoal font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-warm-gold" />
              Live Scraper Agent
            </h3>
            <p className="text-sm font-dm text-muted mt-1">
              Searching {bhk} in {location} across Indian real estate sites
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-forest/10 flex items-center justify-center">
            {isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : error ? (
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            ) : (
              <Search className="w-6 h-6 text-forest animate-pulse" />
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Stage Indicator */}
        {!error && !isComplete && (
          <div className="flex items-center gap-3 bg-forest/5 border border-forest/10 rounded-xl px-4 py-3">
            <span className="text-2xl">{stage.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-dm font-semibold text-charcoal">{stage.label}</p>
              <p className="text-xs font-dm text-muted mt-0.5">{status}</p>
            </div>
          </div>
        )}

        {/* Success message */}
        {isComplete && foundCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-dm font-semibold text-green-800">Scraping Complete!</p>
              <p className="text-xs font-dm text-green-600 mt-0.5">{status}</p>
            </div>
          </motion.div>
        )}

        {/* No results message */}
        {isComplete && foundCount === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3"
          >
            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-dm font-semibold text-orange-800">No Properties Found</p>
              <p className="text-xs font-dm text-orange-600 mt-0.5">{status}</p>
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-4">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <p className="text-sm font-dm font-semibold text-orange-800 text-center">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-lg font-dm text-sm hover:bg-forest-light transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm font-dm font-semibold text-charcoal mb-2">
            <span>{isComplete ? "Complete" : "Searching..."}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-border-custom rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isComplete && foundCount > 0
                  ? "bg-green-500"
                  : error
                    ? "bg-orange-400"
                    : "bg-forest"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-cream border border-border-custom p-3 rounded-xl text-center">
            <p className="text-[10px] font-dm text-muted uppercase tracking-wider mb-1">Properties</p>
            <p className="font-playfair text-2xl text-charcoal">{foundCount}</p>
          </div>
          <div className="bg-cream border border-border-custom p-3 rounded-xl text-center">
            <p className="text-[10px] font-dm text-muted uppercase tracking-wider mb-1">Sites Searched</p>
            <p className="font-playfair text-2xl text-charcoal">
              {progress < 20 ? 0 : progress < 40 ? 2 : progress < 60 ? 3 : 4}
            </p>
          </div>
          <div className="bg-cream border border-border-custom p-3 rounded-xl text-center">
            <p className="text-[10px] font-dm text-muted uppercase tracking-wider mb-1">AI Extractions</p>
            <p className="font-playfair text-2xl text-charcoal">
              {progress < 40 ? 0 : foundCount}
            </p>
          </div>
        </div>

        {/* Sites being searched */}
        {!isComplete && !error && progress > 10 && (
          <div className="flex flex-wrap gap-2">
            {["MagicBricks", "99acres", "Housing.com", "NoBroker"].map((site, i) => {
              const active = progress > 15 + i * 12;
              return (
                <div
                  key={site}
                  className={`flex items-center gap-1.5 text-xs font-dm px-3 py-1.5 rounded-full border transition-all ${
                    active
                      ? "bg-forest/10 border-forest/20 text-forest"
                      : "bg-cream border-border-custom text-muted"
                  }`}
                >
                  <Globe className={`w-3 h-3 ${active ? "animate-pulse" : ""}`} />
                  {site}
                </div>
              );
            })}
          </div>
        )}

        {/* Terminal Logs */}
        <div className="bg-charcoal text-white rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs space-y-1.5 relative">
          {logs.length === 0 && (
            <div className="text-white/40 text-center pt-16">Waiting for connection...</div>
          )}
          {logs.map((log, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex gap-2"
            >
              <span className="text-forest-light shrink-0">
                [{new Date().toLocaleTimeString()}]
              </span>
              <span
                className={`${
                  log.includes("⚠️") || log.includes("error")
                    ? "text-orange-300"
                    : log.includes("Found") || log.includes("Done") || log.includes("Complete")
                      ? "text-green-300"
                      : "text-white/80"
                }`}
              >
                {log}
              </span>
            </motion.div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
