"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import { MapPin, Maximize2, Building2, AlertTriangle, Bookmark, BookmarkCheck } from "lucide-react";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group bg-surface rounded-2xl overflow-hidden border border-border-custom cursor-pointer min-w-[300px] max-w-[360px]",
        className
      )}
    >
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
