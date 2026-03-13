import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Loader2, AlertTriangle, ShieldAlert, VideoOff } from "lucide-react";
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

type PlayerState = "loading" | "ready" | "drm_error" | "not_found" | "hls_fallback";

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
  const [playerState, setPlayerState] = useState<PlayerState>("loading");
  const [jwt, setJwt] = useState<string | null>(null);
  const [jwtLoading, setJwtLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

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
        if (cancelled) return;
        if (data?.error === "VIDEO_NOT_FOUND") {
          console.warn("[PANDA] Video not found in Panda:", pandaVideoId);
          setPlayerState("not_found");
          setJwtLoading(false);
          return;
        }
        if (data?.token) {
          setJwt(data.token);
        }
        if (error) {
          console.warn("[PANDA] JWT fetch failed:", error);
        }
      } catch (err) {
        console.warn("[PANDA] JWT fetch error:", err);
      } finally {
        if (!cancelled) setJwtLoading(false);
      }
    };

    fetchToken();
    return () => { cancelled = true; };
  }, [pandaVideoId, aulaId, retryCount]);

  // Validate config.json before rendering iframe
  useEffect(() => {
    if (jwtLoading) return;

    let cancelled = false;
    const validateConfig = async () => {
      // Build config URL
      const configBase = `https://config.tv.pandavideo.com.br/embed/v2/${pandaVideoId}.json`;
      const configUrl = jwt ? `${configBase}?jwt=${jwt}` : configBase;

      try {
        const res = await fetch(configUrl, { method: "GET" });

        if (cancelled) return;

        if (res.ok) {
          console.log("[PANDA] config.json OK (200)");
          setPlayerState("ready");
        } else if (res.status === 404 || res.status === 401 || res.status === 403) {
          console.error(`[PANDA] config.json rejected: ${res.status}`);
          // If first attempt failed and we had a jwt, try re-fetching token once
          if (retryCount === 0 && jwt) {
            console.log("[PANDA] Retrying token fetch...");
            setRetryCount(1);
          } else {
            setPlayerState("drm_error");
          }
        } else {
          // Other errors — still try to load player
          console.warn(`[PANDA] config.json unexpected status: ${res.status}, proceeding anyway`);
          setPlayerState("ready");
        }
      } catch (err) {
        if (cancelled) return;
        // CORS or network error — can't validate, proceed with iframe
        console.warn("[PANDA] config.json validation failed (likely CORS), proceeding:", err);
        setPlayerState("ready");
      }
    };

    validateConfig();
    return () => { cancelled = true; };
  }, [jwtLoading, jwt, pandaVideoId, retryCount]);

  // Listen for postMessage from Panda iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.origin.includes("pandavideo.com")) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        receivedMessageRef.current = true;

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

        // Only fall back to HLS for actual playback errors, NOT auth/DRM errors
        if (
          data?.message === "panda_error" ||
          data?.event === "panda_error" ||
          data?.message === "panda_playerError"
        ) {
          console.warn("[PANDA] Player error event, switching to HLS fallback");
          setPlayerState("hls_fallback");
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [onProgress, onComplete]
  );

  useEffect(() => {
    if (playerState !== "ready") return;

    completedRef.current = false;
    receivedMessageRef.current = false;

    window.addEventListener("message", handleMessage);

    // Only use timeout fallback when player is in "ready" state
    const timer = setTimeout(() => {
      if (!receivedMessageRef.current) {
        console.warn("[PANDA] No postMessage received after", FALLBACK_TIMEOUT_MS, "ms — HLS fallback");
        setPlayerState("hls_fallback");
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [handleMessage, pandaVideoId, playerState]);

  // Loading state
  if (jwtLoading || playerState === "loading") {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Video not found in Panda — distinct from DRM error
  if (playerState === "not_found") {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="text-center space-y-3 p-6 max-w-md">
          <VideoOff className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Vídeo temporariamente indisponível</p>
          <p className="text-xs text-muted-foreground">
            Este vídeo não foi encontrado na plataforma de streaming. Pode estar em processamento ou requer sincronização pelo administrador.
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono">ID: {pandaVideoId}</p>
        </div>
      </div>
    );
  }

  if (playerState === "drm_error") {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="text-center space-y-3 p-6 max-w-md">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Erro de acesso DRM</p>
          <p className="text-xs text-muted-foreground">
            Este vídeo não está autorizado para reprodução. Verifique se ele está associado ao grupo DRM no painel administrativo.
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono">ID: {pandaVideoId}</p>
        </div>
      </div>
    );
  }

  // HLS fallback mode
  if (playerState === "hls_fallback") {
    return (
      <div className="space-y-2">
        <Suspense
          fallback={
            <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
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

  // Standard Panda iframe (playerState === "ready")
  const params = new URLSearchParams({
    v: pandaVideoId,
    autoplay: "false",
    loop: "false",
    playsinline: "true",
    ...(startAt > 0 ? { start: String(Math.floor(startAt)) } : {}),
    ...(jwt ? { jwt } : {}),
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
