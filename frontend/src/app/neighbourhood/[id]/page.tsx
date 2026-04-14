"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Train, Car, Star, Droplets, TreePine,
  ShieldCheck, Loader2, TrendingUp, Volume2, Wind,
} from "lucide-react";

interface NeighbourhoodData {
  locality: string;
  city: string;
  commute_data: any;
  amenities: any[];
  flood_risk: string;
  aqi_score: number;
  noise_level: string;
  price_trend: any[];
  resident_sentiment: any;
  livability_scores: any;
}

export default function NeighbourhoodPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locality = typeof params?.id === "string" ? params.id : "";
  const city = searchParams?.get("city") || "Mumbai";

  const [data, setData] = useState<NeighbourhoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locality) return;
    fetchReport();
  }, [locality]);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://localhost:8000/api/neighbourhood/${encodeURIComponent(locality)}?city=${encodeURIComponent(city)}`
      );
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setData(json.data);
      } else {
        setError("Failed to load neighbourhood report");
      }
    } catch (err) {
      setError("Failed to connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-forest animate-spin mx-auto" />
          <p className="font-dm text-charcoal text-lg">Generating Neighbourhood Report...</p>
          <p className="text-muted text-sm font-dm max-w-xs mx-auto">
            AI is analyzing commute data, amenities, environmental factors, and resident sentiment
          </p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream p-6">
        <div className="max-w-lg mx-auto text-center py-20">
          <p className="text-charcoal font-dm text-lg">{error}</p>
          <Link href="/dashboard" className="text-forest underline text-sm font-dm mt-3 inline-block">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const scores = data.livability_scores || {};
  const overall = scores.overall || 7.0;
  const quick = scores.quick_stats || {};
  const envDetails = scores.environmental_details || {};
  const commute = data.commute_data || {};

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm font-dm">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-1">
            <span className="font-playfair italic text-lg text-charcoal">griha</span>
            <span className="font-playfair text-lg text-warm-gold font-bold">AI</span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 text-muted text-sm font-dm mb-1">
            <MapPin className="w-4 h-4" /> {data.city}
          </div>
          <h1 className="font-playfair text-4xl text-charcoal">{data.locality}</h1>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 bg-forest/10 px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 text-forest" />
              <span className="font-dm font-bold text-forest text-sm">{overall}/10 Livability</span>
            </div>
            {quick.pin_code && <span className="text-xs text-muted font-dm">PIN: {quick.pin_code}</span>}
            {quick.avg_rent && <span className="text-xs text-muted font-dm">Avg Rent: {quick.avg_rent}</span>}
          </div>
        </motion.div>

        {/* Livability Scores */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {[
            { label: "Connectivity", score: scores.connectivity, icon: Train },
            { label: "Amenities", score: scores.amenities, icon: MapPin },
            { label: "Environment", score: scores.environment, icon: TreePine },
            { label: "Affordability", score: scores.affordability, icon: TrendingUp },
            { label: "Safety", score: scores.safety, icon: ShieldCheck },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-surface rounded-2xl border border-border-custom p-4 text-center"
            >
              <item.icon className="w-5 h-5 text-forest mx-auto mb-2" />
              <p className="font-playfair text-2xl text-charcoal">{item.score || "—"}</p>
              <p className="text-[10px] text-muted font-dm mt-0.5">{item.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commute Data */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-surface rounded-2xl border border-border-custom p-6">
            <h2 className="font-dm font-bold text-charcoal text-lg mb-1">Commute</h2>
            <p className="text-xs text-muted font-dm mb-4">To: {commute.destination}</p>
            <div className="space-y-3">
              {commute.car && (
                <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted" /><span className="text-sm font-dm">Car</span>
                  </div>
                  <span className="text-sm font-dm font-semibold text-charcoal">
                    {commute.car.off_peak_minutes}-{commute.car.peak_minutes} min
                  </span>
                </div>
              )}
              {commute.train && (
                <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Train className="w-4 h-4 text-muted" />
                    <div>
                      <span className="text-sm font-dm">Train/Metro</span>
                      <p className="text-[10px] text-muted">{commute.train.nearest_station} ({commute.train.station_distance_m}m)</p>
                    </div>
                  </div>
                  <span className="text-sm font-dm font-semibold text-charcoal">
                    {commute.train.off_peak_minutes}-{commute.train.peak_minutes} min
                  </span>
                </div>
              )}
            </div>
            {commute.summary && <p className="text-xs text-muted italic mt-3 font-dm">{commute.summary}</p>}
          </motion.div>

          {/* Environmental */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="bg-surface rounded-2xl border border-border-custom p-6">
            <h2 className="font-dm font-bold text-charcoal text-lg mb-4">Environment</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-500" /><span className="text-sm font-dm">Flood Risk</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  data.flood_risk === "Low" ? "bg-success/10 text-success" :
                  data.flood_risk === "Medium" ? "bg-warm-gold/10 text-warm-gold" :
                  "bg-danger/10 text-danger"
                }`}>{data.flood_risk}</span>
              </div>
              <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-green-500" /><span className="text-sm font-dm">Air Quality (AQI)</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  data.aqi_score <= 50 ? "bg-success/10 text-success" :
                  data.aqi_score <= 100 ? "bg-warm-gold/10 text-warm-gold" :
                  "bg-danger/10 text-danger"
                }`}>{data.aqi_score} — {envDetails.aqi_label || (data.aqi_score <= 50 ? "Good" : data.aqi_score <= 100 ? "Moderate" : "Unhealthy")}</span>
              </div>
              <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-orange-500" /><span className="text-sm font-dm">Noise</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  data.noise_level === "Low" ? "bg-success/10 text-success" :
                  data.noise_level === "Medium" ? "bg-warm-gold/10 text-warm-gold" :
                  "bg-danger/10 text-danger"
                }`}>{data.noise_level}</span>
              </div>
            </div>
          </motion.div>

          {/* Amenities */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-surface rounded-2xl border border-border-custom p-6 lg:col-span-2">
            <h2 className="font-dm font-bold text-charcoal text-lg mb-4">Nearby Amenities</h2>
            {data.amenities && data.amenities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.amenities.map((cat: any, i: number) => (
                  <div key={i} className="bg-cream rounded-xl p-4">
                    <h3 className="font-dm font-bold text-charcoal text-sm mb-3">{cat.category}</h3>
                    <div className="space-y-2">
                      {(cat.items || []).map((item: any, j: number) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-dm text-charcoal truncate">{item.name}</p>
                            <p className="text-[10px] text-muted">{item.distance}</p>
                          </div>
                          {item.rating && (
                            <div className="flex items-center gap-0.5 ml-2">
                              <Star className="w-3 h-3 text-warm-gold fill-warm-gold" />
                              <span className="text-[10px] font-dm text-charcoal">{item.rating}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted font-dm">No amenity data available yet.</p>
            )}
          </motion.div>

          {/* Resident Sentiment */}
          {data.resident_sentiment && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="bg-surface rounded-2xl border border-border-custom p-6">
              <h2 className="font-dm font-bold text-charcoal text-lg mb-4">Resident Sentiment</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-forest/10 rounded-full px-4 py-2">
                  <span className="font-playfair text-xl text-forest">{data.resident_sentiment.overall_rating}</span>
                  <span className="text-xs text-forest font-dm">/5</span>
                </div>
                <p className="text-xs text-muted font-dm">{data.resident_sentiment.total_reviews} reviews</p>
              </div>
              {data.resident_sentiment.positives?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-dm font-semibold text-success mb-1">✅ What people love</p>
                  {data.resident_sentiment.positives.map((p: string, i: number) => (
                    <p key={i} className="text-xs text-muted font-dm ml-5">• {p}</p>
                  ))}
                </div>
              )}
              {data.resident_sentiment.concerns?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-dm font-semibold text-warm-gold mb-1">⚠️ Common concerns</p>
                  {data.resident_sentiment.concerns.map((c: string, i: number) => (
                    <p key={i} className="text-xs text-muted font-dm ml-5">• {c}</p>
                  ))}
                </div>
              )}
              {data.resident_sentiment.reviews?.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-border-custom">
                  {data.resident_sentiment.reviews.map((r: any, i: number) => (
                    <div key={i} className="bg-cream rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }, (_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < r.rating ? "text-warm-gold fill-warm-gold" : "text-muted/30"}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted font-dm">{r.author}</span>
                      </div>
                      <p className="text-xs text-charcoal font-dm italic">&ldquo;{r.text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Price Trend */}
          {data.price_trend && data.price_trend.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="bg-surface rounded-2xl border border-border-custom p-6">
              <h2 className="font-dm font-bold text-charcoal text-lg mb-4">12-Month Rent Trend</h2>
              <div className="flex items-end gap-1 h-32">
                {data.price_trend.map((pt: any, i: number) => {
                  const rents = data.price_trend.map((p: any) => p.avg_rent);
                  const max = Math.max(...rents);
                  const min = Math.min(...rents);
                  const range = max - min || 1;
                  const height = ((pt.avg_rent - min) / range) * 80 + 20;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${pt.month}: ₹${pt.avg_rent?.toLocaleString()}`}>
                      <div
                        className="w-full bg-forest/20 hover:bg-forest/40 rounded-t-sm transition-colors"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[8px] text-muted font-dm rotate-[-45deg] origin-left whitespace-nowrap">
                        {pt.month?.split(" ")[0]?.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted font-dm">
                <span>{data.price_trend[0]?.month}</span>
                <span>{data.price_trend[data.price_trend.length - 1]?.month}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
