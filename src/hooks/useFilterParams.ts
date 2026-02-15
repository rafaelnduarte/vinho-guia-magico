import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const get = (key: string, fallback = "") => searchParams.get(key) ?? fallback;
  const getNum = (key: string, fallback: number) => {
    const v = searchParams.get(key);
    return v ? parseInt(v) : fallback;
  };

  const set = useCallback(
    (updates: Record<string, string | number | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === "" || v === "all") {
            next.delete(k);
          } else {
            next.set(k, String(v));
          }
        }
        // Reset page when changing filters
        if (!("page" in updates)) next.delete("page");
        return next;
      });
    },
    [setSearchParams]
  );

  return { get, getNum, set };
}
