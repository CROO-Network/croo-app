"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CampaignHero from "@/components/campaign/CampaignHero";
import TaskList from "@/components/campaign/TaskList";
import LeaderboardWithRewards from "@/components/campaign/LeaderboardWithRewards";
import { CampaignRulesModal } from "@/components/campaign/CampaignRulesModal";
import BaseModeOnly from "@/components/shared/BaseModeOnly";
import {
  getMyFirstAgentConfig,
  getMyFirstAgentLeaderboard,
  getMyFirstAgentLeaderboardEntry,
  getMyFirstAgentSummary,
  listMyFirstAgentFeaturedXAgents,
  scanMyFirstAgentTopUp,
  syncMyFirstAgentTasks,
  type CampaignConfigJson,
  type CampaignFeaturedXAgentJson,
  type CampaignLeaderboardEntryJson,
} from "@/lib/api/campaign";
import { getMyNavigatorInfo } from "@/lib/api/agent";
import { useAuth } from "@/lib/auth";
import {
  invalidateMyFirstAgentCampaign,
  markMyFirstAgentTopUpCompleted,
} from "@/lib/campaign-cache";
import { queryKeys } from "@/lib/query/keys";
import type { FeaturedAgentOnX, LeaderboardEntry } from "@/lib/campaign-static";

const LEADERBOARD_PAGE_SIZE = 20;
const TASK_SYNC_INTERVAL_MS = 35_000;
const TOP_UP_SCAN_INTERVAL_MS = 30_000;
const ONE_TIME_TASK_KEYS = ["createAccount", "connectX", "topUp"] as const;

type OneTimeTaskKey = (typeof ONE_TIME_TASK_KEYS)[number];
type OneTimeTaskCompletionState = Record<OneTimeTaskKey, boolean>;

function heroStatus(status?: string): "upcoming" | "running" | "ended" {
  if (status === "not_started") return "upcoming";
  if (status === "ended" || status === "disabled") return "ended";
  return "running";
}

function heroEnd(config?: CampaignConfigJson) {
  if (!config?.endAt) return undefined;
  const end = Date.parse(config.endAt);
  return Number.isFinite(end) ? end : undefined;
}

function mapFeaturedAgent(agent: CampaignFeaturedXAgentJson): FeaturedAgentOnX {
  return {
    agentId: agent.agentId,
    name: agent.name,
    avatar:
      agent.avatar ||
      `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(agent.name || agent.agentId)}&backgroundColor=b6e3f4`,
    handle: agent.handle,
    blurb: agent.blurb,
    tags: agent.tags ?? [],
    fromPrice: Number(agent.fromPrice || 0),
    serviceName: agent.serviceName,
    requiredFields: agent.requiredFields ?? [],
    templateText: agent.templateText,
  };
}

function dedupeFeaturedAgentsByAgent(agents: FeaturedAgentOnX[]) {
  const seen = new Set<string>();
  return agents.filter((agent) => {
    const key = (agent.agentId || agent.handle || agent.name).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapLeaderboardEntry(entry: CampaignLeaderboardEntryJson): LeaderboardEntry {
  return {
    rank: Number(entry.rank || 0),
    userId: entry.userId,
    identifier: entry.identifier,
    avatar:
      entry.avatar ||
      `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(entry.userId || entry.identifier)}`,
    points: Number(entry.points || 0),
    isMe: Boolean(entry.isMe),
  };
}

function mapMyLeaderboardEntry(entry?: CampaignLeaderboardEntryJson): LeaderboardEntry | undefined {
  if (!entry?.rank) return undefined;
  return {
    rank: Number(entry.rank || 0),
    userId: entry.userId,
    identifier: `${entry.identifier || entry.userId || "You"} (You)`,
    avatar:
      entry.avatar ||
      `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(entry.userId || entry.identifier)}`,
    points: Number(entry.points || 0),
    isMe: true,
  };
}

export default function MyFirstAgentPage() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const { status, session } = useAuth();
  const queryClient = useQueryClient();
  const scanInFlightRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const summaryRefreshKeysRef = useRef(new Set<string>());
  const previousCompletionRef = useRef<{
    userId: string;
    completed: OneTimeTaskCompletionState;
  } | null>(null);
  const currentUserId = status === "authenticated" ? session?.userId ?? "" : "";
  const configQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentConfig(),
    queryFn: getMyFirstAgentConfig,
  });
  const featuredAgentsQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentFeaturedXAgents(),
    queryFn: listMyFirstAgentFeaturedXAgents,
  });
  const leaderboardQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentLeaderboard(
      leaderboardPage,
      LEADERBOARD_PAGE_SIZE,
    ),
    queryFn: () => getMyFirstAgentLeaderboard(leaderboardPage, LEADERBOARD_PAGE_SIZE),
  });
  const myLeaderboardEntryQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentLeaderboardEntry(currentUserId),
    queryFn: getMyFirstAgentLeaderboardEntry,
    enabled: Boolean(currentUserId),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const summaryQuery = useQuery({
    queryKey: queryKeys.campaign.myFirstAgentSummary(currentUserId),
    queryFn: getMyFirstAgentSummary,
    enabled: Boolean(currentUserId),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const refetchMyLeaderboardEntry = myLeaderboardEntryQuery.refetch;
  const refetchSummary = summaryQuery.refetch;
  const navigatorQuery = useQuery({
    queryKey: queryKeys.agents.navigator(currentUserId),
    queryFn: getMyNavigatorInfo,
    enabled: Boolean(currentUserId),
    staleTime: 30_000,
  });

  const apiFeaturedAgents = featuredAgentsQuery.data?.agents?.map(mapFeaturedAgent);
  const featuredAgents = featuredAgentsQuery.data
    ? dedupeFeaturedAgentsByAgent(apiFeaturedAgents ?? [])
    : undefined;
  const apiLeaderboardEntries = leaderboardQuery.data?.entries?.map(mapLeaderboardEntry);
  const leaderboardEntries = leaderboardQuery.data ? (apiLeaderboardEntries ?? []) : undefined;
  const rawLeaderboardTotal =
    typeof leaderboardQuery.data?.total === "string"
      ? Number(leaderboardQuery.data.total)
      : leaderboardQuery.data?.total;
  const leaderboardTotal =
    leaderboardEntries && Number.isFinite(rawLeaderboardTotal)
      ? rawLeaderboardTotal
      : undefined;
  const summary = currentUserId ? summaryQuery.data : undefined;
  const myLeaderboardEntry = mapMyLeaderboardEntry(myLeaderboardEntryQuery.data?.entry);
  const hasMyLeaderboardEntryResponse = Boolean(myLeaderboardEntryQuery.data);
  const hasFreshSummary = summaryQuery.isSuccess && summaryQuery.isFetchedAfterMount;
  const sessionTwitterHandle =
    session?.userInfo.twitter?.connected && session.userInfo.twitter.username
      ? session.userInfo.twitter.username
      : "";
  const summaryTwitterHandle =
    summary?.twitterStatus?.connected && summary.twitterStatus.username
      ? summary.twitterStatus.username
      : "";
  const createAccountAppearsCompleted = Boolean(session);
  const connectXAppearsCompleted = Boolean(summaryTwitterHandle || sessionTwitterHandle);
  const topUpAppearsCompleted = summary?.tasks?.topUp?.completed === true;
  const createAccountSummaryCompleted = summary?.tasks?.createAccount?.completed === true;
  const connectXSummaryCompleted = summary?.tasks?.connectX?.completed === true;
  const topUpSummaryCompleted = summary?.tasks?.topUp?.completed === true;
  const shouldScanTopUp =
    status === "authenticated" &&
    configQuery.data?.status === "active" &&
    hasFreshSummary &&
    summary?.tasks?.topUp?.completed === false;
  const shouldSyncTasks =
    status === "authenticated" &&
    Boolean(currentUserId) &&
    configQuery.data?.status === "active";

  useEffect(() => {
    console.log("version 0713.01");
  }, []);

  useEffect(() => {
    if (!currentUserId || !hasFreshSummary) return;

    const displayedCompletions: OneTimeTaskCompletionState = {
      createAccount: createAccountAppearsCompleted,
      connectX: connectXAppearsCompleted,
      topUp: topUpAppearsCompleted,
    };
    const summaryCompletions: OneTimeTaskCompletionState = {
      createAccount: createAccountSummaryCompleted,
      connectX: connectXSummaryCompleted,
      topUp: topUpSummaryCompleted,
    };
    const previous =
      previousCompletionRef.current?.userId === currentUserId
        ? previousCompletionRef.current.completed
        : null;
    previousCompletionRef.current = {
      userId: currentUserId,
      completed: displayedCompletions,
    };

    const refreshTasks = ONE_TIME_TASK_KEYS.filter((key) => {
      const appearsCompleteAheadOfSummary =
        displayedCompletions[key] && !summaryCompletions[key];
      const justMarkedComplete =
        previous ? displayedCompletions[key] && !previous[key] : false;
      return appearsCompleteAheadOfSummary || justMarkedComplete;
    }).filter((key) => {
      const refreshKey = `${currentUserId}:${key}`;
      if (summaryRefreshKeysRef.current.has(refreshKey)) return false;
      summaryRefreshKeysRef.current.add(refreshKey);
      return true;
    });

    if (refreshTasks.length === 0) return;

    void refetchSummary();
    void refetchMyLeaderboardEntry();
  }, [
    connectXAppearsCompleted,
    connectXSummaryCompleted,
    createAccountAppearsCompleted,
    createAccountSummaryCompleted,
    currentUserId,
    hasFreshSummary,
    refetchMyLeaderboardEntry,
    refetchSummary,
    topUpAppearsCompleted,
    topUpSummaryCompleted,
  ]);

  useEffect(() => {
    if (!shouldSyncTasks) return;
    let cancelled = false;

    const refreshSummary = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.myFirstAgentSummary(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.myFirstAgentLeaderboardEntry(),
      });
    };

    const runSync = async () => {
      if (cancelled || syncInFlightRef.current || document.visibilityState !== "visible") {
        return;
      }
      syncInFlightRef.current = true;
      try {
        const res = await syncMyFirstAgentTasks();
        if (res.synced) {
          refreshSummary();
        }
      } catch {
        // Non-blocking: the next interval retries while the page is visible.
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void runSync();
    const timer = window.setInterval(runSync, TASK_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [queryClient, shouldSyncTasks]);

  useEffect(() => {
    if (!shouldScanTopUp) return;
    let cancelled = false;

    const runScan = async () => {
      if (cancelled || scanInFlightRef.current || document.visibilityState !== "visible") {
        return;
      }
      scanInFlightRef.current = true;
      try {
        const res = await scanMyFirstAgentTopUp();
        if (res.settled) {
          markMyFirstAgentTopUpCompleted(queryClient);
          invalidateMyFirstAgentCampaign(queryClient);
        } else if (res.eventsFound) {
          invalidateMyFirstAgentCampaign(queryClient);
        }
      } catch {
        // Non-blocking: the next interval retries while the task remains incomplete.
      } finally {
        scanInFlightRef.current = false;
      }
    };

    void runScan();
    const timer = window.setInterval(runScan, TOP_UP_SCAN_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [queryClient, shouldScanTopUp]);

  return (
    <BaseModeOnly title="My First Agent is not available here yet">
    <div className="min-h-screen pb-20">
      <CampaignHero
        status={heroStatus(configQuery.data?.status)}
        endsAt={heroEnd(configQuery.data)}
        onOpenRules={() => setRulesOpen(true)}
      />
      <TaskList
        featuredAgents={featuredAgents}
        summary={summary}
        topUpSummaryReady={hasFreshSummary}
        navigatorWalletAddress={navigatorQuery.data?.navigator?.walletAddress}
        navigatorAgentId={navigatorQuery.data?.navigator?.agentId}
      />
      <LeaderboardWithRewards
        entries={leaderboardEntries}
        total={Number.isFinite(leaderboardTotal) ? leaderboardTotal : undefined}
        page={leaderboardPage}
        pageSize={LEADERBOARD_PAGE_SIZE}
        myEntry={myLeaderboardEntry}
        hasMyEntryResponse={hasMyLeaderboardEntryResponse}
        onPageChange={setLeaderboardPage}
      />
      <CampaignRulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
    </BaseModeOnly>
  );
}
