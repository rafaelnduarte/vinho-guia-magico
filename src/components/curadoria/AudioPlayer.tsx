import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, Play, Pause, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  src?: string | null;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2];

export default function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);

  const hasAudio = !!src;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(audio.duration);
      setReady(true);
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing, hasAudio]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    audio.playbackRate = next;
    setSpeed(next);
  }, [speed]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-lg bg-muted/50 border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Comentário em Áudio</h3>
      </div>

      {hasAudio && <audio ref={audioRef} src={src!} preload="metadata" />}

      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!hasAudio}
          onClick={togglePlay}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Progress bar */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={!hasAudio}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{hasAudio ? formatTime(currentTime) : "—"}</span>
            <span>{hasAudio && ready ? formatTime(duration) : "—"}</span>
          </div>
        </div>

        {/* Speed */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs shrink-0 min-w-[40px]"
          disabled={!hasAudio}
          onClick={cycleSpeed}
        >
          {speed}x
        </Button>
      </div>

      {!hasAudio && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <VolumeX className="h-3.5 w-3.5" />
          <span>Áudio indisponível para este vinho</span>
        </div>
      )}
    </div>
  );
}
