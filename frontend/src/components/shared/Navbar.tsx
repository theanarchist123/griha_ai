"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  Menu,
  X,
  Shield,
  CheckCircle2,
  Zap,
  FileSearch,
  BellRing,
} from "lucide-react";


const NAV_ITEMS = [
  { label: "My Matches", href: "/dashboard", icon: Home, badge: 8 },
  { label: "Browse", href: "/browse", icon: Search },
  { label: "Pipeline", href: "/pipeline", icon: BarChart3 },
  { label: "Price Alerts", href: "/alerts", icon: BellRing },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Contract AI", href: "/contract", icon: Shield },
  { label: "Neighbourhood", href: "/neighbourhood", icon: MapPin },
];


// Shared state for mobile sidebar
let _sidebarListeners: Array<(open: boolean) => void> = [];
let _sidebarOpen = false;

export function toggleMobileSidebar() {
  _sidebarOpen = !_sidebarOpen;
  _sidebarListeners.forEach(fn => fn(_sidebarOpen));
}

function useMobileSidebar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    _sidebarListeners.push(setOpen);
    return () => { _sidebarListeners = _sidebarListeners.filter(fn => fn !== setOpen); };
  }, []);
  return open;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const mobileOpen = useMobileSidebar();

  // Read search params safely (no useSearchParams → no Suspense requirement)
  const [preferenceLabel, setPreferenceLabel] = useState("Set location and BHK to personalize matches");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const loc = sp.get("location") || "";
    const bhk = sp.get("bhk") || "Any BHK";
    setPreferenceLabel(loc ? `${bhk} in ${loc}` : "Set location and BHK to personalize matches");
  }, [pathname]);

  const displayName = user?.fullName || user?.firstName || "Home Seeker";


  // Close sidebar on route change (mobile)
  useEffect(() => {
    _sidebarOpen = false;
    _sidebarListeners.forEach(fn => fn(false));
  }, [pathname]);

  return (
    <>
      {/* Overlay backdrop on mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => toggleMobileSidebar()}
        />
      )}
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-[260px] bg-surface border-r border-border-custom flex flex-col z-50 transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo + Close on mobile */}
        <div className="px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1">
            <span className="font-playfair italic text-2xl text-charcoal">griha</span>
            <span className="font-playfair text-2xl text-warm-gold font-bold">AI</span>
          </Link>
          <button
            onClick={() => toggleMobileSidebar()}
            className="lg:hidden p-1.5 text-muted hover:text-charcoal rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
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
    </>
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
  filters?: DashboardSearchFilters;
  onApplyFilters?: (filters: DashboardSearchFilters) => void;
}

export function DashboardTopBar({ filters, onApplyFilters }: DashboardTopBarProps = {}) {
  const defaultFilters: DashboardSearchFilters = { location: "", bhk: "Any BHK", gated: false, pet: false, parking: false };
  const safeFilters = filters || defaultFilters;
  
  const { user } = useUser();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DashboardSearchFilters>(safeFilters);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Notification panel state
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (!showNotifPanel) return;
    setNotifLoading(true);
    fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/activity/?limit=15`)
      .then(r => r.json())
      .then(json => {
        if (json.status === "success" && Array.isArray(json.data)) setNotifications(json.data);
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [showNotifPanel]);

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notif-panel]")) setShowNotifPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifPanel]);


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
          `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/locations/autocomplete?q=${encodeURIComponent(draftFilters.location.trim())}`,
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

          const response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/locations/reverse?${params.toString()}`);
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
          onApplyFilters?.(nextFilters);
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
    onApplyFilters?.(draftFilters);
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
      <div className="flex items-center px-4 lg:px-6 py-3 min-h-[72px] gap-3 lg:gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={() => toggleMobileSidebar()}
          className="lg:hidden p-2 text-charcoal hover:bg-surface rounded-xl border border-border-custom shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Status indicators */}
        <div className="hidden md:flex items-center gap-4 min-w-0">
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
            "relative transition-all duration-300 ease-out z-50 flex-1 lg:flex-none",
            isSearchExpanded ? "lg:w-[500px]" : "lg:w-[300px]"
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
                  onChange={(e) => {
                    setDraftFilters((prev) => ({ ...prev, location: e.target.value }));
                    if (!isSearchExpanded) setIsSearchExpanded(true);
                  }}
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
          <button
            className="relative p-2.5 bg-surface border border-border-custom hover:border-forest/50 rounded-xl transition-all hover:shadow-sm"
            onClick={() => setShowNotifPanel(v => !v)}
            data-notif-panel
          >
            <Bell className="w-4 h-4 text-charcoal" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger border border-white rounded-full" />
            )}
          </button>
          {/* Notification panel */}
          <AnimatePresence>
            {showNotifPanel && (
              <motion.div
                data-notif-panel
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                className="absolute top-16 right-4 w-80 bg-surface border border-border-custom rounded-2xl shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom">
                  <p className="font-dm font-bold text-charcoal text-sm">Notifications</p>
                  <button onClick={() => setShowNotifPanel(false)}>
                    <X className="w-4 h-4 text-muted" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-forest" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-muted mx-auto mb-2" />
                      <p className="text-xs font-dm text-muted">All caught up! No new notifications.</p>
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((n: any) => (
                      <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-cream transition-colors border-b border-border-custom last:border-0">
                        <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center shrink-0">
                          {n.type === "scrape" ? <Zap className="w-4 h-4 text-forest" /> :
                           n.type === "document" ? <FileSearch className="w-4 h-4 text-forest" /> :
                           <Bell className="w-4 h-4 text-forest" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-dm font-semibold text-charcoal leading-snug">{n.text}</p>
                          <p className="text-[10px] text-muted mt-0.5">{n.timestamp}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-border-custom p-2">
                  <Link href="/activity" onClick={() => setShowNotifPanel(false)} className="block w-full text-center py-2 text-xs font-dm font-semibold text-forest hover:bg-forest/5 rounded-lg transition-colors">
                    View all activity →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
