import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PandaPlayerProps {
  pandaVideoId: string;
  startAt?: number;
  userId?: string;
  aulaId?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

export default function PandaPlayer({
  pandaVideoId,
  startAt = 0,
  userId,
  aulaId,
  onProgress,
  onComplete,
}: PandaPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);
  const [pandaToken, setPandaToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Fetch signed JWT
  useEffect(() => {
    let cancelled = false;
    setTokenLoading(true);
    setPandaToken(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("panda-token", {
          body: { video_id: pandaVideoId, aula_id: aulaId },
        });
        if (!cancelled && data?.token) {
          setPandaToken(data.token);
        }
        if (error) console.warn("panda-token error, falling back:", error);
      } catch (e) {
        console.warn("panda-token fetch failed, falling back:", e);
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pandaVideoId, aulaId]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.origin.includes("pandavideo.com")) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.message === "panda_timeupdate" || data?.event === "panda_timeupdate") {
          const currentTime = data.currentTime ?? data.seconds ?? 0;
          const duration = data.duration ?? 0;
          onProgress?.(currentTime, duration);

          if (duration > 0 && currentTime / duration > 0.9 && !completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
        }

        if (data?.message === "panda_ended" || data?.event === "panda_ended") {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [onProgress, onComplete]
  );

  useEffect(() => {
    completedRef.current = false;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage, pandaVideoId]);

  if (tokenLoading) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const params = new URLSearchParams({
    v: pandaVideoId,
    autoplay: "false",
    loop: "false",
    playsinline: "true",
    ...(startAt > 0 ? { start: String(Math.floor(startAt)) } : {}),
    ...(pandaToken ? { token: pandaToken } : {}),
  });

  const src = `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?${params.toString()}`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-secondary" style={{ aspectRatio: "16/9" }}>
      <iframe
        ref={iframeRef}
        src={src}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
