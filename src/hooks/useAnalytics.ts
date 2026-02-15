import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type EventType = "page_view" | "filter_used" | "wine_opened";

interface TrackOptions {
  page?: string;
  metadata?: Record<string, any>;
}

export function useAnalytics() {
  const { user, role } = useAuth();

  const track = useCallback(
    async (eventType: EventType, options?: TrackOptions) => {
      // Skip tracking for admin users
      if (role === "admin") return;

      try {
        await supabase.from("analytics_events").insert({
          event_type: eventType,
          user_id: user?.id ?? null,
          page: options?.page ?? window.location.pathname,
          metadata: options?.metadata ?? null,
        });
      } catch (err) {
        // Silent fail — analytics should never break UX
        console.warn("Analytics track error:", err);
      }
    },
    [user?.id, role]
  );

  const trackPageView = useCallback(
    (page?: string) => track("page_view", { page }),
    [track]
  );

  const trackFilterUsed = useCallback(
    (filterName: string, filterValue: string, page?: string) =>
      track("filter_used", {
        page,
        metadata: { filter_name: filterName, filter_value: filterValue },
      }),
    [track]
  );

  const trackWineOpened = useCallback(
    (wineId: string, wineName: string) =>
      track("wine_opened", {
        page: `/curadoria/${wineId}`,
        metadata: { wine_id: wineId, wine_name: wineName },
      }),
    [track]
  );

  return { track, trackPageView, trackFilterUsed, trackWineOpened };
}
