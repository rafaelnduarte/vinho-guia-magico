import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, VideoOff } from "lucide-react";

interface PandaPlayerProps {
  embedUrl?: string | null;
  embedHtml?: string | null;
  pandaVideoId?: string;
  startAt?: number;
  userId?: string;
  aulaId?: string;
  cursoId?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

export default function PandaPlayer({
  embedUrl,
  embedHtml,
  pandaVideoId,
  startAt = 0,
  onProgress,
  onComplete,
}: PandaPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlContainerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // If embedHtml is provided, render it directly
  const useHtml = !!embedHtml;

  // Build the iframe src (only used when embedHtml is NOT available)
  const src = (() => {
    if (useHtml) return null;
    if (embedUrl) return embedUrl;
    if (pandaVideoId) {
      const params = new URLSearchParams({
        v: pandaVideoId,
        autoplay: "false",
        loop: "false",
        playsinline: "true",
        ...(startAt > 0 ? { start: String(Math.floor(startAt)) } : {}),
      });
      return `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?${params.toString()}`;
    }
    return null;
  })();

  // Listen for postMessage from Panda iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.origin.includes("pandavideo.com")) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        // Mark ready when Panda signals it's fully loaded
        if (
          data?.message === "panda_ready" ||
          data?.event === "panda_ready" ||
          data?.message === "panda_play" ||
          data?.event === "panda_play"
        ) {
          setReady(true);
        }

        if (data?.message === "panda_timeupdate" || data?.event === "panda_timeupdate") {
          setReady(true); // also mark ready on first timeupdate as fallback
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
    if (!src && !useHtml) return;
    completedRef.current = false;
    setReady(false);

    window.addEventListener("message", handleMessage);

    const timer = setTimeout(() => setReady(true), 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [handleMessage, src, useHtml]);

  // No video available at all
  if (!src && !useHtml) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="text-center space-y-3 p-6 max-w-md">
          <VideoOff className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Vídeo não disponível</p>
          <p className="text-xs text-muted-foreground">
            Este vídeo ainda não possui um embed configurado. Sincronize pelo painel administrativo.
          </p>
        </div>
      </div>
    );
  }

  // Render embed_html via dangerouslySetInnerHTML
  if (useHtml) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary" style={{ aspectRatio: "16/9" }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div
          className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
          dangerouslySetInnerHTML={{ __html: embedHtml! }}
          onLoad={() => setReady(true)}
        />
      </div>
    );
  }

  // Render via iframe src
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-secondary" style={{ aspectRatio: "16/9" }}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src!}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
        onLoad={() => setReady(true)}
      />
    </div>
  );
}
