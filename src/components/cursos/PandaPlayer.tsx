import { useEffect, useRef, useCallback } from "react";

interface PandaPlayerProps {
  pandaVideoId: string;
  startAt?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

export default function PandaPlayer({
  pandaVideoId,
  startAt = 0,
  onProgress,
  onComplete,
}: PandaPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Only accept messages from Panda domains
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

  const params = new URLSearchParams({
    v: pandaVideoId,
    autoplay: "false",
    loop: "false",
    playsinline: "true",
    ...(startAt > 0 ? { start: String(Math.floor(startAt)) } : {}),
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
