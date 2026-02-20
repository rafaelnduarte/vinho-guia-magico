import { Wine, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeType = "admin" | "radar" | "comunidade";

interface MemberBadgeProps {
  type: BadgeType;
  className?: string;
}

const config: Record<BadgeType, { label: string; icon: typeof Wine; bgClass: string; textClass: string }> = {
  admin: {
    label: "Admin",
    icon: Wine,
    bgClass: "bg-primary/15 border-primary/30",
    textClass: "text-primary",
  },
  radar: {
    label: "Radar",
    icon: Target,
    bgClass: "bg-secondary/15 border-secondary/30",
    textClass: "text-secondary",
  },
  comunidade: {
    label: "Comunidade",
    icon: Wine,
    bgClass: "bg-accent/40 border-accent/60",
    textClass: "text-accent-foreground",
  },
};

export default function MemberBadge({ type, className }: MemberBadgeProps) {
  const { label, icon: Icon, bgClass, textClass } = config[type];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        bgClass,
        textClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
