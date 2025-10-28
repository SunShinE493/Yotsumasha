import { useState, useCallback, useEffect } from "react";

export interface ToastPayload {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

type ToastListener = (toast: ToastPayload) => void;

// Global pub/sub so all hooks share the same event stream
const listeners: Set<ToastListener> = new Set();

function publish(toast: ToastPayload) {
  for (const l of Array.from(listeners)) {
    try { l(toast); } catch {}
  }
}

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type ToastItem = ToastPayload & { id: string };

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = subscribe((t) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: ToastItem = { ...t, id };
      setToasts((prev) => [...prev, item]);
      // Auto-remove after 4s
      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
      return () => clearTimeout(timeout);
    });
    return unsub;
  }, []);

  const toast = useCallback((newToast: ToastPayload) => {
    publish(newToast);
  }, []);

  return { toast, toasts };
}