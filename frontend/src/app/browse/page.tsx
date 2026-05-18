"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, X, ChevronDown, Loader2,
  ArrowUpDown, MapPin, Building2
} from "lucide-react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";
import { PropertyCard } from "@/components/shared/PropertyCard";
import type { Property } from "@/lib/mockData";
import { formatPrice } from "@/lib/utils";
import { STATIC_IMAGES } from "@/lib/unsplash";


const BHK_OPTIONS = ["Any BHK", "1 BHK", "1 RK", "2 BHK", "3 BHK", "4 BHK", "4+ BHK"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "match", label: "Best Match" },
];
const FURNISHING_OPTIONS = ["Any", "Furnished", "Semi-Furnished", "Unfurnished"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRaw(raw: any): Property {
  const images =
    Array.isArray(raw?.images) && raw.images.length > 0
      ? raw.images
      : [STATIC_IMAGES.apartment1];
  return {
    id: raw?.id || raw?._id?.$oid || raw?._id || "unknown",
    title: raw?.title || undefined,
    apartmentName: raw?.apartment_name || raw?.apartmentName || undefined,
    address: raw?.address || raw?.title || "Address unavailable",
    locality: raw?.locality || raw?.city || "Unknown",
    city: raw?.city || "Unknown",
    price: Number(raw?.price || 0),
    priceType: "rent",
    size: Number(raw?.size || raw?.size_sqft || 0),
    bhk: raw?.bhk || "N/A",
    floor: raw?.floor || undefined,
    bathrooms: Number(raw?.bathrooms || 0) || undefined,
    balconies: Number(raw?.balconies || 0) || undefined,
    furnishing: raw?.furnishing || raw?.furnished_status || undefined,
    amenities: Array.isArray(raw?.amenities) ? raw.amenities : [],
    matchScore: Number(raw?.match_score || raw?.matchScore || 80),
    legalStatus: raw?.legal_status || raw?.legalStatus || "caution",
    photoRedFlags: Array.isArray(raw?.photo_red_flags) ? raw.photo_red_flags : [],
    aiInsight: raw?.ai_card_summary || raw?.aiInsight || "",
    aiHighlights: Array.isArray(raw?.ai_highlights) ? raw.ai_highlights : [],
    aiWatchouts: Array.isArray(raw?.ai_watchouts) ? raw.ai_watchouts : [],
    daysListed: Number(raw?.listed_days_ago || 0),
    images,
    sourcePlatform: raw?.source_platform || undefined,
    sourceUrl: raw?.source_url || undefined,
  };
}

function sortProperties(props: Property[], sort: string): Property[] {
  const arr = [...props];
  switch (sort) {
    case "price_asc": return arr.sort((a, b) => a.price - b.price);
    case "price_desc": return arr.sort((a, b) => b.price - a.price);
    case "match": return arr.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    default: return arr; // newest = API order
  }
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-forest" />
      </div>
    }>
      <BrowsePageInner />
    </Suspense>
  );
}

function BrowsePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [bhk, setBhk] = useState(searchParams.get("bhk") || "Any BHK");
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");
  const [furnishing, setFurnishing] = useState("Any");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProperties = useCallback(async (loc: string, b: string, min: string, max: string) => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    if (abortRef.current) abortRef.current.abort();

    fetchTimeoutRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (loc) params.set("location", loc);
        if (b && b !== "Any BHK") params.set("bhk", b);
        if (min) params.set("min_price", min);
        if (max) params.set("max_price", max);
        params.set("limit", "50");

        const res = await fetch(
          `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/properties/?${params.toString()}`,
          { signal: abortRef.current.signal }
        );
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data)) {
          const normalized = json.data.map(normalizeRaw);
          setProperties(normalized);
          setTotalCount(normalized.length);
        } else {
          setProperties([]);
          setTotalCount(0);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setProperties([]);
          setTotalCount(0);
        }
      } finally {
        setLoading(false);
      }
    }, 400); // debounce
  }, []);

  // Initial load + on filter change
  useEffect(() => {
    fetchProperties(location, bhk, minPrice, maxPrice);
  }, [location, bhk, minPrice, maxPrice, fetchProperties]);

  const filteredProps = sortProperties(
    properties.filter(p => {
      if (furnishing === "Any") return true;
      return (p.furnishing || "").toLowerCase().includes(furnishing.toLowerCase());
    }),
    sort
  );

  const activeFilters = [
    bhk !== "Any BHK" && bhk,
    minPrice && `₹${Number(minPrice).toLocaleString("en-IN")}+`,
    maxPrice && `under ₹${Number(maxPrice).toLocaleString("en-IN")}`,
    furnishing !== "Any" && furnishing,
  ].filter(Boolean) as string[];

  const clearFilter = (f: string) => {
    if (f === bhk) setBhk("Any BHK");
    else if (f === furnishing) setFurnishing("Any");
    else if (f.startsWith("₹") && f.endsWith("+")) setMinPrice("");
    else if (f.startsWith("under")) setMaxPrice("");
  };

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="lg:ml-[260px]">
        <DashboardTopBar />

        <div className="p-6">
          {/* Search header */}
          <div className="mb-6">
            <h1 className="font-playfair text-3xl text-charcoal mb-1">Browse Properties</h1>
            <p className="text-sm text-muted font-dm">
              {loading ? "Searching..." : totalCount > 0 ? `${totalCount} properties found` : "Search by location to find properties"}
            </p>
          </div>

          {/* Search bar + controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Location search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="City, locality or area (e.g. Andheri, Pune)"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-surface border border-border-custom rounded-xl text-sm font-dm text-charcoal focus:outline-none focus:border-forest transition-colors"
              />
              {location && (
                <button onClick={() => setLocation("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* BHK quick select */}
            <div className="flex gap-2 flex-wrap">
              {["Any BHK", "1 BHK", "2 BHK", "3 BHK"].map(b => (
                <button
                  key={b}
                  onClick={() => setBhk(b)}
                  className={`px-3 py-2 rounded-xl text-sm font-dm font-semibold border transition-all whitespace-nowrap ${
                    bhk === b
                      ? "bg-forest text-white border-forest"
                      : "bg-surface border-border-custom text-charcoal hover:border-forest/40"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Filters button */}
            <button
              onClick={() => setShowFilters(s => !s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-dm font-semibold border transition-colors ${
                showFilters || activeFilters.length > 0
                  ? "bg-forest text-white border-forest"
                  : "bg-surface border-border-custom text-charcoal hover:border-forest/40"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </button>

            {/* Sort button */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(s => !s)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-dm font-semibold border border-border-custom bg-surface text-charcoal hover:border-forest/40 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                {SORT_OPTIONS.find(s => s.value === sort)?.label || "Sort"}
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border-custom rounded-xl shadow-lg overflow-hidden z-20"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSort(opt.value); setShowSortMenu(false); }}
                        className={`block w-full text-left px-4 py-2.5 text-sm font-dm transition-colors ${
                          sort === opt.value ? "bg-forest/10 text-forest font-semibold" : "text-charcoal hover:bg-cream"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Expanded filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="bg-surface border border-border-custom rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wide mb-1.5 block">BHK Type</label>
                    <select
                      value={bhk}
                      onChange={e => setBhk(e.target.value)}
                      className="w-full bg-cream border border-border-custom rounded-lg px-3 py-2 text-sm font-dm text-charcoal focus:outline-none focus:border-forest"
                    >
                      {BHK_OPTIONS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wide mb-1.5 block">Min Price</label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="w-full bg-cream border border-border-custom rounded-lg px-3 py-2 text-sm font-dm text-charcoal focus:outline-none focus:border-forest"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wide mb-1.5 block">Max Price</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="w-full bg-cream border border-border-custom rounded-lg px-3 py-2 text-sm font-dm text-charcoal focus:outline-none focus:border-forest"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wide mb-1.5 block">Furnishing</label>
                    <select
                      value={furnishing}
                      onChange={e => setFurnishing(e.target.value)}
                      className="w-full bg-cream border border-border-custom rounded-lg px-3 py-2 text-sm font-dm text-charcoal focus:outline-none focus:border-forest"
                    >
                      {FURNISHING_OPTIONS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeFilters.map(f => (
                <button
                  key={f}
                  onClick={() => clearFilter(f)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-forest/10 text-forest rounded-full text-xs font-dm font-semibold hover:bg-forest/20 transition-colors"
                >
                  {f} <X className="w-3 h-3" />
                </button>
              ))}
              <button
                onClick={() => { setBhk("Any BHK"); setMinPrice(""); setMaxPrice(""); setFurnishing("Any"); }}
                className="text-xs font-dm text-muted hover:text-charcoal underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Results grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[340px] bg-surface rounded-2xl border border-border-custom animate-pulse" />
              ))}
            </div>
          ) : filteredProps.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProps.map((prop, i) => (
                <motion.div
                  key={prop.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                >
                  <PropertyCard property={prop} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              {location ? (
                <>
                  <Building2 className="w-12 h-12 text-muted" />
                  <p className="font-dm font-semibold text-charcoal text-lg">No properties found in {location}</p>
                  <p className="text-sm text-muted font-dm max-w-xs">
                    Try adjusting your filters, or go to the Dashboard to scrape fresh listings from MagicBricks, 99acres & more.
                  </p>
                  <button
                    onClick={() => router.push(`/dashboard?location=${encodeURIComponent(location)}&bhk=${encodeURIComponent(bhk)}`)}
                    className="px-6 py-2.5 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-light transition-colors"
                  >
                    Scrape listings for {location}
                  </button>
                </>
              ) : (
                <>
                  <MapPin className="w-12 h-12 text-muted" />
                  <p className="font-dm font-semibold text-charcoal text-lg">Enter a location to browse</p>
                  <p className="text-sm text-muted font-dm">Search by city, locality or area above</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
