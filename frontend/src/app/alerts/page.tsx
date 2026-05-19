"use client";

import { Suspense, useEffect, useState } from "react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  TrendingDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  BarChart2,
  MapPin,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface PriceAlert {
  id: string;
  label: string;
  property_id: string | null;
  property_image: string | null;
  property_locality: string | null;
  property_bhk: string | null;
  target_price: number;
  original_price: number;
  savings_amount: number;
  savings_pct: number;
  is_active: boolean;
  triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  price_history: { price: number; checked_at: string }[];
  created_at: string;
}

function SparklineBadge({ history }: { history: { price: number; checked_at: string }[] }) {
  if (!history || history.length < 2) return null;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const isDropping = prices[prices.length - 1] < prices[0];

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="opacity-80">
        <polyline
          points={points}
          fill="none"
          stroke={isDropping ? "#16a34a" : "#d97706"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Latest dot */}
        <circle
          cx={w}
          cy={h - ((prices[prices.length - 1] - min) / range) * (h - 4) - 2}
          r="3"
          fill={isDropping ? "#16a34a" : "#d97706"}
        />
      </svg>
      <span className={`text-[11px] font-dm font-semibold ${isDropping ? "text-success" : "text-warm-gold"}`}>
        {isDropping ? "↓ Dropping" : "→ Stable"}
      </span>
    </div>
  );
}

function AlertCard({ alert, onDelete, onCheck }: { alert: PriceAlert; onDelete: (id: string) => void; onCheck: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const dropPct = alert.savings_pct;
  const isTriggered = alert.triggered;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`bg-surface border rounded-2xl overflow-hidden transition-all ${
        isTriggered
          ? "border-success/40 bg-success/5"
          : "border-border-custom hover:border-warm-gold/30"
      }`}
    >
      <div className="flex gap-4 p-4">
        {/* Property image or placeholder */}
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-sand">
          {alert.property_image ? (
            <img src={alert.property_image} alt={alert.label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-forest/10">
              <MapPin className="w-6 h-6 text-forest" />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-dm font-semibold text-charcoal text-sm leading-tight line-clamp-1">{alert.label}</p>
              {alert.property_locality && (
                <p className="text-[11px] text-muted font-dm flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {alert.property_locality}
                  {alert.property_bhk && ` · ${alert.property_bhk}`}
                </p>
              )}
            </div>

            {/* Status badge */}
            {isTriggered ? (
              <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Triggered!
              </span>
            ) : (
              <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-warm-gold bg-warm-gold/10 px-2 py-0.5 rounded-full">
                <BellRing className="w-3 h-3" /> Watching
              </span>
            )}
          </div>

          {/* Price details */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted font-dm uppercase tracking-wider">Listed at</p>
              <p className="text-sm font-dm font-semibold text-charcoal">{formatPrice(alert.original_price)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted font-dm uppercase tracking-wider">Alert target</p>
              <p className="text-sm font-dm font-bold text-warm-gold">{formatPrice(alert.target_price)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted font-dm uppercase tracking-wider">Save</p>
              <p className="text-sm font-dm font-semibold text-success">
                ₹{alert.savings_amount.toLocaleString("en-IN")}/mo
                <span className="text-[10px] ml-1 text-muted">({dropPct}%)</span>
              </p>
            </div>
          </div>

          {/* Triggered info */}
          {isTriggered && alert.triggered_price && (
            <div className="mt-2 p-2 rounded-xl bg-success/10 border border-success/20">
              <p className="text-xs font-dm text-success font-semibold">
                🎉 Price dropped to {formatPrice(alert.triggered_price)}/mo
                {alert.triggered_at && (
                  <span className="font-normal text-muted ml-1">
                    on {new Date(alert.triggered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-custom bg-cream/40">
        <SparklineBadge history={alert.price_history} />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-dm text-muted hover:text-charcoal transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {alert.price_history.length} snapshots
          </button>

          <button
            onClick={() => onCheck(alert.id)}
            className="flex items-center gap-1 text-[11px] font-dm text-forest hover:text-forest-light transition-colors px-2 py-1 rounded-lg hover:bg-forest/5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check now
          </button>

          <button
            onClick={async () => {
              setDeleting(true);
              await onDelete(alert.id);
              setDeleting(false);
            }}
            disabled={deleting}
            className="p-1.5 text-muted hover:text-danger transition-colors rounded-lg hover:bg-danger/5 disabled:opacity-40"
            title="Remove alert"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Price history expanded */}
      <AnimatePresence>
        {expanded && alert.price_history.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border-custom"
          >
            <div className="p-4">
              <p className="text-[11px] font-dm font-semibold text-muted uppercase tracking-wider mb-3">Price History</p>
              <div className="space-y-1.5">
                {[...alert.price_history].reverse().map((snap, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-dm">
                    <span className="text-muted">
                      {new Date(snap.checked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-semibold text-charcoal">{formatPrice(snap.price)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-warm-gold/10 flex items-center justify-center mb-5">
        <BellRing className="w-9 h-9 text-warm-gold" />
      </div>
      <h2 className="font-playfair text-2xl text-charcoal mb-2">No Price Alerts Yet</h2>
      <p className="text-muted font-dm text-sm max-w-sm mb-6">
        Browse properties and tap the{" "}
        <span className="inline-flex items-center gap-1 text-warm-gold font-semibold">
          <BellRing className="w-3.5 h-3.5" /> bell icon
        </span>{" "}
        on any card to get notified when the price drops to your target.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 bg-forest text-white font-dm font-semibold px-6 py-2.5 rounded-xl hover:bg-forest-light transition-colors text-sm"
      >
        <Plus className="w-4 h-4" /> Browse Properties
      </Link>
    </motion.div>
  );
}

function AlertsPageInner() {
  const { user, isLoaded } = useUser();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [showTriggered, setShowTriggered] = useState(true);

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  const fetchAlerts = async (clerkId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/alerts/${clerkId}?include_triggered=true`);
      const json = await res.json();
      if (json.status === "success") {
        setAlerts(json.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAll = async () => {
    if (!user || checking) return;
    setChecking(true);
    try {
      const res = await fetch(`${apiBase}/api/alerts/${user.id}/check`, { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        setLastChecked(new Date());
        // Re-fetch to get updated prices / triggered status
        await fetchAlerts(user.id);
      }
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  };

  const handleCheckOne = async (alertId: string) => {
    // For a single alert, just run the global check (same backend endpoint)
    await handleCheckAll();
  };

  const handleDelete = async (alertId: string) => {
    if (!user) return;
    try {
      await fetch(`${apiBase}/api/alerts/${alertId}?clerk_id=${user.id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetchAlerts(user.id);
  }, [isLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = alerts.filter((a) => a.is_active && !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  const totalSavingsIfAllTriggered = active.reduce((sum, a) => sum + a.savings_amount, 0);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-forest" />
      </div>
    );
  }

  if (isLoaded && !user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center flex-col gap-4">
        <AlertCircle className="w-10 h-10 text-muted" />
        <p className="font-dm text-charcoal text-sm">Sign in to see your price alerts.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="lg:ml-[260px]">
        <DashboardTopBar />
        <div className="p-6 max-w-3xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-playfair text-3xl text-charcoal">Price Drop Alerts</h1>
                <p className="text-muted font-dm text-sm mt-1">
                  {active.length} watching · {triggered.length} triggered
                </p>
              </div>
              <button
                onClick={handleCheckAll}
                disabled={checking || loading}
                className="flex items-center gap-2 bg-surface border border-border-custom hover:border-forest/40 text-charcoal font-dm font-semibold text-sm px-4 py-2.5 rounded-xl transition-all hover:shadow-sm disabled:opacity-50"
              >
                {checking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {checking ? "Checking…" : "Check All Prices"}
              </button>
            </div>

            {lastChecked && (
              <p className="text-[11px] text-muted font-dm mt-2">
                Last checked: {lastChecked.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </motion.div>

          {/* Stats banner */}
          {active.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-3 gap-4 mb-6"
            >
              {[
                {
                  icon: BellRing,
                  label: "Active Alerts",
                  value: active.length,
                  color: "text-warm-gold",
                  bg: "bg-warm-gold/10",
                },
                {
                  icon: TrendingDown,
                  label: "Potential Savings",
                  value: `₹${Math.round(totalSavingsIfAllTriggered).toLocaleString("en-IN")}/mo`,
                  color: "text-success",
                  bg: "bg-success/10",
                },
                {
                  icon: BarChart2,
                  label: "Triggered",
                  value: triggered.length,
                  color: "text-forest",
                  bg: "bg-forest/10",
                },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 flex items-center gap-3`}>
                  <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted font-dm uppercase tracking-wider">{stat.label}</p>
                    <p className={`font-playfair text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Alerts list */}
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-surface border border-border-custom animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {/* Active alerts */}
              {active.length > 0 && (
                <div>
                  <p className="text-xs font-dm font-semibold text-muted uppercase tracking-wider mb-3">
                    Watching ({active.length})
                  </p>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {active.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onDelete={handleDelete}
                          onCheck={handleCheckOne}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Triggered alerts */}
              {triggered.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowTriggered((v) => !v)}
                    className="flex items-center gap-2 text-xs font-dm font-semibold text-success uppercase tracking-wider mb-3"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Triggered ({triggered.length})
                    {showTriggered ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <AnimatePresence>
                    {showTriggered && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3"
                      >
                        {triggered.map((alert) => (
                          <AlertCard
                            key={alert.id}
                            alert={alert}
                            onDelete={handleDelete}
                            onCheck={handleCheckOne}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          {!loading && alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 p-5 rounded-2xl border border-dashed border-warm-gold/30 bg-warm-gold/5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-warm-gold/15 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-warm-gold" />
              </div>
              <div className="flex-1">
                <p className="font-dm font-semibold text-charcoal text-sm">Track more properties</p>
                <p className="text-xs text-muted font-dm mt-0.5">
                  Click the <BellRing className="inline w-3 h-3 text-warm-gold" /> icon on any property card to add it to your alert watchlist.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="shrink-0 text-sm font-dm font-semibold text-forest hover:underline flex items-center gap-1"
              >
                Browse →
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-forest" />
        </div>
      }
    >
      <AlertsPageInner />
    </Suspense>
  );
}
