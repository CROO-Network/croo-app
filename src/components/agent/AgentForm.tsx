"use client";

import { useState, useRef, useMemo } from "react";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { getObjectUploadUrl, ObjectUploadPrefix, putFileToPresignedUrl } from "@/lib/api/object";
import {
  ArrowLeft, Plus, ChevronRight, Copy, RefreshCw,
  Key, AlertTriangle, Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSla, maskSdkKeyForDisplay } from "@/lib/formatters";
import { ServiceIdBadge } from "@/components/agent/ServiceIdBadge";
import type { MyAgentService } from "@/lib/mock-data";
import type { AgentInfoJson } from "@/lib/api/agent";
import {
  abandonPendingAgent,
  createAgent,
  getDeployUserOp,
  getMyAgent,
  rotateMyAgentSdkKey,
  submitSignedUserOp,
  updateMyAgent,
  updateMyAgentStatus,
} from "@/lib/api/agent";
import { isWalletSignatureRejected } from "@/lib/wallet-sign-errors";
import { getPublicTags, type PublicTagJson } from "@/lib/api/discovery";
import { getAgentDetailToMyAgent, mapAgentStatus } from "@/lib/my-agent-mapper";
import { getAuthErrorMessage, isApiError } from "@/lib/http/errors";
import {
  avatarStringForApi,
  BASE_MAINNET_USDC,
  serviceFormDataToPayload,
  skillTagLabelsToSlugs,
} from "@/lib/agent-service-payload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ServiceModal,
  type ServiceFormData,
} from "@/components/agent/ServiceModal";
import { useToast } from "@/components/shared/Toast";
import { useAuth } from "@/lib/auth";
import { useSignMessage } from "wagmi";

/* ── Types ─────────────────────────────────────── */

export interface AgentFormData {
  name: string;
  avatar: string;
  description: string;
  tags: string[];
  services: ServiceFormData[];
  /** Auto-detected from connection method — read-only in UI, not user-editable */
  source: string;
  status?: "online" | "offline" | "draft";
  apiKey?: string;
  walletDeployStatus?: string;
}

export { type ServiceFormData } from "@/components/agent/ServiceModal";

/* ── Constants ─────────────────────────────────── */

const FORM_FIELD_CLASS =
  "w-full rounded-xl border border-[#E2E2E0] bg-white px-4 py-2.5 text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] transition-all focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/30";

function agentFormSnapshot(data: AgentFormData): string {
  const { status: _status, ...rest } = data;
  void _status;
  return JSON.stringify(rest);
}

export function agentToFormData(agent: {
  name: string;
  avatar: string;
  description?: string;
  tags: string[];
  source: string;
  status?: "online" | "offline" | "draft";
  services: MyAgentService[];
  apiKey?: string;
  walletDeployStatus?: string;
}): AgentFormData {
  return {
    name: agent.name,
    avatar: agent.avatar,
    description: agent.description ?? "",
    tags: [...agent.tags],
    source: agent.source,
    status: agent.status,
    apiKey: agent.apiKey,
    walletDeployStatus: agent.walletDeployStatus,
    services: agent.services.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      price: String(o.price),
      requireFundTransfer: !!o.requireFundTransfer,
      priceModel: o.priceModel ?? "flat",
      feePercentage: o.feePercentage !== undefined ? String(o.feePercentage) : "",
      slaHours: String(o.slaHours),
      slaMinutes: String(o.slaMinutes),
      deliverableType: o.deliverableType,
      deliverableText: o.deliverableText ?? "",
      deliverableSchema: o.deliverableSchema ?? [],
      requirementsType: o.requirementsType,
      requirementsText: o.requirementsText ?? "",
      requirementsSchema: o.requirementsSchema ?? [],
    })),
  };
}

/* ── Main Component ────────────────────────────── */

interface AgentFormProps {
  mode: "create" | "configure";
  initialData?: AgentFormData;
  agentId?: string;
  /** USDC contract address for new/updated services — from existing service row when available. */
  defaultPaymentToken?: string;
  /** Public tag library (GET /backend/v1/public/tags) — used for configure-mode tag pills. */
  tagCatalog?: PublicTagJson[];
}

export function AgentForm({ mode, initialData, agentId, defaultPaymentToken, tagCatalog = [] }: AgentFormProps) {
  const router = useRouter();
  const isEdit = mode === "configure";
  const isRegistered = isEdit && form_status_registered(initialData?.status);

  const [form, setForm] = useState<AgentFormData>(
    initialData ?? {
      name: "",
      avatar: "",
      description: "",
      tags: [],
      services: [],
      source: "sdk",
    }
  );

  const { showToast } = useToast();
  const { session } = useAuth();
  const { signMessageAsync } = useSignMessage();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState<number | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [pendingWalletAgentId, setPendingWalletAgentId] = useState<string | null>(null);
  const [pendingWalletUserOpHash, setPendingWalletUserOpHash] = useState<string | null>(null);
  const [pendingCreateSdkKey, setPendingCreateSdkKey] = useState("");
  const [retryingWalletSign, setRetryingWalletSign] = useState(false);

  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    agentFormSnapshot(initialData ?? { name: "", avatar: "", description: "", tags: [], services: [], source: "sdk" })
  );
  const isDirty = useMemo(() => {
    // Exclude `status` from dirty check — pause/resume is applied immediately
    // and should not activate the Save Changes button
    return agentFormSnapshot(form) !== initialSnapshot;
  }, [form, initialSnapshot]);
  const isCreateMode = mode === "create";
  const hasAvatar = form.avatar.trim().length > 0;

  const set = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleNewKeyModalDone = () => {
    if (isCreateMode && createdAgentId) {
      router.push(`/account/agents/${encodeURIComponent(createdAgentId)}/configure`);
      setShowNewKeyModal(false);
      setCreatedAgentId(null);
      return;
    }

    setShowNewKeyModal(false);
  };

  const MAX_TAGS = 5;
  /** Top-level tags from API, ordered for display. */
  const displayTags = useMemo(() => {
    const top = (tagCatalog || []).filter((t) => t.parentId === 0);
    return [...top].sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name)));
  }, [tagCatalog]);
  const toggleTag = (tag: string) => {
    if (form.tags.includes(tag)) {
      set("tags", form.tags.filter((t) => t !== tag));
    } else if (form.tags.length < MAX_TAGS) {
      set("tags", [...form.tags, tag]);
    }
  };

  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      showToast("Please choose an image file (PNG, JPEG, etc.)");
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      showToast("Image must be 2MB or smaller");
      return;
    }
    const contentType = f.type || "image/jpeg";
    setAvatarUploading(true);
    void (async () => {
      try {
        const { uploadUrl, objectKey, publicUrl } = await getObjectUploadUrl({
          fileName: f.name || "avatar.jpg",
          contentType,
          objectPrefix: ObjectUploadPrefix.Images,
        });
        await putFileToPresignedUrl(uploadUrl, f, contentType);
        set("avatar", (publicUrl && publicUrl.trim()) || objectKey);
        showToast("Avatar uploaded");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        showToast(msg);
      } finally {
        setAvatarUploading(false);
      }
    })();
  };

  const openCreateSuccessKeyModal = (agentId: string, sdkKeyFromCreate: string) => {
    setCreatedAgentId(agentId);
    setNewKeyValue(sdkKeyFromCreate);
    setKeyCopied(false);
    setShowNewKeyModal(true);
  };

  const signAndSubmitWalletDeploy = async (agentId: string, userOpHash: string) => {
    const signature = await signMessageAsync({
      message: { raw: userOpHash as `0x${string}` },
    });
    await submitSignedUserOp(agentId, userOpHash, signature);
  };

  const handleRetryWalletSign = async () => {
    if (!pendingWalletAgentId || retryingWalletSign) return;
    setRetryingWalletSign(true);
    try {
      let hash = pendingWalletUserOpHash?.trim() || "";
      if (!hash) {
        const dep = await getDeployUserOp(pendingWalletAgentId);
        hash = dep.userOpHash?.trim() || "";
      }
      if (!hash) {
        showToast("Could not prepare deploy signature. Try creating the agent again.");
        return;
      }
      const agentId = pendingWalletAgentId;
      const sdkKey = pendingCreateSdkKey;
      await signAndSubmitWalletDeploy(agentId, hash);
      setPendingWalletAgentId(null);
      setPendingWalletUserOpHash(null);
      setPendingCreateSdkKey("");
      showToast("AA wallet deploy submitted.");
      openCreateSuccessKeyModal(agentId, sdkKey);
    } catch (depErr) {
      console.error(depErr);
      if (isWalletSignatureRejected(depErr)) {
        try {
          await abandonPendingAgent(pendingWalletAgentId);
        } catch (abandonErr) {
          console.error(abandonErr);
        }
        window.location.reload();
        return;
      }
      showToast(getAuthErrorMessage(depErr) || "Signature failed. Try again.");
    } finally {
      setRetryingWalletSign(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || creating) return;
    const avatarKey = avatarStringForApi(form.avatar);
    if (!avatarKey) {
      showToast("Please upload an avatar image before creating an agent.");
      return;
    }
    setCreating(true);
    setPendingWalletAgentId(null);
    setPendingWalletUserOpHash(null);
    setPendingCreateSdkKey("");
    try {
      const res = await createAgent({
        name: form.name.trim(),
        description: "",
        avatar: avatarKey,
      });
      const newId = res.agent.agentId;
      const fullKey =
        (res.sdkKey ?? (res as { sdk_key?: string }).sdk_key)?.trim() || "";

      if (session?.loginMethod === "wallet" && res.walletDeployUserOpHash) {
        setPendingCreateSdkKey(fullKey);
        try {
          await signAndSubmitWalletDeploy(newId, res.walletDeployUserOpHash);
          showToast("AA wallet deploy submitted.");
          openCreateSuccessKeyModal(newId, fullKey);
        } catch (depErr) {
          console.error(depErr);
          if (isWalletSignatureRejected(depErr)) {
            try {
              await abandonPendingAgent(newId);
            } catch (abandonErr) {
              console.error(abandonErr);
            }
            window.location.reload();
            return;
          }
          setPendingWalletAgentId(newId);
          setPendingWalletUserOpHash(res.walletDeployUserOpHash);
          showToast(getAuthErrorMessage(depErr) || "Signature failed. Retry to finish creating your agent.");
          return;
        }
      } else {
        if (session?.loginMethod === "google") {
          if (res.custodianDeployStatus === "failed" && res.custodianDeployError) {
            showToast(`Agent created. Deploy: ${res.custodianDeployError}`);
          } else if (res.custodianDeployStatus) {
            showToast("AA wallet deploy submitted.");
          }
        }
        openCreateSuccessKeyModal(newId, fullKey);
      }
    } catch (e) {
      if (isApiError(e)) {
        if (e.reason === "WEB2_NOT_ALLOWED") {
          showToast("Creating an agent requires a connected Web3 wallet.");
        } else if (e.reason === "OWNER_NOT_EOA") {
          showToast(
            e.message ||
              "Your wallet has smart-contract code on Base (often EIP-7702). Use a plain EOA without delegation to create agents.",
          );
        } else if (e.reason === "AGENT_LIMIT_EXCEEDED") {
          showToast("You have reached the maximum number of agents.");
        } else {
          showToast(e.message || "Could not create agent.");
        }
      } else {
        showToast("Could not create agent.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!isEdit || !agentId || saving) return;
    const payment = (defaultPaymentToken || BASE_MAINNET_USDC).trim();
    if (form.services.length > 0 && form.tags.length < 1) {
      showToast("Select at least one skill tag when you have services.");
      return;
    }
    setSaving(true);
    try {
      const tagRes = await getPublicTags();
      const skillTags = skillTagLabelsToSlugs(form.tags, tagRes.tags ?? []);
      if (form.services.length > 0 && skillTags.length < 1) {
        showToast("Select at least one skill tag that matches the catalog, or remove services.");
        return;
      }
      const services = form.services.map((s) => serviceFormDataToPayload(s, payment));
      const updateRes = await updateMyAgent(agentId, {
        name: form.name.trim(),
        description: form.description.trim(),
        skillTags,
        avatar: avatarStringForApi(form.avatar),
        services,
      });
      const refreshed = await getMyAgent(agentId).catch(() => ({
        ...updateRes,
        sdkKey: form.apiKey,
        walletDeployStatus: form.walletDeployStatus,
      }));
      const slugToLabel = new Map((tagRes.tags || []).map((t) => [t.slug, t.name]));
      const nextForm = agentToFormData({
        ...getAgentDetailToMyAgent(
          refreshed.agent,
          refreshed.skillTags || [],
          refreshed.services || [],
          slugToLabel,
          (refreshed.sdkKey ?? (refreshed as { sdk_key?: string }).sdk_key)?.trim() || form.apiKey,
        ),
        walletDeployStatus: (refreshed.walletDeployStatus ?? form.walletDeployStatus)?.trim() || undefined,
      });
      setForm(nextForm);
      setInitialSnapshot(agentFormSnapshot(nextForm));
      const nextProfileComplete =
        nextForm.name.trim().length > 0 &&
        nextForm.description.trim().length > 0 &&
        nextForm.tags.length > 0 &&
        nextForm.services.length > 0;
      if (isRegistered && nextProfileComplete) {
        setShowCompleteDialog(true);
      } else {
        showToast("Changes saved successfully");
      }
    } catch (e) {
      if (isApiError(e)) {
        showToast(e.message || "Could not save changes.");
      } else {
        showToast("Could not save changes.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Rotate: show confirm first, then call backend rotate (full key shown once in modal)
  const handleRotateRequest = () => setShowRotateConfirm(true);

  const confirmRotate = async () => {
    if (!agentId || rotatingKey) return;
    setShowRotateConfirm(false);
    setRotatingKey(true);
    try {
      const res = await rotateMyAgentSdkKey(agentId);
      const full = res.sdkKey?.sdkKey?.trim() ?? "";
      if (!full) {
        showToast("Rotate succeeded but no key was returned.");
        return;
      }
      setNewKeyValue(full);
      setKeyCopied(false);
      setShowNewKeyModal(true);
      setForm((prev) => {
        const next = { ...prev, apiKey: maskSdkKeyForDisplay(full) };
        setInitialSnapshot(agentFormSnapshot(next));
        return next;
      });
      showToast("API key rotated.");
    } catch (e) {
      if (isApiError(e)) {
        showToast(e.message || "Could not rotate API key.");
      } else {
        showToast("Could not rotate API key.");
      }
    } finally {
      setRotatingKey(false);
    }
  };

const openCreateService = () => { setEditingServiceIdx(null); setShowServiceModal(true); };
  const openEditService = (idx: number) => { setEditingServiceIdx(idx); setShowServiceModal(true); };

  const handleServiceSave = (data: ServiceFormData) => {
    if (editingServiceIdx !== null) {
      setForm((prev) => ({ ...prev, services: prev.services.map((o, i) => (i === editingServiceIdx ? data : o)) }));
    } else {
      setForm((prev) => ({ ...prev, services: [...prev.services, data] }));
    }
    setShowServiceModal(false);
  };

  const handleServiceDelete = () => {
    if (editingServiceIdx !== null) {
      setForm((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== editingServiceIdx) }));
    }
    setShowServiceModal(false);
  };

  const backHref = "/account/agents";

  return (
    <div className="space-y-6 pb-24">
      {/* Back link */}
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-[#9A9A9A] transition-colors hover:text-[#0F0F0F]">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to My Agents
      </Link>

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F0F0F]">
            {isEdit ? "Configure Agent" : "Register Agent"}
          </h1>
          <p className="mt-1 text-sm text-[#9A9A9A]">
            {isEdit
              ? isRegistered
                ? "Your agent is in draft. Complete the setup to go live."
                : "Update your agent's profile, services, and settings."
              : "Create your agent and save your API key. Add description, tags, and services on the next screen."}
          </p>
        </div>
        {/* Status control — only for agents that are already connected (not registered, not create) */}
        {isEdit && !isRegistered && form.status && agentId && (
          <StatusControl
            agentId={agentId}
            status={form.status as "online" | "offline"}
            onStatusUpdated={(s) => set("status", s)}
          />
        )}
      </div>

      {/* ── Draft banner — stepped onboarding guide ── */}
      {isRegistered && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#6EE646]/50 bg-[#F0F9EB] px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#6EE646]/20">
            <Key className="h-4 w-4 text-[#3D8C1F]" />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            {/* Step 1 */}
            <div>
              <p className="text-xs font-semibold text-[#0F0F0F]">Step 1 — Complete profile and service setup</p>
              <p className="mt-1 text-xs text-[#6B6B6B] leading-relaxed">
                Fill in description, tags, and at least one service below.
              </p>
            </div>

            {/* Step 2 — Install SDK + export API key */}
            <div>
              <p className="text-xs font-semibold text-[#0F0F0F]">Step 2 — Install SDK and input API key</p>
              <div className="mt-2 rounded-lg bg-white border border-[#6EE646]/30 px-3 py-2 font-mono text-xs leading-relaxed text-[#0F0F0F] overflow-x-auto">
                <div className="text-[#9A9A9A]"># Install the SDK</div>
                <div>pip install croo-sdk</div>
                <div className="mt-1.5 text-[#9A9A9A]"># Export your API key</div>
                <div>export CROO_API_KEY={form.apiKey ?? "croo_sk_****xxxx"}</div>
              </div>
            </div>

            {/* Step 3 — Start provider */}
            <div>
              <p className="text-xs font-semibold text-[#0F0F0F]">Step 3 — Start your provider</p>
              <div className="mt-2 rounded-lg bg-white border border-[#6EE646]/30 px-3 py-2 font-mono text-xs leading-relaxed text-[#0F0F0F] overflow-x-auto">
                <div className="text-[#9A9A9A]"># Start the provider</div>
                <div>npx ts-node examples/provider.ts</div>
              </div>
            </div>

            {/* OpenClaw supplementary note */}
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              If you use OpenClaw or Hermes, you can finish the rest of the setup by chatting with your Agent.
            </p>

            {/* Footer */}
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              For more details, check out our{" "}
              <a
                href="https://docs.croo.network/developer-docs/quick-start"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-[#3D8C1F] hover:text-[#2A6B13]"
              >
                documentation
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* ── Basic Info ────────────────────────── */}
      <SectionCard label="Basic Info">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[#E2E2E0] bg-[#F5F5F3]">
              {avatarUploading ? (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-[#9A9A9A]">…</div>
              ) : !hasAvatar ? (
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="flex h-full w-full items-center justify-center text-lg font-semibold text-[#9A9A9A] transition-colors hover:text-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/30"
                  aria-label="Upload avatar"
                >
                  ?
                </button>
              ) : (
                <ResolvedAgentAvatar
                  avatar={form.avatar}
                  name={form.name || "?"}
                  className="h-full w-full object-cover"
                  alt="Avatar"
                />
              )}
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={handleAvatarFile}
            />
            <button
              type="button"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarUploading}
              className="flex items-center gap-1 text-[10px] text-[#9A9A9A] hover:text-[#6EE646] transition-colors cursor-pointer disabled:opacity-50"
              title="Upload avatar"
            >
              <Upload className="h-3 w-3" aria-hidden="true" />
              Upload
            </button>
          </div>

          <div className="space-y-4">
            <FieldRow label="Agent Name">
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. WhaleTracker" className={FORM_FIELD_CLASS} />
            </FieldRow>

            {/* Source is backend-detected and read-only; show it whenever present. */}
            {isEdit && !isRegistered && (
              <FieldRow label="Source">
                <div className="flex items-center gap-2 pt-0.5">
                  <SourceBadge source={form.source} empty={!form.source.trim()} />
                  <span className="text-[11px] text-[#9A9A9A]">Auto-detected from connection method</span>
                </div>
              </FieldRow>
            )}

            {/* Description — configure mode */}
            {isEdit && (
              <FieldRow label="Description">
                <div>
                  <textarea value={form.description} onChange={(e) => { if (e.target.value.length <= 500) set("description", e.target.value); }} placeholder="Describe what your agent does in 1–2 sentences..." rows={3} className={`${FORM_FIELD_CLASS} resize-none`} />
                  <p className={`mt-1 text-right text-[10px] font-mono tabular-nums ${form.description.length > 160 ? "text-[#E5A02E]" : "text-[#C4C4C2]"}`}>
                    {form.description.length}/500
                  </p>
                </div>
              </FieldRow>
            )}

            {/* Tags — configure mode */}
            {isEdit && (
              <FieldRow label="Tags">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {displayTags.length === 0 ? (
                      <p className="text-xs text-[#9A9A9A]">
                        No tags available. Ensure the public tag library is seeded in the database.
                      </p>
                    ) : (
                      displayTags.map((t) => {
                        const tag = t.name;
                        const active = form.tags.includes(tag);
                        const disabled = !active && form.tags.length >= MAX_TAGS;
                        return (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          disabled={disabled}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                            active
                              ? "bg-[#6EE646]/15 text-[#0F0F0F] border border-[#6EE646]/40 cursor-pointer"
                              : disabled
                              ? "border border-[#E2E2E0] bg-white text-[#D0D0CE] cursor-not-allowed"
                              : "border border-[#E2E2E0] bg-white text-[#9A9A9A] hover:text-[#0F0F0F] hover:border-[#D0D0CE] cursor-pointer"
                          }`}
                        >
                          {tag}
                        </button>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-[#9A9A9A]">
                    {form.tags.length} / {MAX_TAGS} selected
                  </p>
                </div>
              </FieldRow>
            )}
          </div>
        </div>
        {!isEdit && (
          <p className="mt-4 text-xs text-[#9A9A9A]">Description, tags, and services can be configured after creation.</p>
        )}
      </SectionCard>

      {/* ── Services — configure mode ─────────── */}
      {isEdit && (
        <SectionCard label="Services" action={
          <button onClick={openCreateService} className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F0F] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer">
            <Plus className="h-3 w-3" />Add Service
          </button>
        }>
          {form.services.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E2E0] bg-[#FAFAF9] px-6 py-10 text-center">
              <p className="text-sm text-[#9A9A9A]">No services yet. Add one to start accepting orders.</p>
              <button onClick={openCreateService} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#E2E2E0] px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#6EE646] cursor-pointer">
                <Plus className="h-3 w-3" />Add Service
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {form.services.map((service, idx) => (
                <ServiceListButton
                  key={service.id}
                  service={service}
                  fallbackName={`Service ${idx + 1}`}
                  onClick={() => openEditService(idx)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── API Key — configure mode ─────────── */}
      {isEdit && (
        <SectionCard label="API Key">
          {form.apiKey ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F3]">
                  <Key className="h-4 w-4 text-[#9A9A9A]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-mono text-[#0F0F0F] break-all">{form.apiKey}</p>
                  <p className="text-[11px] text-[#9A9A9A]">
                    Key is masked for security. Use Rotate to issue a new key.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotateRequest}
                  disabled={rotatingKey}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E2E0] px-3.5 py-1.5 text-xs font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 ${rotatingKey ? "animate-spin" : ""}`} />
                  {rotatingKey ? "Rotating…" : "Rotate"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B6B6B]">No API key found for this agent.</p>
          )}
        </SectionCard>
      )}

      {/* ── Floating Footer ── */}
      <div className="fixed bottom-6 z-30" style={{ left: "calc(50% + 6.5rem)", transform: "translateX(-50%)" }}>
        <div className="flex items-center gap-3 rounded-2xl border border-[#E2E2E0] bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <Link
            href={backHref}
            className="inline-flex h-9 items-center justify-center rounded-full border border-[#E2E2E0] px-5 text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]"
          >
            Cancel
          </Link>
          {isCreateMode ? (
            pendingWalletAgentId ? (
              <button
                type="button"
                onClick={() => void handleRetryWalletSign()}
                disabled={retryingWalletSign}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#0F0F0F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {retryingWalletSign ? "Signing…" : "Retry wallet signature"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!form.name.trim() || creating}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#0F0F0F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? "Creating…" : "Register Agent"}
              </button>
            )
          ) : (
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#0F0F0F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {/* ── Service Modal ── */}
      <ServiceModal
        key={
          showServiceModal
            ? editingServiceIdx !== null
              ? form.services[editingServiceIdx]?.id ?? `edit-${editingServiceIdx}`
              : "new"
            : "closed"
        }
        open={showServiceModal}
        onOpenChange={setShowServiceModal}
        service={editingServiceIdx !== null ? form.services[editingServiceIdx] : null}
        onSave={handleServiceSave}
        onDelete={editingServiceIdx !== null ? handleServiceDelete : undefined}
      />

      {/* ── Rotate Confirm Modal ── */}
      <Dialog open={showRotateConfirm} onOpenChange={setShowRotateConfirm}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm bg-white border-[#E2E2E0] rounded-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#0F0F0F]">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Rotate API Key?
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-2 pb-6 space-y-4">
            <p className="text-sm text-[#6B6B6B]">
              Your current key will be <span className="font-medium text-[#0F0F0F]">immediately invalidated</span>. Any agent connections using the old key will disconnect.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowRotateConfirm(false)} className="flex-1 rounded-full border border-[#E2E2E0] py-2.5 text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRotate()}
                disabled={rotatingKey}
                className="flex-1 rounded-full bg-[#0F0F0F] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rotatingKey ? "Rotating…" : "Rotate Key"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── API Key Modal (after create or rotate) ── */}
      <Dialog open={showNewKeyModal} onOpenChange={setShowNewKeyModal}>
        <DialogContent showCloseButton className="sm:max-w-md bg-white border-[#E2E2E0] rounded-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#0F0F0F]">
              <Key className="h-5 w-5 text-[#6EE646]" />
              {isCreateMode ? "Agent created — save your API key" : "Your new API key"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-3 pb-6 space-y-4">
            {isCreateMode && (
              <p className="text-sm text-[#6B6B6B]">
                <span className="font-medium text-[#0F0F0F]">{form.name}</span> has been created.
                Copy and store your API key — you will use it to connect your agent.
              </p>
            )}
            {newKeyValue ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#F5F5F3] p-3">
                <code className="flex-1 break-all text-sm font-mono text-[#0F0F0F]">{newKeyValue}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(newKeyValue);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-[#9A9A9A] transition-colors hover:bg-[#E2E2E0] hover:text-[#0F0F0F] cursor-pointer"
                  aria-label="Copy API key"
                >
                  {keyCopied ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5l3 3 7-7" stroke="#6EE646" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-amber-800">API key was not returned. Use Rotate on the configure page to issue a new key.</p>
            )}
            {newKeyValue && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {isCreateMode
                    ? "This key is shown in full here only once. On the configure page it stays masked."
                    : "This key will only be shown once. Copy it now and store it securely."}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleNewKeyModalDone}
              className="w-full rounded-full bg-[#0F0F0F] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer"
            >
              {isCreateMode ? "Done — configure agent" : "Done"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Profile Complete Dialog (shown after saving draft with all fields complete) ── */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md bg-white border-[#E2E2E0] rounded-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold text-[#0F0F0F]">
              Profile complete! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-3 pb-6 space-y-4">
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Next step — install the SDK, input your API key, and start your provider to go live.
            </p>
            <div className="rounded-xl bg-[#F5F5F3] border border-[#E2E2E0] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#0F0F0F] overflow-x-auto">
              <div className="text-[#9A9A9A]"># Install the SDK</div>
              <div>pip install croo-sdk</div>
              <div className="mt-1.5 text-[#9A9A9A]"># Export your API key</div>
              <div>export CROO_API_KEY={form.apiKey ?? "croo_sk_****xxxx"}</div>
              <div className="mt-1.5 text-[#9A9A9A]"># Start the provider</div>
              <div>npx ts-node examples/provider.ts</div>
            </div>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              If you use OpenClaw or Hermes, you can finish the rest of the setup by chatting with your Agent.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="flex-1 rounded-full border border-[#E2E2E0] py-2.5 text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer"
              >
                Got it
              </button>
              <a
                href="https://docs.croo.network/developer-docs/quick-start"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center rounded-full bg-[#0F0F0F] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer"
              >
                View Documentation
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────── */

function form_status_registered(status?: string) {
  return status === "draft";
}

/* ── Sub-components ────────────────────────────── */


function SectionCard({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E2E2E0] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-px w-5 bg-[#6EE646]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">{label}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#6B6B6B]">{label}</label>
      {children}
    </div>
  );
}

/** `empty`: when true (e.g. OFFLINE), no connection source text; neutral pill for layout. */
function SourceBadge({ source, empty }: { source: string; empty?: boolean }) {
  if (empty) {
    return (
      <span
        className="inline-flex min-h-[26px] min-w-[2.75rem] items-center justify-center rounded-full border border-[#E2E2E0] bg-[#F5F5F3] px-2.5 py-1"
        aria-label="Connection type shown after agent is online"
      />
    );
  }
  const key = source?.toLowerCase();
  const variant =
    key === "openclaw"
      ? { label: "OpenClaw", bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-500" }
      : key === "hermes"
        ? { label: "Hermes", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" }
        : { label: "SDK", bg: "bg-[#F5F5F3]", text: "text-[#6B6B6B]", border: "border-[#E2E2E0]", dot: "bg-[#9A9A9A]" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${variant.bg} ${variant.text} border ${variant.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${variant.dot}`} />
      {variant.label}
    </span>
  );
}

function StatusControl({
  agentId,
  status,
  onStatusUpdated,
}: {
  agentId: string;
  status: "online" | "offline";
  onStatusUpdated: (s: "online" | "offline" | "draft") => void;
}) {
  const { showToast } = useToast();
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOnline = status === "online";

  const runStatusAction = async (
    fn: () => Promise<{ agent: AgentInfoJson }>,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fn();
      onStatusUpdated(mapAgentStatus(res.agent?.status ?? ""));
      return true;
    } catch (e) {
      showToast(getAuthErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    const ok = await runStatusAction(() => updateMyAgentStatus(agentId, "pause"));
    if (ok) setShowPauseConfirm(false);
  };

  const handleResume = async () => {
    await runStatusAction(() => updateMyAgentStatus(agentId, "resume"));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        {status === "offline" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResume()}
            className="rounded-full bg-[#6EE646] px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#5DD835] cursor-pointer disabled:opacity-50"
          >
            Resume
          </button>
        ) : isOnline ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPauseConfirm(true)}
            className="rounded-full border border-amber-300 px-4 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 cursor-pointer disabled:opacity-50"
          >
            Pause
          </button>
        ) : null}
      </div>

      <Dialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm bg-white border-[#E2E2E0] rounded-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#0F0F0F]">
              Pause Agent?
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-2 pb-6 space-y-4">
            <p className="text-sm text-[#6B6B6B]">
              Pausing will stop your agent from accepting new orders. Existing orders in progress will continue to completion.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowPauseConfirm(false)}
                className="flex-1 rounded-full border border-[#E2E2E0] py-2.5 text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePause()}
                className="flex-1 rounded-full border border-amber-300 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 cursor-pointer disabled:opacity-50"
              >
                {busy ? "…" : "Pause Agent"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { label: string; dot: string; color: string; bg: string }> = {
    online: { label: "Online", dot: "●", color: "text-[#3D8C1F]", bg: "bg-[#6EE646]/10" },
    paused: { label: "Offline", dot: "○", color: "text-[#6B6B6B]", bg: "bg-[#9A9A9A]/10" },
    offline: { label: "Offline", dot: "○", color: "text-[#6B6B6B]", bg: "bg-[#9A9A9A]/10" },
    banned: { label: "Banned", dot: "✕", color: "text-[#DC2626]", bg: "bg-[#EF4444]/10" },
  };
  const c = config[status] ?? config.offline;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${c.color} ${c.bg}`}>
      <span aria-hidden>{c.dot}</span>{c.label}
    </span>
  );
}

function ServiceListButton({
  service,
  fallbackName,
  onClick,
}: {
  service: ServiceFormData;
  fallbackName: string;
  onClick: () => void;
}) {
  const priceLabel =
    service.requireFundTransfer &&
    service.priceModel === "percentage" &&
    service.feePercentage
      ? `${service.feePercentage}%`
      : service.price
        ? `$${service.price}`
        : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[#E2E2E0] bg-[#FAFAF9] px-4 py-3 text-left transition-colors hover:bg-[#F0F0EE] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EE646] focus-visible:ring-offset-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-[#0F0F0F]">
          {service.name || fallbackName}
        </span>
        <ServiceIdBadge serviceId={service.id} />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {priceLabel && <span className="text-xs font-mono text-[#6B6B6B]">{priceLabel}</span>}
        <span className="text-[11px] text-[#9A9A9A]">
          {formatSla(service.slaHours, service.slaMinutes)}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[#C4C4C2] transition-colors group-hover:text-[#9A9A9A]" aria-hidden />
      </div>
    </div>
  );
}
