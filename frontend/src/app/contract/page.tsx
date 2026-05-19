"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  Upload, FileText, Shield, AlertTriangle, XCircle,
  CheckCircle, ChevronDown, ChevronUp, Sparkles, Loader2,
  MessageCircle, Send, X, BookOpen
} from "lucide-react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";
import Link from "next/link";

interface ClauseAnalysis {
  clause_number: number;
  heading: string;
  text: string;
  risk_level: "standard" | "caution" | "high";
  meaning: string;
  problem: string;
  recommendation: string;
  law_reference: string;
}

interface ExtractedData {
  parties?: string[];
  rent_amount?: number;
  deposit_amount?: number;
  lock_in_months?: number;
  agreement_duration_months?: number;
  escalation_percent?: number;
  property_address?: string;
  start_date?: string;
  maintenance_amount?: number;
  special_conditions?: string[];
}

interface AnalysisResult {
  document_id: string;
  filename: string;
  ai_summary: string;
  clause_analysis: ClauseAnalysis[];
  extracted_data: ExtractedData;
}

const RISK_CONFIG = {
  standard: { color: "text-success", bg: "bg-success/10 border-success/20", icon: CheckCircle, label: "Standard" },
  caution: { color: "text-warm-gold", bg: "bg-warm-gold/10 border-warm-gold/20", icon: AlertTriangle, label: "Caution" },
  high: { color: "text-danger", bg: "bg-danger/10 border-danger/20", icon: XCircle, label: "High Risk" },
};

const DOC_TYPES = [
  { value: "rent_agreement", label: "Rent Agreement" },
  { value: "sale_deed", label: "Sale Deed" },
  { value: "lease_deed", label: "Lease Deed" },
  { value: "noc", label: "NOC Letter" },
  { value: "builder_agreement", label: "Builder Agreement" },
  { value: "other", label: "Other Legal Document" },
];

export default function ContractAnalysisPage() {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState("rent_agreement");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expandedClause, setExpandedClause] = useState<number | null>(null);

  // Q&A chat
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("document_type", docType);
    if (user?.id) form.append("clerk_id", user.id);

    try {
      const res = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/documents/upload`,
        { method: "POST", body: form }
      );
      const json = await res.json();
      if (json.status === "success") {
        setResult({
          document_id: json.document_id,
          filename: json.filename,
          ai_summary: json.ai_summary,
          clause_analysis: json.clause_analysis || [],
          extracted_data: json.extracted_data || {},
        });
      } else {
        setUploadError(json.message || "Analysis failed");
      }
    } catch {
      setUploadError("Failed to connect to server. Is the backend running?");
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/documents/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), clerk_id: user?.id }),
        }
      );
      const json = await res.json();
      setAnswer(json.answer || "No answer found.");
    } catch {
      setAnswer("Failed to get answer from server.");
    } finally {
      setAsking(false);
    }
  };

  const highCount = result?.clause_analysis.filter(c => c.risk_level === "high").length || 0;
  const cautionCount = result?.clause_analysis.filter(c => c.risk_level === "caution").length || 0;
  const standardCount = result?.clause_analysis.filter(c => c.risk_level === "standard").length || 0;

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="lg:ml-[260px]">
        <DashboardTopBar />

        <div className="p-6">
          <div className="mb-6">
            <h1 className="font-playfair text-3xl text-charcoal flex items-center gap-3">
              <Shield className="w-8 h-8 text-forest" /> Contract Analysis
            </h1>
            <p className="text-sm text-muted font-dm mt-1">
              Upload a rent agreement or legal document — AI will analyze every clause for risk.
            </p>
          </div>

          {/* Upload section */}
          {!result && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Doc type selector */}
              <div className="bg-surface rounded-2xl border border-border-custom p-5">
                <label className="text-xs text-muted font-dm font-semibold uppercase tracking-wide mb-2 block">
                  Document Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-dm font-semibold border transition-all ${
                        docType === dt.value
                          ? "bg-forest text-white border-forest"
                          : "bg-cream border-border-custom text-charcoal hover:border-forest/40"
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`bg-surface rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                  dragging ? "border-forest bg-forest/5" : "border-border-custom hover:border-forest/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
                />
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-forest" : "text-muted"}`} />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-5 h-5 text-forest" />
                    <span className="font-dm font-semibold text-charcoal">{file.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-muted hover:text-danger"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-dm font-semibold text-charcoal mb-1">Drop PDF or image here</p>
                    <p className="text-sm text-muted">or click to browse — supports PDF, JPG, PNG</p>
                  </>
                )}
              </div>

              {uploadError && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm font-dm">
                  {uploadError}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full py-4 bg-forest text-white rounded-xl font-dm font-semibold text-lg hover:bg-forest-light transition-colors disabled:opacity-40 flex items-center justify-center gap-3"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing document... this may take 30-60 seconds
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze with AI
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Analysis result */}
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Header + reset */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-playfair text-2xl text-charcoal">{result.filename}</h2>
                  <p className="text-sm text-muted font-dm mt-0.5">{result.clause_analysis.length} clauses analyzed</p>
                </div>
                <button
                  onClick={() => { setResult(null); setFile(null); setAnswer(null); }}
                  className="px-4 py-2 text-sm font-dm border border-border-custom rounded-xl hover:border-forest/40 text-charcoal transition-colors"
                >
                  Analyze Another
                </button>
              </div>

              {/* Risk summary bar */}
              <div className="bg-surface rounded-2xl border border-border-custom p-5 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-2xl font-bold text-danger">{highCount}</p>
                  <p className="text-xs font-dm text-danger font-semibold mt-0.5">High Risk</p>
                </div>
                <div className="text-center p-3 bg-warm-gold/10 border border-warm-gold/20 rounded-xl">
                  <p className="text-2xl font-bold text-warm-gold">{cautionCount}</p>
                  <p className="text-xs font-dm text-warm-gold font-semibold mt-0.5">Caution</p>
                </div>
                <div className="text-center p-3 bg-success/10 border border-success/20 rounded-xl">
                  <p className="text-2xl font-bold text-success">{standardCount}</p>
                  <p className="text-xs font-dm text-success font-semibold mt-0.5">Standard</p>
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-surface rounded-2xl border border-border-custom p-6">
                <h3 className="font-dm font-bold text-charcoal mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-forest" /> AI Summary
                </h3>
                <p className="text-sm font-dm text-charcoal leading-relaxed">{result.ai_summary}</p>
              </div>

              {/* Extracted key data */}
              {result.extracted_data && Object.keys(result.extracted_data).some(k => result.extracted_data[k as keyof ExtractedData] != null) && (
                <div className="bg-surface rounded-2xl border border-border-custom p-6">
                  <h3 className="font-dm font-bold text-charcoal mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-forest" /> Key Terms Extracted
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {result.extracted_data.rent_amount && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Rent</p>
                        <p className="font-semibold text-charcoal">₹{result.extracted_data.rent_amount.toLocaleString("en-IN")}/mo</p>
                      </div>
                    )}
                    {result.extracted_data.deposit_amount && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Deposit</p>
                        <p className="font-semibold text-charcoal">₹{result.extracted_data.deposit_amount.toLocaleString("en-IN")}</p>
                      </div>
                    )}
                    {result.extracted_data.lock_in_months && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Lock-in</p>
                        <p className="font-semibold text-charcoal">{result.extracted_data.lock_in_months} months</p>
                      </div>
                    )}
                    {result.extracted_data.agreement_duration_months && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Duration</p>
                        <p className="font-semibold text-charcoal">{result.extracted_data.agreement_duration_months} months</p>
                      </div>
                    )}
                    {result.extracted_data.escalation_percent && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Escalation</p>
                        <p className="font-semibold text-charcoal">{result.extracted_data.escalation_percent}% / year</p>
                      </div>
                    )}
                    {result.extracted_data.maintenance_amount && (
                      <div className="bg-cream rounded-xl p-3">
                        <p className="text-xs text-muted font-dm">Maintenance</p>
                        <p className="font-semibold text-charcoal">₹{result.extracted_data.maintenance_amount.toLocaleString("en-IN")}/mo</p>
                      </div>
                    )}
                  </div>
                  {result.extracted_data.parties && result.extracted_data.parties.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted font-dm mb-1">Parties</p>
                      <p className="text-sm font-dm text-charcoal">{result.extracted_data.parties.join(" ↔ ")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Clause-by-clause */}
              <div className="space-y-3">
                <h3 className="font-dm font-bold text-charcoal text-lg">Clause Analysis</h3>
                {result.clause_analysis.map(clause => {
                  const cfg = RISK_CONFIG[clause.risk_level] || RISK_CONFIG.standard;
                  const isExpanded = expandedClause === clause.clause_number;
                  return (
                    <div
                      key={clause.clause_number}
                      className={`rounded-2xl border ${cfg.bg} overflow-hidden transition-all`}
                    >
                      <button
                        onClick={() => setExpandedClause(isExpanded ? null : clause.clause_number)}
                        className="w-full flex items-center gap-3 p-4 text-left"
                      >
                        <cfg.icon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-dm font-semibold text-charcoal truncate">
                            Clause {clause.clause_number}{clause.heading ? `: ${clause.heading}` : ""}
                          </p>
                          <p className="text-xs text-muted mt-0.5">{clause.meaning}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} shrink-0`}>
                          {cfg.label}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted shrink-0" />}
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-black/5"
                          >
                            <div className="p-4 space-y-3 bg-white/30">
                              <div>
                                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Original Text</p>
                                <p className="text-xs font-dm text-charcoal leading-relaxed italic">"{clause.text}"</p>
                              </div>
                              {clause.problem && (
                                <div>
                                  <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1">Problem</p>
                                  <p className="text-sm font-dm text-charcoal">{clause.problem}</p>
                                </div>
                              )}
                              {clause.recommendation && (
                                <div>
                                  <p className="text-xs font-semibold text-forest uppercase tracking-wide mb-1">Recommendation</p>
                                  <p className="text-sm font-dm text-charcoal">{clause.recommendation}</p>
                                </div>
                              )}
                              {clause.law_reference && (
                                <p className="text-xs text-muted font-dm">⚖️ {clause.law_reference}</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Document Q&A */}
              <div className="bg-surface rounded-2xl border border-border-custom p-6">
                <h3 className="font-dm font-bold text-charcoal mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-forest" /> Ask About This Document
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAsk()}
                    placeholder="e.g. What is the notice period? Is there an escalation clause?"
                    className="flex-1 bg-cream border border-border-custom rounded-xl px-4 py-2.5 text-sm font-dm focus:outline-none focus:border-forest text-charcoal"
                    disabled={asking}
                  />
                  <button
                    onClick={handleAsk}
                    disabled={asking || !question.trim()}
                    className="px-4 py-2.5 bg-forest text-white rounded-xl hover:bg-forest-light transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                {answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-forest/5 border border-forest/15 rounded-xl"
                  >
                    <p className="text-xs font-semibold text-forest mb-1">AI Answer</p>
                    <p className="text-sm font-dm text-charcoal leading-relaxed whitespace-pre-line">{answer}</p>
                  </motion.div>
                )}

                {/* Quick questions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {["What is the notice period?", "Is there a rent escalation clause?", "What are my deposit terms?", "Are there any risky clauses I should negotiate?"].map(q => (
                    <button
                      key={q}
                      onClick={() => { setQuestion(q); }}
                      className="text-xs font-dm px-2.5 py-1 bg-forest/5 border border-forest/15 text-forest rounded-full hover:bg-forest/10 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link to negotiate */}
              <div className="bg-surface rounded-2xl border border-border-custom p-5 flex items-center justify-between">
                <div>
                  <p className="font-dm font-semibold text-charcoal">Ready to negotiate?</p>
                  <p className="text-xs text-muted font-dm mt-0.5">Use AI to negotiate better terms based on what was found</p>
                </div>
                <Link
                  href="/negotiate/prop-1"
                  className="px-5 py-2.5 bg-forest text-white text-sm font-dm font-semibold rounded-xl hover:bg-forest-light transition-colors"
                >
                  Start Negotiation →
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
