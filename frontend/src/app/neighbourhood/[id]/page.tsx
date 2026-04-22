"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Send, Loader2, Sparkles, RotateCcw,
} from "lucide-react";

// Dynamic import — no SSR (Leaflet needs browser)
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#0f0f1a" }}>
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9922A" }} />
        <p className="font-dm text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading map...</p>
      </div>
    </div>
  ),
});

interface POI {
  name: string;
  lat: number;
  lng: number;
  distance_m?: number;
  category: string;
  emoji: string;
}

interface RouteData {
  polyline: [number, number][];
  distance_km: number;
  duration_min: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
}

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  pois?: POI[];
  route?: RouteData | null;
  category?: string;
  emoji?: string;
  loading?: boolean;
}

const QUICK_PROMPTS = [
  { label: "Hospitals", emoji: "🏥", query: "nearby hospitals" },
  { label: "Supermarkets", emoji: "🛒", query: "nearby supermarkets" },
  { label: "Parks", emoji: "🌳", query: "nearby parks" },
  { label: "Metro Stations", emoji: "🚊", query: "metro stations nearby" },
  { label: "Restaurants", emoji: "🍽️", query: "restaurants nearby" },
  { label: "Schools", emoji: "🏫", query: "nearby schools" },
  { label: "ATMs", emoji: "🏧", query: "ATMs nearby" },
  { label: "Pharmacies", emoji: "💊", query: "pharmacies nearby" },
];

function formatDistance(m?: number) {
  if (m == null) return "";
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export default function NeighbourhoodExplorerPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const propertyId = typeof params?.id === "string" ? params.id : "";
  const address = searchParams?.get("address") || "Your Property";
  const lat = parseFloat(searchParams?.get("lat") || "19.076");
  const lng = parseFloat(searchParams?.get("lng") || "72.877");
  const locality = searchParams?.get("locality") || "";
  const city = searchParams?.get("city") || "Mumbai";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: `Exploring **${address}** in ${locality ? `${locality}, ` : ""}${city}.\n\nAsk me anything — nearby hospitals, supermarkets, parks, or how far a place is from here. Use the quick buttons below or type your own question.`,
      emoji: "🤖",
    },
  ]);
  const [input, setInput] = useState("");
  const [activePois, setActivePois] = useState<POI[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuery = useCallback(async (query: string) => {
    if (!query.trim() || isQuerying) return;

    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: query },
      { id: aiMsgId, role: "ai", text: "", loading: true, emoji: "⏳" },
    ]);
    setInput("");
    setIsQuerying(true);

    try {
      const res = await fetch("http://localhost:8000/api/neighbourhood-ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          lat,
          lng,
          property_address: address,
          radius_m: 3000,
        }),
      });
      const data = await res.json();

      // Update AI message with results
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                loading: false,
                text: data.summary,
                pois: data.pois || [],
                route: data.route || null,
                category: data.category,
                emoji: data.emoji || "📍",
              }
            : m
        )
      );

      // Update map
      setActivePois(data.pois || []);
      setActiveRoute(data.route || null);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                loading: false,
                text: "Could not connect to backend. Make sure the server is running on port 8000.",
                emoji: "❌",
              }
            : m
        )
      );
    } finally {
      setIsQuerying(false);
      inputRef.current?.focus();
    }
  }, [isQuerying, lat, lng, address]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  const resetMap = () => {
    setActivePois([]);
    setActiveRoute(null);
    setMessages([{
      id: `welcome-${Date.now()}`,
      role: "ai",
      text: `Map cleared. Ask me something new about **${address}**!`,
      emoji: "🗺️",
    }]);
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#0f0f1a", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ─── Top bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0 z-20"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
        }}
      >
        <Link
          href="/neighbourhood"
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Properties</span>
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(201,146,42,0.15)", border: "1px solid rgba(201,146,42,0.3)" }}
          >
            <MapPin className="w-3.5 h-3.5" style={{ color: "#C9922A" }} />
            <span className="text-xs font-dm font-medium" style={{ color: "#C9922A" }}>
              {locality || city}
            </span>
          </div>
          <Link href="/" className="flex items-center gap-1">
            <span className="font-playfair italic text-lg text-white">griha</span>
            <span className="font-playfair text-lg font-bold" style={{ color: "#C9922A" }}>AI</span>
          </Link>
        </div>

        <button
          onClick={resetMap}
          className="flex items-center gap-1.5 text-xs font-dm transition-colors px-3 py-1.5 rounded-lg"
          style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
          title="Clear map & reset"
          suppressHydrationWarning
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* ─── Main split ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Chat panel ─────────────────────────────────────────────── */}
        <div
          className="w-[420px] shrink-0 flex flex-col border-r"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#121220" }}
        >
          {/* Property header */}
          <div
            className="px-5 py-4 shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(45,80,22,0.3), rgba(74,122,40,0.1))",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-xs font-dm mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Exploring neighbourhood of
            </p>
            <p className="text-sm font-dm font-semibold text-white line-clamp-1">{address}</p>
            <p className="text-xs font-dm mt-0.5" style={{ color: "#4A7A28" }}>
              {locality ? `${locality}, ` : ""}{city} · {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs"
                    style={{
                      background: msg.role === "ai"
                        ? "linear-gradient(135deg, #2D5016, #4A7A28)"
                        : "linear-gradient(135deg, #1a1a4e, #2d2d6e)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {msg.role === "ai" ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-white font-dm font-bold text-xs">U</span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className="flex-1 max-w-[85%] rounded-2xl px-4 py-3"
                    style={{
                      background: msg.role === "ai"
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(135deg, #1a1a4e, #2d2d6e)",
                      border: msg.role === "ai"
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(255,255,255,0.12)",
                      borderRadius: msg.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                    }}
                  >
                    {msg.loading ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{ background: "#C9922A" }}
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-dm" style={{ color: "rgba(255,255,255,0.4)" }}>
                          AI is analyzing...
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-dm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                          {msg.text}
                        </p>

                        {/* POI list */}
                        {msg.pois && msg.pois.length > 0 && msg.intent !== "distance_query" && (
                          <div className="mt-3 space-y-1.5">
                            {msg.pois.slice(0, 6).map((poi, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
                              >
                                <span className="text-base">{poi.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-dm font-medium text-white truncate">{poi.name}</p>
                                  {poi.distance_m != null && (
                                    <p className="text-[10px] font-dm" style={{ color: "rgba(255,255,255,0.4)" }}>
                                      {formatDistance(poi.distance_m)} away
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {msg.pois.length > 6 && (
                              <p className="text-[10px] font-dm text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                                +{msg.pois.length - 6} more on map
                              </p>
                            )}
                          </div>
                        )}

                        {/* Route info */}
                        {msg.route && (
                          <div
                            className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: "rgba(201,146,42,0.12)", border: "1px solid rgba(201,146,42,0.25)" }}
                          >
                            <span className="text-xl">🗺️</span>
                            <div>
                              <p className="text-xs font-dm font-semibold text-white">{msg.route.destination_name}</p>
                              <p className="text-[10px] font-dm" style={{ color: "#C9922A" }}>
                                {msg.route.distance_km}km · ~{msg.route.duration_min} min
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div
            className="px-4 py-3 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] font-dm mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>QUICK EXPLORE</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendQuery(qp.query)}
                  disabled={isQuerying}
                  suppressHydrationWarning
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-dm font-medium transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <span>{qp.emoji}</span>
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div
            className="px-4 py-4 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this neighbourhood..."
                disabled={isQuerying}
                suppressHydrationWarning
                className="flex-1 text-sm font-dm outline-none bg-transparent"
                style={{ color: "white" }}
              />
              <button
                onClick={() => sendQuery(input)}
                disabled={!input.trim() || isQuerying}
                suppressHydrationWarning
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0"
                style={{
                  background: input.trim() && !isQuerying
                    ? "linear-gradient(135deg, #2D5016, #4A7A28)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                {isQuerying ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.5)" }} />
                ) : (
                  <Send className="w-4 h-4" style={{ color: input.trim() ? "white" : "rgba(255,255,255,0.3)" }} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Map ────────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <MapComponent
            centerLat={lat}
            centerLng={lng}
            pois={activePois}
            route={activeRoute}
            propertyAddress={address}
          />

          {/* Map overlay — result count bubble */}
          <AnimatePresence>
            {activePois.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-4 z-[1000] px-4 py-2.5 rounded-2xl flex items-center gap-2"
                style={{
                  background: "rgba(15,15,26,0.9)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span className="text-lg">{messages.filter((m) => m.emoji && m.emoji !== "⏳" && m.emoji !== "❌" && m.emoji !== "🤖" && m.role === "ai").slice(-1)[0]?.emoji || "📍"}</span>
                <div>
                  <p className="text-xs font-dm font-semibold text-white">{activePois.length} result{activePois.length !== 1 ? "s" : ""} found</p>
                  <p className="text-[10px] font-dm" style={{ color: "rgba(255,255,255,0.4)" }}>Showing on map</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Route distance badge */}
          <AnimatePresence>
            {activeRoute && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 z-[1000] px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(15,15,26,0.9)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(201,146,42,0.3)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🗺️</span>
                  <div>
                    <p className="text-xs font-dm text-white font-semibold">{activeRoute.destination_name}</p>
                    <p className="text-xs font-dm" style={{ color: "#C9922A" }}>
                      {activeRoute.distance_km} km · ~{activeRoute.duration_min} min by car
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state hint */}
          <AnimatePresence>
            {activePois.length === 0 && !activeRoute && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-2xl text-center"
                style={{
                  background: "rgba(15,15,26,0.85)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-xs font-dm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Ask AI to show nearby places or routes — they'll appear here
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
