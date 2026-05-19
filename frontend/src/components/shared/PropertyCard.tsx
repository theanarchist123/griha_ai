"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import { MapPin, Maximize2, Building2, AlertTriangle, Bookmark, BookmarkCheck, BellRing, X, TrendingDown } from "lucide-react";
import type { Property } from "@/lib/mockData";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState } from "react";
import { toast } from "react-hot-toast";

interface PropertyCardProps {
  property: Property;
  className?: string;
}

export function PropertyCard({ property, className }: PropertyCardProps) {
  const cleanName = (name?: string) => {
    if (!name) return undefined;
    const cleaned = name.trim().replace(/^(?:in|at|near|of)\s+/i, "").split(",")[0].trim();
    return cleaned.length >= 3 ? cleaned : undefined;
  };
  const cardTitle = cleanName(property.apartmentName) || cleanName(property.title) || `${property.bhk} in ${property.locality}`;
  const cardInsight = (property.aiInsight || `${property.bhk} listing in ${property.locality}.`).replace(/\.{3,}\s*$/, ".").trim();

  const { user, isLoaded } = useUser();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Alert state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTarget, setAlertTarget] = useState(Math.round((property.price || 0) * 0.9));
  const [settingAlert, setSettingAlert] = useState(false);
  const [alertSet, setAlertSet] = useState(false);

  // NOTE: We intentionally do NOT pre-check saved status on card mount.
  // Firing one request per card creates a parallel connection storm on MongoDB Atlas.
  // The property detail page checks status (single page = single request).
  // Cards show live state after the user saves during the current session.

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to detail page
    e.stopPropagation();
    if (!user) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/pipeline/save?clerk_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: property.id, stage: "shortlisted" }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setIsSaved(true);
        toast?.success?.("Saved to pipeline!") || alert("Saved to pipeline!");
      }
    } catch (err) {
      console.error(err);
      toast?.error?.("Failed to save") || alert("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetAlert = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setSettingAlert(true);
    try {
      const res = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/alerts/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clerk_id: user.id,
            property_id: property.id,
            property_title: property.apartmentName || property.title || `${property.bhk} in ${property.locality}`,
            property_locality: property.locality,
            property_bhk: property.bhk,
            property_image: property.images?.[0] ?? null,
            target_price: alertTarget,
            original_price: property.price,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setAlertSet(true);
        setShowAlertModal(false);
        toast?.success?.("Price alert set! We'll notify you when it drops.");
      } else {
        toast?.error?.(data.detail || "Failed to set alert");
      }
    } catch {
      toast?.error?.("Failed to set alert");
    } finally {
      setSettingAlert(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group bg-surface rounded-2xl overflow-hidden border border-border-custom cursor-pointer min-w-[300px] max-w-[360px] relative",
        className
      )}
    >
      {/* Inline Set-Alert Modal overlay */}
      <AnimatePresence>
        {showAlertModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-40 bg-surface/97 backdrop-blur-sm rounded-2xl flex flex-col p-5"
            onClick={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-warm-gold/15 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-warm-gold" />
                </div>
                <p className="font-dm font-bold text-charcoal text-sm">Set Price Alert</p>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAlertModal(false); }}
                className="p-1.5 hover:bg-cream rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>

            <p className="text-xs text-muted font-dm mb-1">Current price</p>
            <p className="font-playfair text-xl text-charcoal font-bold mb-4">{formatPrice(property.price)}/mo</p>

            <label className="text-xs font-dm text-muted font-medium uppercase tracking-wider mb-1.5 block">Alert me when price drops to</label>
            <div className="relative mb-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal font-bold text-sm">₹</span>
              <input
                type="number"
                value={alertTarget}
                min={1}
                max={property.price - 1}
                step={500}
                onChange={(e) => setAlertTarget(Number(e.target.value))}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="w-full pl-7 pr-3 py-2.5 border border-border-custom rounded-xl text-sm font-dm text-charcoal bg-cream focus:outline-none focus:border-forest"
              />
            </div>
            <p className="text-[11px] text-forest font-dm mb-4">
              {alertTarget < property.price
                ? `That's ₹${(property.price - alertTarget).toLocaleString("en-IN")} less (${Math.round(((property.price - alertTarget) / property.price) * 100)}% drop)`
                : "⚠️ Target must be less than current price"}
            </p>

            <button
              disabled={settingAlert || alertTarget >= property.price || alertTarget <= 0}
              onClick={handleSetAlert}
              className="w-full py-2.5 bg-warm-gold text-charcoal font-dm font-semibold text-sm rounded-xl hover:bg-warm-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {settingAlert ? (
                <span className="w-4 h-4 border-2 border-charcoal/40 border-t-charcoal rounded-full animate-spin" />
              ) : (
                <BellRing className="w-4 h-4" />
              )}
              {settingAlert ? "Setting alert…" : "Set Alert"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={`/property/${property.id}`}>
        {/* Image section - 60% */}
        <div className="relative h-[220px] overflow-hidden">
          <img
            src={property.images[0]}
            alt={property.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Save Button */}
          {isLoaded && (
            user ? (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="absolute top-3 left-3 p-2 bg-surface/90 backdrop-blur-sm rounded-full text-charcoal hover:text-forest transition-colors shadow-sm z-10"
                title={isSaved ? "Saved" : "Save to Pipeline"}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4 text-forest" /> : <Bookmark className="w-4 h-4" />}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="absolute top-3 left-3 p-2 bg-surface/90 backdrop-blur-sm rounded-full text-charcoal hover:text-forest transition-colors shadow-sm z-10"
                  title="Sign in to save"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </SignInButton>
            )
          )}
          {/* Bell Alert Button — shown when user is logged in */}
          {isLoaded && user && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAlertModal(v => !v); }}
              className="absolute top-3 left-12 p-2 bg-surface/90 backdrop-blur-sm rounded-full text-charcoal hover:text-warm-gold transition-colors shadow-sm z-10"
              title={alertSet ? "Alert active" : "Set price drop alert"}
            >
              <BellRing className={`w-4 h-4 ${alertSet ? "text-warm-gold" : ""}`} />
            </button>
          )}
          {/* Match Score Badge */}
          <div className="absolute top-3 right-3 bg-forest text-white text-sm font-bold px-3 py-1.5 rounded-full z-10">
            {property.matchScore}% Match
          </div>
          {/* Red Flag Badge */}
          {property.photoRedFlags.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-warm-gold text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 z-10">
              <AlertTriangle className="w-3 h-3" />
              {property.photoRedFlags.length} Flag{property.photoRedFlags.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Content section */}
        <div className="p-4">
          <h3 className="font-dm font-semibold text-charcoal text-lg leading-tight line-clamp-2">
            {cardTitle}
          </h3>
          <p className="text-muted text-sm mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {property.address}
          </p>
          <p className="text-forest font-bold text-xl mt-2">
            {formatPrice(property.price)}
            {property.priceType === "rent" ? "/mo" : ""}
          </p>
          {alertSet && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-dm text-warm-gold">
              <BellRing className="w-3 h-3" /> Alert set for {formatPrice(alertTarget)}/mo
            </span>
          )}

          {/* Attribute chips */}
          <div className="flex flex-wrap gap-2 mt-3">
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
            {property.floor && property.floor !== "Floor not provided" && (
              <span className="inline-flex items-center gap-1 text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                <Building2 className="w-3 h-3" /> {property.floor}
              </span>
            )}
            {property.furnishing && property.furnishing !== "Not specified" && (
              <span className="text-xs bg-cream px-2.5 py-1 rounded-full text-charcoal">
                {property.furnishing}
              </span>
            )}
            {property.sourcePlatform && (
              <span className="text-xs bg-forest/10 px-2.5 py-1 rounded-full text-forest font-medium">
                {property.sourcePlatform}
              </span>
            )}
          </div>

          {/* AI Insight */}
          <p className="text-forest-light text-sm italic mt-3 leading-relaxed">
            {cardInsight}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
