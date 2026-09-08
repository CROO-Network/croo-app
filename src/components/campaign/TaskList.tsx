"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Users,
  ShoppingBag,
  Lock,
} from "lucide-react";
import SectionHeader from "@/components/shared/SectionHeader";
import TopUpModal from "@/components/shared/TopUpModal";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { ConnectModal } from "@/components/auth/ConnectModal";
import { useToast } from "@/components/shared/Toast";
import { useNavigator } from "@/lib/navigator-context";
import { useAuth } from "@/lib/auth";
import { useTwitterBinding } from "@/hooks/useTwitterBinding";
import { getMyNavigatorInfo } from "@/lib/api/agent";
import { agentDetailHref } from "@/lib/api/discovery";
import { isNavigatorAaActive } from "@/hooks/useNavigatorDeployUntilActive";
import type { MyFirstAgentSummaryJson } from "@/lib/api/campaign";
import {
  campaignOneTimeTasks,
  campaignRepeatTasks,
  buildXOrderTweet,
  type CampaignTaskState,
  type FeaturedAgentOnX,
} from "@/lib/campaign-static";
import { InviteRecordsModal } from "./InviteRecordsModal";
import { PointsHistoryModal } from "./PointsHistoryModal";
import { HowToOrderOnXModal } from "./HowToOrderOnXModal";
import { DeploySmartWalletModal } from "./DeploySmartWalletModal";
import { XLogo, IconTile } from "./icons";

/* ── Shared bits ─────────────────────────────── */

function PointsTag({ text, done }: { text: string; done?: boolean }) {
  return (
    <span
      className={`shrink-0 font-mono text-xs font-medium ${
        done ? "text-[#9A9A9A]" : "text-[#5BC23A]"
      }`}
    >
      {text}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EBEBEA]">
      <div
        className="h-full rounded-full bg-[#6EE646]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const UTC_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_WEEKLY_RESET_LABEL = "Resets Sun 24:00 UTC";

const weeklyResetLabel = (weekStart?: string, weekEnd?: string) => {
  if (!weekEnd) return DEFAULT_WEEKLY_RESET_LABEL;
  const startDate = weekStart ? new Date(weekStart) : null;
  const endDate = new Date(weekEnd);
  if (Number.isNaN(endDate.getTime())) return DEFAULT_WEEKLY_RESET_LABEL;
  const isNaturalWeek =
    startDate &&
    !Number.isNaN(startDate.getTime()) &&
    endDate.getTime() - startDate.getTime() === 7 * 24 * 60 * 60 * 1000;
  if (
    isNaturalWeek &&
    endDate.getUTCDay() === 1 &&
    endDate.getUTCHours() === 0 &&
    endDate.getUTCMinutes() === 0
  ) {
    return DEFAULT_WEEKLY_RESET_LABEL;
  }
  const weekday = UTC_WEEKDAYS[endDate.getUTCDay()] ?? "Mon";
  const hour = String(endDate.getUTCHours()).padStart(2, "0");
  const minute = String(endDate.getUTCMinutes()).padStart(2, "0");
  return `Resets ${weekday} ${hour}:${minute} UTC`;
};

const subscribeToOrigin = () => () => {};
const getBrowserOrigin = () =>
  typeof window === "undefined" ? "" : window.location.origin;
const getServerOrigin = () => "";

function buildInviteLinkForOrigin(inviteUrl: string, refCode: string, origin: string) {
  const trimmedInviteUrl = inviteUrl.trim();
  const trimmedRefCode = refCode.trim();
  if (!trimmedInviteUrl && !trimmedRefCode) return "";
  if (!origin) return trimmedInviteUrl;

  try {
    const current = new URL(origin);
    const url = new URL(trimmedInviteUrl || "/myfirstagent", current);
    url.protocol = current.protocol;
    url.host = current.host;
    if (!url.searchParams.get("ref") && trimmedRefCode) {
      url.searchParams.set("ref", trimmedRefCode);
    }
    return url.toString();
  } catch {
    if (!trimmedRefCode) return trimmedInviteUrl;
    return `${origin}/myfirstagent?ref=${encodeURIComponent(trimmedRefCode)}`;
  }
}

function Card({
  children,
  locked,
  id,
}: {
  children: React.ReactNode;
  locked?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-2xl border bg-white px-6 py-5 transition-colors ${
        locked ? "border-[#EBEBEA] opacity-70" : "border-[#E2E2E0]"
      }`}
    >
      {children}
    </div>
  );
}

/* ── One-time task row (inside combined card) ─── */

function OneTimeRow({
  task,
  summary,
  topUpSummaryReady,
  navigatorWalletAddress,
}: {
  task: CampaignTaskState;
  summary?: MyFirstAgentSummaryJson;
  topUpSummaryReady?: boolean;
  navigatorWalletAddress?: string;
}) {
  const {
    twitterHandle,
    connecting,
    connectTwitter,
  } = useTwitterBinding();
  const { session } = useAuth();
  const [connectOpen, setConnectOpen] = useState(false);
  const connectedHandle =
    summary?.twitterStatus?.connected && summary.twitterStatus.username
      ? summary.twitterStatus.username
      : twitterHandle;
  const topUpSummaryResolved = Boolean(topUpSummaryReady);
  const topUpCompleted =
    topUpSummaryResolved && summary?.tasks?.topUp?.completed === true;
  const topUpIncomplete =
    topUpSummaryResolved && summary?.tasks?.topUp?.completed === false;

  // Resolve done + right-side action by task kind.
  let done = false;
  if (task.kind === "account") {
    done = Boolean(summary?.tasks?.createAccount?.completed || session);
  } else if (task.kind === "connectX") {
    done = Boolean(summary?.tasks?.connectX?.completed || connectedHandle);
  } else if (task.kind === "topup") {
    done = topUpCompleted;
  }

  let sub: string;
  let action: React.ReactNode = null;

  if (task.kind === "account") {
    if (done) {
      sub = `Connected · ${session?.loginMethod === "wallet" ? "Wallet" : "Google"}`;
    } else {
      sub = task.description;
      action = (
        <>
          <button
            onClick={() => setConnectOpen(true)}
            className="rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#252525]"
          >
            {task.ctaLabel}
          </button>
          <ConnectModal
            externalOpen={connectOpen}
            onExternalOpenChange={setConnectOpen}
          />
        </>
      );
    }
  } else if (task.kind === "connectX") {
    if (connectedHandle) {
      sub = `Connected · @${connectedHandle}`;
    } else if (done) {
      sub = "Completed";
    } else {
      sub = task.description;
      action = session ? (
        <button
          onClick={connectTwitter}
          disabled={connecting}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#252525] disabled:opacity-60"
        >
          {connecting ? (
            "Connecting…"
          ) : (
            <>
              <XLogo className="h-3 w-3" />
              Connect
            </>
          )}
        </button>
      ) : (
        <>
          <button
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#252525]"
          >
            <XLogo className="h-3 w-3" />
            Connect
          </button>
          <ConnectModal
            externalOpen={connectOpen}
            onExternalOpenChange={setConnectOpen}
          />
        </>
      );
    }
  } else {
    // topup
    if (done) {
      sub = "Completed";
    } else {
      const canTopUp = topUpIncomplete && Boolean(navigatorWalletAddress);
      sub = task.description;
      action = canTopUp ? (
        <TopUpModal
          walletLabel="Agent Wallet"
          walletAddress={navigatorWalletAddress!}
        >
          <button className="rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#252525]">
            {task.ctaLabel}
          </button>
        </TopUpModal>
      ) : null;
    }
  }

  return (
    <div className="flex items-center gap-3 py-3">
      {done ? (
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-[#5BC23A]"
          strokeWidth={1.6}
          aria-hidden
        />
      ) : (
        <Circle
          className="h-5 w-5 shrink-0 text-[#D4D4D2]"
          strokeWidth={1.6}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            done ? "text-[#6B6B6B]" : "text-[#0F0F0F]"
          }`}
        >
          {task.shortTitle ?? task.title}
        </p>
        <p className="truncate font-mono text-[11px] text-[#9A9A9A]">{sub}</p>
      </div>
      {action}
      <PointsTag text="+5" done={done} />
    </div>
  );
}

/* ── Combined card: My Points + one-time tasks ── */

function CombinedCard({
  summary,
  topUpSummaryReady,
  navigatorWalletAddress,
}: {
  summary?: MyFirstAgentSummaryJson;
  topUpSummaryReady?: boolean;
  navigatorWalletAddress?: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const points = summary?.profile?.points ?? 0;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#E2E2E0] bg-white lg:grid-cols-[280px_1fr]">
      {/* left: points */}
      <div className="flex flex-col justify-center border-b border-[#EBEBEA] bg-[#FAFAF9] px-7 py-6 lg:border-b-0 lg:border-r">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#9A9A9A]">
          My Points
        </p>
        <button onClick={() => setHistoryOpen(true)} className="mt-1 block text-left">
          <span className="font-mono text-4xl font-bold tabular-nums text-[#0F0F0F]">
            {points}
          </span>
          <span className="ml-1 text-sm text-[#9A9A9A]">pts</span>
        </button>
        <button
          onClick={() => setHistoryOpen(true)}
          className="mt-1.5 w-fit text-xs font-medium text-[#5BC23A] hover:underline"
        >
          View history ▸
        </button>
      </div>

      {/* right: 3 one-time tasks */}
      <div className="px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#9A9A9A]">
          Get started · one-time tasks
        </p>
        <div className="mt-1 divide-y divide-[#F0F0EF]">
          {campaignOneTimeTasks.map((t) => (
            <OneTimeRow
              key={t.id}
              task={t}
              summary={summary}
              topUpSummaryReady={topUpSummaryReady}
              navigatorWalletAddress={navigatorWalletAddress}
            />
          ))}
        </div>
      </div>

      <PointsHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        totalPoints={points}
      />
    </div>
  );
}

/* ── R1 · Invite ──────────────────────────────── */

function InviteCard({
  task,
  summary,
}: {
  task: CampaignTaskState;
  summary?: MyFirstAgentSummaryJson;
}) {
  const [copied, setCopied] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const currentOrigin = useSyncExternalStore(
    subscribeToOrigin,
    getBrowserOrigin,
    getServerOrigin,
  );
  const rawInviteUrl = summary?.invite?.inviteUrl?.trim() ?? "";
  const refCode = summary?.invite?.refCode?.trim() ?? "";
  const link = useMemo(
    () => buildInviteLinkForOrigin(rawInviteUrl, refCode, currentOrigin),
    [currentOrigin, rawInviteUrl, refCode],
  );
  const hasInviteLink = link.length > 0;
  const settledCount = summary?.tasks?.invite?.settledCount ?? 0;
  const invitePoints = summary?.tasks?.invite?.points ?? 0;

  function copy() {
    if (!hasInviteLink) return;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Users} />
          <div>
            <p className="font-medium text-[#0F0F0F]">{task.title}</p>
            <p className="mt-0.5 text-xs text-[#9A9A9A]">
              {settledCount} friends onboarded · {invitePoints} pts earned
            </p>
          </div>
        </div>
        <PointsTag text="+5 pts each" />
      </div>

      <div className="mt-4 rounded-xl bg-[#F5F5F3] p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#9A9A9A]">
          My invite link
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-[#0F0F0F]">
            {link || "—"}
          </code>
          <button
            disabled={!hasInviteLink}
            onClick={copy}
            className="shrink-0 rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#252525] disabled:cursor-not-allowed disabled:bg-[#E2E2E0] disabled:text-[#9A9A9A]"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => setRecordsOpen(true)}
          className="text-xs font-medium text-[#5BC23A] hover:underline"
        >
          View invite records ▸
        </button>
      </div>

      <InviteRecordsModal
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        settledCount={settledCount}
        points={invitePoints}
      />
    </Card>
  );
}

/* ── R2 · Weekly Agent Store purchase ─────────── */

function AgentStoreCard({
  task,
  summary,
}: {
  task: CampaignTaskState;
  summary?: MyFirstAgentSummaryJson;
}) {
  const { openNavigator } = useNavigator();
  const done = summary?.tasks?.agentStoreOrder?.completedThisWeek ?? 0;
  const cap = summary?.tasks?.agentStoreOrder?.weeklyCap ?? task.weeklyCap ?? 0;
  const resetLabel = weeklyResetLabel(
    summary?.tasks?.agentStoreOrder?.weekStart,
    summary?.tasks?.agentStoreOrder?.weekEnd,
  );
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={ShoppingBag} />
          <div>
            <p className="font-medium text-[#0F0F0F]">{task.title}</p>
            <p className="mt-0.5 text-xs text-[#9A9A9A]">{task.description}</p>
          </div>
        </div>
        <PointsTag text="+5 pts each" />
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-[#6B6B6B]">
            {done} / {cap} this week
          </span>
          <span className="text-[#9A9A9A]">{resetLabel}</span>
        </div>
        <ProgressBar value={done} max={cap} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <a
          href={task.ctaTarget}
          className="rounded-full border border-[#E2E2E0] bg-white px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#9A9A9A]"
        >
          {task.ctaLabel}
        </a>
        <button
          onClick={() => openNavigator()}
          className="rounded-full bg-[#0F0F0F] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#252525]"
        >
          Open Navigator
        </button>
      </div>
    </Card>
  );
}

/* ── R3 · Order on X (featured agents + lock) ─── */

const buildIntentUrl = (text: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

function openXIntentUrl(url: string) {
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return;
  }
  window.location.assign(url);
}

const INITIAL_AGENTS = 8; // two rows of four on lg

function XOrderCard({
  task,
  featuredAgents,
  summary,
  navigatorAgentId,
}: {
  task: CampaignTaskState;
  featuredAgents: FeaturedAgentOnX[];
  summary?: MyFirstAgentSummaryJson;
  navigatorAgentId?: string;
}) {
  const router = useRouter();
  const { twitterHandle } = useTwitterBinding();
  const { showToast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [pendingTweet, setPendingTweet] = useState<string | null>(null);
  const [pendingNavigatorAgentId, setPendingNavigatorAgentId] = useState("");
  const [pendingLoginMethod, setPendingLoginMethod] = useState<string | undefined>();
  const checkingWalletRef = useRef(false);
  const connectedHandle =
    summary?.twitterStatus?.connected && summary.twitterStatus.username
      ? summary.twitterStatus.username
      : twitterHandle;
  const locked = !connectedHandle;

  async function handleOrderClick(
    e: React.MouseEvent<HTMLButtonElement>,
    url: string,
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (checkingWalletRef.current) return;

    checkingWalletRef.current = true;
    try {
      const nav = await getMyNavigatorInfo();
      if (isNavigatorAaActive(nav.navigator?.status)) {
        openXIntentUrl(url);
        return;
      }

      const agentId =
        nav.navigator?.agentId?.trim() || navigatorAgentId?.trim() || "";
      if (!agentId) {
        showToast("Smart Wallet is not ready. Please try again.");
        return;
      }

      setPendingTweet(url);
      setPendingNavigatorAgentId(agentId);
      setPendingLoginMethod(nav.loginMethod);
      setDeployOpen(true);
    } catch {
      showToast("Could not check Smart Wallet status. Please try again.");
    } finally {
      checkingWalletRef.current = false;
    }
  }

  if (locked) {
    return (
      <Card locked>
        <div className="flex items-start gap-3">
          <IconTile icon={Lock} state="locked" />
          <div className="flex-1">
            <p className="font-medium text-[#0F0F0F]">{task.title}</p>
            <p className="mt-1 text-xs text-[#9A9A9A]">
              Connect your X account above to unlock this task.
            </p>
            <p className="mt-1 text-[11px] text-[#9A9A9A]">
              Once connected, tag featured Agents on X and order in one click.
            </p>
            <button
              onClick={() => {
                const el = document.getElementById("campaign-tasks");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-3 rounded-full border border-[#E2E2E0] px-4 py-2 text-xs font-medium text-[#0F0F0F] hover:border-[#6EE646]"
            >
              Go connect X →
            </button>
          </div>
          <PointsTag text="+5 pts each" />
        </div>
      </Card>
    );
  }

  const done = summary?.tasks?.xOrder?.completedThisWeek ?? 0;
  const cap = summary?.tasks?.xOrder?.weeklyCap ?? task.weeklyCap ?? 0;
  const resetLabel = weeklyResetLabel(
    summary?.tasks?.xOrder?.weekStart,
    summary?.tasks?.xOrder?.weekEnd,
  );
  const total = featuredAgents.length;
  const visible = showAll
    ? featuredAgents
    : featuredAgents.slice(0, INITIAL_AGENTS);
  const hasMore = total > INITIAL_AGENTS;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile>
            <XLogo className="h-[18px] w-[18px]" />
          </IconTile>
          <div>
            <p className="font-medium text-[#0F0F0F]">{task.title}</p>
            <p className="mt-0.5 text-xs text-[#9A9A9A]">{task.description}</p>
          </div>
        </div>
        <PointsTag text="+5 pts each" />
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-[#6B6B6B]">
            {done} / {cap} this week
          </span>
          <span className="text-[#9A9A9A]">{resetLabel}</span>
        </div>
        <ProgressBar value={done} max={cap} />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#9A9A9A]">
          Agents you can order on X
        </p>
        <button
          onClick={() => setHowToOpen(true)}
          className="text-xs font-medium text-[#5BC23A] hover:underline"
        >
          How to order ▸
        </button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((a, index) => (
          <div
            key={`${a.agentId || a.handle}:${index}`}
            role="link"
            tabIndex={0}
            onClick={() => router.push(agentDetailHref(a.agentId))}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(agentDetailHref(a.agentId));
            }}
            className="group flex h-[216px] cursor-pointer flex-col overflow-hidden rounded-xl border border-[#E2E2E0] bg-[#F5F5F3] p-3 transition-all hover:border-[#6EE646] hover:bg-white hover:shadow-sm has-[a:hover]:cursor-default has-[a:hover]:border-[#E2E2E0] has-[a:hover]:bg-[#F5F5F3] has-[a:hover]:shadow-none has-[button:hover]:cursor-default has-[button:hover]:border-[#E2E2E0] has-[button:hover]:bg-[#F5F5F3] has-[button:hover]:shadow-none"
          >
            <div className="flex items-start justify-between">
              <ResolvedAgentAvatar
                avatar={a.avatar}
                name={a.name}
                className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#E2E2E0] bg-white object-cover"
              />
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-medium text-[#5BC23A] opacity-0 transition-opacity group-hover:opacity-100 group-has-[a:hover]:opacity-0 group-has-[button:hover]:opacity-0">
                View details ›
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-[#0F0F0F]">{a.name}</p>
            <a
              href={`https://x.com/${a.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full truncate font-mono text-[11px] text-[#9A9A9A] transition-colors hover:text-[#5BC23A] hover:underline"
            >
              @{a.handle}
            </a>
            <p className="mt-1 truncate text-[11px] text-[#6B6B6B]">{a.blurb}</p>
            <div className="mt-2 flex h-5 flex-wrap gap-1 overflow-hidden">
              {a.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#EBEBEA] px-2 py-0.5 text-[10px] font-medium text-[#3A3A3A]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-auto flex items-center gap-1 pt-3 font-mono text-[11px] text-[#0F0F0F]">
              <span className="text-[#9A9A9A]">from</span>
              <UsdcIcon size={12} />
              {a.fromPrice.toFixed(2)}
            </p>
            <button
              type="button"
              onClick={(e) => handleOrderClick(e, buildIntentUrl(buildXOrderTweet(a)))}
              className="mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#252525] hover:shadow-[0_2px_8px_rgba(15,15,15,0.25)]"
            >
              <XLogo className="h-3 w-3" />
              Order on X
            </button>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-3 rounded-xl border border-[#E2E2E0] bg-[#F5F5F3] px-4 py-6 text-center text-sm text-[#9A9A9A]">
          Featured X Agents are being updated.
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full border border-[#E2E2E0] bg-white px-5 py-2 text-xs font-medium text-[#0F0F0F] hover:border-[#6EE646]"
          >
            {showAll ? "Show less" : `Show all (${total})`}
          </button>
        </div>
      )}

      <HowToOrderOnXModal open={howToOpen} onOpenChange={setHowToOpen} />
      <DeploySmartWalletModal
        open={deployOpen}
        onOpenChange={(open) => {
          setDeployOpen(open);
          if (!open) {
            setPendingNavigatorAgentId("");
            setPendingLoginMethod(undefined);
          }
        }}
        navigatorAgentId={pendingNavigatorAgentId || navigatorAgentId || ""}
        loginMethod={pendingLoginMethod}
        onDeployed={() => {
          if (pendingTweet) openXIntentUrl(pendingTweet);
          setPendingTweet(null);
        }}
      />
    </Card>
  );
}

/* ── List ─────────────────────────────────────── */

interface TaskListProps {
  featuredAgents?: FeaturedAgentOnX[];
  summary?: MyFirstAgentSummaryJson;
  topUpSummaryReady?: boolean;
  navigatorWalletAddress?: string;
  navigatorAgentId?: string;
}

export default function TaskList({
  featuredAgents,
  summary,
  topUpSummaryReady,
  navigatorWalletAddress,
  navigatorAgentId,
}: TaskListProps) {
  const byId = (id: string) => campaignRepeatTasks.find((t) => t.id === id)!;
  const agents = featuredAgents ?? [];
  return (
    <section id="campaign-tasks" className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader label="Tasks" />
      <div className="space-y-4">
        <CombinedCard
          summary={summary}
          topUpSummaryReady={topUpSummaryReady}
          navigatorWalletAddress={navigatorWalletAddress}
        />
        <InviteCard task={byId("R1")} summary={summary} />
        <AgentStoreCard task={byId("R2")} summary={summary} />
        <XOrderCard
          task={byId("R3")}
          featuredAgents={agents}
        summary={summary}
        navigatorAgentId={navigatorAgentId}
      />
      </div>
    </section>
  );
}
