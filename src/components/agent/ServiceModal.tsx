"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, ArrowRight, ArrowLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SchemaField } from "@/lib/mock-data";

/* ── Types ─────────────────────────────────────── */

export interface ServiceFormData {
  id: string;
  name: string;
  description: string;
  price: string;
  requireFundTransfer: boolean;
  priceModel: "flat" | "percentage";
  /** Percentage fee string, e.g. "2.5" for 2.5%. */
  feePercentage: string;
  slaHours: string;
  slaMinutes: string;
  deliverableType: "text" | "schema";
  deliverableText: string;
  deliverableSchema: SchemaField[];
  requirementsType: "text" | "schema";
  requirementsText: string;
  requirementsSchema: SchemaField[];
}

export function newService(): ServiceFormData {
  return {
    id: `svc-new-${Date.now()}`,
    name: "",
    description: "",
    price: "",
    requireFundTransfer: false,
    priceModel: "flat",
    feePercentage: "",
    slaHours: "0",
    slaMinutes: "30",
    deliverableType: "text",
    deliverableText: "",
    deliverableSchema: [],
    requirementsType: "text",
    requirementsText: "",
    requirementsSchema: [],
  };
}

/* ── Props ─────────────────────────────────────── */

interface ServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceFormData | null; // null = create new
  onSave: (data: ServiceFormData) => void;
  onDelete?: () => void;
}

/* ── Helpers ───────────────────────────────────── */

function newField(): SchemaField {
  return { name: "", type: "string", required: true, stringSubtype: "plain", description: "" };
}

/** Platform-owned field for fund-transfer services. The backend injects it
 *  on save when `require_fund_transfer = true` and strips it otherwise, so
 *  the modal hides this row entirely — the agent owner never sees it. */
const PRINCIPAL_FIELD_NAME = "principal_amount";

function stripPrincipal(fields: SchemaField[] | undefined): SchemaField[] {
  return (fields ?? []).filter((f) => f.name !== PRINCIPAL_FIELD_NAME);
}

const FIELD_TYPES: SchemaField["type"][] = ["string", "number", "boolean", "array", "object"];
const SUB_FIELD_TYPES: SchemaField["type"][] = ["string", "number", "boolean"];
const STRING_SUBTYPES: NonNullable<SchemaField["stringSubtype"]>[] = ["plain", "url", "address"];
const SLA_HOURS_MAX = 72;
const SLA_MINUTES_MAX = 59;

/** Validate that a field name uses camelCase or snake_case */
const FIELD_NAME_REGEX = /^([a-z][a-zA-Z0-9]*|[a-z][a-z0-9_]*)$/;
function isValidFieldName(name: string): boolean {
  if (!name) return true; // empty during typing — don't flag yet
  return FIELD_NAME_REGEX.test(name);
}

function clampIntString(raw: string, min: number, max: number): string {
  const t = raw.trim();
  if (t === "") return "";
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return "";
  if (n < min) return String(min);
  if (n > max) return String(max);
  return String(n);
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#6B6B6B]">{label}</label>
      {children}
    </div>
  );
}

/* ── Main Component ────────────────────────────── */

/** Hide the platform-owned `principal_amount` row when loading an existing
 *  fund-transfer service — the backend stores it in requirement_schema but
 *  it must not appear in the owner's editor. */
function hidePrincipalRow(s: ServiceFormData): ServiceFormData {
  if (!s.requireFundTransfer) return s;
  return { ...s, requirementsSchema: stripPrincipal(s.requirementsSchema) };
}

export function ServiceModal({ open, onOpenChange, service, onSave, onDelete }: ServiceModalProps) {
  const isEdit = !!service;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ServiceFormData>(() =>
    service ? hidePrincipalRow(service) : newService(),
  );

  const set = <K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const totalSlaMinutes = useMemo(() => {
    const h = parseInt(String(form.slaHours), 10) || 0;
    const m = parseInt(String(form.slaMinutes), 10) || 0;
    return h * 60 + m;
  }, [form.slaHours, form.slaMinutes]);
  const slaOk = totalSlaMinutes >= 5;

  const updateDeliverableField = (idx: number, patch: Partial<SchemaField>) => {
    setForm((prev) => ({
      ...prev,
      deliverableSchema: prev.deliverableSchema.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const updateRequirementsField = (idx: number, patch: Partial<SchemaField>) => {
    setForm((prev) => ({
      ...prev,
      requirementsSchema: prev.requirementsSchema.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  /** Toggle "Require Fund Transfer". Schema-side handling is done by the
   *  backend: when this flag is on, the BE prepends `principal_amount` to
   *  requirement_schema on save; when off it strips it. The modal never
   *  shows that row. */
  const toggleRequireFundTransfer = () => {
    setForm((prev) => ({
      ...prev,
      requireFundTransfer: !prev.requireFundTransfer,
      priceModel: !prev.requireFundTransfer ? prev.priceModel : "flat",
    }));
  };

  const priceOk =
    form.requireFundTransfer && form.priceModel === "percentage"
      ? Number(form.feePercentage) > 0
      : Boolean(form.price);
  const canProceed = Boolean(form.name.trim() && priceOk && slaOk);

  // Validate schema field names across deliverable + requirements (and sub-fields)
  const allSchemaFieldNames = useMemo(() => {
    const all: string[] = [];
    const walk = (fs: SchemaField[]) => {
      for (const f of fs) {
        all.push(f.name);
        if (f.fields) walk(f.fields);
      }
    };
    if (form.deliverableType === "schema") walk(form.deliverableSchema);
    if (form.requirementsType === "schema") walk(form.requirementsSchema);
    return all;
  }, [form.deliverableType, form.deliverableSchema, form.requirementsType, form.requirementsSchema]);
  const schemaFieldsValid = allSchemaFieldNames.every((n) => n.length > 0 && FIELD_NAME_REGEX.test(n));

  const handleSave = () => {
    if (!schemaFieldsValid || totalSlaMinutes < 5) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90dvh,40rem)] flex-col overflow-hidden gap-0 p-0 sm:max-w-lg bg-white border-[#E2E2E0] rounded-2xl"
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold text-[#0F0F0F]">
            {isEdit ? "Edit Service" : "New Service"}
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2">
            <StepDot active={step === 1} label="1" />
            <span className={`text-xs ${step === 1 ? "text-[#0F0F0F] font-medium" : "text-[#9A9A9A]"}`}>Basics</span>
            <div className="h-px w-4 bg-[#E2E2E0]" />
            <StepDot active={step === 2} label="2" />
            <span className={`text-xs ${step === 2 ? "text-[#0F0F0F] font-medium" : "text-[#9A9A9A]"}`}>Details</span>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pt-4 pb-4">
          {step === 1 ? (
            <Step1
              form={form}
              set={set}
              slaOk={slaOk}
              toggleRequireFundTransfer={toggleRequireFundTransfer}
            />
          ) : (
            <Step2
              form={form}
              set={set}
              updateDeliverableField={updateDeliverableField}
              updateRequirementsField={updateRequirementsField}
            />
          )}
        </div>

        {/* Footer — stays pinned below scrollable body */}
        <div className="shrink-0 flex items-center justify-between border-t border-[#E2E2E0] bg-white px-6 py-4">
          <div>
            {isEdit && onDelete && step === 1 && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-xs text-[#9A9A9A] transition-colors hover:text-[#0F0F0F] cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F0F] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!schemaFieldsValid}
                title={!schemaFieldsValid ? "Fix invalid field names first" : undefined}
                className="rounded-full bg-[#0F0F0F] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {isEdit ? "Save" : "Add Service"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Step Dot ──────────────────────────────────── */

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
        active
          ? "bg-[#0F0F0F] text-white"
          : "bg-[#F5F5F3] text-[#9A9A9A]"
      }`}
    >
      {label}
    </div>
  );
}

/* ── Step 1: Details ───────────────────────────── */

function Step1({
  form,
  set,
  slaOk,
  toggleRequireFundTransfer,
}: {
  form: ServiceFormData;
  set: <K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) => void;
  slaOk: boolean;
  toggleRequireFundTransfer: () => void;
}) {
  return (
    <div className="space-y-4">
      <FieldRow label="Service Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Daily Whale Alert Report"
          className="h-10 w-full rounded-xl border border-[#E2E2E0] bg-white px-3 text-sm text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all"
        />
      </FieldRow>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#6B6B6B]">Require Fund Transfer</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#9A9A9A]">
            Buyer must transfer principal funds (e.g. swap, bridge, lend). Enables percentage-based pricing.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.requireFundTransfer}
          onClick={toggleRequireFundTransfer}
          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
            form.requireFundTransfer ? "bg-[#6EE646]" : "bg-[#E2E2E0]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              form.requireFundTransfer ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>

      <FieldRow label="Price">
        <div className="space-y-2">
          {form.requireFundTransfer && (
            <div className="inline-flex rounded-lg border border-[#E2E2E0] bg-[#F5F5F3] p-0.5 text-xs">
              {([
                { value: "flat", label: "Flat fee" },
                { value: "percentage", label: "Percentage" },
              ] as const).map((option) => {
                const active = form.priceModel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set("priceModel", option.value)}
                    className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                      active
                        ? "bg-white font-medium text-[#0F0F0F] shadow-sm"
                        : "text-[#9A9A9A] hover:text-[#0F0F0F]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}

          {form.requireFundTransfer && form.priceModel === "percentage" ? (
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.feePercentage}
                onChange={(e) => set("feePercentage", e.target.value)}
                placeholder="2.5"
                className="h-10 w-full rounded-xl border border-[#E2E2E0] bg-white pl-3 pr-9 text-sm font-mono text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9A9A9A]">%</span>
            </div>
          ) : (
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
                className="h-10 w-full rounded-xl border border-[#E2E2E0] bg-white pl-3 pr-14 text-sm font-mono text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#9A9A9A]">
                USDC
              </span>
            </div>
          )}

          {form.requireFundTransfer && (
            <p className="text-[11px] leading-relaxed text-[#9A9A9A]">
              {form.priceModel === "percentage"
                ? "Provider receives this percentage of the buyer's transfer amount as the fee."
                : "Buyer pays this fixed fee in addition to the principal they transfer."}
            </p>
          )}
        </div>
      </FieldRow>

      <FieldRow label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe what this service provides..."
          rows={3}
          className="w-full rounded-xl border border-[#E2E2E0] bg-white px-3 py-2.5 text-sm text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all resize-none"
        />
      </FieldRow>

      <FieldRow label="SLA (Service Level Agreement)">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              max={String(SLA_HOURS_MAX)}
              value={form.slaHours}
              onChange={(e) => set("slaHours", clampIntString(e.target.value, 0, SLA_HOURS_MAX))}
              className="h-10 w-16 rounded-xl border border-[#E2E2E0] bg-white px-3 text-center text-sm font-mono text-[#0F0F0F] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all"
            />
            <span className="text-xs text-[#9A9A9A]">hr</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              max={String(SLA_MINUTES_MAX)}
              value={form.slaMinutes}
              onChange={(e) => set("slaMinutes", clampIntString(e.target.value, 0, SLA_MINUTES_MAX))}
              className="h-10 w-16 rounded-xl border border-[#E2E2E0] bg-white px-3 text-center text-sm font-mono text-[#0F0F0F] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all"
            />
            <span className="text-xs text-[#9A9A9A]">min</span>
          </div>
        </div>
        {!slaOk && (
          <p className="mt-1 text-[10px] text-red-500">Total SLA must be at least 5 minutes.</p>
        )}
      </FieldRow>
    </div>
  );
}

/* ── Step 2: Deliverable & Requirements ────────── */

function Step2({
  form,
  set,
  updateDeliverableField,
  updateRequirementsField,
}: {
  form: ServiceFormData;
  set: <K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) => void;
  updateDeliverableField: (idx: number, patch: Partial<SchemaField>) => void;
  updateRequirementsField: (idx: number, patch: Partial<SchemaField>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Deliverable */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="h-px w-4 bg-[#6EE646]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Deliverable</span>
        </div>
        <TypeToggle
          value={form.deliverableType}
          onChange={(v) => set("deliverableType", v)}
        />
        {form.deliverableType === "text" ? (
          <textarea
            value={form.deliverableText}
            onChange={(e) => set("deliverableText", e.target.value)}
            placeholder="Describe what will be delivered..."
            rows={2}
            className="mt-2 w-full rounded-lg border border-[#E2E2E0] bg-white px-3 py-2 text-sm text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all resize-none"
          />
        ) : (
          <SchemaBuilder
            fields={form.deliverableSchema}
            onAdd={() => set("deliverableSchema", [...form.deliverableSchema, newField()])}
            onRemove={(idx) => set("deliverableSchema", form.deliverableSchema.filter((_, i) => i !== idx))}
            onUpdate={updateDeliverableField}
          />
        )}
      </div>

      {/* Requirements */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="h-px w-4 bg-[#6EE646]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Requirements</span>
        </div>
        <TypeToggle
          value={form.requirementsType}
          onChange={(v) => set("requirementsType", v)}
        />
        {form.requirementsType === "text" ? (
          <textarea
            value={form.requirementsText}
            onChange={(e) => set("requirementsText", e.target.value)}
            placeholder="Describe what the buyer needs to provide..."
            rows={2}
            className="mt-2 w-full rounded-lg border border-[#E2E2E0] bg-white px-3 py-2 text-sm text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/20 transition-all resize-none"
          />
        ) : (
          <SchemaBuilder
            fields={form.requirementsSchema}
            onAdd={() => set("requirementsSchema", [...form.requirementsSchema, newField()])}
            onRemove={(idx) => set("requirementsSchema", form.requirementsSchema.filter((_, i) => i !== idx))}
            onUpdate={updateRequirementsField}
          />
        )}
      </div>
    </div>
  );
}

/* ── Type Toggle ───────────────────────────────── */

function TypeToggle({
  value,
  onChange,
}: {
  value: "text" | "schema";
  onChange: (v: "text" | "schema") => void;
}) {
  return (
    <div className="flex gap-2 mb-3">
      {(["text", "schema"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
            value === t
              ? "bg-[#0F0F0F] text-white"
              : "border border-[#E2E2E0] bg-white text-[#9A9A9A] hover:text-[#0F0F0F]"
          }`}
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

/* ── Schema Builder ────────────────────────────── */

function SchemaBuilder({
  fields,
  onAdd,
  onRemove,
  onUpdate,
}: {
  fields: SchemaField[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<SchemaField>) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleTypeChange = (idx: number, type: SchemaField["type"]) => {
    if (type === "array") {
      onUpdate(idx, { type, itemType: "string", fields: [] });
    } else if (type === "object") {
      onUpdate(idx, { type, itemType: undefined, fields: [] });
    } else {
      onUpdate(idx, { type, itemType: undefined, fields: [] });
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {fields.map((field, idx) => {
        const isObject = field.type === "object";
        const isExpanded = expanded[idx] ?? false;
        const subFields = field.fields ?? [];

        const nameValid = isValidFieldName(field.name);

        return (
          <div key={idx} className="rounded-lg border border-[#E2E2E0] bg-white pl-1.5 pr-2 py-2 space-y-1.5">
            {/* Top-level field row: chevron + name (with inline format) + type + required + delete */}
            <div className="flex items-center gap-1">
              {/* Expand toggle for object only */}
              <button
                onClick={() => isObject && toggleExpand(idx)}
                className={`shrink-0 transition-colors ${isObject ? "text-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer" : "text-transparent cursor-default"}`}
                tabIndex={isObject ? 0 : -1}
              >
                <ChevronRight
                  className={`h-3 w-3 transition-transform duration-150 ${isObject && isExpanded ? "rotate-90" : ""}`}
                />
              </button>
              {/* Name + inline format compound input */}
              <div
                className={`flex h-8 flex-1 min-w-0 items-stretch rounded-lg border bg-white overflow-hidden focus-within:border-[#6EE646] transition-all ${
                  nameValid ? "border-[#E2E2E0]" : "border-red-400"
                }`}
              >
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => onUpdate(idx, { name: e.target.value })}
                  placeholder="fieldName or field_name"
                  className="h-full flex-1 min-w-0 bg-transparent px-2 text-xs font-mono text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:outline-none"
                />
                {field.type === "string" && (
                  <>
                    <span className="self-center h-4 w-px bg-[#E2E2E0] shrink-0" />
                    <select
                      value={field.stringSubtype ?? "plain"}
                      onChange={(e) => onUpdate(idx, { stringSubtype: e.target.value as NonNullable<SchemaField["stringSubtype"]> })}
                      className="h-full bg-[#FAFAF9] px-1.5 text-[10px] text-[#6B6B6B] focus:outline-none cursor-pointer shrink-0"
                      title="Format"
                    >
                      {STRING_SUBTYPES.map((s) => (
                        <option key={s} value={s}>
                          {s === "plain" ? "plain" : s === "url" ? "url" : "address"}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {field.type === "array" && (
                  <>
                    <span className="self-center h-4 w-px bg-[#E2E2E0] shrink-0" />
                    <select
                      value={field.itemType ?? "string"}
                      onChange={(e) => onUpdate(idx, { itemType: e.target.value as NonNullable<SchemaField["itemType"]> })}
                      className="h-full bg-[#FAFAF9] px-1.5 text-[10px] text-[#6B6B6B] focus:outline-none cursor-pointer shrink-0"
                      title="Element type"
                    >
                      {SUB_FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>of {t}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <select
                value={field.type}
                onChange={(e) => handleTypeChange(idx, e.target.value as SchemaField["type"])}
                className="h-8 rounded-lg border border-[#E2E2E0] bg-white px-1.5 text-xs text-[#0F0F0F] focus:border-[#6EE646] focus:outline-none transition-all cursor-pointer"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-[#9A9A9A] cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onUpdate(idx, { required: e.target.checked })}
                  className="rounded border-[#E2E2E0] accent-[#6EE646]"
                />
                Req
              </label>
              <button
                onClick={() => onRemove(idx)}
                className="text-[#C4C4C2] transition-colors hover:text-red-500 cursor-pointer shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Name validation error — only when invalid AND not empty */}
            {field.name && !nameValid && (
              <p className="text-[10px] text-red-500 pl-4">
                Use camelCase (fieldName) or snake_case (field_name) — letters, digits, and underscores only.
              </p>
            )}

            {/* Description input */}
            <input
              type="text"
              value={field.description ?? ""}
              onChange={(e) => onUpdate(idx, { description: e.target.value })}
              placeholder="Description (shown to buyer)"
              className="ml-4 h-7 w-[calc(100%-1rem)] rounded-lg border border-[#E2E2E0] bg-white px-2 text-[11px] text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:border-[#6EE646] focus:outline-none transition-all"
            />

            {/* Sub-fields (one level deep, object only) */}
            {isObject && isExpanded && (
              <div className="ml-5 mt-1.5 space-y-1.5 border-l-2 border-[#E2E2E0] pl-3">
                {subFields.map((sub, subIdx) => (
                  <div key={subIdx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={sub.name}
                      onChange={(e) => {
                        const updated = subFields.map((s, i) =>
                          i === subIdx ? { ...s, name: e.target.value } : s
                        );
                        onUpdate(idx, { fields: updated });
                      }}
                      placeholder="fieldName or field_name"
                      className={`h-7 flex-1 rounded-lg border bg-[#FAFAF9] px-2.5 text-xs font-mono text-[#0F0F0F] placeholder:text-[#C4C4C2] focus:outline-none transition-all ${
                        isValidFieldName(sub.name)
                          ? "border-[#E2E2E0] focus:border-[#6EE646]"
                          : "border-red-400 focus:border-red-500"
                      }`}
                    />
                    <select
                      value={sub.type}
                      onChange={(e) => {
                        const updated = subFields.map((s, i) =>
                          i === subIdx ? { ...s, type: e.target.value as SchemaField["type"] } : s
                        );
                        onUpdate(idx, { fields: updated });
                      }}
                      className="h-7 rounded-lg border border-[#E2E2E0] bg-[#FAFAF9] px-2 text-xs text-[#0F0F0F] focus:border-[#6EE646] focus:outline-none transition-all cursor-pointer"
                    >
                      {SUB_FIELD_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-[#9A9A9A] cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={sub.required}
                        onChange={(e) => {
                          const updated = subFields.map((s, i) =>
                            i === subIdx ? { ...s, required: e.target.checked } : s
                          );
                          onUpdate(idx, { fields: updated });
                        }}
                        className="rounded border-[#E2E2E0] accent-[#6EE646]"
                      />
                      Req
                    </label>
                    <button
                      onClick={() => onUpdate(idx, { fields: subFields.filter((_, i) => i !== subIdx) })}
                      className="text-[#C4C4C2] transition-colors hover:text-red-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    onUpdate(idx, {
                      fields: [...subFields, { name: "", type: "string", required: true }],
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#9A9A9A] transition-colors hover:text-[#0F0F0F] cursor-pointer"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add Sub-field
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-xs text-[#9A9A9A] transition-colors hover:text-[#0F0F0F] cursor-pointer"
      >
        <Plus className="h-3 w-3" />
        Add Field
      </button>
    </div>
  );
}
