import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface HLSPlayerProps {
  pandaVideoId: string;
  startAt?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
  jwt?: string | null;
}

export default function HLSPlayer({
  pandaVideoId,
  startAt = 0,
  onProgress,
  onComplete,
  jwt,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const completedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseHlsUrl = `https://b-vz-7b95acb0-d42.tv.pandavideo.com.br/${pandaVideoId}/playlist.m3u8`;
  const hlsUrl = jwt ? `${baseHlsUrl}?jwt=${jwt}` : baseHlsUrl;

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const ct = video.currentTime;
    const dur = video.duration || 0;
    onProgress?.(ct, dur);

    if (dur > 0 && ct / dur > 0.9 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onProgress, onComplete]);

  const handleEnded = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    completedRef.current = false;
    setLoading(true);
    setError(null);

    const init = async () => {
      // Safari/iOS native HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        if (startAt > 0) video.currentTime = startAt;
        setLoading(false);
        return;
      }

      try {
        const HlsModule = await import("hls.js");
        const Hls = HlsModule.default;

        if (!Hls.isSupported()) {
          setError("Seu navegador não suporta reprodução HLS.");
          setLoading(false);
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          startLevel: -1,
          maxMaxBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          if (startAt > 0) video.currentTime = startAt;
        });

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) {
            console.error("[HLS] Fatal error:", data.type, data.details);
            setError(`Erro de reprodução: ${data.details}`);
            setLoading(false);
          }
        });
      } catch (err) {
        console.error("[HLS] Import error:", err);
        setError("Falha ao carregar player de vídeo.");
        setLoading(false);
      }
    };

    init();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, startAt]);

  if (error) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl bg-secondary flex items-center justify-center"
        style={{ aspectRatio: "16/9" }}
      >
        <div className="text-center space-y-2 p-4">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground/60">ID: {pandaVideoId}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-secondary"
      style={{ aspectRatio: "16/9" }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        controls
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );
}
