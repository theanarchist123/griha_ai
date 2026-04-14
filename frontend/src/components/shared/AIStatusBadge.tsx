"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AIStatusBadgeProps {
  text: string;
  variant?: "active" | "idle" | "alert";
  className?: string;
}

export function AIStatusBadge({ text, variant = "active", className }: AIStatusBadgeProps) {
  const dotColors = {
    active: "bg-success",
    idle: "bg-muted",
    alert: "bg-warm-gold",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border-custom text-sm font-dm", className)}>
      <motion.span
        className={cn("w-2 h-2 rounded-full", dotColors[variant])}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="text-charcoal">{text}</span>
    </div>
  );
}
