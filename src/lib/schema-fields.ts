import type { SchemaField } from "@/lib/mock-data";

function jsonSchemaType(value: unknown): SchemaField["type"] {
  if (value === "number" || value === "integer") return "number";
  if (value === "boolean") return "boolean";
  if (value === "array") return "array";
  if (value === "object") return "object";
  return "string";
}

/** Convert a JSON Schema object (`{ type, properties, required }`) into FieldDef rows. */
function jsonSchemaToFields(schema: Record<string, unknown>): SchemaField[] | undefined {
  const props = schema.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return undefined;
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name): name is string => typeof name === "string")
      : [],
  );
  const fields: SchemaField[] = [];
  for (const [name, spec] of Object.entries(props as Record<string, unknown>)) {
    const s =
      spec && typeof spec === "object" && !Array.isArray(spec)
        ? (spec as Record<string, unknown>)
        : {};
    const type = jsonSchemaType(s.type);
    const field: SchemaField = { name, type, required: required.has(name) };
    if (typeof s.description === "string" && s.description.trim()) {
      field.description = s.description.trim();
    }
    if (type === "array") {
      const items =
        s.items && typeof s.items === "object" && !Array.isArray(s.items)
          ? (s.items as Record<string, unknown>)
          : {};
      const itemType = jsonSchemaType(items.type);
      if (itemType === "string" || itemType === "number" || itemType === "boolean") {
        field.itemType = itemType;
      }
    }
    fields.push(field);
  }
  return fields.length ? fields : undefined;
}

/**
 * Parse backend schema blobs. Public BSC MCP tools send a JSON Schema object
 * string; Base FieldDef[] arrays are still accepted.
 */
export function parseSchemaFields(raw: string | undefined): SchemaField[] | undefined {
  const t = (raw ?? "").trim();
  if (!t || t === "[]" || t === "{}") return undefined;
  try {
    const v = JSON.parse(t) as unknown;
    if (Array.isArray(v)) return v.length ? (v as SchemaField[]) : undefined;
    if (v && typeof v === "object") return jsonSchemaToFields(v as Record<string, unknown>);
    return undefined;
  } catch {
    return undefined;
  }
}

/** Human-readable type label for public service cards. */
export function schemaFieldTypeLabel(f: SchemaField): string {
  if (f.type === "array" && f.itemType) {
    return `${f.itemType}[]`;
  }
  return f.type;
}
