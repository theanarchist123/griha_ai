"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import {
  Home,
  Search,
  Scale,
  MessageSquare,
  FileText,
  MapPin,
  Settings,
  Activity,
  Bell,
  BarChart3,
  SlidersHorizontal,
  LocateFixed,
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "My Matches", href: "/dashboard", icon: Home, badge: 8 },
  { label: "Pipeline", href: "/dashboard#pipeline", icon: BarChart3 },
  { label: "Legal Checks", href: "/legal/prop-1", icon: Scale },
  { label: "Negotiations", href: "/negotiate/prop-1", icon: MessageSquare },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Neighbourhood", href: "/neighbourhood/bandra-west", icon: MapPin },
  { label: "Preferences", href: "/preferences", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useUser();

  const preferredLocation = searchParams.get("location") || "";
  const preferredBhk = searchParams.get("bhk") || "Any BHK";
  const displayName = user?.fullName || user?.firstName || "Home Seeker";
  const preferenceLabel = preferredLocation
    ? `${preferredBhk} in ${preferredLocation}`
    : "Set location and BHK to personalize matches";

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-surface border-r border-border-custom flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <Link href="/" className="flex items-center gap-1">
          <span className="font-playfair italic text-2xl text-charcoal">griha</span>
          <span className="font-playfair text-2xl text-warm-gold font-bold">AI</span>
        </Link>
      </div>

      {/* User greeting */}
      <div className="px-6 pb-4 border-b border-border-custom">
        <p className="text-sm text-muted">Welcome back,</p>
        <p className="font-dm font-semibold text-charcoal">{isSignedIn ? displayName : "Guest"}</p>
        <p className="text-xs text-muted mt-1">{preferenceLabel}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href.split("#")[0] + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-dm transition-all",
                isActive
                  ? "bg-forest/10 text-forest font-semibold"
                  : "text-muted hover:bg-cream hover:text-charcoal"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-forest text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="px-4 py-4 border-t border-border-custom">
        <SignedIn>
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-charcoal truncate">{displayName}</p>
              <p className="text-xs text-warm-gold font-medium">Signed in with Clerk</p>
            </div>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full rounded-xl bg-forest text-white text-sm font-semibold px-3 py-2 hover:bg-forest-light transition-colors">
              Sign in
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </aside>
  );
}

export interface DashboardSearchFilters {
  location: string;
  bhk: string;
  gated: boolean;
  pet: boolean;
  parking: boolean;
}

interface DashboardTopBarProps {
  filters: DashboardSearchFilters;
  onApplyFilters: (filters: DashboardSearchFilters) => void;
}

export function DashboardTopBar({ filters, onApplyFilters }: DashboardTopBarProps) {
  const defaultFilters: DashboardSearchFilters = { location: "", bhk: "Any BHK", gated: false, pet: false, parking: false };
  const safeFilters = filters || defaultFilters;
  
  const { user, isSignedIn } = useUser();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DashboardSearchFilters>(safeFilters);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftFilters(filters || defaultFilters);
  }, [filters]);

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isSearchExpanded || !draftFilters.location.trim()) {
      setLocationSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const res = await fetch(
          `http://localhost:8000/api/locations/autocomplete?q=${encodeURIComponent(draftFilters.location.trim())}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          setLocationSuggestions([]);
          return;
        }

        const json = await res.json();
        setLocationSuggestions(Array.isArray(json) ? json : []);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setLocationSuggestions([]);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draftFilters.location, isSearchExpanded]);

  const toggleAmenity = (key: "gated" | "pet" | "parking") => {
    setDraftFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUseCurrentLocation = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setLocationStatus("Requesting location permission...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setLocationStatus("Detecting your locality...");

          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude),
          });

          const response = await fetch(`http://localhost:8000/api/locations/reverse?${params.toString()}`);
          if (!response.ok) {
            throw new Error("reverse_geocode_failed");
          }

          const payload = await response.json();
          const detectedLocation = typeof payload?.location === "string" ? payload.location.trim() : "";

          if (!detectedLocation) {
            throw new Error("location_not_found");
          }

          const nextFilters = { ...draftFilters, location: detectedLocation };
          setDraftFilters(nextFilters);
          onApplyFilters(nextFilters);
          setIsSearchExpanded(false);
          setLocationSuggestions([]);
          setLocationStatus(`Showing properties near ${detectedLocation}`);
        } catch {
          setLocationStatus("Unable to detect your location right now. Please try again.");
        } finally {
          setLocating(false);
          window.setTimeout(() => setLocationStatus(""), 4500);
        }
      },
      (error) => {
        const messageByCode: Record<number, string> = {
          1: "Location access denied. Please allow permission and try again.",
          2: "Location unavailable. Please try again in a few seconds.",
          3: "Location request timed out. Please try again.",
        };
        setLocating(false);
        setLocationStatus(messageByCode[error.code] || "Unable to read your location.");
        window.setTimeout(() => setLocationStatus(""), 4500);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const applyFilters = () => {
    onApplyFilters(draftFilters);
    setIsSearchExpanded(false);
    setLocationSuggestions([]);
  };

  const profileName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Home Seeker";

  return (
    <div className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-border-custom">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-3 min-h-[72px] gap-4">
        {/* Status indicators */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 bg-surface/50 border border-border-custom px-3 py-1.5 rounded-full shrink-0">
            <motion.span
              className="w-2 h-2 rounded-full bg-success"
              animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[13px] text-charcoal font-dm">
              <span className="font-bold">1,247</span> <span className="text-muted">searched</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-forest/5 border border-forest/10 px-3 py-1.5 rounded-full hidden sm:flex shrink-0">
            <span className="font-bold text-forest text-[13px]">8</span>
            <span className="text-forest/70 text-[13px] font-dm">new matches</span>
          </div>
        </div>

        {/* Global Advanced Search Center */}
        <div 
          ref={searchRef}
          className={cn(
            "relative transition-all duration-300 ease-out z-50",
            isSearchExpanded ? "w-[500px]" : "w-[300px]"
          )}
        >
          <div 
            className={cn(
              "bg-surface border-border-custom rounded-2xl shadow-sm transition-all",
              isSearchExpanded ? "border shadow-xl overflow-visible" : "border hover:shadow-md cursor-pointer overflow-hidden"
            )}
            onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
          >
            {/* The collapsed view / Search Input row */}
            <div className="flex items-center px-2 py-1.5 h-12">
              <div className="flex-1 flex items-center px-3 relative">
                <Search className="w-4 h-4 text-muted mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Where do you want to live?"
                  value={draftFilters.location}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, location: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      applyFilters();
                    }
                  }}
                  className="w-full bg-transparent text-sm font-dm focus:outline-none text-charcoal"
                  autoComplete="off"
                />

                {isSearchExpanded && (locationSuggestions.length > 0 || loadingSuggestions) && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-surface border border-border-custom rounded-xl shadow-lg overflow-hidden">
                    {loadingSuggestions && (
                      <div className="px-4 py-2.5 text-xs font-dm text-muted">Searching locations...</div>
                    )}
                    {!loadingSuggestions && locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftFilters((prev) => ({ ...prev, location: suggestion }));
                          setLocationSuggestions([]);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm font-dm text-charcoal hover:bg-cream transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="px-3 h-9 border-l border-border-custom text-sm font-dm text-muted hover:text-charcoal transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Use my current location"
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LocateFixed className="w-4 h-4" />
                )}
                <span className="hidden xl:inline">Near Me</span>
              </button>
              
              {!isSearchExpanded && (
                <div className="px-3 border-l border-border-custom text-sm font-dm text-muted flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </div>
              )}

              {isSearchExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    applyFilters();
                  }}
                  className="px-5 py-2 mr-1 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-light transition-colors shadow-sm"
                >
                  Search
                </button>
              )}
            </div>

            {/* Expanded Content Panel */}
            <AnimatePresence>
              {isSearchExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border-custom bg-surface px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  {/* Dropdown for BHK */}
                  <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <span className="text-xs font-dm text-muted font-medium uppercase tracking-wider">SIZE</span>
                    <select 
                      value={draftFilters.bhk}
                      onChange={(e) => setDraftFilters((prev) => ({ ...prev, bhk: e.target.value }))}
                      className="bg-cream border border-border-custom text-sm text-charcoal font-dm rounded-lg px-3 py-2 outline-none focus:border-forest"
                    >
                      <option>Any BHK</option>
                      <option>1 BHK</option>
                      <option>2 BHK</option>
                      <option>3 BHK</option>
                      <option>4+ BHK</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <span className="text-xs font-dm text-muted font-medium uppercase tracking-wider">AMENITIES</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAmenity("gated");
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border font-dm",
                          draftFilters.gated
                            ? "bg-forest text-white border-forest"
                            : "bg-cream text-charcoal border-border-custom"
                        )}
                      >
                        Gated
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAmenity("pet");
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border font-dm",
                          draftFilters.pet
                            ? "bg-forest text-white border-forest"
                            : "bg-cream text-charcoal border-border-custom"
                        )}
                      >
                        Pet Friendly
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAmenity("parking");
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border font-dm",
                          draftFilters.parking
                            ? "bg-forest text-white border-forest"
                            : "bg-cream text-charcoal border-border-custom"
                        )}
                      >
                        Parking
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {locationStatus && (
            <p className={cn(
              "mt-2 px-3 text-xs font-dm",
              locationStatus.toLowerCase().includes("unable") || locationStatus.toLowerCase().includes("denied")
                ? "text-danger"
                : "text-forest"
            )}>
              {locationStatus}
            </p>
          )}
        </div>

        {/* Right side interactions */}
        <div className="flex items-center justify-end gap-3">
          <SignedIn>
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-border-custom bg-surface px-2.5 py-1.5">
              <UserButton afterSignOutUrl="/sign-in" />
              <span className="max-w-[140px] truncate text-sm font-dm font-semibold text-charcoal">
                {profileName}
              </span>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-xl bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest-light transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <button className="relative p-2.5 bg-surface border border-border-custom hover:border-forest/50 rounded-xl transition-all hover:shadow-sm">
            <Bell className="w-4 h-4 text-charcoal" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger border border-white rounded-full" />
          </button>
          <Link href="/activity" className="p-2.5 bg-surface border border-border-custom hover:border-forest/50 rounded-xl transition-all hover:shadow-sm">
            <Activity className="w-4 h-4 text-charcoal" />
          </Link>
        </div>
      </div>
    </div>
  );
}
