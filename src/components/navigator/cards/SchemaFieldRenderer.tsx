"use client";

import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import type { SchemaField } from "@/types/navigator";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export type FormShape = Record<string, unknown>;
export type FormSchema = z.ZodType<FormShape, FormShape>;

export function buildSchemaFor(fields: SchemaField[]): FormSchema {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case "string":
        schema = z.string();
        if (field.required) {
          schema = (schema as z.ZodString).min(1, `${field.label} is required`);
        }
        break;
      case "url":
        schema = z
          .string()
          .regex(/^https?:\/\//i, `${field.label} must start with http(s)://`);
        if (field.required) {
          schema = (schema as z.ZodString).min(1, `${field.label} is required`);
        }
        break;
      case "address":
        schema = z
          .string()
          .regex(ADDRESS_REGEX, `${field.label} must be a 0x-prefixed EVM address`);
        if (field.required) {
          schema = (schema as z.ZodString).min(1, `${field.label} is required`);
        }
        break;
      case "number":
        schema = z.coerce
          .number({ message: `${field.label} must be a number` })
          .nonnegative({ message: `${field.label} must be ≥ 0` });
        break;
      case "bool":
        schema = z.boolean();
        break;
      case "object":
      case "array":
        schema = z.unknown();
        break;
      default:
        schema = z.unknown();
    }

    if (!field.required && field.type !== "bool") {
      schema = z.union([z.literal(""), schema]);
    }

    shape[field.key] = schema;
  }

  return z.object(shape) as unknown as FormSchema;
}

export function defaultsFor(fields: SchemaField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field.key] = field.type === "bool" ? false : "";
  }
  return out;
}

export function pruneOptionalEmpty(
  values: Record<string, unknown>,
  fields: SchemaField[],
): Record<string, unknown> {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      const field = byKey.get(key);
      if (!field) return true;
      if (field.required) return true;
      if (field.type === "bool") return true;
      return value !== "" && value !== null && value !== undefined;
    }),
  );
}

export interface SchemaFieldRendererProps {
  field: SchemaField;
}

export function SchemaFieldRenderer({ field }: SchemaFieldRendererProps) {
  const { control, formState } = useFormContext();
  const error = formState.errors[field.key]?.message as string | undefined;

  if (field.type === "object" || field.type === "array") {
    return (
      <div className="rounded-lg border border-dashed border-[#E2E2E0] bg-[#FAFAF9] px-3 py-2 text-[10px] text-[#9A9A9A] font-mono">
        {field.label} ({field.type}) — not yet supported in V2
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[#3A3A3A]">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
        {field.description && (
          <span className="text-[#9A9A9A] font-normal ml-1.5">
            — {field.description}
          </span>
        )}
      </label>

      <Controller
        control={control}
        name={field.key}
        render={({ field: rhfField }) => {
          if (field.type === "bool") {
            return (
              <div className="flex items-center gap-4">
                {([true, false] as const).map((val) => (
                  <label
                    key={String(val)}
                    className="flex items-center gap-1.5 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                  >
                    <input
                      type="radio"
                      name={field.key}
                      checked={rhfField.value === val}
                      onChange={() => rhfField.onChange(val)}
                      className="accent-[#0F0F0F] w-3 h-3 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-[#3A3A3A]">
                      {val ? "True" : "False"}
                    </span>
                  </label>
                ))}
              </div>
            );
          }

          const adornment =
            field.type === "address"
              ? "EVM Address"
              : field.type === "url"
                ? "URL"
                : null;

          const isNumber = field.type === "number";

          return (
            <div className="relative">
              <input
                type={isNumber ? "number" : "text"}
                placeholder={field.placeholder}
                value={(rhfField.value as string | number | undefined) ?? ""}
                onChange={(e) => rhfField.onChange(e.target.value)}
                onBlur={rhfField.onBlur}
                ref={rhfField.ref}
                min={isNumber ? 0 : undefined}
                inputMode={isNumber ? "decimal" : undefined}
                onKeyDown={
                  isNumber
                    ? (e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "E") {
                          e.preventDefault();
                        }
                      }
                    : undefined
                }
                onPaste={
                  isNumber
                    ? (e) => {
                        const text = e.clipboardData.getData("text");
                        if (/[-eE]/.test(text)) e.preventDefault();
                      }
                    : undefined
                }
                className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-[#0F0F0F] placeholder:text-[#CACAC8] font-mono disabled:bg-[#F5F5F3] disabled:text-[#9A9A9A] disabled:border-[#EBEBEA] disabled:cursor-not-allowed disabled:placeholder:text-[#CACAC8] ${
                  adornment ? "pr-24" : ""
                } ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
                    : "border-[#E2E2E0] focus:border-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#0F0F0F]/20"
                }`}
              />
              {adornment && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9A9A9A] pointer-events-none font-sans">
                  {adornment}
                </span>
              )}
            </div>
          );
        }}
      />

      {error && (
        <p className="text-[10px] text-red-500 leading-tight">{error}</p>
      )}
    </div>
  );
}
