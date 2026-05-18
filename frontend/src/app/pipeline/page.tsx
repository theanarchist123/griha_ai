"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { DashboardSidebar } from "@/components/shared/Navbar";
import { formatPrice } from "@/lib/utils";
import { Loader2, AlertCircle, Building2, Trash2 } from "lucide-react";

type Stage = "shortlisted" | "underReview" | "negotiating" | "offerMade";

interface PipelineEntry {
  entry_id: string;
  property_id: string;
  stage: Stage;
  notes: string | null;
  created_at: string;
  property: {
    id: string;
    title: string;
    apartment_name: string;
    locality: string;
    city: string;
    price: number;
    bhk: string;
    images: string[];
    source_platform: string;
    ai_card_summary: string;
  } | null;
}

const COLUMNS: { id: Stage; label: string; color: string }[] = [
  { id: "shortlisted", label: "Shortlisted", color: "bg-forest" },
  { id: "underReview", label: "Under Review", color: "bg-warm-gold" },
  { id: "negotiating", label: "Negotiating", color: "bg-blue-500" },
  { id: "offerMade", label: "Offer Made", color: "bg-success" },
];

export default function PipelinePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [data, setData] = useState<Record<Stage, PipelineEntry[]>>({
    shortlisted: [],
    underReview: [],
    negotiating: [],
    offerMade: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    const fetchPipeline = async () => {
      try {
        const res = await fetch(
          `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/pipeline?clerk_id=${user.id}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.status === "success") {
            setData(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to load pipeline", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, [isLoaded, isSignedIn, user?.id]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStage = source.droppableId as Stage;
    const destStage = destination.droppableId as Stage;

    // Optimistic UI update
    const sourceCol = Array.from(data[sourceStage]);
    const destCol = sourceStage === destStage ? sourceCol : Array.from(data[destStage]);
    
    const [movedItem] = sourceCol.splice(source.index, 1);
    movedItem.stage = destStage;
    destCol.splice(destination.index, 0, movedItem);

    setData((prev) => ({
      ...prev,
      [sourceStage]: sourceCol,
      [destStage]: destCol,
    }));

    // Persist to backend
    if (sourceStage !== destStage) {
      try {
        await fetch(
          `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/pipeline/${draggableId}/stage?clerk_id=${user?.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: destStage }),
          }
        );
      } catch (err) {
        console.error("Failed to move stage", err);
      }
    }
  };

  const removeEntry = async (entryId: string, stage: Stage) => {
    setData((prev) => ({
      ...prev,
      [stage]: prev[stage].filter((e) => e.entry_id !== entryId),
    }));

    try {
      await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/pipeline/${entryId}?clerk_id=${user?.id}`,
        { method: "DELETE" }
      );
    } catch (err) {
      console.error("Failed to delete entry", err);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex">
      <DashboardSidebar />
      <div className="flex-1 ml-[260px] flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-cream/90 backdrop-blur-md border-b border-border-custom px-8 py-6 shrink-0 z-10">
          <h1 className="font-playfair text-3xl text-charcoal">My Pipeline</h1>
          <p className="text-muted font-dm text-sm mt-1">Track and manage your shortlisted properties</p>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-8 scrollbar-thin">
          {!isLoaded || loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
          ) : !isSignedIn ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-warm-gold" />
              <h2 className="text-xl font-playfair font-bold text-charcoal">Sign in to use Pipeline</h2>
              <p className="text-sm text-muted font-dm">Save properties and track them through your decision process.</p>
              <SignInButton mode="modal">
                <button className="px-6 py-2 bg-forest text-white font-dm rounded-xl hover:bg-forest-light transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-6 h-full min-w-[1200px]">
                {COLUMNS.map((col) => {
                  const items = data[col.id] || [];
                  return (
                    <div key={col.id} className="flex-1 flex flex-col bg-surface/50 border border-border-custom rounded-2xl overflow-hidden max-h-full">
                      {/* Column Header */}
                      <div className="p-4 border-b border-border-custom bg-surface shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${col.color}`} />
                          <h3 className="font-dm font-semibold text-charcoal">{col.label}</h3>
                        </div>
                        <span className="bg-cream text-muted text-xs font-bold px-2 py-1 rounded-full">
                          {items.length}
                        </span>
                      </div>
                      
                      {/* Column Body / Droppable */}
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin ${
                              snapshot.isDraggingOver ? "bg-forest/5" : ""
                            }`}
                          >
                            {items.map((entry, index) => (
                              <Draggable key={entry.entry_id} draggableId={entry.entry_id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-surface border rounded-xl overflow-hidden shadow-sm group ${
                                      snapshot.isDragging ? "shadow-xl border-forest" : "border-border-custom hover:border-forest/50"
                                    }`}
                                  >
                                    {entry.property ? (
                                      <div className="p-3 relative">
                                        <button
                                          onClick={() => removeEntry(entry.entry_id, col.id)}
                                          className="absolute top-2 right-2 p-1.5 bg-surface/80 rounded-full text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-sand">
                                          {entry.property.images?.[0] ? (
                                            <img
                                              src={entry.property.images[0]}
                                              alt={entry.property.title}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <Building2 className="w-8 h-8 text-muted m-auto mt-12" />
                                          )}
                                        </div>
                                        <Link href={`/property/${entry.property_id}`} className="block hover:underline">
                                          <h4 className="font-dm font-semibold text-charcoal text-sm truncate">
                                            {entry.property.bhk} in {entry.property.locality}
                                          </h4>
                                        </Link>
                                        <p className="text-xs text-muted truncate mt-0.5">
                                          {entry.property.apartment_name || entry.property.title}
                                        </p>
                                        <p className="font-bold text-forest mt-2">
                                          {formatPrice(entry.property.price)}/mo
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="p-4 text-center">
                                        <p className="text-xs text-muted">Property unavailable</p>
                                        <button onClick={() => removeEntry(entry.entry_id, col.id)} className="text-xs text-danger hover:underline mt-2">Remove</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {items.length === 0 && (
                              <div className="text-center py-8 text-sm font-dm text-muted border-2 border-dashed border-border-custom rounded-xl">
                                Drag properties here
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </div>
      </div>
    </div>
  );
}
