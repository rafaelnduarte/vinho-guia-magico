import { useEffect, useRef, useState, useMemo } from "react";
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
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const [ready, setReady] = useState(false);

  // Keep refs in sync without triggering re-renders
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;

  const useHtml = !!embedHtml;

  // Memoize src so it only changes when inputs actually change
  const src = useMemo(() => {
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
  }, [useHtml, embedUrl, pandaVideoId, startAt]);

  // Attach postMessage listener ONCE (reads callbacks from refs)
  useEffect(() => {
    if (!src && !useHtml) return;
    completedRef.current = false;

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes("pandavideo.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.message === "panda_timeupdate" || data?.event === "panda_timeupdate") {
          const currentTime = data.currentTime ?? data.seconds ?? 0;
          const duration = data.duration ?? 0;
          onProgressRef.current?.(currentTime, duration);

          if (duration > 0 && currentTime / duration > 0.9 && !completedRef.current) {
            completedRef.current = true;
            onCompleteRef.current?.();
          }
        }

        if (data?.message === "panda_ended" || data?.event === "panda_ended") {
          if (!completedRef.current) {
            completedRef.current = true;
            onCompleteRef.current?.();
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [src, useHtml]);

  // For embed_html: inject HTML imperatively once so React never recreates the iframe
  useEffect(() => {
    if (!useHtml || !embedHtml || !htmlContainerRef.current) return;
    completedRef.current = false;
    setReady(false);

    const container = htmlContainerRef.current;
    container.innerHTML = embedHtml;

    // Style any injected iframes
    const iframes = container.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.style.position = "absolute";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      iframe.addEventListener("load", () => setReady(true), { once: true });
    });

    // Fallback ready after 2s if no load event fires
    const fallback = setTimeout(() => setReady(true), 2000);

    return () => {
      clearTimeout(fallback);
    };
  }, [useHtml, embedHtml]);

  // No video available
  if (!src && !useHtml) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center"
        style={{ aspectRatio: "16/9", minHeight: 360 }}
      >
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

  // Render embed_html via imperative ref (no dangerouslySetInnerHTML)
  if (useHtml) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl bg-secondary"
        style={{ aspectRatio: "16/9", minHeight: 360 }}
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div
          ref={htmlContainerRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Render via iframe src
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-secondary"
      style={{ aspectRatio: "16/9", minHeight: 360 }}
    >
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
