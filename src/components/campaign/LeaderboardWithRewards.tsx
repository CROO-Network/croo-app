"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import SectionHeader from "@/components/shared/SectionHeader";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useAuth } from "@/lib/auth";
import {
  tierForRank,
  TIER_META,
  type LeaderboardEntry,
} from "@/lib/campaign-static";
import { truncateAddress } from "@/lib/formatters";
import { TierIcon } from "./icons";

const COLS =
  "grid grid-cols-[3rem_1fr_auto] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_5rem_21rem]";

const PAGE_SIZE = 20;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const YOU_SUFFIX_RE = /\s+\(You\)$/i;

function displayIdentifier(value?: string) {
  const raw = (value || "").trim();
  if (!raw) return "";

  const isMe = YOU_SUFFIX_RE.test(raw);
  const base = raw.replace(YOU_SUFFIX_RE, "").trim();
  const display = EVM_ADDRESS_RE.test(base) ? truncateAddress(base) : base;
  return isMe && display ? `${display} (You)` : display;
}

function baseIdentifier(value?: string) {
  return (value || "").replace(YOU_SUFFIX_RE, "").trim().toLowerCase();
}

function isSameLeaderboardUser(a?: LeaderboardEntry, b?: LeaderboardEntry) {
  if (!a || !b) return false;
  if (a.userId && b.userId && a.userId === b.userId) return true;
  const aIdentifier = baseIdentifier(a.identifier);
  const bIdentifier = baseIdentifier(b.identifier);
  return !!aIdentifier && aIdentifier === bIdentifier;
}

function RowInner({ e }: { e: LeaderboardEntry }) {
  const tier = tierForRank(e.rank);
  const meta = TIER_META[tier];
  return (
    <>
      <span className="font-mono font-semibold text-[#0F0F0F]">#{e.rank}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <ResolvedAgentAvatar
          avatar={e.avatar}
          name={e.identifier}
          alt=""
          className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[#E2E2E0] bg-white object-cover"
        />
        <span
          className={`min-w-0 break-all font-mono text-[13px] leading-snug ${
            e.isMe ? "font-semibold text-[#0F0F0F]" : "text-[#3A3A3A]"
          }`}
        >
          {displayIdentifier(e.identifier)}
        </span>
      </div>
      <span className="hidden font-mono tabular-nums text-[#0F0F0F] sm:block">
        {e.points.toLocaleString()}
      </span>
      <span className="flex items-center justify-end gap-1.5 text-right text-xs text-[#6B6B6B]">
        <TierIcon tier={tier} />
        <span className="hidden whitespace-nowrap sm:inline">{meta.reward}</span>
        <span className="font-mono tabular-nums text-[#0F0F0F] sm:hidden">
          {e.points.toLocaleString()}
        </span>
      </span>
    </>
  );
}

function PagerBtn({
  children,
  disabled,
  active,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-[#6EE646] bg-[#F0FDE8] text-[#0F0F0F]"
          : "border-[#E2E2E0] bg-white text-[#0F0F0F] hover:border-[#6EE646]"
      }`}
    >
      {children}
    </button>
  );
}

interface LeaderboardWithRewardsProps {
  entries?: LeaderboardEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  myEntry?: LeaderboardEntry;
  hasMyEntryResponse?: boolean;
  onPageChange?: (page: number) => void;
}

export default function LeaderboardWithRewards({
  entries,
  total,
  page,
  pageSize = PAGE_SIZE,
  myEntry,
  hasMyEntryResponse = false,
  onPageChange,
}: LeaderboardWithRewardsProps) {
  const [internalPage, setInternalPage] = useState(1);
  const { status, session } = useAuth();
  const hasExternalEntries = entries !== undefined;
  const currentPage = page ?? internalPage;
  const setPage = onPageChange ?? setInternalPage;
  const data = hasExternalEntries ? entries : [];
  const totalRows = Math.min(total ?? data.length, 100);
  const displayMyEntry = hasMyEntryResponse ? myEntry : undefined;
  const showMyRank = status === "authenticated" && !!session && !!displayMyEntry;
  const rows =
    showMyRank && displayMyEntry
      ? data.filter((entry) => !isSameLeaderboardUser(entry, displayMyEntry))
      : data;
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <section id="leaderboard" className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader label="Leaderboard & Rewards" />

      <div className="rounded-2xl border border-[#E2E2E0] bg-white">
        {/* column header */}
        <div
          className={`${COLS} rounded-t-2xl border-b border-[#EBEBEA] bg-[#F5F5F3] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wide text-[#9A9A9A]`}
        >
          <span>Rank</span>
          <span>User</span>
          <span className="hidden sm:block">Points</span>
          <span className="hidden items-center justify-end gap-1 text-right sm:flex">
            Reward
            <span className="group relative inline-flex">
              <Info className="h-3 w-3 cursor-help text-[#9A9A9A]" strokeWidth={1.6} />
              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-72 rounded-lg bg-[#0F0F0F] p-3 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span className="block font-sans text-[11px] normal-case leading-snug tracking-normal text-[#B8B8B6]">
                  Your final rank when the campaign ends decides your tier:
                </span>
                <span className="mt-2 block space-y-1.5">
                  {[
                    { r: "TOP 10", t: "Master", d: "Badge · 100 USDC · Store Feature" },
                    { r: "TOP 100", t: "Expert", d: "Badge · 20 USDC" },
                    { r: "TOP 1000", t: "Journeyman", d: "Badge" },
                    { r: "All", t: "Apprentice", d: "Badge" },
                  ].map((row) => (
                    <span
                      key={row.t}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#6EE646]">
                        {row.r}
                      </span>
                      <span className="flex-1 text-right font-sans text-[11px] normal-case tracking-normal text-white">
                        <span className="font-medium">{row.t}</span>
                        <span className="block text-[10px] leading-tight text-[#9A9A9A]">
                          {row.d}
                        </span>
                      </span>
                    </span>
                  ))}
                </span>
                <span className="mt-2 block border-t border-white/10 pt-2 font-sans text-[10px] normal-case leading-snug tracking-normal text-[#9A9A9A]">
                  All badges are non-transferable SBTs.
                </span>
              </span>
            </span>
          </span>
        </div>

        {showMyRank && (
          <div
            data-me-row
            className={`${COLS} sticky top-[60px] z-20 items-center border-b border-[#6EE646]/40 bg-[#F0FDE8] px-4 py-3 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.05)]`}
          >
            <RowInner e={displayMyEntry} />
          </div>
        )}

        {/* ranked rows */}
        <div className="divide-y divide-[#F0F0EF]">
          {rows.map((e, index) => (
            <div
              key={`${e.rank}-${e.identifier}-${index}`}
              className={`${COLS} items-center px-4 py-2.5 text-sm`}
            >
              <RowInner e={e} />
            </div>
          ))}
          {rows.length === 0 && !showMyRank && (
            <div className="px-4 py-10 text-center text-sm text-[#9A9A9A]">
              No leaderboard entries yet.
            </div>
          )}
        </div>

        {/* pager */}
        <div className="flex items-center justify-between rounded-b-2xl border-t border-[#EBEBEA] bg-[#FAFAF9] px-4 py-3">
          <span className="font-mono text-[11px] text-[#9A9A9A]">
            Top {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <PagerBtn
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ‹
            </PagerBtn>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <PagerBtn key={p} active={p === currentPage} onClick={() => setPage(p)}>
                {p}
              </PagerBtn>
            ))}
            <PagerBtn
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              ›
            </PagerBtn>
          </div>
        </div>
      </div>
    </section>
  );
}
