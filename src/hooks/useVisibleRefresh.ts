"use client";
import { useEffect } from "react";

export function useVisibleRefresh(refresh: () => void, enabled = true, interval = 60_000) {
  useEffect(() => {
    if (!enabled) return;
    let lastAttempt = 0;
    const update = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastAttempt < 2000) return;
      lastAttempt = Date.now();
      refresh();
    };
    const timer = window.setInterval(update, interval);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
    };
  }, [refresh, enabled, interval]);
}
