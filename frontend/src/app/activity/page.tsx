"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Bell, CheckCircle2, MessageSquare, Scale, FileText,
  AlertTriangle, Settings, ArrowRight, Loader2, Sparkles, Filter
} from "lucide-react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";

interface ActivityItem {
  id: string;
  type: "match" | "negotiation" | "legal" | "document" | "alert" | "system";
  text: string;
  property_name?: string;
  property_id?: string;
  action_label?: string;
  action_href?: string;
  timestamp: string; // Relative time (e.g. "2 min ago")
}

const TYPE_CONFIG = {
  match: { icon: Sparkles, color: "text-forest", bg: "bg-forest/10" },
  negotiation: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
  legal: { icon: Scale, color: "text-warm-gold", bg: "bg-warm-gold/10" },
  document: { icon: FileText, color: "text-purple-500", bg: "bg-purple-500/10" },
  alert: { icon: AlertTriangle, color: "text-danger", bg: "bg-danger/10" },
  system: { icon: Settings, color: "text-muted", bg: "bg-sand" },
};

export default function ActivityPage() {
  const { userId } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchActivity();
  }, [userId, filter]);

  async function fetchActivity() {
    setLoading(true);
    try {
      let url = `http://localhost:8000/api/activity/?limit=50`;
      if (userId) url += `&clerk_id=${userId}`;
      if (filter && filter !== "all") url += `&type_filter=${filter}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "success") {
        setActivities(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  }

  const filterOptions = [
    { id: "all", label: "All Activity" },
    { id: "match", label: "Matches" },
    { id: "negotiation", label: "Negotiations" },
    { id: "legal", label: "Legal" },
    { id: "document", label: "Documents" },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="ml-[260px]">
        <DashboardTopBar />

        <div className="p-6 max-w-4xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="font-playfair text-3xl text-charcoal mb-2">Activity Feed</h1>
              <p className="text-muted font-dm">Everything happening with your property search in real-time</p>
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 bg-surface border border-border-custom rounded-xl text-sm font-dm font-semibold text-charcoal focus:outline-none focus:border-forest cursor-pointer"
              >
                {filterOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border-custom p-12 text-center">
              <Bell className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="font-dm font-semibold text-charcoal text-lg">No activity yet</p>
              <p className="text-sm text-muted font-dm mt-1 mb-6">
                Your activities across shortlists, negotiations, and legal checks will appear here.
              </p>
              <Link href="/dashboard" className="px-6 py-3 bg-forest text-white rounded-xl font-dm font-semibold inline-flex">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-custom before:to-transparent">
              {activities.map((item, i) => {
                const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                  >
                    {/* Timeline Marker */}
                    <div className={`absolute left-5 md:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-4 border-cream flex items-center justify-center shrink-0 z-10 ${config.bg}`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                    </div>

                    {/* Card */}
                    <div className="w-[calc(100%-48px)] ml-12 md:w-[calc(50%-24px)] md:ml-0 bg-surface rounded-2xl border border-border-custom p-4 shadow-sm hover:shadow-md transition-shadow group-hover:border-forest/30">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="font-dm font-semibold text-charcoal text-sm leading-tight">
                          {item.text}
                        </p>
                        <span className="text-[10px] text-muted font-dm whitespace-nowrap shrink-0 bg-sand px-2 py-0.5 rounded-full">
                          {item.timestamp}
                        </span>
                      </div>
                      
                      {item.property_name && (
                        <p className="text-xs text-muted font-dm mb-3 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> {item.property_name}
                        </p>
                      )}

                      {item.action_href && item.action_label && (
                        <Link
                          href={item.action_href}
                          className="inline-flex items-center gap-1 text-xs font-dm font-bold text-forest hover:text-forest-light transition-colors"
                        >
                          {item.action_label} <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
