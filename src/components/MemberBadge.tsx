import { Wine, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeType = "admin" | "radar" | "comunidade";

interface MemberBadgeProps {
  type: BadgeType;
  className?: string;
  variant?: "default" | "light";
}

const config: Record<BadgeType, { label: string; icon: typeof Wine; bgClass: string; textClass: string; lightBgClass: string; lightTextClass: string }> = {
  admin: {
    label: "Admin",
    icon: Wine,
    bgClass: "bg-primary/15 border-primary/30",
    textClass: "text-primary",
    lightBgClass: "bg-white/15 border-white/25",
    lightTextClass: "text-white",
  },
  radar: {
    label: "Radar",
    icon: Target,
    bgClass: "bg-secondary/15 border-secondary/30",
    textClass: "text-secondary",
    lightBgClass: "bg-accent/25 border-accent/40",
    lightTextClass: "text-accent",
  },
  comunidade: {
    label: "Comunidade",
    icon: Wine,
    bgClass: "bg-accent/40 border-accent/60",
    textClass: "text-accent-foreground",
    lightBgClass: "bg-accent/25 border-accent/40",
    lightTextClass: "text-accent",
  },
};

export default function MemberBadge({ type, className, variant = "default" }: MemberBadgeProps) {
  const { label, icon: Icon, bgClass, textClass, lightBgClass, lightTextClass } = config[type];
  const isLight = variant === "light";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        isLight ? lightBgClass : bgClass,
        isLight ? lightTextClass : textClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
