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
  listMyFirstAgentInvites,
  type CampaignInviteRecordJson,
} from "@/lib/api/campaign";
import { useAuth } from "@/lib/auth";
import { truncateAddress } from "@/lib/formatters";
import { queryKeys } from "@/lib/query/keys";

const PAGE_SIZE = 10;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type InviteRecordRow = {
  inviteeIdentifier: string;
  invitedAt: string;
  points: number;
};

function formatDate(value: string) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function mapInviteRecord(record: CampaignInviteRecordJson): InviteRecordRow {
  return {
    inviteeIdentifier: record.inviteeIdentifier,
    invitedAt: formatDate(record.settledAt),
    points: Number(record.points || 0),
  };
}

function formatInviteeIdentifier(value: string): string {
  return EVM_ADDRESS_RE.test(value) ? truncateAddress(value) : value;
}

export function InviteRecordsModal({
  open,
  onOpenChange,
  settledCount,
  points,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settledCount?: number;
  points?: number;
}) {
  const [page, setPage] = useState(1);
  const { status, session } = useAuth();
  const currentUserId = status === "authenticated" ? session?.userId ?? "" : "";
  const invitesQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentInvites(page, PAGE_SIZE, currentUserId),
    queryFn: () => listMyFirstAgentInvites(page, PAGE_SIZE),
    enabled: open && Boolean(currentUserId),
  });

  const hasApiResponse = Boolean(currentUserId) && Boolean(invitesQuery.data);
  const settled = hasApiResponse
    ? (invitesQuery.data?.entries ?? []).map(mapInviteRecord)
    : [];

  const total = hasApiResponse ? Number(invitesQuery.data?.total || 0) : settled.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = settled;
  const displaySettledCount = hasApiResponse ? total : (settledCount ?? 0);
  const displayPoints = points ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setPage(1);
      }}
    >
      <DialogContent className="overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wide">
            Successful Invites
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-[#6B6B6B]">
          {displaySettledCount} friends onboarded ·{" "}
          <span className="font-mono text-[#5BC23A]">
            {displayPoints} pts
          </span>
        </p>

        {/* header row */}
        <div className="grid grid-cols-[1fr_7rem_3rem] gap-2 border-b border-[#EBEBEA] pb-2 font-mono text-[10px] uppercase tracking-wide text-[#9A9A9A]">
          <span>Invitee</span>
          <span>Invited</span>
          <span className="text-right">Pts</span>
        </div>

        <div className="divide-y divide-[#EBEBEA]">
          {slice.map((r) => (
            <div
              key={r.inviteeIdentifier}
              className="grid grid-cols-[1fr_7rem_3rem] items-center gap-2 py-2.5 text-sm"
            >
              <span
                className="truncate font-mono text-[13px] text-[#0F0F0F]"
                title={r.inviteeIdentifier}
              >
                {formatInviteeIdentifier(r.inviteeIdentifier)}
              </span>
              <span className="font-mono text-xs text-[#6B6B6B]">
                {r.invitedAt}
              </span>
              <span className="text-right font-mono text-xs text-[#5BC23A]">
                +{r.points}
              </span>
            </div>
          ))}
          {slice.length === 0 && (
            <div className="py-8 text-center text-sm text-[#9A9A9A]">
              No successful invites yet.
            </div>
          )}
        </div>

        {/* footer: pager */}
        <div className="-mx-4 -mb-4 flex items-center justify-end border-t border-[#EBEBEA] bg-[#F5F5F3] px-4 py-3">
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
