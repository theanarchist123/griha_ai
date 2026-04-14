"use client";

import { motion } from "framer-motion";
import { DashboardSidebar, DashboardTopBar, type DashboardSearchFilters } from "@/components/shared/Navbar";
import { PropertyCard } from "@/components/shared/PropertyCard";
import { SkeletonCard } from "@/components/shared/LoadingState";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/lib/mockData";
import { STATIC_IMAGES } from "@/lib/unsplash";
import {
  Home,
  Eye,
  MessageSquare,
  FileCheck,
  Clock,
  Search,
  Scale,
  AlertTriangle,
  FileText,
  Bell,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const ACTIVITY_ICONS: Record<string, { icon: typeof Home; color: string }> = {
  match: { icon: Home, color: "bg-forest text-white" },
  negotiation: { icon: MessageSquare, color: "bg-warm-gold text-white" },
  legal: { icon: Scale, color: "bg-blue-500 text-white" },
  document: { icon: FileText, color: "bg-muted text-white" },
  alert: { icon: AlertTriangle, color: "bg-orange-500 text-white" },
  system: { icon: CheckCircle, color: "bg-charcoal text-white" },
};

const PIPELINE_COLUMNS = [
  { key: "shortlisted" as const, label: "Shortlisted", color: "bg-forest" },
  { key: "underReview" as const, label: "Under Review", color: "bg-warm-gold" },
  { key: "negotiating" as const, label: "Negotiating", color: "bg-blue-500" },
  { key: "offerMade" as const, label: "Offer Made", color: "bg-success" },
];

function buildCardSummaryFromRaw(raw: any): string {
  const bhk = typeof raw?.bhk === "string" ? raw.bhk : "Home";
  const apartmentName = raw?.apartment_name || raw?.apartmentName || raw?.title || "this project";
  const locality = raw?.locality || raw?.city || "selected locality";
  const rent = Number(raw?.price || 0);
  const source = raw?.source_platform || raw?.sourcePlatform || "listing source";
  const totalFlats = Number(raw?.total_flats_available || raw?.totalFlatsAvailable || 0);
  if (rent > 0) {
    const availability = totalFlats > 0 ? ` About ${totalFlats}+ similar flats are currently listed.` : "";
    return `${bhk} in ${apartmentName}, ${locality} at approximately INR ${Math.round(rent).toLocaleString("en-IN")}/month.${availability} Source: ${source}.`;
  }
  return `${bhk} listing in ${locality}. Verify current asking rent and source listing details before shortlisting.`;
}

function deriveApartmentName(raw: any): string | undefined {
  const explicit = raw?.apartment_name || raw?.apartmentName;
  if (typeof explicit === "string" && explicit.trim().length > 2) {
    // Clean leading prepositions
    let cleaned = explicit.trim().replace(/^(?:in|at|near|of)\s+/i, "").trim();
    // Strip trailing comma fragments
    cleaned = cleaned.split(",")[0].trim();
    if (cleaned.length >= 3) return cleaned;
  }

  // Also clean the title field — if it's a proper project name, use it
  const rawTitle = typeof raw?.title === "string" ? raw.title.trim() : "";
  if (rawTitle) {
    let titleCleaned = rawTitle.replace(/^(?:in|at|near|of)\s+/i, "").trim();
    titleCleaned = titleCleaned.split(",")[0].trim();
    const genericListing = /(verified|flat|flats|rent|sale|properties|apartments|listings|is available|price range|bhk)/i.test(titleCleaned);
    if (!genericListing && titleCleaned.length >= 4) {
      return titleCleaned;
    }
  }

  const description = `${raw?.description || ""} ${raw?.ai_card_summary || raw?.aiCardSummary || ""}`;
  const patterns = [
    /(?:apartment|project|society)\s+(?:at|in)\s+([A-Za-z][A-Za-z0-9&'\-., ]{3,80})/i,
    /(?:at|in)\s+([A-Za-z][A-Za-z0-9&'\-., ]{3,80})/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match?.[1]) continue;
    const candidate = match[1].split(",")[0].split(" for ")[0].split(" with ")[0].split(" near ")[0].trim();
    const lowered = candidate.toLowerCase();
    const invalid = ["is available", "price range", "for rent", "for sale", "verified flats", "listings"]; 
    if (invalid.some((phrase) => lowered.includes(phrase))) {
      continue;
    }
    // Skip if it's just the locality name
    const locality = (raw?.locality || "").toLowerCase();
    const city = (raw?.city || "").toLowerCase();
    if (lowered === locality || lowered === city) continue;

    if (candidate.length >= 4) {
      return candidate;
    }
  }

  return undefined;
}

function isGenericListingTitle(value: string | undefined): boolean {
  if (!value) return true;
  return /(flats?\s+for\s+rent|price\s+range|\bis\s+available\b|verified\s+\d+\+?\s*bhk\s*flats?|listings?|living\s+room\s+property|perfect\s+blend|semi\s+furnished\s+apartment)/i.test(value);
}

function isGenericCardInsight(value: string | undefined): boolean {
  if (!value) return true;
  return /(selected locality|verify current asking rent|live listing fetched from web index|primary details available)/i.test(value);
}

function deriveTotalFlats(raw: any): number | undefined {
  const explicit = Number(raw?.total_flats_available || raw?.totalFlatsAvailable || 0);
  if (explicit > 0) return explicit;

  const title = String(raw?.title || "");
  const match = title.match(/(\d{1,4})\+?\s*(?:verified\s*)?(?:flat|flats|properties|units|homes)/i);
  if (!match?.[1]) return undefined;

  const parsed = Number(match[1]);
  return parsed > 0 ? parsed : undefined;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topMatches, setTopMatches] = useState<Property[]>([]);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchNotice, setSearchNotice] = useState<string>("");
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [scrapeFound, setScrapeFound] = useState(0);

  const initialFilters = useMemo<DashboardSearchFilters>(() => {
    return {
      location: searchParams.get("location") || "",
      bhk: searchParams.get("bhk") || "Any BHK",
      gated: searchParams.get("gated") === "true",
      pet: searchParams.get("pet") === "true",
      parking: searchParams.get("parking") === "true",
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<DashboardSearchFilters>(initialFilters);

  const resolveId = (raw: any, index: number): string => {
    const direct = raw?.id ?? raw?._id;
    if (typeof direct === "string") return direct;
    if (direct && typeof direct === "object" && typeof direct.$oid === "string") return direct.$oid;
    if (typeof raw?.external_id === "string") return raw.external_id;
    return `prop-${index}`;
  };

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const normalizeProperty = (raw: any, index: number): Property => {
    const apartmentName = deriveApartmentName(raw);

    const rawFlags = Array.isArray(raw?.photoRedFlags)
      ? raw.photoRedFlags
      : Array.isArray(raw?.photo_red_flags)
        ? raw.photo_red_flags
        : [];

    const legal = raw?.legalStatus || raw?.legal_status || "caution";
    const legalStatus = legal === "clean" || legal === "high_risk" ? legal : "caution";

    const images = Array.isArray(raw?.images) && raw.images.length > 0
      ? raw.images
      : [STATIC_IMAGES.apartment1];

    return {
      id: resolveId(raw, index),
      title: apartmentName || (isGenericListingTitle(raw?.title) ? undefined : raw?.title) || undefined,
      apartmentName,
      totalFlatsAvailable: deriveTotalFlats(raw),
      sourcePlatform: raw?.source_platform || raw?.sourcePlatform || undefined,
      sourceUrl: raw?.source_url || raw?.sourceUrl || undefined,
      address: raw?.address || raw?.title || "Address unavailable",
      locality: raw?.locality || raw?.city || "Unknown locality",
      city: raw?.city || "Unknown city",
      price: Number(raw?.price || 0),
      priceType: "rent",
      size: Number(raw?.size || raw?.size_sqft || 0),
      bhk: typeof raw?.bhk === "string" ? raw.bhk : String(raw?.bhk || "N/A"),
      floor: raw?.floor || "Floor not provided",
      bathrooms: Number(raw?.bathrooms || 0) || undefined,
      balconies: Number(raw?.balconies || 0) || undefined,
      furnishing: raw?.furnishing || raw?.furnished_status || "Not specified",
      amenities: Array.isArray(raw?.amenities) ? raw.amenities : [],
      matchScore: Number(raw?.matchScore || raw?.match_score || Math.max(55, 90 - rawFlags.length * 8)),
      legalStatus,
      photoRedFlags: rawFlags,
      aiInsight: isGenericCardInsight(raw?.ai_card_summary || raw?.aiCardSummary || raw?.aiInsight)
        ? buildCardSummaryFromRaw(raw)
        : (raw?.ai_card_summary || raw?.aiCardSummary || raw?.aiInsight),
      aiDetailOverview: raw?.ai_detail_overview || raw?.aiDetailOverview || undefined,
      aiLocationInsights: raw?.ai_location_insights || raw?.aiLocationInsights || undefined,
      aiInvestmentOutlook: raw?.ai_investment_outlook || raw?.aiInvestmentOutlook || undefined,
      aiNegotiationTips: raw?.ai_negotiation_tips || raw?.aiNegotiationTips || undefined,
      aiHighlights: Array.isArray(raw?.ai_highlights)
        ? raw.ai_highlights
        : Array.isArray(raw?.aiHighlights)
          ? raw.aiHighlights
          : [],
      aiWatchouts: Array.isArray(raw?.ai_watchouts)
        ? raw.ai_watchouts
        : Array.isArray(raw?.aiWatchouts)
          ? raw.aiWatchouts
          : rawFlags,
      daysListed: Number(raw?.daysListed || raw?.listed_days_ago || 0),
      images,
    };
  };

  const startScraping = (location: string, bhk: string) => {
    if (scraping) return;

    setScraping(true);
    setScrapeProgress(0);
    setScrapeStatus("🔗 Connecting to scraper agent...");
    setScrapeFound(0);
    setLoading(false);

    const clientId = Math.random().toString(36).substring(7);
    const ws = new WebSocket(`ws://localhost:8000/api/ws/scrape-progress/${clientId}`);

    ws.onopen = () => {
      setScrapeStatus("🔍 Connected! Starting live property search...");
      ws.send(JSON.stringify({ action: "start_scraping", location, bhk }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) setScrapeProgress(data.progress);
        if (data.status) setScrapeStatus(data.status);
        if (data.found_count !== undefined) setScrapeFound(data.found_count);
        if (data.progress >= 100) {
          setTimeout(() => {
            setScraping(false);
            setScrapeProgress(0);
            setFilters((prev) => ({ ...prev, _refresh: Date.now() } as any));
          }, 1500);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      setScrapeStatus("❌ Connection error. Make sure the backend is running on port 8000.");
      setTimeout(() => setScraping(false), 4000);
    };

    ws.onclose = () => {
      setScraping((current) => {
        if (current) {
          setScrapeStatus("Connection closed.");
          setTimeout(() => setScraping(false), 2000);
        }
        return current;
      });
    };
  };

  const handleStartScrape = () => {
    if (!filters.location) return;
    startScraping(filters.location, filters.bhk || "Any BHK");
  };

  useEffect(() => {
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    async function fetchData() {
      setLoading(true);
      setSearchProgress(12);
      progressTimer = setInterval(() => {
        setSearchProgress((prev) => (prev >= 90 ? prev : prev + 9));
      }, 160);

      try {
        const params = new URLSearchParams();
        if (filters.location) params.set("location", filters.location);
        if (filters.bhk && filters.bhk !== "Any BHK") params.set("bhk", filters.bhk);
        if (filters.gated) params.set("gated", "true");
        if (filters.pet) params.set("pet", "true");
        if (filters.parking) params.set("parking", "true");

        const searchUrl = params.toString()
          ? `http://localhost:8000/api/properties/search?${params.toString()}`
          : "http://localhost:8000/api/properties/search";

        const searchRes = await fetch(searchUrl);
        const searchJson = await searchRes.json();
        let apiProperties = Array.isArray(searchJson.results)
          ? searchJson.results
          : Array.isArray(searchJson.data)
            ? searchJson.data
            : [];

        if (searchJson?.meta?.fallback_applied && searchJson?.meta?.requested_bhk && filters.location) {
          setSearchNotice(
            `No exact ${searchJson.meta.requested_bhk} listings found in ${filters.location}. Showing currently available homes in this location.`
          );
        } else {
          setSearchNotice("");
        }

        const hasActiveFilters =
          Boolean(filters.location) ||
          (Boolean(filters.bhk) && filters.bhk !== "Any BHK") ||
          filters.gated ||
          filters.pet ||
          filters.parking;

        // Only fallback when there are no active filters
        if (apiProperties.length === 0 && !hasActiveFilters) {
          const allRes = await fetch("http://localhost:8000/api/properties/");
          const allJson = await allRes.json();
          apiProperties = Array.isArray(allJson.data) ? allJson.data : [];
        }

        setTopMatches(apiProperties.map(normalizeProperty));
        setPipelineData({ shortlisted: [], underReview: [], negotiating: [], offerMade: [] });
        setRecentActivity([]);

        // ============================================================
        // AUTO-TRIGGER SCRAPING when location is set but 0 DB results
        // ============================================================
        if (apiProperties.length === 0 && filters.location && !isCancelled) {
          // Start live scraping automatically
          startScraping(filters.location, filters.bhk || "Any BHK");
        }

      } catch (e) {
        console.error("Failed to fetch dashboard data:", e);
      } finally {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        if (!isCancelled) {
          setSearchProgress(100);
          finishTimer = setTimeout(() => {
            if (!isCancelled) {
              setLoading(false);
              setSearchProgress(0);
            }
          }, 220);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      if (finishTimer) {
        clearTimeout(finishTimer);
      }
    };
  }, [filters]);

  const handleApplyFilters = (nextFilters: DashboardSearchFilters) => {
    setFilters(nextFilters);

    const params = new URLSearchParams();
    if (nextFilters.location) params.set("location", nextFilters.location);
    if (nextFilters.bhk && nextFilters.bhk !== "Any BHK") params.set("bhk", nextFilters.bhk);
    if (nextFilters.gated) params.set("gated", "true");
    if (nextFilters.pet) params.set("pet", "true");
    if (nextFilters.parking) params.set("parking", "true");

    router.replace(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard");
  };



  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />

      <div className="ml-[260px] mr-[300px]">
        <DashboardTopBar filters={filters} onApplyFilters={handleApplyFilters} />

        <div className="p-6 space-y-8">
          {/* Today's Top Matches */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-playfair text-2xl text-charcoal">Today&apos;s Top Matches</h2>
              <Link
                href={`/compare?ids=${topMatches.slice(0, 3).map((p) => p.id).join(",")}`}
                className="text-sm text-forest font-dm hover:underline flex items-center gap-1"
              >
                Compare All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {!loading && searchNotice && (
              <div className="mb-3 rounded-lg border border-warm-gold/30 bg-warm-gold/10 px-3 py-2 text-xs font-dm text-charcoal">
                {searchNotice}
              </div>
            )}
            {loading && (
              <div className="mb-4">
                <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-forest"
                    animate={{ width: `${searchProgress}%` }}
                    transition={{ ease: "easeOut", duration: 0.2 }}
                  />
                </div>
                <p className="mt-2 text-xs font-dm text-muted">
                  Searching listings{filters.location ? ` in ${filters.location}` : ""}
                  {filters.bhk && filters.bhk !== "Any BHK" ? ` for ${filters.bhk}` : ""}...
                </p>
              </div>
            )}

            {/* Inline Scraping Progress */}
            {scraping && (
              <div className="mb-4 bg-surface border border-forest/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Search className="w-4 h-4 text-forest animate-pulse" />
                  <span className="text-sm font-dm font-semibold text-charcoal">Live Scraping in Progress</span>
                  <span className="text-xs font-dm text-muted ml-auto">{scrapeProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden mb-2">
                  <motion.div className="h-full bg-forest" animate={{ width: `${scrapeProgress}%` }} transition={{ ease: "easeOut", duration: 0.3 }} />
                </div>
                <p className="text-xs font-dm text-muted">{scrapeStatus}</p>
                {scrapeFound > 0 && <p className="text-xs font-dm text-forest mt-1">{scrapeFound} properties found so far</p>}
              </div>
            )}

            <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-thin snap-x snap-mandatory -mx-2 px-2">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={`skeleton-${i}`} className="w-[335px] shrink-0 snap-start" />
              ))}
              {!loading && !scraping && topMatches.length === 0 && (
                <div className="flex flex-col items-center gap-4 p-8 border border-dashed border-border-custom rounded-xl w-full text-center">
                  <Search className="w-8 h-8 text-muted" />
                  <div>
                    <p className="text-sm font-dm font-semibold text-charcoal">
                      No properties found{filters.location ? ` in ${filters.location}` : ""}
                    </p>
                    <p className="text-xs font-dm text-muted mt-1">
                      {filters.location
                        ? "Click below to scrape live listings from MagicBricks, 99acres, Housing.com & NoBroker"
                        : "Enter a location in the search bar to find properties"}
                    </p>
                  </div>
                  {filters.location && (
                    <button
                      onClick={handleStartScrape}
                      className="px-6 py-2.5 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-light transition-colors shadow-sm flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Scrape Live from Property Sites
                    </button>
                  )}
                </div>
              )}
              {!loading && topMatches.map((property, i) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="shrink-0 snap-start"
                >
                  <PropertyCard property={property} />
                </motion.div>
              ))}
            </div>
          </section>

          {/* Pipeline Kanban */}
          <section id="pipeline">
            <h2 className="font-playfair text-2xl text-charcoal mb-4">Pipeline</h2>
            {!loading && pipelineData && (
              <div className="overflow-x-auto pb-4 -mx-2 px-2 scrollbar-thin">
                <div className="flex gap-4 min-w-[1000px] lg:grid lg:grid-cols-4 lg:min-w-0">
                {PIPELINE_COLUMNS.map((col) => {
                  const items = pipelineData[col.key] || [];
                  return (
                    <div key={col.key} className="bg-surface rounded-xl border border-border-custom p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                        <h3 className="font-dm font-semibold text-charcoal text-sm">{col.label}</h3>
                        <span className="ml-auto text-xs bg-cream px-2 py-0.5 rounded-full text-muted">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {items.length === 0 && (
                          <div className="text-center py-4 text-xs font-dm text-muted">No items</div>
                        )}
                        {items.map((prop: any) => (
                          <Link
                            key={prop.id || prop._id}
                            href={`/property/${prop.id || prop._id}`}
                            className="block bg-cream rounded-lg p-3 hover:shadow-md transition-shadow"
                          >
                            <div className="flex gap-3">
                              <img
                                src={prop.images?.[0] || ""}
                                alt={prop.address || "Property"}
                                className="w-14 h-14 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-dm font-semibold text-charcoal text-xs truncate">
                                  {prop.bhk}, {prop.locality}
                                </p>
                                <p className="text-forest font-bold text-sm mt-0.5">
                                  {formatPrice(prop.price)}/mo
                                </p>
                                <p className="text-muted text-[10px] mt-1 truncate italic">
                                  {prop.aiInsight ? prop.aiInsight.slice(0, 50) + "..." : ""}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        </div>
      </div>

      {/* AI Activity Feed - Right Panel */}
      <div className="fixed right-0 top-0 h-screen w-[300px] bg-surface border-l border-border-custom overflow-y-auto">
        <div className="p-4 border-b border-border-custom">
          <h3 className="font-dm font-bold text-charcoal text-sm">What Griha AI did while you were away</h3>
        </div>
        <div className="p-3 space-y-1">
          {recentActivity.length === 0 && (
            <div className="text-center py-4 text-xs font-dm text-muted">No recent activity</div>
          )}
          {recentActivity.map((item: any, i) => {
            const iconData = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.system;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3 p-2.5 rounded-lg hover:bg-cream transition-colors"
              >
                <div className={`w-8 h-8 rounded-full ${iconData.color} flex items-center justify-center shrink-0`}>
                  <iconData.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-dm font-semibold text-charcoal">{item.text}</p>
                  {item.propertyName && (
                    <p className="text-[10px] text-muted truncate">{item.propertyName}</p>
                  )}
                  <p className="text-[10px] text-muted mt-0.5">{item.timestamp}</p>
                </div>
                {item.actionLabel && item.actionHref && (
                  <Link
                    href={item.actionHref}
                    className="text-[10px] text-forest font-semibold hover:underline shrink-0 self-center"
                  >
                    {item.actionLabel}
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
