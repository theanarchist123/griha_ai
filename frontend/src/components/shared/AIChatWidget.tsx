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

  // Track last successful search params for follow-up context
  const lastSearchRef = useRef<Record<string, string>>({});

  const parseSearchIntent = (query: string) => {
    const params: Record<string, string> = {};

    // Normalize: strip command prefixes
    let q = query
      .replace(/^(?:find|show|get|search|look for|looking for|i want|i need|give me|can you find|please find)\s+(?:me\s+)?/i, "")
      .replace(/^(?:any|some|all)\s+/i, "")
      .trim();

    // BHK extraction
    const bhkMatch = q.match(/(\d\+?)\s*(?:bhk|rk|bed(?:room)?s?)/i);
    if (bhkMatch) {
      params.bhk = `${bhkMatch[1]} BHK`;
      q = q.replace(bhkMatch[0], " ").trim();
    }

    // Price extraction — handle k, K, lakh, L, lac, cr, crore
    const pricePatterns = [
      /(?:under|below|within|budget|max|upto|up\s*to|less\s*than|not\s*(?:more|above)\s*than)\s*₹?\s*(\d+(?:\.\d+)?)\s*(k|l|lakh|lac|lacs|cr|crore)?/i,
      /₹\s*(\d+(?:\.\d+)?)\s*(k|l|lakh|lac|lacs|cr|crore)?\s*(?:budget|max)?/i,
      /(\d+(?:\.\d+)?)\s*(k|l|lakh|lac|lacs|cr|crore)\s*(?:budget|rent|price)?/i,
    ];
    for (const pattern of pricePatterns) {
      const priceMatch = q.match(pattern);
      if (priceMatch) {
        let price = parseFloat(priceMatch[1]);
        const suffix = (priceMatch[2] || "").toLowerCase();
        if (suffix === "k") price *= 1000;
        else if (suffix === "l" || suffix === "lakh" || suffix === "lac" || suffix === "lacs") price *= 100000;
        else if (suffix === "cr" || suffix === "crore") price *= 10000000;
        else if (price < 500) price *= 1000; // bare number < 500 → assume thousands (e.g. "40" → 40k)
        params.max_price = String(Math.round(price));
        q = q.replace(priceMatch[0], " ").trim();
        break;
      }
    }

    // Location extraction — multi-pass
    // Pass 1: after "in", "near", "at", "around", "from"
    const locPatterns = [
      /(?:in|near|at|around|from)\s+([A-Za-z][A-Za-z\s,.-]+?)(?:\s*$|\s+(?:under|below|within|with|for|budget|max|priced|that|which|having))/i,
      /(?:in|near|at|around|from)\s+([A-Za-z][A-Za-z\s,.-]+)$/i,
    ];
    for (const pattern of locPatterns) {
      const locMatch = q.match(pattern);
      if (locMatch) {
        params.location = locMatch[1].replace(/[,.]$/,"").trim();
        break;
      }
    }

    // Pass 2: if no location, clean remaining text and use as location
    if (!params.location) {
      const cleaned = q
        .replace(/(\d+\s*(?:bhk|rk|bed(?:room)?s?))/gi, "")
        .replace(/(?:pet[- ]?friendly|with\s+parking|gated|furnished|semi[- ]?furnished|with\s+gym|with\s+pool|with\s+lift)/gi, "")
        .replace(/(?:apartments?|flats?|homes?|house|properties|listings?|rentals?)/gi, "")
        .replace(/(?:cheap|affordable|luxury|premium|best|good|nice|spacious)/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      // Only use if it looks like a place name (2+ chars, starts with letter)
      if (cleaned.length >= 2 && /^[A-Za-z]/.test(cleaned)) {
        params.location = cleaned;
      }
    }

    // Clean location of trailing junk
    if (params.location) {
      params.location = params.location
        .replace(/\s+(with|that|which|having|and|or)\s*$/i, "")
        .trim();
    }

    // Amenity flags
    if (/pet[- ]?friendly/i.test(query)) params.pet = "true";
    if (/parking/i.test(query)) params.parking = "true";
    if (/gated/i.test(query)) params.gated = "true";

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
      let params = parseSearchIntent(query);

      // Context: if user says generic follow-up, reuse last search params
      const isFollowUp = /^(?:show|list|any|all|more|yes|ok|sure|go ahead|no (?:budget|restriction|limit)|without|remove|drop)\b/i.test(query)
        || query.length < 15;
      if (!params.location && !params.bhk && isFollowUp && Object.keys(lastSearchRef.current).length > 0) {
        // Merge: keep last search context, but allow overrides
        params = { ...lastSearchRef.current, ...params };
        // If user says "no budget/restriction" → remove price filter
        if (/no\s*(?:budget|restriction|limit|price)/i.test(query) || /all\s*prices?/i.test(query) || /remove\s*(?:budget|price|filter)/i.test(query)) {
          delete params.max_price;
        }
      }

      // Save for follow-up context
      if (params.location || params.bhk) {
        lastSearchRef.current = { ...params };
      }

      const searchParams = new URLSearchParams();
      if (params.location) searchParams.set("location", params.location);
      if (params.bhk) searchParams.set("bhk", params.bhk);
      if (params.max_price) searchParams.set("max_price", params.max_price);
      // Amenity flags — sent to /search endpoint which handles them
      const hasAmenities = params.pet === "true" || params.parking === "true" || params.gated === "true";
      if (params.gated === "true") searchParams.set("gated", "true");
      if (params.pet === "true") searchParams.set("pet", "true");
      if (params.parking === "true") searchParams.set("parking", "true");

      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      // Use /search endpoint (amenity-aware) if any filter set; /? (list) for bare browse
      const useSearchEndpoint = hasAmenities || params.gated || params.pet || params.parking;
      const endpoint = useSearchEndpoint
        ? `${apiBase}/api/properties/search?${searchParams.toString()}`
        : `${apiBase}/api/properties/?${searchParams.toString()}`;

      const res = await fetch(endpoint);
      const json = await res.json();

      // /search returns {results:[]} while / returns {data:[]}
      const rawList = Array.isArray(json.results) ? json.results : Array.isArray(json.data) ? json.data : [];

      if (json.status === "success" && rawList.length > 0) {
        const properties = rawList.slice(0, 4).map((p: any) => ({
          id: p.id || p._id?.$oid || p._id,
          bhk: p.bhk || "N/A",
          locality: p.locality || p.city || "Unknown",
          price: Number(p.price || 0),
          images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [],
        }));


        const locationLabel = params.location || "your search area";
        const bhkLabel = params.bhk || "homes";
        const priceLabel = params.max_price ? ` under ${formatPrice(parseInt(params.max_price))}` : "";
        const amenityLabels = [
          params.gated === "true" && "gated",
          params.pet === "true" && "pet-friendly",
          params.parking === "true" && "with parking",
        ].filter(Boolean).join(", ");
        const amenityLabel = amenityLabels ? ` (${amenityLabels})` : "";

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: `Found ${rawList.length} ${bhkLabel} in ${locationLabel}${priceLabel}${amenityLabel}. Here are the top picks:`,
          properties,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        // Distinguish: did we parse anything vs completely empty
        const parsed = params.location || params.bhk;
        const locationNote = params.location ? `"${params.location}"` : "the specified area";
        const bhkNote = params.bhk || "";

        let content: string;
        if (parsed) {
          content = `No ${bhkNote} properties found in ${locationNote} right now. This area might not have scraped listings yet.\n\n💡 Go to the Dashboard, enter "${params.location || ""}" in the search bar, and hit "Scrape Live" to fetch fresh listings from MagicBricks, 99acres, etc.`;
        } else {
          content = `I couldn't understand that query. Try something like:\n• "2BHK in Andheri"\n• "3BHK near Bandra under 50k"\n• "Flats in Powai"\n\nJust mention a location and I'll search!`;
        }

        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Couldn't connect to server right now. Try again in a moment.",
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
