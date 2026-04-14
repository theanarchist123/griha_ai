"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, X, Plus, Loader2, Search } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { STATIC_IMAGES } from "@/lib/unsplash";

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    async function fetchProperties() {
      const idsParam = searchParams.get("ids");
      if (!idsParam) {
        setLoading(false);
        return;
      }
      
      const ids = idsParam.split(",").filter(Boolean);
      
      try {
        const fetchedProps = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`http://localhost:8000/api/properties/${id}`);
            const json = await res.json();
            if (json.status === "success" && json.data) {
              const raw = json.data;
              return {
                id: raw.id || raw._id,
                bhk: raw.bhk || "N/A",
                locality: raw.locality || raw.city || "Unknown",
                price: Number(raw.price || 0),
                size: Number(raw.size || raw.size_sqft || 0),
                floor: raw.floor || "N/A",
                furnishing: raw.furnishing || raw.furnished_status || "Not specified",
                daysListed: Number(raw.listed_days_ago || 0),
                matchScore: Number(raw.matchScore || raw.match_score || 85),
                photoRedFlags: Array.isArray(raw.photo_red_flags) ? raw.photo_red_flags : [],
                aiInsight: raw.ai_card_summary || raw.aiCardSummary || raw.aiInsight || "No specific insights available.",
                legalStatus: raw.legalStatus || raw.legal_status || "caution",
                amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
                images: Array.isArray(raw.images) && raw.images.length > 0 ? raw.images : [STATIC_IMAGES.apartment1],
              };
            }
            return null;
          })
        );
        
        setProperties(fetchedProps.filter(Boolean));
      } catch (e) {
        console.error("Failed to fetch properties for comparison", e);
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [searchParams]);

  const removeProperty = (id: string) => {
    const newProps = properties.filter((p) => p.id !== id);
    setProperties(newProps);
    // Also update URL so refresh maintains state
    const newIds = newProps.map(p => p.id).join(",");
    router.replace(`/compare?ids=${newIds}`, { scroll: false });
  };

  const getBestValue = (rowRender: (p: any) => string, isLowerBetter: boolean = false) => {
    if (properties.length === 0) return -1;
    const values = properties.map((p) => {
      const v = rowRender(p);
      const num = parseFloat(v.replace(/[^0-9.-]+/g, ""));
      return isNaN(num) ? 0 : num;
    });
    return isLowerBetter ? values.indexOf(Math.min(...values)) : values.indexOf(Math.max(...values));
  };

  const handleShortlist = (id: string) => {
    setShortlisted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const fetchAllProperties = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch("http://localhost:8000/api/properties/");
      const json = await res.json();
      if (json.status === "success") {
        setAllProperties(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAll(false);
    }
  };

  const addPropertyToCompare = (raw: any) => {
    const idToAdd = raw.id || raw._id;
    if (properties.find(p => p.id === idToAdd)) return;

    if (properties.length >= 4) return;
    
    // Build normalized prop
    const newProp = {
      id: idToAdd,
      bhk: raw.bhk || "N/A",
      locality: raw.locality || raw.city || "Unknown",
      price: Number(raw.price || 0),
      size: Number(raw.size || raw.size_sqft || 0),
      floor: raw.floor || "N/A",
      furnishing: raw.furnishing || raw.furnished_status || "Not specified",
      daysListed: Number(raw.listed_days_ago || 0),
      matchScore: Number(raw.matchScore || raw.match_score || 85),
      photoRedFlags: Array.isArray(raw.photo_red_flags) ? raw.photo_red_flags : [],
      aiInsight: raw.ai_card_summary || raw.aiCardSummary || raw.aiInsight || "No insights.",
      legalStatus: raw.legalStatus || raw.legal_status || "caution",
      amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
      images: Array.isArray(raw.images) && raw.images.length > 0 ? raw.images : [STATIC_IMAGES.apartment1],
    };
    
    const nextArr = [...properties, newProp];
    setProperties(nextArr);
    
    // Update URL
    const newIds = nextArr.map(p => p.id).join(",");
    router.replace(`/compare?ids=${newIds}`, { scroll: false });
    
    setShowAddModal(false);
  };

  const COMPARISON_SECTIONS = [
    {
      title: "Basics",
      rows: [
        { label: "Price", render: (p: any) => `${formatPrice(p.price)}/mo` },
        { label: "Size", render: (p: any) => `${p.size} sqft` },
        { label: "BHK", render: (p: any) => p.bhk },
        { label: "Floor", render: (p: any) => p.floor },
        { label: "Furnishing", render: (p: any) => p.furnishing },
        { label: "Days Listed", render: (p: any) => `${p.daysListed} days` },
      ],
    },
    {
      title: "AI Intelligence",
      rows: [
        { label: "Match Score", render: (p: any) => `${p.matchScore}%` },
        { label: "Red Flags", render: (p: any) => p.photoRedFlags.length === 0 ? "None" : `${p.photoRedFlags.length} found` },
        { label: "AI Insight", render: (p: any) => (p.aiInsight ? p.aiInsight.slice(0, 60) + "..." : "N/A") },
      ],
    },
    {
      title: "Legal",
      rows: [
        { label: "Legal Status", render: (p: any) => p.legalStatus === "clean" ? "Clean" : p.legalStatus === "caution" ? "Caution" : "High Risk" },
      ],
    },
    {
      title: "Neighbourhood",
      rows: [
        { label: "Locality", render: (p: any) => p.locality },
        { label: "Amenities", render: (p: any) => `${p.amenities.length} available` },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-dm">Back to Dashboard</span>
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="font-playfair text-3xl font-bold text-charcoal mb-4">No Properties Selected</h1>
          <p className="text-muted font-dm mb-8">Select at least two properties from your dashboard to compare them.</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-forest text-white rounded-xl font-dm font-semibold hover:bg-forest-light transition-colors">
            Browse Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-dm">Back to Dashboard</span>
          </button>
          <h1 className="font-playfair text-xl text-charcoal">Compare Properties</h1>
          <div className="w-24" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px] p-6">
          {/* Sticky header */}
          <div className="sticky top-[57px] z-20 bg-cream pb-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${properties.length}, 1fr) ${properties.length < 4 ? "140px" : ""}` }}>
              <div /> {/* label column */}
              {properties.map((prop) => (
                <div key={prop.id} className="bg-surface rounded-2xl border border-border-custom p-4 relative">
                  <button
                    onClick={() => removeProperty(prop.id)}
                    className="absolute top-2 right-2 p-1 text-muted hover:text-danger rounded-full hover:bg-danger/10 transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <img src={prop.images[0]} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />
                  <p className="font-dm font-semibold text-charcoal text-sm">{prop.bhk}, {prop.locality}</p>
                  <p className="text-forest font-bold text-lg">{formatPrice(prop.price)}/mo</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-forest/10 text-forest text-xs font-semibold rounded-full">
                    {prop.matchScore}% Match
                  </div>
                </div>
              ))}
              {properties.length < 4 && (
                <button
                  onClick={() => {
                    fetchAllProperties();
                    setShowAddModal(true);
                  }}
                  className="border-2 border-dashed border-border-custom rounded-2xl flex flex-col items-center justify-center text-muted hover:border-forest hover:text-forest transition-colors min-h-[200px]"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-xs font-dm">Add Property</span>
                </button>
              )}
            </div>
          </div>

          {/* Comparison rows */}
          {COMPARISON_SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              <h3 className="font-dm font-bold text-charcoal text-sm mb-3 px-2">{section.title}</h3>
              {section.rows.map((row) => {
                const bestIdx = getBestValue(row.render, row.label === "Price" || row.label === "Days Listed");
                return (
                  <div
                    key={row.label}
                    className="grid gap-4 py-2.5 border-b border-border-custom/50"
                    style={{ gridTemplateColumns: `200px repeat(${properties.length}, 1fr) ${properties.length < 4 ? "140px" : ""}` }}
                  >
                    <span className="text-sm font-dm text-muted self-center">{row.label}</span>
                    {properties.map((prop, idx) => (
                      <span
                        key={prop.id}
                        className={`text-sm font-dm self-center ${
                          idx === bestIdx ? "text-forest font-bold" : "text-charcoal"
                        }`}
                      >
                        {row.render(prop)}
                      </span>
                    ))}
                    {properties.length < 4 && <span />}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Bottom actions */}
          <div className="sticky bottom-0 bg-cream pt-4 pb-6 border-t border-border-custom">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `200px repeat(${properties.length}, 1fr) ${properties.length < 4 ? "140px" : ""}` }}
            >
              <span />
              {properties.map((prop) => (
                <div key={prop.id} className="flex flex-col gap-2">
                  <Link
                    href={`/negotiate/${prop.id}`}
                    className="py-2.5 bg-forest text-white text-center rounded-xl font-dm font-semibold text-sm hover:bg-forest-light transition-colors"
                  >
                    Negotiate
                  </Link>
                  <button 
                    onClick={() => handleShortlist(prop.id)}
                    className={`py-2.5 border text-center rounded-xl font-dm font-semibold text-sm transition-colors ${
                      shortlisted.has(prop.id)
                        ? "border-forest bg-forest/10 text-forest"
                        : "border-forest text-forest hover:bg-forest/5"
                    }`}
                  >
                    {shortlisted.has(prop.id) ? "✓ Shortlisted" : "Shortlist"}
                  </button>
                </div>
              ))}
              {properties.length < 4 && <span />}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal for adding property */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-cream w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border-custom">
              <h2 className="font-playfair text-xl text-charcoal">Select Property</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 bg-surface text-muted hover:text-danger rounded-full transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {loadingAll ? (
                 <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-forest"/></div>
              ) : (
                allProperties.filter(p => !properties.find(fp => fp.id === (p.id || p._id))).map((prop) => (
                  <button 
                    key={prop.id || prop._id}
                    onClick={() => addPropertyToCompare(prop)}
                    className="w-full text-left bg-surface hover:bg-sand transition-colors rounded-xl p-3 flex items-center gap-4 border border-border-custom hover:border-forest/30"
                  >
                    <img src={Array.isArray(prop.images) ? prop.images[0] : STATIC_IMAGES.apartment1} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <div>
                      <p className="font-dm font-semibold text-sm text-charcoal">{prop.bhk}, {prop.locality}</p>
                      <p className="text-xs text-muted mt-0.5">{prop.apartment_name || prop.title || "Apartment"}</p>
                      <p className="text-sm font-bold text-forest mt-1">₹{Number(prop.price).toLocaleString()}/mo</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
