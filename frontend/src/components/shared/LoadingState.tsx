"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <div className="flex gap-1.5 mb-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-forest"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p className="text-muted font-dm text-sm">{message}</p>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("bg-surface rounded-2xl overflow-hidden border border-border-custom", className)}
    >
      <motion.div
        className="h-[220px] bg-sand/50"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <div className="p-4 space-y-3">
        <motion.div className="h-5 bg-sand/50 rounded w-3/4" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }} />
        <motion.div className="h-4 bg-sand/50 rounded w-1/2" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
        <motion.div className="h-6 bg-sand/50 rounded w-1/3" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} />
        <div className="flex gap-2">
          <motion.div className="h-7 bg-sand/50 rounded-full w-20" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} />
          <motion.div className="h-7 bg-sand/50 rounded-full w-16" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }} />
        </div>
      </div>
    </motion.div>
  );
}
