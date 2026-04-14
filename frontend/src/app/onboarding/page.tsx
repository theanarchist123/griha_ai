"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { STATIC_IMAGES } from "@/lib/unsplash";
import { AgentProgress } from "@/components/shared/AgentProgress";

const ONBOARDING_IMAGES = [
  STATIC_IMAGES.onboarding1,
  STATIC_IMAGES.onboarding2,
  STATIC_IMAGES.onboarding3,
  STATIC_IMAGES.onboarding4,
  STATIC_IMAGES.onboarding5,
];

const PREFERENCES = [
  "Metro nearby", "No broker", "Pet friendly", "Furnished",
  "Parking", "Quiet area", "Gated society", "Near school",
  "Work from home friendly", "Good natural light",
];

const QUOTES = [
  "Home is not a place, it's a feeling.",
  "The best investment on earth is earth.",
  "Every house has a story to tell.",
  "Your perfect home is waiting.",
  "Let AI handle the chaos.",
];

interface Message {
  from: "ai" | "user";
  content: string;
  component?: React.ReactNode;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-forest flex items-center justify-center shrink-0 mr-2">
        <span className="text-white text-xs font-bold font-playfair italic">G</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-forest/40"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [showComplete, setShowComplete] = useState(false);

  // Responses state
  const [intent, setIntent] = useState<string>("");
  const [city, setCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [dealBreakers, setDealBreakers] = useState("");
  const [bhk, setBhk] = useState<string>("");

  const fetchLocationSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/locations/autocomplete?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setLocationSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
        return;
      }
    } catch {
      // Backend not available — use fallback
    }
    const fallback = [
      "Mumbai, Maharashtra", "Andheri West, Mumbai", "Bandra West, Mumbai", "Powai, Mumbai",
      "Thane, Maharashtra", "Pune, Maharashtra", "Bangalore, Karnataka", "Koramangala, Bangalore",
      "Indiranagar, Bangalore", "Delhi, NCR", "Gurgaon, Haryana", "Noida, Uttar Pradesh",
      "Hyderabad, Telangana", "Chennai, Tamil Nadu", "Kolkata, West Bengal",
    ];
    const matches = fallback.filter(l => l.toLowerCase().includes(query.toLowerCase()));
    setLocationSuggestions(matches.slice(0, 8));
  };

  const addAIMessage = useCallback((content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { from: "ai", content }]);
    }, 1200);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { from: "user", content }]);
  }, []);

  // Initialize first message
  useEffect(() => {
    addAIMessage("Hey there! I'm Griha AI. Let's find you the perfect home. First — are you looking to rent or buy?");
  }, [addAIMessage]);

  const handleIntent = (value: string) => {
    setIntent(value);
    addUserMessage(value === "rent" ? "I'm looking to rent" : "I'm looking to buy");
    setStep(1);
    setTimeout(() => {
      addAIMessage("Great choice! Which city or area are you targeting?");
    }, 500);
  };

  const handleCity = () => {
    if (!city) return;
    addUserMessage(city);
    setStep(2);
    setTimeout(() => {
      addAIMessage("What size of home are you looking for?");
    }, 500);
  };

  const handleBhk = (selectedBhk: string) => {
    setBhk(selectedBhk);
    addUserMessage(selectedBhk);
    setStep(3);
    setTimeout(() => {
      addAIMessage("Last one — any absolute deal breakers? Things you won't tolerate at all.");
    }, 500);
  };

  const handleDealBreakers = () => {
    addUserMessage(dealBreakers || "None specifically");
    setStep(4);
    // Show completion animation
    setTimeout(() => {
      setShowComplete(true);
    }, 1500);
  };

  const handleScrapeComplete = () => {
    const params = new URLSearchParams();
    if (city) params.set("location", city);
    if (bhk) params.set("bhk", bhk);
    if (intent) params.set("intent", intent);
    if (selectedPrefs.length) params.set("prefs", selectedPrefs.join(","));
    if (dealBreakers) params.set("dealBreakers", dealBreakers);

    router.push(`/dashboard?${params.toString()}`);
  };


  // Completion screen
  if (showComplete) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
        <AgentProgress 
          location={city || "Your Location"} 
          bhk={bhk || "Any BHK"} 
          onComplete={handleScrapeComplete} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Image Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <img
              src={ONBOARDING_IMAGES[step] || ONBOARDING_IMAGES[0]}
              alt="Property"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Step counter */}
        <div className="absolute top-6 left-6 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
          <span className="text-white text-sm font-dm">Step {Math.min(step + 1, 4)} of 4</span>
        </div>

        {/* Quote */}
        <div className="absolute bottom-8 left-8 right-8">
          <p className="text-white/70 text-sm font-dm italic">&ldquo;{QUOTES[step] || QUOTES[0]}&rdquo;</p>
        </div>
      </div>

      {/* Right - Chat Panel */}
      <div className="flex-1 bg-cream flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-sand">
          <motion.div
            className="h-full bg-forest"
            animate={{ width: `${(Math.min(step + 1, 4) / 4) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Logo */}
        <div className="px-6 py-4 border-b border-border-custom">
          <div className="flex items-center gap-1">
            <span className="font-playfair italic text-xl text-charcoal">griha</span>
            <span className="font-playfair text-xl text-warm-gold font-bold">AI</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.from === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-forest flex items-center justify-center shrink-0 mr-2 mt-1">
                    <span className="text-white text-xs font-bold font-playfair italic">G</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-dm ${
                    msg.from === "user"
                      ? "bg-forest text-white rounded-tr-sm"
                      : "bg-surface border border-border-custom text-charcoal rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && <TypingIndicator />}

          {/* Input areas based on step */}
          {!isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              {/* Step 0: Rent or Buy */}
              {step === 0 && !intent && (
                <div className="flex gap-3 justify-center mt-4">
                  {["rent", "buy"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleIntent(opt)}
                      className="px-8 py-3 rounded-full border-2 border-forest text-forest font-dm font-semibold hover:bg-forest hover:text-white transition-all capitalize text-lg"
                    >
                      {opt === "rent" ? "Rent" : "Buy"}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 1: Location Autocomplete */}
              {step === 1 && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={citySearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCitySearch(val);
                        fetchLocationSuggestions(val);
                      }}
                      placeholder="Type a city or locality..."
                      className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl text-sm font-dm focus:outline-none focus:border-forest"
                    />
                    {locationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-surface border border-border-custom rounded-xl mt-1 overflow-hidden shadow-lg z-10">
                        {locationSuggestions.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setCity(c);
                              setCitySearch(c);
                              setLocationSuggestions([]);
                            }}
                            className={`block w-full text-left px-4 py-2.5 text-sm font-dm hover:bg-cream transition-colors ${
                              city === c ? "bg-forest/10 text-forest font-semibold" : "text-charcoal"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {citySearch && (
                    <button
                      onClick={() => {
                        // Allow proceeding with whatever they typed even if not in list
                        if (!city) setCity(citySearch);
                        handleCity();
                      }}
                      className="w-full py-3 bg-forest text-white rounded-xl font-dm font-semibold hover:bg-forest-light transition-colors"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: BHK */}
              {step === 2 && (
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  {["1 RK", "1 BHK", "2 BHK", "3 BHK", "4+ BHK"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleBhk(opt)}
                      className="px-6 py-3 rounded-full border-2 border-forest text-forest font-dm font-semibold hover:bg-forest hover:text-white transition-all text-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3: Deal breakers */}
              {step === 3 && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={dealBreakers}
                    onChange={(e) => setDealBreakers(e.target.value)}
                    placeholder="e.g., No ground floor, no busy road..."
                    className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl text-sm font-dm focus:outline-none focus:border-forest"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDealBreakers();
                    }}
                  />
                  <button
                    onClick={handleDealBreakers}
                    className="w-full py-3 bg-forest text-white rounded-xl font-dm font-semibold hover:bg-forest-light transition-colors"
                  >
                    Build My Search Profile
                  </button>
                </div>
              )}

              {/* Step 4: Building profile animation */}
              {step === 4 && !showComplete && (
                <div className="mt-4 bg-surface border border-border-custom rounded-xl p-6 text-center">
                  <p className="text-sm font-dm text-charcoal mb-3">Building your search profile...</p>
                  <div className="h-2 bg-sand rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-forest rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5 }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
