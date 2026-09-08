"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PREV_PATH_KEY = "croo_prev_path";
const CURR_PATH_KEY = "croo_curr_path";

/** Place once in the root layout to track SPA navigation history. */
export function NavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const current = sessionStorage.getItem(CURR_PATH_KEY);
    if (current && current !== pathname) {
      sessionStorage.setItem(PREV_PATH_KEY, current);
    }
    sessionStorage.setItem(CURR_PATH_KEY, pathname);
  }, [pathname]);

  return null;
}

/** Derive a human-readable back label from the previously visited path. */
export function getBackInfo(): { label: string } {
  if (typeof window === "undefined") return { label: "Back" };
  const prev = sessionStorage.getItem(PREV_PATH_KEY);
  if (!prev || prev === "/" || prev === "") return { label: "Back to Store" };
  if (prev === "/agents" || prev.startsWith("/agents?")) return { label: "Back to Agents" };
  if (prev.startsWith("/account")) return { label: "Back to Account" };
  if (prev.startsWith("/services")) return { label: "Back to Services" };
  return { label: "Back" };
}
