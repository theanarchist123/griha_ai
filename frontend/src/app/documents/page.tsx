"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, FileText, Upload, Eye, Download, Share2, File, Image,
  MessageSquare, Scale, Loader2, AlertTriangle, ShieldCheck, XCircle,
} from "lucide-react";
import { DashboardSidebar, DashboardTopBar } from "@/components/shared/Navbar";

interface DocumentItem {
  id: string;
  document_type: string;
  filename: string;
  ai_summary: string;
  clause_count: number;
  high_risk_clauses: number;
  caution_clauses: number;
  extracted_data: Record<string, any>;
  uploaded_at: string | null;
  property_id: string | null;
  url: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  rent_agreement: FileText,
  sale_deed: Scale,
  legal_report: Scale,
  receipt: File,
  photo: Image,
  negotiation_transcript: MessageSquare,
};

const TYPE_LABELS: Record<string, string> = {
  rent_agreement: "Agreements",
  sale_deed: "Agreements",
  legal_report: "Legal Reports",
  receipt: "Receipts",
  photo: "Property Photos",
  negotiation_transcript: "Negotiation Transcripts",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [askingAI, setAskingAI] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents/");
      const json = await res.json();
      if (json.status === "success") {
        setDocuments(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", guessDocType(file.name));

      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.status === "success") {
        // Refresh the list
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function guessDocType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes("agreement") || lower.includes("rent") || lower.includes("lease")) return "rent_agreement";
    if (lower.includes("sale") || lower.includes("deed")) return "sale_deed";
    if (lower.includes("legal") || lower.includes("report")) return "legal_report";
    if (lower.includes("receipt") || lower.includes("invoice")) return "receipt";
    if (lower.match(/\.(jpg|jpeg|png|webp)$/)) return "photo";
    return "rent_agreement";
  }

  async function handleAskAI() {
    if (!searchQuery.trim()) return;
    setAskingAI(true);
    setAiAnswer("");
    try {
      const res = await fetch("http://localhost:8000/api/documents/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: searchQuery }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setAiAnswer(json.answer);
      }
    } catch (err) {
      setAiAnswer("Failed to connect to server. Please try again.");
    } finally {
      setAskingAI(false);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) uploadFile(files[0]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) uploadFile(files[0]);
  };

  // Group by category
  const grouped = documents.reduce<Record<string, DocumentItem[]>>((acc, doc) => {
    const cat = TYPE_LABELS[doc.document_type] || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-cream">
      <DashboardSidebar />
      <div className="ml-[260px]">
        <DashboardTopBar />

        <div className="p-6 max-w-5xl">
          <h1 className="font-playfair text-3xl text-charcoal mb-6">Documents</h1>

          {/* Smart Search */}
          <div className="bg-surface rounded-2xl border border-border-custom p-6 mb-8">
            <h3 className="font-dm font-semibold text-charcoal text-sm mb-3">Ask anything about your documents</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                  placeholder="e.g., What is my lock-in period? What's the penalty for early exit?"
                  className="w-full pl-9 pr-4 py-3 bg-cream border border-border-custom rounded-xl text-sm font-dm focus:outline-none focus:border-forest"
                />
              </div>
              <button
                onClick={handleAskAI}
                disabled={askingAI}
                className="px-6 py-3 bg-forest text-white rounded-xl font-dm font-semibold hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {askingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Ask AI
              </button>
            </div>
            {aiAnswer && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-forest/5 border border-forest/10 rounded-xl p-4"
              >
                <p className="text-xs text-forest font-dm font-semibold mb-1">AI Answer</p>
                <p className="text-sm font-dm text-charcoal whitespace-pre-line">{aiAnswer}</p>
              </motion.div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-forest animate-spin mx-auto mb-3" />
              <p className="text-muted font-dm">Loading documents...</p>
            </div>
          )}

          {/* Document Categories */}
          {!loading && Object.keys(grouped).length > 0 && Object.entries(grouped).map(([category, docs]) => {
            const Icon = TYPE_ICONS[docs[0]?.document_type] || FileText;
            return (
              <section key={category} className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="w-5 h-5 text-forest" />
                  <h2 className="font-dm font-bold text-charcoal text-lg">{category}</h2>
                  <span className="text-xs text-muted bg-cream px-2 py-0.5 rounded-full">{docs.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {docs.map((doc, i) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-surface rounded-xl border border-border-custom p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-forest" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-dm font-semibold text-charcoal text-sm truncate">{doc.filename}</p>
                          <p className="text-xs text-muted mt-0.5">
                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "Recently"}
                          </p>
                          <p className="text-xs text-forest-light italic mt-1 line-clamp-2">{doc.ai_summary}</p>

                          {/* Risk badges */}
                          {(doc.high_risk_clauses > 0 || doc.caution_clauses > 0) && (
                            <div className="flex gap-1.5 mt-2">
                              {doc.high_risk_clauses > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-semibold">
                                  <XCircle className="w-3 h-3" /> {doc.high_risk_clauses} High Risk
                                </span>
                              )}
                              {doc.caution_clauses > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-warm-gold/10 text-warm-gold px-2 py-0.5 rounded-full font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> {doc.caution_clauses} Caution
                                </span>
                              )}
                              {doc.high_risk_clauses === 0 && doc.caution_clauses === 0 && doc.clause_count > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-semibold">
                                  <ShieldCheck className="w-3 h-3" /> All Clear
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border-custom">
                        <button className="flex items-center gap-1 text-xs text-forest font-dm font-semibold hover:underline">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button className="flex items-center gap-1 text-xs text-forest font-dm font-semibold hover:underline">
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Empty state */}
          {!loading && documents.length === 0 && (
            <div className="text-center py-12 bg-surface rounded-2xl border border-border-custom">
              <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="font-dm font-semibold text-charcoal text-lg">No documents yet</p>
              <p className="text-muted text-sm font-dm mt-1">Upload a rent agreement, legal report, or receipt to get AI analysis</p>
            </div>
          )}

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-2xl p-12 text-center bg-surface cursor-pointer transition-all mt-8 ${
              dragOver ? "border-forest bg-forest/5" : "border-border-custom hover:border-forest/30"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {uploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-forest mx-auto mb-3 animate-spin" />
                  <p className="font-dm font-semibold text-charcoal">Uploading & Analyzing...</p>
                  <p className="text-sm text-muted font-dm mt-1">AI is extracting text and analyzing clauses</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="font-dm font-semibold text-charcoal">Drag & drop files here</p>
                  <p className="text-sm text-muted font-dm mt-1">or click to browse. PDF, JPG, PNG supported.</p>
                </>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
