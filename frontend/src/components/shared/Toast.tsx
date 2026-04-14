"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  type: "success" | "warning" | "info";
  message: string;
}

let toastId = 0;
const listeners: ((toast: Toast) => void)[] = [];

export function showToast(type: Toast["type"], message: string) {
  const toast: Toast = { id: String(++toastId), type, message };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    warning: <AlertTriangle className="w-5 h-5 text-warm-gold" />,
    info: <Info className="w-5 h-5 text-forest" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
              "flex items-center gap-3 bg-surface border border-border-custom rounded-xl px-4 py-3 shadow-lg min-w-[300px]"
            )}
          >
            {icons[toast.type]}
            <p className="text-sm text-charcoal font-dm flex-1">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-muted hover:text-charcoal transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
