"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Sparkles, Home } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  properties?: Array<{
    id: string;
    bhk: string;
    locality: string;
    price: number;
    images: string[];
  }>;
  timestamp: Date;
}

const SUGGESTIONS = [
  "2BHK in Bandra under 40k",
  "Pet-friendly apartments in Powai",
  "Near Andheri station with parking",
  "Best value 3BHK in Pune",
];

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm Griha AI. Tell me what kind of home you're looking for — I'll search and find the best matches for you. Try something like \"2BHK in Bandra under 40k\" or \"pet-friendly flat near station\".",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, messages.length, scrollToBottom]);

  const parseSearchIntent = (query: string) => {
    const params: Record<string, string> = {};

    // BHK
    const bhkMatch = query.match(/(\d\+?\s*(?:bhk|rk))/i);
    if (bhkMatch) params.bhk = bhkMatch[1].toUpperCase().replace(/\s+/g, " ");

    // Location — everything after "in" or "near" or "at"
    const locMatch = query.match(/(?:in|near|at|around)\s+([A-Za-z][A-Za-z\s,]+?)(?:\s+(?:under|below|within|with|for|budget|max|priced)|$)/i);
    if (locMatch) params.location = locMatch[1].trim();

    // Price
    const priceMatch = query.match(/(?:under|below|within|budget|max|upto|up to)\s*₹?\s*(\d+)\s*k?/i);
    if (priceMatch) {
      let price = parseInt(priceMatch[1]);
      if (price < 1000) price *= 1000; // "40k" → 40000
      params.max_price = String(price);
    }

    // If no location found, try the whole string minus BHK/price keywords
    if (!params.location) {
      const cleaned = query
        .replace(/(\d+\s*(?:bhk|rk))/gi, "")
        .replace(/(?:under|below|within|budget|max|upto|up to)\s*₹?\s*\d+\s*k?/gi, "")
        .replace(/(?:pet[- ]?friendly|with parking|gated|furnished|semi[- ]?furnished)/gi, "")
        .trim();
      if (cleaned.length > 2) params.location = cleaned;
    }

    return params;
  };

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const params = parseSearchIntent(query);
      const searchParams = new URLSearchParams();
      if (params.location) searchParams.set("location", params.location);
      if (params.bhk) searchParams.set("bhk", params.bhk);
      if (params.max_price) searchParams.set("max_price", params.max_price);
      searchParams.set("limit", "5");

      const res = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/properties/?${searchParams.toString()}`
      );
      const json = await res.json();

      if (json.status === "success" && Array.isArray(json.data) && json.data.length > 0) {
        const properties = json.data.slice(0, 4).map((p: any) => ({
          id: p.id || p._id?.$oid || p._id,
          bhk: p.bhk || "N/A",
          locality: p.locality || p.city || "Unknown",
          price: Number(p.price || 0),
          images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [],
        }));

        const locationLabel = params.location || "your search area";
        const bhkLabel = params.bhk || "homes";
        const priceLabel = params.max_price ? ` under ${formatPrice(parseInt(params.max_price))}` : "";

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: `Found ${json.data.length} ${bhkLabel} in ${locationLabel}${priceLabel}. Here are the top picks:`,
          properties,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: `I couldn't find properties matching "${query}". Try specifying a location like "2BHK in Andheri under 30k" or adjust your filters. You can also start a scrape from the dashboard to fetch fresh listings!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Oops — couldn't connect to the server right now. Try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-forest text-white rounded-full shadow-xl shadow-forest/30 flex items-center justify-center hover:bg-forest-light transition-colors"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-3rem)] bg-surface rounded-2xl border border-border-custom shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-custom bg-forest text-white flex items-center justify-between shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-dm font-bold text-sm">Griha AI</p>
                  <p className="text-[10px] text-white/70">Natural language property search</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "thin" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-dm ${
                      msg.role === "user"
                        ? "bg-forest text-white rounded-tr-sm"
                        : "bg-cream border border-border-custom text-charcoal rounded-tl-sm"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>

                    {/* Property cards inline */}
                    {msg.properties && msg.properties.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.properties.map((p) => (
                          <Link
                            key={p.id}
                            href={`/property/${p.id}`}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 p-2 bg-surface rounded-xl border border-border-custom hover:border-forest/40 transition-colors"
                          >
                            {p.images[0] ? (
                              <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-sand flex items-center justify-center shrink-0">
                                <Home className="w-5 h-5 text-muted" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-charcoal truncate">{p.bhk} in {p.locality}</p>
                              <p className="text-xs text-forest font-bold">{formatPrice(p.price)}/mo</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-cream border border-border-custom rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-forest animate-spin" />
                    <span className="text-xs text-muted font-dm">Searching properties...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions — only show when few messages */}
            {messages.length <= 2 && !loading && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-[11px] font-dm px-2.5 py-1 bg-forest/5 border border-forest/15 text-forest rounded-full hover:bg-forest/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-border-custom bg-surface shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="e.g. 2BHK in Bandra under 40k..."
                  className="flex-1 bg-cream border border-border-custom rounded-xl px-4 py-2.5 text-sm font-dm focus:outline-none focus:border-forest text-charcoal placeholder:text-muted/50"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="p-2.5 bg-forest text-white rounded-xl hover:bg-forest-light transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
