export type ViewMode = "physical" | "logical" | "compact";

export const VIEW_CONFIG = {
  physical: {
    label: "Physical",
    nodeHeader: "key" as const,
    fieldName: "name" as const,
    showType: "physical" as const,
    showKeys: true,
    showIndexes: true,
    editableFields: false,
    nodeWidth: 250,
  },
  logical: {
    label: "Logical",
    nodeHeader: "title" as const,
    fieldName: "alias" as const,
    showType: "business" as const,
    showKeys: true,
    showIndexes: false,
    editableFields: true,
    nodeWidth: 250,
  },
  compact: {
    label: "Compact",
    nodeHeader: "title" as const,
    fieldName: "name" as const,
    showType: "none" as const,
    showKeys: false,
    showIndexes: false,
    editableFields: false,
    nodeWidth: 200,
  },
};

const KEY = "mc.viewMode.v2";

export function loadViewMode(): ViewMode {
  try {
    const val = localStorage.getItem(KEY);
    if (val === "physical" || val === "logical" || val === "compact") return val;
    return "physical";
  } catch {
    return "physical";
  }
}

export function persistViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // best-effort
  }
}

export function toBusinessType(dbType: string): string {
  const t = dbType.toUpperCase();
  if (t.includes("VARCHAR") || t.includes("STRING") || t.includes("TEXT") || t.includes("CHAR"))
    return "Text";
  if (
    t.includes("INT") ||
    t.includes("FLOAT") ||
    t.includes("NUMERIC") ||
    t.includes("DECIMAL") ||
    t.includes("DOUBLE") ||
    t.includes("REAL")
  ) {
    if (t.includes("DECIMAL") || t.includes("NUMERIC")) return "Decimal";
    return "Number";
  }
  if (t.includes("DATE") && !t.includes("DATETIME")) return "Date";
  if (t.includes("TIME") || t.includes("TIMESTAMP")) return "Time";
  if (t.includes("BOOL")) return "Boolean";
  if (t.includes("JSON") || t.includes("VARIANT") || t.includes("STRUCT") || t.includes("ARRAY"))
    return "Object";
  if (t.includes("BYTES") || t.includes("BLOB")) return "Binary";
  if (t.includes("GEOGRAPHY") || t.includes("GEOMETRY")) return "Geo";
  return "Unknown";
}
