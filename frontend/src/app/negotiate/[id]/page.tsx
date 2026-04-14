"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, TrendingDown, Clock, Users, Target,
  CheckCircle, MessageSquare, Loader2, Send, Zap,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface NegMessage {
  role: "agent" | "broker" | "user";
  content: string;
  timestamp: string | null;
  approved_by_user: boolean;
}

interface NegotiationData {
  id: string;
  property_id: string;
  status: string;
  user_max_price: number;
  tone: string;
  current_offer: number | null;
  messages: NegMessage[];
  fair_value_min: number | null;
  fair_value_max: number | null;
  turn_count: number;
  property?: {
    id: string;
    bhk: string;
    locality: string;
    city: string;
    address: string;
    price: number;
    images: string[];
    days_listed: number;
  };
}

interface Strategy {
  fair_value_min: number;
  fair_value_max: number;
  comparable_count: number;
  recommended_opening: number;
  sentiment_trend: string;
  leverage_points: string[];
  progress_percent: number;
  turn_count: number;
}

export default function NegotiationPage() {
  const params = useParams();
  const propertyId = typeof params?.id === "string" ? params.id : "";

  const [negotiation, setNegotiation] = useState<NegotiationData | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [maxPrice, setMaxPrice] = useState(70000);
  const [tone, setTone] = useState("balanced");
  const [brokerInput, setBrokerInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!propertyId) return;
    checkExistingNegotiation();
  }, [propertyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [negotiation?.messages]);

  async function checkExistingNegotiation() {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/negotiation/property/${propertyId}`);
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setNegotiation(json.data);
        setStrategy(json.strategy || null);
        if (json.data.user_max_price) setMaxPrice(json.data.user_max_price);
        if (json.data.tone) setTone(json.data.tone);
      }
    } catch (err) {
      // No existing negotiation — that's fine
    } finally {
      setLoading(false);
    }
  }

  async function startNegotiation() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/negotiation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          user_max_price: maxPrice,
          tone,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setNegotiation(json.data);
        // Fetch strategy
        if (json.data?.id) {
          const stratRes = await fetch(`http://localhost:8000/api/negotiation/${json.data.id}`);
          const stratJson = await stratRes.json();
          if (stratJson.strategy) setStrategy(stratJson.strategy);
        }
      } else {
        setError(json.detail || "Failed to start negotiation");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setStarting(false);
    }
  }

  async function sendBrokerResponse() {
    if (!brokerInput.trim() || !negotiation?.id) return;
    setResponding(true);
    try {
      const res = await fetch(`http://localhost:8000/api/negotiation/${negotiation.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker_message: brokerInput }),
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setNegotiation(json.data);
        setBrokerInput("");
      }
    } catch (err) {
      setError("Failed to process response");
    } finally {
      setResponding(false);
    }
  }

  const prop = negotiation?.property;
  const listedPrice = prop?.price || 80000;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  // Show setup screen if no negotiation exists
  if (!negotiation) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
          <Link href={`/property/${propertyId}`} className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-dm">Back to Property</span>
          </Link>
        </div>
        <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-playfair text-3xl text-charcoal mb-3">Start AI Negotiation</h1>
            <p className="text-muted font-dm">Griha AI will negotiate on your behalf using market intelligence and AI-powered messaging.</p>
          </motion.div>

          <div className="bg-surface rounded-2xl border border-border-custom p-6 text-left space-y-6">
            <div>
              <label className="text-xs text-muted font-dm mb-2 block">Maximum Budget</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={20000} max={200000} step={1000}
                  value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="flex-1 accent-forest h-2 cursor-pointer"
                />
                <span className="text-sm font-dm font-bold text-forest w-24 text-right">{formatPrice(maxPrice)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted font-dm mb-2 block">Negotiation Tone</label>
              <div className="flex gap-2">
                {["aggressive", "balanced", "polite"].map((t) => (
                  <button key={t} onClick={() => setTone(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-dm font-semibold capitalize transition-all ${
                      tone === t ? "bg-forest text-white" : "bg-cream text-charcoal hover:bg-sand"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startNegotiation}
              disabled={starting}
              className="w-full py-4 bg-forest text-white rounded-xl font-dm font-semibold text-lg hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Researching Market...</>
              ) : (
                <><Zap className="w-5 h-5" /> Start AI Negotiation</>
              )}
            </button>
            {error && <p className="text-danger text-sm font-dm">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Active negotiation view
  const offerProgress = strategy?.progress_percent || 50;

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <div className="flex items-center justify-between max-w-full">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-dm">Back</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              negotiation.status === "active" ? "bg-success/10 text-success" :
              negotiation.status === "closed_won" ? "bg-forest/10 text-forest" :
              negotiation.status === "closed_lost" ? "bg-danger/10 text-danger" :
              "bg-warm-gold/10 text-warm-gold"
            }`}>
              {negotiation.status === "active" ? "● Negotiation Active" :
               negotiation.status === "closed_won" ? "✓ Deal Closed" :
               negotiation.status === "closed_lost" ? "✗ Walked Away" :
               "⏸ Paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left Panel - Strategy */}
        <div className="w-[420px] border-r border-border-custom bg-surface overflow-y-auto p-6 space-y-6">
          {prop && (
            <div className="bg-cream rounded-xl p-4">
              <div className="flex gap-3">
                {prop.images?.[0] && <img src={prop.images[0]} alt="" className="w-20 h-20 rounded-lg object-cover" />}
                <div>
                  <p className="font-dm font-semibold text-charcoal text-sm">{prop.bhk}, {prop.locality}</p>
                  <p className="text-muted text-xs mt-0.5">{prop.address}</p>
                  <p className="text-forest font-bold text-lg mt-1">{formatPrice(prop.price)}/mo</p>
                </div>
              </div>
            </div>
          )}

          {/* Market Intelligence */}
          <div>
            <h3 className="font-dm font-bold text-charcoal text-sm mb-3">Market Intelligence</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-cream rounded-xl p-3 text-center">
                <TrendingDown className="w-5 h-5 text-forest mx-auto mb-1" />
                <p className="font-dm font-bold text-charcoal text-sm">
                  {formatPrice(strategy?.fair_value_min || listedPrice * 0.82)} - {formatPrice(strategy?.fair_value_max || listedPrice * 0.93)}
                </p>
                <p className="text-muted text-[10px]">Fair Value Range</p>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 text-warm-gold mx-auto mb-1" />
                <p className="font-dm font-bold text-charcoal text-sm">{prop?.days_listed || 0} days</p>
                <p className="text-muted text-[10px]">Days Listed</p>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <Users className="w-5 h-5 text-muted mx-auto mb-1" />
                <p className="font-dm font-bold text-charcoal text-sm">{strategy?.comparable_count || 0}</p>
                <p className="text-muted text-[10px]">Comparable Properties</p>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <Target className="w-5 h-5 text-forest mx-auto mb-1" />
                <p className="font-dm font-bold text-charcoal text-sm">{formatPrice(strategy?.recommended_opening || listedPrice * 0.87)}</p>
                <p className="text-muted text-[10px]">Recommended Opening</p>
              </div>
            </div>
          </div>

          {/* Leverage Points */}
          {strategy?.leverage_points && strategy.leverage_points.length > 0 && (
            <div>
              <h3 className="font-dm font-bold text-charcoal text-sm mb-2">Leverage Points</h3>
              <div className="space-y-1.5">
                {strategy.leverage_points.map((lp, i) => (
                  <p key={i} className="text-xs text-charcoal font-dm bg-cream px-3 py-2 rounded-lg">💡 {lp}</p>
                ))}
              </div>
            </div>
          )}

          {/* Negotiation Controls */}
          <div>
            <h3 className="font-dm font-bold text-charcoal text-sm mb-3">Controls</h3>
            <div className="mb-4">
              <label className="text-xs text-muted font-dm mb-1 block">Maximum Price</label>
              <div className="flex items-center gap-3">
                <input type="range" min={20000} max={200000} step={1000}
                  value={negotiation.user_max_price}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="flex-1 accent-forest h-2 cursor-pointer"
                />
                <span className="text-sm font-dm font-bold text-forest w-20 text-right">{formatPrice(negotiation.user_max_price)}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-muted font-dm mb-2 block">Tone</label>
              <div className="flex gap-2">
                {["aggressive", "balanced", "polite"].map((t) => (
                  <button key={t}
                    className={`flex-1 py-2 rounded-lg text-xs font-dm font-semibold capitalize transition-all ${
                      negotiation.tone === t ? "bg-forest text-white" : "bg-cream text-charcoal hover:bg-sand"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-cream rounded-xl p-4">
            <div className="flex justify-between text-xs font-dm text-muted mb-2">
              <span>Current Offer</span>
              <span>Max Price</span>
            </div>
            <div className="h-3 bg-sand rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-forest rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(offerProgress, 100)}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <div className="flex justify-between text-sm font-dm mt-1">
              <span className="font-bold text-forest">{formatPrice(negotiation.current_offer || 0)}</span>
              <span className="text-muted">{formatPrice(negotiation.user_max_price)}</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Conversation */}
        <div className="flex-1 flex flex-col bg-cream">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {negotiation.messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex gap-3 ${msg.role === "broker" ? "justify-end" : ""}`}
              >
                {msg.role === "agent" && (
                  <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold font-playfair italic">G</span>
                  </div>
                )}
                <div className="max-w-[70%]">
                  <div className={`px-4 py-3 rounded-2xl text-sm font-dm ${
                    msg.role === "agent"
                      ? "bg-surface border border-border-custom text-charcoal rounded-tl-sm"
                      : "bg-muted/10 border border-border-custom text-charcoal rounded-tr-sm"
                  }`}>
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-muted mt-1 px-1">
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Now"
                    }
                  </p>
                </div>
                {msg.role === "broker" && (
                  <div className="w-9 h-9 rounded-full bg-muted/20 flex items-center justify-center shrink-0">
                    <span className="text-charcoal text-sm font-dm font-semibold">B</span>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input — Simulate Broker Response */}
          {negotiation.status === "active" && (
            <div className="border-t border-border-custom bg-surface p-4">
              <p className="text-xs text-muted font-dm mb-2">Simulate broker response (for demo)</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={brokerInput}
                  onChange={(e) => setBrokerInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendBrokerResponse()}
                  placeholder="Type broker's response..."
                  className="flex-1 px-4 py-3 bg-cream border border-border-custom rounded-xl text-sm font-dm focus:outline-none focus:border-forest"
                  disabled={responding}
                />
                <button
                  onClick={sendBrokerResponse}
                  disabled={responding || !brokerInput.trim()}
                  className="px-6 py-3 bg-forest text-white rounded-xl font-dm font-semibold text-sm hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {(negotiation.status === "closed_won" || negotiation.status === "closed_lost") && (
            <div className={`border-t-2 p-6 text-center ${
              negotiation.status === "closed_won" ? "border-forest bg-forest/5" : "border-danger bg-danger/5"
            }`}>
              <p className="font-dm font-bold text-lg text-charcoal">
                {negotiation.status === "closed_won"
                  ? `🎉 Deal closed at ${formatPrice(negotiation.current_offer || 0)}/mo!`
                  : "Negotiation ended. Consider exploring other properties."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
