"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message: string;
  className?: string;
}

export function EmptyState({ title, message, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center mb-6"
      >
        <span className="font-playfair italic text-forest text-2xl font-bold">G</span>
      </motion.div>
      {title && (
        <h3 className="font-playfair text-xl text-charcoal mb-2">{title}</h3>
      )}
      <p className="text-muted text-center max-w-md font-dm">{message}</p>
    </div>
  );
}
