"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  MapPin,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Sofa,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { Property } from "@/lib/mockData";
import { formatPrice } from "@/lib/utils";
import { STATIC_IMAGES } from "@/lib/unsplash";

function parseId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "$oid" in value) {
    const oid = (value as { $oid?: unknown }).$oid;
    if (typeof oid === "string") return oid;
  }
  return null;
}

function normalizeProperty(raw: any): Property {
  const rawTitle = typeof raw?.title === "string" ? raw.title.trim() : "";
  const genericTitle = /(flats?\s+for\s+rent|price\s+range|\bis\s+available\b|verified\s+\d+\+?\s*bhk\s*flats?|listings?|living\s+room\s+property|perfect\s+blend|semi\s+furnished\s+apartment)/i.test(rawTitle);

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

  const rawInsight = raw?.ai_card_summary || raw?.aiCardSummary || raw?.aiInsight || "";
  const genericInsight = /selected locality|verify current asking rent|live listing fetched from web index|primary details available/i.test(String(rawInsight));

  // Clean apartment name — strip leading "in ", "at ", etc.
  const rawAptName = raw?.apartment_name || raw?.apartmentName || "";
  let cleanedAptName: string | undefined;
  if (typeof rawAptName === "string" && rawAptName.trim().length > 2) {
    cleanedAptName = rawAptName.trim().replace(/^(?:in|at|near|of)\s+/i, "").split(",")[0].trim();
    if (cleanedAptName.length < 3) cleanedAptName = undefined;
  }

  // Clean the title too
  let cleanedTitle: string | undefined;
  if (!genericTitle && rawTitle.length > 3) {
    const titleCandidate = rawTitle.replace(/^(?:in|at|near|of)\s+/i, "").split(",")[0].trim();
    const genericCheck = /(flat|flats|rent|sale|property|listing|bhk|verified)/i.test(titleCandidate);
    cleanedTitle = (!genericCheck && titleCandidate.length >= 3) ? titleCandidate : undefined;
  }

  return {
    id: parseId(raw?.id) || parseId(raw?._id) || raw?.external_id || "unknown-property",
    title: cleanedAptName || cleanedTitle || undefined,
    apartmentName: cleanedAptName || undefined,
    totalFlatsAvailable: Number(raw?.total_flats_available || raw?.totalFlatsAvailable || 0) || undefined,
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
    aiInsight: genericInsight
      ? `${typeof raw?.bhk === "string" ? raw.bhk : "Home"} in ${raw?.apartment_name || raw?.apartmentName || raw?.locality || raw?.city || "the selected locality"} at approximately INR ${Math.round(Number(raw?.price || 0)).toLocaleString("en-IN")}/month.`
      : rawInsight || `${typeof raw?.bhk === "string" ? raw.bhk : "Home"} listing in ${raw?.locality || raw?.city || "selected locality"}.`,
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
}

function deriveOverview(property: Property): string {
  const facts: string[] = [];
  if (property.apartmentName) {
    facts.push(`${property.bhk} listing in ${property.apartmentName}, ${property.locality}, ${property.city}.`);
  } else {
    facts.push(`${property.bhk} listing in ${property.locality}, ${property.city}.`);
  }
  if (property.price > 0) facts.push(`Current asking rent is ${formatPrice(property.price)}/month.`);
  if (property.totalFlatsAvailable && property.totalFlatsAvailable > 0) {
    facts.push(`Approximately ${property.totalFlatsAvailable}+ flats are currently listed in this project.`);
  }
  if (property.size > 0) facts.push(`Reported area is approximately ${property.size} sqft.`);
  if (property.bathrooms) facts.push(`Bathrooms reported: ${property.bathrooms}.`);
  if (property.balconies) facts.push(`Balconies reported: ${property.balconies}.`);
  if (property.floor && property.floor !== "Floor not provided") facts.push(`Floor detail: ${property.floor}.`);
  if (property.furnishing && property.furnishing !== "Not specified") facts.push(`Furnishing: ${property.furnishing}.`);
  if (property.amenities.length > 0) facts.push(`Amenities mentioned: ${property.amenities.slice(0, 5).join(", ")}.`);
  if (property.sourcePlatform) facts.push(`Source platform: ${property.sourcePlatform}.`);

  const baseOverview = facts.join(" ");
  const aiText = property.aiDetailOverview?.trim() || "";
  const aiLooksGeneric = /^(this listing is|property overview|detailed overview)/i.test(aiText);
  if (!aiText || aiLooksGeneric) {
    return baseOverview;
  }
  return `${baseOverview} ${aiText}`.trim();
}

function deriveHighlights(property: Property): string[] {
  const highlights: string[] = [];
  if (property.size > 0) highlights.push(`Approx. ${property.size} sqft reported area`);
  if (property.bathrooms) highlights.push(`${property.bathrooms} bathroom(s) reported`);
  if (property.balconies) highlights.push(`${property.balconies} balcony/balconies reported`);
  if (property.floor && property.floor !== "Floor not provided") highlights.push(`Floor detail available: ${property.floor}`);
  if (property.furnishing && property.furnishing !== "Not specified") highlights.push(`Furnishing status: ${property.furnishing}`);
  if (property.amenities.length > 0) highlights.push(`Amenities listed: ${property.amenities.slice(0, 4).join(", ")}`);
  if (property.sourcePlatform) highlights.push(`Listing source: ${property.sourcePlatform}`);
  if (property.daysListed > 0) highlights.push(`Listing active for ${property.daysListed} day(s)`);

  const aiHighlights = (property.aiHighlights || [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !/primary details available|no extracted highlights/i.test(item));

  const merged = [...highlights, ...aiHighlights];
  const unique = Array.from(new Set(merged));
  return unique.slice(0, 6);
}

function deriveWatchouts(property: Property): string[] {
  const watchouts = new Set<string>();
  (property.aiWatchouts || []).forEach((item) => item?.trim() && watchouts.add(item.trim()));
  property.photoRedFlags.forEach((item) => item?.trim() && watchouts.add(item.trim()));

  if (!property.size) watchouts.add("Area details are missing in the listing. Verify exact carpet/super built-up area.");
  if (!property.floor || property.floor === "Floor not provided") watchouts.add("Floor details are missing. Confirm tower/floor before site visit.");
  if (!property.sourceUrl) watchouts.add("Direct source link is unavailable. Validate listing authenticity before paying token.");

  return Array.from(watchouts).slice(0, 5);
}

function deriveLocationInsights(property: Property): string {
  if (property.aiLocationInsights?.trim()) return property.aiLocationInsights.trim();
  return `This listing is mapped to ${property.locality}, ${property.city}. Compare commute time, civic infra, and nearby rental inventory in this micro-market before final shortlisting.`;
}

function deriveInvestmentOutlook(property: Property): string {
  if (property.aiInvestmentOutlook?.trim()) return property.aiInvestmentOutlook.trim();
  if (property.price > 0) {
    return `Quoted monthly rent is ${formatPrice(property.price)}. Benchmark with at least 5 nearby listings and include maintenance, deposits, and brokerage to estimate true monthly outflow.`;
  }
  return "Compare this listing with nearby properties and compute total monthly outflow including maintenance and one-time charges.";
}

function deriveNegotiationTips(property: Property): string {
  if (property.aiNegotiationTips?.trim()) return property.aiNegotiationTips.trim();
  const tips: string[] = [];
  if (property.daysListed > 10) tips.push("The listing has been active for multiple days, which can provide room for rent negotiation.");
  tips.push("Ask for a rent revision against comparable listings in the same locality and BHK band.");
  tips.push("Negotiate maintenance split, lock-in, notice period, and brokerage in writing before token payment.");
  return tips.join(" ");
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = useMemo(() => {
    const value = params?.id;
    if (Array.isArray(value)) return value[0] || "";
    return typeof value === "string" ? value : "";
  }, [params]);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProperty() {
      if (!propertyId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`http://localhost:8000/api/properties/${propertyId}`);
        const json = await res.json();
        if (!res.ok || json?.status !== "success" || !json?.data) {
          throw new Error(json?.detail || "Failed to fetch property details.");
        }

        if (!cancelled) {
          setProperty(normalizeProperty(json.data));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load property details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProperty();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream p-6">
        <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
          <div className="h-10 w-52 bg-sand rounded-xl" />
          <div className="h-[360px] bg-sand rounded-2xl" />
          <div className="h-28 bg-sand rounded-2xl" />
          <div className="h-44 bg-sand rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-cream p-6">
        <div className="max-w-3xl mx-auto bg-surface border border-border-custom rounded-2xl p-6">
          <p className="font-dm text-charcoal">{error || "Property not found."}</p>
          <Link href="/dashboard" className="inline-flex mt-4 text-sm font-semibold text-forest hover:underline">
            Back to matches
          </Link>
        </div>
      </div>
    );
  }

  const heading = property.apartmentName?.trim() || property.title?.trim() || `${property.bhk} in ${property.locality}`;
  const aiInsight = (property.aiInsight || `${property.bhk} listing in ${property.locality}.`).replace(/\.{3,}\s*$/, ".").trim();
  const overview = deriveOverview(property);
  const highlights = deriveHighlights(property);
  const watchouts = deriveWatchouts(property);
  const locationInsights = deriveLocationInsights(property);
  const investmentOutlook = deriveInvestmentOutlook(property);
  const negotiationTips = deriveNegotiationTips(property);

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to matches
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Gallery */}
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-2xl overflow-hidden border border-border-custom bg-surface">
              <img
                src={property.images[selectedImage] || property.images[0] || STATIC_IMAGES.apartment1}
                alt={heading}
                className="w-full h-[420px] object-cover"
              />
            </div>
            {/* Thumbnail strip */}
            {property.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {property.images.map((img, idx) => (
                  <button
                    key={`thumb-${idx}`}
                    onClick={() => setSelectedImage(idx)}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      idx === selectedImage
                        ? "border-forest shadow-md"
                        : "border-border-custom opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt={`${heading} - ${idx + 1}`} className="w-20 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-border-custom p-6 flex flex-col gap-4">
            <div>
              <h1 className="font-playfair text-3xl text-charcoal leading-tight">{heading}</h1>
              <p className="mt-2 text-sm text-muted flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {property.address}, {property.city}
              </p>
            </div>

            <div className="text-forest font-bold text-3xl">
              {formatPrice(property.price)}
              <span className="text-lg">/mo</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {property.bhk && property.bhk !== "N/A" && (
                <span className="inline-flex items-center gap-1 text-xs bg-forest/10 px-2.5 py-1 rounded-full text-forest font-semibold">
                  {property.bhk}
                </span>
              )}
              {property.totalFlatsAvailable && property.totalFlatsAvailable > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  {property.totalFlatsAvailable}+ flats listed
                </span>
              )}
              {property.size > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  <Maximize2 className="w-3 h-3" /> {property.size} sqft
                </span>
              )}
              {property.bathrooms && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  {property.bathrooms} bath
                </span>
              )}
              {property.balconies && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  {property.balconies} balcony
                </span>
              )}
              {property.floor && property.floor !== "Floor not provided" && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  <Building2 className="w-3 h-3" /> {property.floor}
                </span>
              )}
              {property.furnishing && property.furnishing !== "Not specified" && (
                <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                  <Sofa className="w-3 h-3" /> {property.furnishing}
                </span>
              )}
              {property.sourcePlatform && (
                <span className="text-xs bg-forest/10 px-2.5 py-1 rounded-full text-forest font-medium">
                  {property.sourcePlatform}
                </span>
              )}
            </div>

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div className="border-t border-border-custom pt-3">
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {property.amenities.slice(0, 8).map((amenity, idx) => (
                    <span key={`${amenity}-${idx}`} className="text-xs bg-cream px-2 py-0.5 rounded-full text-charcoal">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm font-dm text-forest-light italic leading-relaxed">{aiInsight}</p>

            <div className="text-xs text-muted border-t border-border-custom pt-3 space-y-1">
              <p>Source: {property.sourcePlatform || "not available"}</p>
              {property.daysListed > 0 && <p>Listed {property.daysListed} day{property.daysListed !== 1 ? "s" : ""} ago</p>}
              {property.sourceUrl && (
                <a
                  href={property.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-forest hover:underline"
                >
                  Open listing source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-surface rounded-2xl border border-border-custom p-6"
          >
            <h2 className="font-playfair text-2xl text-charcoal mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-forest" />
              AI Property Overview
            </h2>
            <p className="text-sm font-dm text-charcoal leading-relaxed">
              {overview}
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cream rounded-xl p-4 border border-border-custom">
                <h3 className="text-sm font-semibold text-charcoal mb-2">Top Highlights</h3>
                {highlights.length > 0 ? (
                  <ul className="space-y-2 text-sm text-charcoal">
                    {highlights.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No highlight signals could be extracted from the current listing fields.</p>
                )}
              </div>

              <div className="bg-cream rounded-xl p-4 border border-border-custom">
                <h3 className="text-sm font-semibold text-charcoal mb-2">Watchouts</h3>
                {watchouts && watchouts.length > 0 ? (
                  <ul className="space-y-2 text-sm text-charcoal">
                    {watchouts.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-warm-gold mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No explicit watchouts identified from the available source listing fields.</p>
                )}
              </div>
            </div>
          </motion.section>

          <div className="space-y-4">
            <section className="bg-surface rounded-2xl border border-border-custom p-5">
              <h3 className="font-dm font-bold text-charcoal mb-2">Location Insights</h3>
              <p className="text-sm font-dm text-charcoal leading-relaxed">
                {locationInsights}
              </p>
            </section>

            <section className="bg-surface rounded-2xl border border-border-custom p-5">
              <h3 className="font-dm font-bold text-charcoal mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-forest" /> Investment Outlook
              </h3>
              <p className="text-sm font-dm text-charcoal leading-relaxed">
                {investmentOutlook}
              </p>
            </section>

            <section className="bg-surface rounded-2xl border border-border-custom p-5">
              <h3 className="font-dm font-bold text-charcoal mb-2">Negotiation Tips</h3>
              <p className="text-sm font-dm text-charcoal leading-relaxed">
                {negotiationTips}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
