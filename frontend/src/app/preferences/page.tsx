"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { Pencil, X, Check, MapPin, Wallet, Heart, Ban, Navigation, Bell, Loader2, Save } from "lucide-react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";

interface PreferencesData {
  id: string;
  intent: string;
  city: string;
  localities: string[];
  budget_min: number | null;
  budget_max: number;
  bhk: string;
  must_haves: string[];
  deal_breakers: string[];
  commute_destination: string | null;
  commute_time: number | null;
  updated_at: string | null;
}

export default function PreferencesPage() {
  const { userId } = useAuth();
  const [prefs, setPrefs] = useState<PreferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [notifications, setNotifications] = useState({
    instantAlerts: true,
    dailyDigest: true,
    weeklyReport: false,
    negotiationUpdates: true,
    legalAlerts: true,
  });

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  async function fetchPreferences() {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/preferences/${userId}`);
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setPrefs(json.data);
      }
    } catch (err) {
      // No profile yet
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences(updates: Partial<{
    locations: string[];
    budget_min: number;
    budget_max: number;
    bhk: string;
    must_haves: string[];
    deal_breakers: string[];
    commute_destination: string;
  }>) {
    if (!userId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`http://localhost:8000/api/preferences/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.status === "success") {
        await fetchPreferences();
      } else {
        setErrorMsg(json.detail || "Failed to save");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
  }

  function handleSaveField(field: string) {
    if (field === "localities") {
      savePreferences({ locations: editValue.split(",").map(s => s.trim()).filter(Boolean) });
    } else if (field === "budget") {
      const parts = editValue.replace(/[₹,/mo]/g, "").trim().split("-").map(s => parseInt(s.replace(/\D/g, "")));
      if (parts.length === 2) savePreferences({ budget_min: parts[0], budget_max: parts[1] });
    } else if (field === "bhk") {
      savePreferences({ bhk: editValue });
    } else if (field === "must_haves") {
      savePreferences({ must_haves: editValue.split(",").map(s => s.trim()).filter(Boolean) });
    } else if (field === "deal_breakers") {
      savePreferences({ deal_breakers: editValue.split(",").map(s => s.trim()).filter(Boolean) });
    } else if (field === "commute") {
      savePreferences({ commute_destination: editValue });
    }
    setEditingField(null);
  }

  const prefCards = prefs ? [
    { key: "localities", title: "Looking For", icon: MapPin, value: `${prefs.bhk} for ${prefs.intent} in ${prefs.localities.join(", ")}` },
    { key: "budget", title: "Budget", icon: Wallet, value: `₹${(prefs.budget_min || 0).toLocaleString()} - ₹${prefs.budget_max.toLocaleString()} per month` },
    { key: "must_haves", title: "Must-Haves", icon: Heart, value: "", chips: prefs.must_haves },
    { key: "deal_breakers", title: "Deal Breakers", icon: Ban, value: "", chips: prefs.deal_breakers },
    { key: "commute", title: "Commute Destination", icon: Navigation, value: prefs.commute_destination || "Not set" },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <DashboardSidebar />
        <div className="ml-[260px]">
          <DashboardTopBar />
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-forest animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="ml-[260px]">
        <DashboardTopBar />

        <div className="p-6 max-w-3xl">
          <h1 className="font-playfair text-3xl text-charcoal mb-6">Preferences</h1>

          {!prefs ? (
            <div className="bg-surface rounded-2xl border border-border-custom p-8 text-center">
              <MapPin className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="font-dm font-semibold text-charcoal text-lg">No search profile found</p>
              <p className="text-sm text-muted font-dm mt-1">
                Complete the onboarding flow to set up your preferences
              </p>
            </div>
          ) : (
            <>
              {/* Preference Cards */}
              <div className="space-y-4 mb-8">
                {prefCards.map((pref, i) => (
                  <motion.div
                    key={pref.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface rounded-2xl border border-border-custom p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center shrink-0">
                          <pref.icon className="w-5 h-5 text-forest" />
                        </div>
                        <div>
                          <h3 className="font-dm font-bold text-charcoal">{pref.title}</h3>
                          {editingField === pref.key ? (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full px-3 py-2 bg-cream border border-border-custom rounded-lg text-sm font-dm focus:outline-none focus:border-forest"
                                placeholder="Update your preference..."
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleSaveField(pref.key)}
                                  className="px-3 py-1.5 bg-forest text-white rounded-lg text-xs font-dm font-semibold flex items-center gap-1"
                                  disabled={saving}
                                >
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                                </button>
                                <button
                                  onClick={() => setEditingField(null)}
                                  className="px-3 py-1.5 text-muted rounded-lg text-xs font-dm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {pref.value && <p className="text-sm text-muted font-dm mt-1">{pref.value}</p>}
                              {pref.chips && pref.chips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {pref.chips.map((chip) => (
                                    <span key={chip} className="px-3 py-1 bg-forest/10 text-forest text-xs font-dm rounded-full">
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {editingField !== pref.key && (
                        <button
                          onClick={() =>
                            handleEdit(
                              pref.key,
                              pref.chips ? pref.chips.join(", ") : pref.value
                            )
                          }
                          className="p-2 text-muted hover:text-forest hover:bg-forest/5 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Budget Visual */}
              <div className="bg-surface rounded-2xl border border-border-custom p-6 mb-8">
                <h3 className="font-dm font-bold text-charcoal mb-4">Budget Range</h3>
                <div className="relative h-4 bg-sand rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-forest rounded-full"
                    style={{
                      left: `${((prefs.budget_min || 0) / 200000) * 100}%`,
                      width: `${((prefs.budget_max - (prefs.budget_min || 0)) / 200000) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted font-dm">
                  <span>₹10K</span>
                  <span className="text-forest font-semibold">
                    ₹{((prefs.budget_min || 0) / 1000).toFixed(0)}K - ₹{(prefs.budget_max / 1000).toFixed(0)}K
                  </span>
                  <span>₹2L</span>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="bg-surface rounded-2xl border border-border-custom p-6 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-forest" />
                  <h3 className="font-dm font-bold text-charcoal">Notification Settings</h3>
                </div>
                <div className="space-y-4">
                  {Object.entries(notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm font-dm text-charcoal capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <button
                        onClick={() => setNotifications((prev) => ({ ...prev, [key]: !value }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          value ? "bg-forest" : "bg-sand"
                        }`}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
                          animate={{ left: value ? "22px" : "2px" }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {errorMsg && <p className="text-danger text-sm font-dm mb-4">{errorMsg}</p>}

              <button
                onClick={() => savePreferences({})}
                disabled={saving}
                className="w-full py-4 bg-forest text-white rounded-xl font-dm font-semibold text-lg hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save & Restart Search
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
