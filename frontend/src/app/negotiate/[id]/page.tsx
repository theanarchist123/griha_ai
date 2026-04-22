"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, TrendingDown, Clock, Users, Target,
  Mic, MicOff, PhoneOff, Phone, Loader2, Zap,
  CheckCircle, Info,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { LottieRefCurrentProps } from "lottie-react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const VAPI_PUBLIC_KEY = "ebe53bb9-4757-445c-908a-170d7f13f8b2";
const VAPI_ASSISTANT_ID = "2ba17115-eb99-45f6-ae36-b74d73cd0f9d";

interface TranscriptLine {
  role: "assistant" | "user";
  text: string;
  id: string;
  final: boolean;
}

interface NegotiationData {
  id: string; property_id: string; status: string;
  user_max_price: number; tone: string; current_offer: number | null;
  messages: Array<{ role: string; content: string; timestamp: string | null }>;
  fair_value_min: number | null; fair_value_max: number | null; turn_count: number;
  property?: {
    id: string; bhk: string; locality: string; city: string;
    address: string; price: number; images: string[]; days_listed: number;
  };
}

interface Strategy {
  fair_value_min: number; fair_value_max: number; comparable_count: number;
  recommended_opening: number; sentiment_trend: string;
  leverage_points: string[]; progress_percent: number; turn_count: number;
}

export default function NegotiationPage() {
  const params = useParams();
  const propertyId = typeof params?.id === "string" ? params.id : "";

  const [negotiation, setNegotiation] = useState<NegotiationData | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(70000);
  const [tone, setTone] = useState("balanced");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [soundwavesData, setSoundwavesData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  const vapiRef = useRef<any>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  // Scroll transcript container, NOT the page
  const transcriptBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/soundwaves.json").then(r => r.json()).then(setSoundwavesData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lottieRef.current) return;
    if (aiSpeaking) { lottieRef.current.play(); lottieRef.current.setSpeed(1.6); }
    else { lottieRef.current.setSpeed(0.25); }
  }, [aiSpeaking]);

  // Scroll only the transcript box, never the page
  useEffect(() => {
    const box = transcriptBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/negotiation/property/${propertyId}`);
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setNegotiation(json.data);
          setStrategy(json.strategy || null);
          if (json.data.user_max_price) setMaxPrice(json.data.user_max_price);
          if (json.data.tone) setTone(json.data.tone);
        }
      } catch {}
      setLoading(false);
    })();
  }, [propertyId]);

  async function startBackendNeg() {
    setStarting(true); setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/negotiation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, user_max_price: maxPrice, tone }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setNegotiation(json.data);
        if (json.data?.id) {
          const sr = await fetch(`http://localhost:8000/api/negotiation/${json.data.id}`);
          const sj = await sr.json();
          if (sj.strategy) setStrategy(sj.strategy);
        }
      } else { setError(json.detail || "Failed to start"); }
    } catch { setError("Server unreachable"); }
    setStarting(false);
  }

  const startCall = useCallback(async () => {
    setCallStatus("connecting");
    setTranscript([]);
    setCallDuration(0);

    const { default: Vapi } = await import("@vapi-ai/web");
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setCallStatus("active");
      durationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    });
    vapi.on("call-end", () => {
      setCallStatus("ended");
      setAiSpeaking(false); setUserSpeaking(false);
      if (durationRef.current) clearInterval(durationRef.current);
    });
    vapi.on("speech-start", () => setAiSpeaking(true));
    vapi.on("speech-end", () => setAiSpeaking(false));
    vapi.on("message", (msg: any) => {
      if (msg.type === "transcript") {
        const { role, transcript: text, transcriptType } = msg;
        const isFinal = transcriptType === "final";
        setTranscript(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === role && !last.final)
            return [...prev.slice(0, -1), { ...last, text, final: isFinal }];
          return [...prev, { role, text, id: `${Date.now()}-${Math.random()}`, final: isFinal }];
        });
        if (role === "user") setUserSpeaking(!isFinal);
      }
    });
    vapi.on("error", (e: any) => {
      setCallStatus("idle");
      setError("Call failed: " + (e?.message || "unknown error"));
      if (durationRef.current) clearInterval(durationRef.current);
    });

    const prop = negotiation?.property;
    const fairMin = strategy?.fair_value_min ?? Math.round((prop?.price || maxPrice) * 0.82);
    const fairMax = strategy?.fair_value_max ?? Math.round((prop?.price || maxPrice) * 0.93);
    const listedPrice = prop?.price || maxPrice;
    const leverage = strategy?.leverage_points?.slice(0, 3).join("; ") ?? "property has been listed for a while";
    const daysListed = prop?.days_listed ?? 0;

    const systemPrompt = `You are Arjun, an experienced Indian real estate broker negotiating on behalf of a prospective tenant.

PROPERTY DETAILS:
- Property: ${prop?.bhk ?? "apartment"} in ${prop?.locality ?? "the locality"}, ${prop?.city ?? "the city"}
- Full address: ${prop?.address ?? "N/A"}
- Listed rent: ₹${listedPrice.toLocaleString("en-IN")}/month
- Days on market: ${daysListed} days

NEGOTIATION MANDATE:
- Client's maximum budget: ₹${maxPrice.toLocaleString("en-IN")}/month
- Fair market value range: ₹${fairMin.toLocaleString("en-IN")} – ₹${fairMax.toLocaleString("en-IN")}/month
- Negotiation tone: ${tone}
- Key leverage points: ${leverage}

YOUR ROLE: You are the tenant's broker-advocate. Help them get the best deal.
- Brief tenant on market intelligence using real numbers
- Suggest negotiation strategy and opening offers
- Help craft counter-offer arguments
- Advise on when to accept or walk away
- Be direct, use INR figures, be conversational
- Use Indian real estate vocabulary (rent, deposit, lock-in, escalation)
- Keep responses under 60 words unless asked to elaborate
- You are Arjun. Do NOT call yourself Riley or any other name.`;

    const firstMessage = `Namaste! I'm Arjun, your property broker. I've reviewed the ${prop?.bhk ?? "apartment"} at ${prop?.locality ?? "the property"} — listed at ₹${listedPrice.toLocaleString("en-IN")} per month. Market analysis shows fair rent is ₹${fairMin.toLocaleString("en-IN")}–₹${fairMax.toLocaleString("en-IN")}. ${daysListed > 20 ? `It's been listed ${daysListed} days — landlord may be flexible.` : "It's a new listing, so let's negotiate smart."} How do you want to approach this?`;

    const assistantOverrides = {
      firstMessage,
      model: {
        provider: "openai" as const,
        model: "gpt-4o-mini",
        systemPrompt,
        temperature: 0.7,
        maxTokens: 150,
      },
    } as any;

    vapi.start(VAPI_ASSISTANT_ID, assistantOverrides);
  }, [negotiation, maxPrice, strategy, tone]);

  const endCall = useCallback(() => {
    vapiRef.current?.stop();
    setCallStatus("idle");
    setAiSpeaking(false); setUserSpeaking(false);
    if (durationRef.current) clearInterval(durationRef.current);
  }, []);

  const toggleMute = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const prop = negotiation?.property;
  const listedPrice = prop?.price || maxPrice;
  const fairMin = strategy?.fair_value_min ?? Math.round(listedPrice * 0.82);
  const fairMax = strategy?.fair_value_max ?? Math.round(listedPrice * 0.93);
  const offerPct = strategy?.progress_percent ?? 0;

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-forest animate-spin" />
    </div>
  );

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!negotiation) return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <Link href={`/property/${propertyId}`} className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-dm">Back to Property</span>
        </Link>
      </div>
      <div className="max-w-md mx-auto px-6 py-16 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-forest/10 items-center justify-center mb-5 border border-forest/20">
            <Phone className="w-8 h-8 text-forest" />
          </div>
          <h1 className="font-playfair text-3xl text-charcoal mb-2">Voice Negotiation</h1>
          <p className="text-muted font-dm text-sm leading-relaxed">
            Arjun — your AI property broker — will negotiate in real-time via voice call.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-surface border border-border-custom rounded-2xl p-6 space-y-5 shadow-sm"
        >
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wider">Max Budget</label>
              <span className="text-forest font-dm font-bold text-sm">{formatPrice(maxPrice)}</span>
            </div>
            <input type="range" min={20000} max={300000} step={1000} value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full h-1.5 accent-forest cursor-pointer rounded-full"
            />
          </div>

          <div>
            <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wider mb-2.5 block">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {["aggressive", "balanced", "polite"].map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`py-2.5 rounded-xl text-xs font-dm font-semibold capitalize transition-all border ${
                    tone === t
                      ? "bg-forest text-white border-forest shadow-sm"
                      : "bg-cream text-charcoal border-border-custom hover:border-forest/40"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <button onClick={startBackendNeg} disabled={starting}
            className="w-full py-4 bg-forest text-white rounded-xl font-dm font-bold text-sm hover:bg-forest-light transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-forest/10"
          >
            {starting ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing market…</> : <><Zap className="w-4 h-4" />Prepare AI Broker</>}
          </button>
          {error && <p className="text-danger text-xs font-dm text-center">{error}</p>}
        </motion.div>
      </div>
    </div>
  );

  // ── Active page — fixed-height, no page scroll ─────────────────────────────
  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-cream border-b border-border-custom px-6 py-3 flex items-center justify-between z-10">
        <Link href="/dashboard" className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-dm">Dashboard</span>
        </Link>
        <div className="flex items-center gap-3">
          {callStatus === "active" && (
            <span className="flex items-center gap-1.5 text-xs font-dm font-semibold text-forest bg-forest/10 px-3 py-1 rounded-full border border-forest/20">
              <motion.span className="w-1.5 h-1.5 rounded-full bg-forest"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              LIVE · {fmt(callDuration)}
            </span>
          )}
          {prop && <span className="text-xs text-muted font-dm">{prop.bhk} · {prop.locality}</span>}
        </div>
      </div>

      {/* ── Main body — two columns, fixed height ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Property + Intelligence (fixed, scrolls independently) ── */}
        <div className="w-72 shrink-0 border-r border-border-custom bg-surface overflow-y-auto p-4 space-y-4">
          {/* Property snapshot */}
          {prop && (
            <div className="bg-cream rounded-xl border border-border-custom overflow-hidden">
              {prop.images?.[0] && (
                <img src={prop.images[0]} alt="" className="w-full h-28 object-cover" />
              )}
              <div className="p-3">
                <p className="font-dm font-bold text-charcoal text-sm">{prop.bhk}</p>
                <p className="text-muted text-xs">{prop.locality}, {prop.city}</p>
                <p className="text-forest font-bold text-lg mt-1">{formatPrice(listedPrice)}<span className="text-xs text-muted font-normal font-dm">/mo</span></p>
              </div>
            </div>
          )}

          {/* Market intel */}
          <div>
            <p className="text-[10px] font-dm font-semibold text-muted uppercase tracking-widest mb-2.5">Market Intelligence</p>
            <div className="space-y-2">
              {[
                { icon: <TrendingDown className="w-3.5 h-3.5 text-forest" />, label: "Fair Range", val: `${formatPrice(fairMin)} – ${formatPrice(fairMax)}` },
                { icon: <Clock className="w-3.5 h-3.5 text-warm-gold" />, label: "Days Listed", val: `${prop?.days_listed || 0} days` },
                { icon: <Users className="w-3.5 h-3.5 text-muted" />, label: "Comparables", val: `${strategy?.comparable_count || 0} found` },
                { icon: <Target className="w-3.5 h-3.5 text-forest" />, label: "Open Offer", val: formatPrice(strategy?.recommended_opening || Math.round(listedPrice * 0.87)) },
              ].map(({ icon, label, val }) => (
                <div key={label} className="flex items-center gap-2.5 px-3 py-2 bg-cream rounded-lg border border-border-custom">
                  <div className="shrink-0">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted font-dm">{label}</p>
                    <p className="text-xs font-dm font-semibold text-charcoal truncate">{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leverage */}
          {strategy?.leverage_points && strategy.leverage_points.length > 0 && (
            <div>
              <p className="text-[10px] font-dm font-semibold text-muted uppercase tracking-widest mb-2">Your Leverage</p>
              <div className="space-y-1.5">
                {strategy.leverage_points.slice(0, 3).map((lp, i) => (
                  <div key={i} className="flex gap-2 items-start bg-forest/5 border border-forest/10 rounded-lg px-2.5 py-2">
                    <CheckCircle className="w-3 h-3 text-forest mt-0.5 shrink-0" />
                    <p className="text-[11px] text-charcoal font-dm leading-relaxed">{lp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offer bar */}
          <div className="bg-cream rounded-xl border border-border-custom p-3">
            <div className="flex justify-between text-[10px] font-dm text-muted mb-1.5">
              <span>Current Offer</span><span>Your Max</span>
            </div>
            <div className="h-1.5 bg-sand rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-forest to-forest-light rounded-full"
                initial={{ width: 0 }} animate={{ width: `${Math.min(offerPct, 100)}%` }}
                transition={{ duration: 1.2 }}
              />
            </div>
            <div className="flex justify-between text-xs font-dm mt-1">
              <span className="font-bold text-forest">{formatPrice(negotiation.current_offer || 0)}</span>
              <span className="text-muted">{formatPrice(negotiation.user_max_price)}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Voice call — image reference layout ─────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F7F4EE]">

          {/* ── Main call area — AI stage + right panel, same height ──────── */}
          <div className="flex-1 flex gap-4 p-5 overflow-hidden items-stretch">

            {/* Left col: AI stage + captions below it only */}
            <div className="flex-1 flex flex-col gap-0 overflow-hidden">

            {/* Big AI stage */}
            <div className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-500 relative overflow-hidden ${
              callStatus === "active"
                ? aiSpeaking
                  ? "border-forest bg-white shadow-lg shadow-forest/10"
                  : "border-forest/40 bg-white shadow-md"
                : "border-border-custom bg-white"
            }`}>
              {/* Active glow ring */}
              {callStatus === "active" && aiSpeaking && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ boxShadow: ["inset 0 0 0px rgba(45,80,22,0)", "inset 0 0 30px rgba(45,80,22,0.06)", "inset 0 0 0px rgba(45,80,22,0)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* AI Avatar / Soundwaves */}
              <div className="flex flex-col items-center gap-5">
                {callStatus === "idle" || callStatus === "ended" ? (
                  // Idle: show a static rounded square icon (like the lab flask in image)
                  <div className="w-40 h-40 rounded-[2rem] bg-forest/10 flex items-center justify-center border border-forest/15 shadow-inner">
                    <Phone className="w-16 h-16 text-forest/60" />
                  </div>
                ) : callStatus === "connecting" ? (
                  <div className="w-40 h-40 rounded-[2rem] bg-forest/10 flex items-center justify-center border border-forest/15 shadow-inner">
                    <Loader2 className="w-14 h-14 text-forest animate-spin" />
                  </div>
                ) : soundwavesData ? (
                  // Active call: Lottie soundwaves fills the stage
                  <motion.div
                    animate={aiSpeaking ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-80 h-80"
                  >
                    <Lottie animationData={soundwavesData} lottieRef={lottieRef} loop className="w-full h-full drop-shadow-xl" />
                  </motion.div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-forest/10 flex items-center justify-center shadow-inner">
                    <Mic className="w-14 h-14 text-forest" />
                  </div>
                )}

                <div className="text-center">
                  <p className="font-playfair text-charcoal text-xl font-semibold">Arjun</p>
                  <motion.p
                    key={`${callStatus}-${aiSpeaking}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={`text-xs font-dm mt-0.5 ${
                      callStatus === "connecting" ? "text-warm-gold" :
                      aiSpeaking ? "text-forest font-semibold" :
                      callStatus === "active" ? "text-muted" : "text-muted/60"
                    }`}
                  >
                    {callStatus === "idle" ? "AI Property Broker" :
                     callStatus === "connecting" ? "Connecting…" :
                     callStatus === "active" ? (aiSpeaking ? "Speaking…" : userSpeaking ? "Listening…" : "On call") :
                     `Call ended · ${fmt(callDuration)}`}
                  </motion.p>
                </div>
              </div>

              {/* Idle: start call button inside the stage */}
              {callStatus === "idle" && (
                <motion.button
                  onClick={startCall}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="mt-6 flex items-center gap-2 px-8 py-3 bg-forest text-white font-dm font-bold rounded-xl text-sm shadow-lg shadow-forest/20 hover:bg-forest-light transition-all"
                >
                  <Phone className="w-4 h-4" /> Start Voice Call
                </motion.button>
              )}
              {callStatus === "ended" && (
                <button
                  onClick={() => { setCallStatus("idle"); setTranscript([]); setCallDuration(0); }}
                  className="mt-6 px-6 py-2.5 bg-forest/10 border border-forest/25 rounded-xl text-xs font-dm font-semibold text-forest hover:bg-forest/20 transition-all"
                >
                  Call again
                </button>
              )}
            </div>

              {/* Captions — below AI stage only, not spanning right panel */}
              <div className="shrink-0 bg-white border border-t border-border-custom rounded-b-2xl px-5 py-3" style={{ minHeight: "72px" }}>
                <div
                  ref={transcriptBoxRef}
                  className="overflow-y-auto max-h-14 text-center"
                  style={{ scrollbarWidth: "none" }}
                >
                  {transcript.length === 0 ? (
                    <p className="text-xs text-muted/40 font-dm py-1">
                      {callStatus === "idle" ? "Start the call — transcript appears here" : "Listening…"}
                    </p>
                  ) : (() => {
                    const recent = transcript.slice(-2);
                    return (
                      <div className="space-y-0.5">
                        {recent.map((line, i) => (
                          <motion.p key={line.id}
                            initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                            className={`font-dm leading-snug ${
                              i === recent.length - 1
                                ? line.role === "assistant" ? "text-sm text-charcoal font-medium" : "text-sm text-forest font-medium"
                                : "text-xs text-muted/40"
                            } ${!line.final ? "opacity-70" : ""}`}
                          >
                            {line.text}
                            {!line.final && (
                              <motion.span className="ml-1 inline-block w-1 h-3 bg-current rounded-sm align-middle"
                                animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />
                            )}
                          </motion.p>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>{/* end left col */}
            <div className="w-52 shrink-0 flex flex-col gap-3 h-full">
              {/* User card — flex-1 so it fills remaining height */}
              <div className="flex-1 bg-white rounded-2xl border border-border-custom p-4 flex flex-col items-center justify-center gap-3 shadow-sm">
                <div className="w-14 h-14 rounded-xl bg-forest/10 border border-forest/20 flex items-center justify-center overflow-hidden">
                  {prop?.images?.[0] ? (
                    <img src={prop.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-forest font-playfair font-bold text-xl">Y</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-dm font-semibold text-charcoal text-sm">You</p>
                  {callStatus === "active" && (
                    <motion.p
                      animate={userSpeaking ? { opacity: 1 } : { opacity: 0.4 }}
                      className="text-[10px] text-forest font-dm mt-0.5"
                    >
                      {userSpeaking ? "● Speaking" : "Listening"}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Mic + Duration buttons — like "Turn off mic | Repeat" in image */}
              {callStatus === "active" && (
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    onClick={toggleMute}
                    whileTap={{ scale: 0.93 }}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-dm font-semibold transition-all ${
                      isMuted
                        ? "bg-danger/5 border-danger/40 text-danger"
                        : "bg-white border-border-custom text-charcoal hover:border-forest/40"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    {isMuted ? "Unmute" : "Mute mic"}
                  </motion.button>
                  <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-border-custom bg-white text-xs font-dm font-semibold text-charcoal">
                    <span className="text-base font-mono font-bold text-forest">{fmt(callDuration)}</span>
                    Duration
                  </div>
                </div>
              )}

              {/* End Call — big red button like "End Lesson" in image */}
              {callStatus === "active" && (
                <motion.button
                  onClick={endCall}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="w-full py-4 bg-danger text-white font-dm font-bold rounded-xl text-sm shadow-lg shadow-danger/20 hover:bg-danger/90 transition-all flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" /> End Call
                </motion.button>
              )}

              {/* Live indicator */}
              {callStatus === "active" && (
                <div className="flex items-center justify-center gap-1.5">
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-forest"
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  <span className="text-[10px] font-dm text-muted">LIVE</span>
                </div>
              )}

              {/* Connecting state */}
              {callStatus === "connecting" && (
                <div className="flex items-center justify-center gap-2 text-muted font-dm text-xs py-4">
                  <Loader2 className="w-3.5 h-3.5 text-forest animate-spin" />
                  Connecting…
                </div>
              )}
            </div>
          </div>        </div>
      </div>
    </div>
  );
}

