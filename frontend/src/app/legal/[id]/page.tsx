"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, AlertTriangle, XCircle, Download, Scale,
  Loader2, BookOpen,
} from "lucide-react";

interface LegalReportData {
  id: string;
  property_id: string;
  rera: { status: string; number: string; complaints: number; details?: string };
  encumbrance: { status: string; details: string };
  property_tax: { status: string; details: string };
  builder_track_record: { status: string; details: string };
  overall_risk: "clean" | "caution" | "high_risk";
  summary: string;
  generated_at: string | null;
  property: {
    bhk: string;
    locality: string;
    city: string;
    address: string;
    price: number;
    apartment_name?: string;
  };
}

const RISK_CONFIG = {
  clean: { bg: "bg-forest", icon: ShieldCheck, label: "Clean", desc: "This property has a clean legal standing. Safe to proceed." },
  caution: { bg: "bg-warm-gold", icon: AlertTriangle, label: "Caution", desc: "Some concerns found. Proceed with care and verify flagged items." },
  high_risk: { bg: "bg-danger", icon: XCircle, label: "High Risk", desc: "Significant legal risks detected. We recommend avoiding this property." },
};

export default function LegalReportPage() {
  const params = useParams();
  const propertyId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [report, setReport] = useState<LegalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    fetchReport();
  }, [propertyId]);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/legal/report/${propertyId}`);
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setReport(json.data);
      } else {
        setError(json.detail || "Failed to load legal report");
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-10 h-10 text-forest animate-spin mx-auto" />
          <p className="font-dm text-charcoal text-lg">Generating Legal Report...</p>
          <p className="text-muted text-sm font-dm">Analyzing RERA status, encumbrances, property tax, and builder history</p>
        </motion.div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-cream p-6">
        <div className="max-w-3xl mx-auto bg-surface border border-border-custom rounded-2xl p-6 text-center">
          <XCircle className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="font-dm text-charcoal text-lg mb-2">Couldn&apos;t load legal report</p>
          <p className="text-muted text-sm">{error}</p>
          <Link href="/dashboard" className="inline-flex mt-4 text-sm font-semibold text-forest hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const riskConfig = RISK_CONFIG[report.overall_risk] || RISK_CONFIG.caution;

  const checks = [
    {
      title: "RERA Registration",
      status: report.rera.status,
      statusColor: report.rera.status === "Registered" || report.rera.status === "Not Applicable" ? "success" : report.rera.status === "Pending" ? "warm-gold" : "danger",
      details: report.rera.details || (
        report.rera.status === "Registered"
          ? `Registered under number ${report.rera.number}. ${report.rera.complaints} complaints on record.`
          : report.rera.status === "Not Applicable"
          ? "RERA does not apply to resale properties in established societies."
          : report.rera.status === "Pending"
          ? "RERA registration is still pending."
          : "Not registered under RERA."
      ),
    },
    {
      title: "Encumbrance Certificate",
      status: report.encumbrance.status,
      statusColor: report.encumbrance.status === "Clear" ? "success" : report.encumbrance.status === "Manual Check Required" ? "warm-gold" : "danger",
      details: report.encumbrance.details,
    },
    {
      title: "Property Tax",
      status: report.property_tax.status,
      statusColor: report.property_tax.status === "Paid" ? "success" : "warm-gold",
      details: report.property_tax.details,
    },
    {
      title: "Builder Track Record",
      status: report.builder_track_record.status,
      statusColor: report.builder_track_record.status === "Good" || report.builder_track_record.status === "N/A" ? "success" : report.builder_track_record.status === "Average" ? "warm-gold" : "danger",
      details: report.builder_track_record.details,
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-cream/80 backdrop-blur-md border-b border-border-custom px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link href={`/property/${propertyId}`} className="flex items-center gap-2 text-muted hover:text-charcoal transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-dm">Back to Property</span>
          </Link>
          <Link href="/" className="flex items-center gap-1">
            <span className="font-playfair italic text-lg text-charcoal">griha</span>
            <span className="font-playfair text-lg text-warm-gold font-bold">AI</span>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Verdict Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${riskConfig.bg} rounded-2xl p-8 text-white mb-8`}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <riskConfig.icon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-playfair text-3xl">{riskConfig.label}</h1>
                <span className="px-3 py-0.5 bg-white/20 rounded-full text-sm font-dm">
                  {report.property.bhk}, {report.property.locality}
                </span>
              </div>
              <p className="font-dm text-white/90 text-lg">{report.summary}</p>
            </div>
          </div>
        </motion.div>

        {/* Check Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {checks.map((check, i) => (
            <motion.div
              key={check.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface rounded-2xl border border-border-custom p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dm font-bold text-charcoal text-lg">{check.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  check.statusColor === "success" ? "bg-success/10 text-success" :
                  check.statusColor === "warm-gold" ? "bg-warm-gold/10 text-warm-gold" :
                  "bg-danger/10 text-danger"
                }`}>
                  {check.status}
                </span>
              </div>
              <p className="text-sm font-dm text-muted leading-relaxed">{check.details}</p>
            </motion.div>
          ))}
        </div>

        {/* Generated timestamp */}
        {report.generated_at && (
          <p className="text-xs text-muted font-dm mb-4">
            Report generated: {new Date(report.generated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {/* Disclaimer & Download */}
        <div className="bg-surface rounded-2xl border border-border-custom p-6">
          <p className="text-xs text-muted font-dm mb-4">
            <strong>Disclaimer:</strong> This report is generated using AI analysis of publicly available data.
            It does not constitute legal advice. We recommend consulting a property lawyer before finalizing any transaction.
          </p>
          <div className="flex gap-3">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-forest text-white rounded-xl font-dm font-semibold hover:bg-forest-light transition-colors">
              <Download className="w-4 h-4" /> Download Report
            </button>
            <Link
              href={`/negotiate/${propertyId}`}
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-forest text-forest rounded-xl font-dm font-semibold hover:bg-forest/5 transition-colors"
            >
              <Scale className="w-4 h-4" /> Start Negotiation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
