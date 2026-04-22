"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MapPin, Home, ArrowRight, Loader2, Search, Building2 } from "lucide-react";

interface Property {
  id: string;
  address: string;
  locality: string;
  city: string;
  bhk: string;
  price: number;
  images: string[];
  lat?: number;
  lng?: number;
  apartment_name?: string;
  apartmentName?: string;
}

function formatPrice(n: number) {
  if (!n) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L/mo`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K/mo`;
  return `₹${n}/mo`;
}

// Geocode locality using Nominatim
async function geocodeLocality(locality: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${locality}, ${city}, India`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`,
      { headers: { "User-Agent": "GrihaAI/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function NeighbourhoodSelectorPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [geocoding, setGeocoding] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/properties/search")
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d.results) ? d.results : Array.isArray(d.data) ? d.data : [];
        setProperties(
          items.map((raw: any, i: number) => ({
            id: raw?.id ?? raw?._id?.$oid ?? raw?._id ?? `prop-${i}`,
            address: raw?.address || raw?.title || "Address unavailable",
            locality: raw?.locality || raw?.city || "Unknown",
            city: raw?.city || "India",
            bhk: raw?.bhk || "N/A",
            price: Number(raw?.price || 0),
            images: Array.isArray(raw?.images) && raw.images.length > 0 ? raw.images : [],
            apartment_name: raw?.apartment_name || raw?.apartmentName || undefined,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.locality.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.bhk.toLowerCase().includes(q)
    );
  });

  const handleSelect = async (prop: Property) => {
    setGeocoding(prop.id);
    const coords = await geocodeLocality(prop.locality, prop.city);
    setGeocoding(null);

    const params = new URLSearchParams({
      address: prop.apartment_name || prop.address,
      lat: String(coords?.lat ?? 19.076),
      lng: String(coords?.lng ?? 72.877),
      city: prop.city,
      locality: prop.locality,
    });
    window.location.href = `/neighbourhood/${prop.id}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-1">
            <span className="font-playfair italic text-xl text-white">griha</span>
            <span className="font-playfair text-xl font-bold" style={{ color: "#C9922A" }}>AI</span>
          </Link>
          <div className="w-24" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero text */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: "rgba(201,146,42,0.15)", border: "1px solid rgba(201,146,42,0.3)" }}>
            <MapPin className="w-4 h-4" style={{ color: "#C9922A" }} />
            <span className="text-sm font-dm font-medium" style={{ color: "#C9922A" }}>AI Neighbourhood Explorer</span>
          </div>
          <h1 className="font-playfair text-5xl text-white mb-4">
            Explore Your <span style={{ color: "#C9922A" }}>Neighbourhood</span>
          </h1>
          <p className="font-dm text-lg max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Select a property you searched. Ask AI anything — hospitals nearby, distance to a place, parks, supermarkets.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative max-w-md mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by locality, BHK..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-dm outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            }}
          />
        </motion.div>

        {/* Property grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9922A" }} />
              <p className="font-dm text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading your properties...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="font-dm text-lg text-white mb-2">No properties found</p>
            <p className="font-dm text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
              Search for properties in the dashboard first, then come back here.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-dm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #2D5016, #4A7A28)" }}
            >
              <Search className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence>
              {filtered.map((prop, i) => (
                <motion.button
                  key={prop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(prop)}
                  disabled={geocoding === prop.id}
                  className="text-left rounded-2xl overflow-hidden group transition-all duration-300 relative"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.4)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Image */}
                  <div className="h-40 overflow-hidden relative">
                    {prop.images[0] ? (
                      <img
                        src={prop.images[0]}
                        alt={prop.address}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <Home className="w-10 h-10" style={{ color: "rgba(255,255,255,0.2)" }} />
                      </div>
                    )}
                    {/* BHK badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-dm font-bold" style={{ background: "rgba(45,80,22,0.9)", color: "white" }}>
                      {prop.bhk}
                    </div>
                    {/* Geocoding overlay */}
                    {geocoding === prop.id && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <p className="font-dm font-semibold text-white text-sm mb-1 line-clamp-1">
                      {prop.apartment_name || prop.address}
                    </p>
                    <div className="flex items-center gap-1 mb-3">
                      <MapPin className="w-3 h-3 shrink-0" style={{ color: "#C9922A" }} />
                      <span className="text-xs font-dm line-clamp-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {prop.locality}, {prop.city}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-dm font-bold text-sm" style={{ color: "#4A7A28" }}>
                        {formatPrice(prop.price)}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-dm" style={{ color: "#C9922A" }}>
                        <MapPin className="w-3 h-3" />
                        <span>Explore →</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
