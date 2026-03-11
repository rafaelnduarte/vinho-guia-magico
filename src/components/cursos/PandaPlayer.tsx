import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const HLSPlayer = lazy(() => import("./HLSPlayer"));

interface PandaPlayerProps {
  pandaVideoId: string;
  startAt?: number;
  userId?: string;
  aulaId?: string;
  cursoId?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

const FALLBACK_TIMEOUT_MS = 15_000;

export default function PandaPlayer({
  pandaVideoId,
  startAt = 0,
  aulaId,
  onProgress,
  onComplete,
}: PandaPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);
  const receivedMessageRef = useRef(false);
  const [useHLS, setUseHLS] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [jwt, setJwt] = useState<string | null>(null);
  const [jwtLoading, setJwtLoading] = useState(true);

  // Fetch JWT from panda-token edge function
  useEffect(() => {
    let cancelled = false;
    setJwt(null);
    setJwtLoading(true);

    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("panda-token", {
          body: { video_id: pandaVideoId, aula_id: aulaId || null },
        });
        if (!cancelled && data?.token) {
          setJwt(data.token);
        }
        if (error) {
          console.warn("[PANDA] JWT fetch failed, continuing without token:", error);
        }
      } catch (err) {
        console.warn("[PANDA] JWT fetch error, continuing without token:", err);
      } finally {
        if (!cancelled) setJwtLoading(false);
      }
    };

    fetchToken();
    return () => { cancelled = true; };
  }, [pandaVideoId, aulaId]);

  // Listen for postMessage from Panda iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.origin.includes("pandavideo.com")) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        receivedMessageRef.current = true;
        setIframeLoading(false);

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

        if (
          data?.message === "panda_error" ||
          data?.event === "panda_error" ||
          data?.message === "panda_playerError"
        ) {
          console.warn("[PANDA] Player error event received, switching to HLS fallback");
          setUseHLS(true);
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [onProgress, onComplete]
  );

  useEffect(() => {
    completedRef.current = false;
    receivedMessageRef.current = false;
    setUseHLS(false);
    setIframeLoading(true);

    window.addEventListener("message", handleMessage);

    const timer = setTimeout(() => {
      if (!receivedMessageRef.current) {
        console.warn("[PANDA] No postMessage received after", FALLBACK_TIMEOUT_MS, "ms — activating HLS fallback");
        setUseHLS(true);
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [handleMessage, pandaVideoId]);

  // Wait for JWT before rendering
  if (jwtLoading) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // HLS fallback mode
  if (useHLS) {
    return (
      <div className="space-y-2">
        <Suspense
          fallback={
            <div
              className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center"
              style={{ aspectRatio: "16/9" }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <HLSPlayer
            pandaVideoId={pandaVideoId}
            startAt={startAt}
            onProgress={onProgress}
            onComplete={onComplete}
            jwt={jwt}
          />
        </Suspense>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Reprodução em modo alternativo (HLS). Se o problema persistir, o vídeo pode estar em processamento.</span>
        </div>
      </div>
    );
  }

  // Standard Panda iframe
  const params = new URLSearchParams({
    v: pandaVideoId,
    autoplay: "false",
    loop: "false",
    playsinline: "true",
    ...(startAt > 0 ? { start: String(Math.floor(startAt)) } : {}),
    ...(jwt ? { token: jwt } : {}),
  });

  const src = `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?${params.toString()}`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-secondary" style={{ aspectRatio: "16/9" }}>
      {iframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
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
