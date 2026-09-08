import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  size?: "sm" | "md";
  /**
   * "default" — uppercase + leading dot (used across agent/service cards).
   * "subtle"  — title-case + no dot (Navigator order cards, per prototype).
   */
  variant?: "default" | "subtle";
};

type StatusConfig = {
  label: string;
  dotClassName: string;
  textClassName: string;
  bgClassName: string;
};

const statusConfig: Record<string, StatusConfig> = {
  online: {
    label: "Online",
    dotClassName: "bg-[#6EE646]",
    textClassName: "text-[#3D8C1F]",
    bgClassName: "bg-[#6EE646]/10",
  },
  paused: {
    label: "Offline",
    dotClassName: "bg-[#9A9A9A]",
    textClassName: "text-[#9A9A9A]",
    bgClassName: "bg-[#F5F5F3]",
  },
  offline: {
    label: "Offline",
    dotClassName: "bg-[#9A9A9A]",
    textClassName: "text-[#9A9A9A]",
    bgClassName: "bg-[#F5F5F3]",
  },
  registered: {
    label: "Draft",
    dotClassName: "bg-[#9A9A9A]",
    textClassName: "text-[#9A9A9A]",
    bgClassName: "bg-[#F5F5F3]",
  },
  draft: {
    label: "Draft",
    dotClassName: "bg-[#9A9A9A]",
    textClassName: "text-[#9A9A9A]",
    bgClassName: "bg-[#F5F5F3]",
  },
  banned: {
    label: "Banned",
    dotClassName: "bg-[#E54D2E]",
    textClassName: "text-[#E54D2E]",
    bgClassName: "bg-[#E54D2E]/10",
  },
  in_progress: {
    label: "In Progress",
    dotClassName: "bg-[#2775CA]",
    textClassName: "text-[#2775CA]",
    bgClassName: "bg-[#2775CA]/10",
  },
  completed: {
    label: "Completed",
    dotClassName: "bg-[#6EE646]",
    textClassName: "text-[#3D8C1F]",
    bgClassName: "bg-[#6EE646]/10",
  },
  paid: {
    label: "Paid",
    dotClassName: "bg-[#6EE646]",
    textClassName: "text-[#3D8C1F]",
    bgClassName: "bg-[#6EE646]/10",
  },
  feedback: {
    label: "Review",
    dotClassName: "bg-[#2775CA]",
    textClassName: "text-[#2775CA]",
    bgClassName: "bg-[#2775CA]/10",
  },
  success: {
    label: "Success",
    dotClassName: "bg-[#6EE646]",
    textClassName: "text-[#3D8C1F]",
    bgClassName: "bg-[#6EE646]/10",
  },
  expired: {
    label: "Expired",
    dotClassName: "bg-[#E5A02E]",
    textClassName: "text-[#E5A02E]",
    bgClassName: "bg-[#E5A02E]/10",
  },
  deliver_failed: {
    label: "Failed",
    dotClassName: "bg-[#E54D2E]",
    textClassName: "text-[#E54D2E]",
    bgClassName: "bg-[#E54D2E]/10",
  },
  lock_failed: {
    label: "Failed",
    dotClassName: "bg-[#E54D2E]",
    textClassName: "text-[#E54D2E]",
    bgClassName: "bg-[#E54D2E]/10",
  },
  failed: {
    label: "Failed",
    dotClassName: "bg-[#E54D2E]",
    textClassName: "text-[#E54D2E]",
    bgClassName: "bg-[#E54D2E]/10",
  },
  pending: {
    label: "Pending",
    dotClassName: "bg-[#2775CA]",
    textClassName: "text-[#2775CA]",
    bgClassName: "bg-[#2775CA]/10",
  },
};

const sizeClassNames = {
  sm: "gap-1 px-2 py-0.5 text-[9px] tracking-[0.16em]",
  md: "gap-1.5 px-2.5 py-1 text-[10px] tracking-wider",
} as const;

// "subtle" overrides the default sizing for a flatter look (no letter-spacing,
// title-case, slightly larger px).
const subtleSizeClassNames = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-[11px]",
} as const;

function formatFallbackLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StatusBadge({
  status,
  size = "md",
  variant = "default",
}: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: formatFallbackLabel(status),
    dotClassName: "bg-[#9A9A9A]",
    textClassName: "text-[#9A9A9A]",
    bgClassName: "bg-[#F5F5F3]",
  };

  const isSubtle = variant === "subtle";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        isSubtle ? subtleSizeClassNames[size] : sizeClassNames[size],
        !isSubtle && "uppercase",
        config.textClassName,
        config.bgClassName,
      )}
    >
      {!isSubtle && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)}
        />
      )}
      {config.label}
    </span>
  );
}
