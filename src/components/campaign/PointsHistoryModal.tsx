"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listMyFirstAgentPoints,
  type CampaignPointEntryJson,
} from "@/lib/api/campaign";
import { useAuth } from "@/lib/auth";
import type { PointsHistoryEntry } from "@/lib/campaign-static";
import { queryKeys } from "@/lib/query/keys";

const PAGE_SIZE = 10;

const POINT_SOURCE_LABELS: Record<string, string> = {
  create_account: "Sign up",
  connect_x: "Connect X account",
  top_up: "Top up Agent Wallet",
  invite: "Invite completed",
  agent_store_order: "Order on Agent Store",
  x_order: "Order on X",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(value: string) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return value;
  const d = new Date(date);
  return [
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  ].join(" ");
}

function pointSourceLabel(entry: CampaignPointEntryJson) {
  const source = entry.source?.trim();
  if (source && POINT_SOURCE_LABELS[source]) return POINT_SOURCE_LABELS[source];
  return entry.sourceLabel || entry.source;
}

function pointRelatedEntity(entry: CampaignPointEntryJson) {
  const related = entry.relatedEntity?.trim();
  if (!related) return undefined;
  if (entry.source === "x_order" && !related.startsWith("@")) return undefined;
  return related;
}

function mapPointEntry(entry: CampaignPointEntryJson): PointsHistoryEntry {
  return {
    id: entry.id,
    timestamp: formatTimestamp(entry.createdAt),
    delta: Number(entry.delta || 0),
    sourceLabel: pointSourceLabel(entry),
    relatedEntity: pointRelatedEntity(entry),
  };
}

export function PointsHistoryModal({
  open,
  onOpenChange,
  totalPoints,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalPoints?: number;
}) {
  const [page, setPage] = useState(1);
  const { status, session } = useAuth();
  const currentUserId = status === "authenticated" ? session?.userId ?? "" : "";
  const pointsQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentPoints(page, PAGE_SIZE, currentUserId),
    queryFn: () => listMyFirstAgentPoints(page, PAGE_SIZE),
    enabled: open && Boolean(currentUserId),
  });
  const hasApiResponse = Boolean(currentUserId) && Boolean(pointsQuery.data);
  const total = hasApiResponse ? Number(pointsQuery.data?.total || 0) : 0;
  const pointsTotal = hasApiResponse
    ? Number(pointsQuery.data?.totalPoints || 0)
    : (totalPoints ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = hasApiResponse
    ? (pointsQuery.data?.entries ?? []).map(mapPointEntry)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setPage(1);
      }}
    >
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wide">
            Points History
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-[#EBEBEA]">
          {slice.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="text-[#0F0F0F]">{e.sourceLabel}</p>
                <p className="font-mono text-[11px] text-[#9A9A9A]">
                  {e.timestamp}
                  {e.relatedEntity ? ` · ${e.relatedEntity}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold text-[#5BC23A]">
                {e.delta >= 0 ? "+" : ""}
                {e.delta}
              </span>
            </div>
          ))}
          {slice.length === 0 && (
            <div className="py-8 text-center text-sm text-[#9A9A9A]">
              No points yet.
            </div>
          )}
        </div>

        <div className="-mx-4 -mb-4 flex items-center justify-between border-t border-[#EBEBEA] bg-[#F5F5F3] px-4 py-3">
          <span className="font-mono text-xs text-[#6B6B6B]">
            Total: {pointsTotal} pts
          </span>
          <div className="flex items-center gap-1">
            <PagerBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹
            </PagerBtn>
            <span className="px-2 font-mono text-xs text-[#6B6B6B]">
              {page} / {pages}
            </span>
            <PagerBtn
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </PagerBtn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E2E0] bg-white font-mono text-sm text-[#0F0F0F] transition-colors hover:border-[#6EE646] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
