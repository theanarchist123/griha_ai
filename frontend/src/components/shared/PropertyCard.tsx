"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import { MapPin, Maximize2, Building2, AlertTriangle } from "lucide-react";
import type { Property } from "@/lib/mockData";

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
          {/* Match Score Badge */}
          <div className="absolute top-3 right-3 bg-forest text-white text-sm font-bold px-3 py-1.5 rounded-full">
            {property.matchScore}% Match
          </div>
          {/* Red Flag Badge */}
          {property.photoRedFlags.length > 0 && (
            <div className="absolute top-3 left-3 bg-warm-gold text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
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
