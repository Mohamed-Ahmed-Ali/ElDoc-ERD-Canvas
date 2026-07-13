import { useState } from "react";
import { GripVertical, Settings } from "lucide-react";
import type { SchemaField, MeasureType } from "@mc/okf";
import { InfoTip } from "./InfoTip";

// canonical ElDoc schema types — the set accepted across storages (BigQuery,
// snowflake, …). Note: no DATETIME (not in the cross-storage enum).
const FIELD_TYPES = [
  "STRING",
  "INTEGER",
  "FLOAT",
  "NUMERIC",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "BYTES",
  "GEOGRAPHY",
  "VARIANT",
];

const MEASURE_TYPES: { value: MeasureType; label: string }[] = [
  { value: "additive", label: "Additive" },
  { value: "semi-additive", label: "Semi-additive" },
  { value: "non-additive", label: "Non-additive" },
];

interface SchemaEditorProps {
  nodeType: "mart" | "bridge" | "group";
  schema: SchemaField[];
  onChange: (schema: SchemaField[]) => void;
}

export function SchemaEditor({ nodeType, schema, onChange }: SchemaEditorProps) {
  // row being dragged and the row it's hovering over — for reordering fields.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // which row's advanced panel is expanded
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function updateField(i: number, patch: Partial<SchemaField>) {
    onChange(schema.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i: number) {
    if (expandedIdx === i) setExpandedIdx(null);
    else if (expandedIdx && expandedIdx > i) setExpandedIdx(expandedIdx - 1);
    onChange(schema.filter((_, idx) => idx !== i));
  }

  function addField() {
    onChange([
      ...schema,
      { name: "", type: "STRING", role: "none", keyType: "attribute", isComposite: false },
    ]);
  }

  // move a field from one position to another, preserving the order of the rest.
  function moveField(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = schema.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    // fix expandedIdx if it was moved
    if (expandedIdx === from) setExpandedIdx(to);
    else if (expandedIdx !== null) {
      if (from < expandedIdx && to >= expandedIdx) setExpandedIdx(expandedIdx - 1);
      else if (from > expandedIdx && to <= expandedIdx) setExpandedIdx(expandedIdx + 1);
    }

    onChange(next);
  }

  const cols =
    "16px minmax(100px,1.2fr) 85px 65px 115px 35px 95px minmax(80px,1fr) minmax(110px,1.3fr) 24px 22px";
  const inputCls =
    "w-full text-[12.5px] px-[7px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]";

  return (
    <div className="border border-[#d8dee8] rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Header */}
          <div
            className="grid bg-[#f8fafc] px-[10px] py-[7px] text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.3px] border-b border-[#d8dee8] gap-[6px]"
            style={{ gridTemplateColumns: cols }}
          >
            <span />
            <span>Name</span>
            <span>Type</span>
            <span className="flex items-center gap-[3px]">
              Role <InfoTip text="PK, FK, AK, or None." />
            </span>
            <span className="flex items-center gap-[3px]">
              Key Type <InfoTip text="Attribute, Business Key, or Surrogate (Seq/UUID/Hash)." />
            </span>
            <span className="flex items-center gap-[3px]">
              PII{" "}
              <InfoTip text="Personally Identifiable Information (e.g. emails, phone numbers). Flags sensitive columns." />
            </span>
            <span className="flex items-center gap-[3px]">
              <InfoTip text="Mark as a measure (metric). Then choose how it aggregates." />
              <span className="leading-none">Msr</span>
            </span>
            <span className="flex items-center gap-[3px]">
              Alias <InfoTip text="Business-friendly label for the field." />
            </span>
            <span className="flex items-center gap-[3px]">
              Description{" "}
              <InfoTip text="What the field means and, for metrics, how it's calculated." />
            </span>
            <span />
            <span />
          </div>

          {/* Rows — drag the grip handle to reorder */}
          {schema.map((field, i) => (
            <div
              key={i}
              className={`border-b border-[#eef1f5] last:border-b-0 transition-colors ${dragIdx === i ? "opacity-40" : ""} ${overIdx === i && dragIdx !== null && dragIdx !== i ? "bg-[#e6f1fb]" : ""}`}
            >
              <div
                onDragOver={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  if (overIdx !== i) setOverIdx(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) moveField(dragIdx, i);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className="grid items-center gap-[6px] px-[10px] py-[6px]"
                style={{ gridTemplateColumns: cols }}
              >
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  title="Drag to reorder"
                  className="flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={13} />
                </span>

                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  placeholder="field name"
                  className={inputCls}
                />

                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value })}
                  className="w-full text-[11.5px] px-[6px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={field.role ?? "none"}
                  onChange={(e) => {
                    const role = e.target.value as SchemaField["role"];
                    let patch: Partial<SchemaField> = { role };
                    if (role === "pk") {
                      patch.keyType = nodeType === "bridge" ? "businessKey" : "surrogateSequence";
                    } else if (role === "none") {
                      patch.keyType = "attribute";
                      patch.isComposite = false;
                      patch.compositeGroup = null;
                    }
                    updateField(i, patch);
                  }}
                  className="w-full text-[11px] px-[4px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
                >
                  <option value="none">None</option>
                  <option value="pk">PK</option>
                  <option value="fk">FK</option>
                  <option value="ak">AK</option>
                </select>

                <select
                  value={field.keyType ?? "attribute"}
                  onChange={(e) =>
                    updateField(i, { keyType: e.target.value as SchemaField["keyType"] })
                  }
                  className="w-full text-[11px] px-[4px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
                >
                  <option value="attribute">Attribute</option>
                  <option value="businessKey">Business Key</option>
                  <option value="surrogateSequence">Surrogate (Seq)</option>
                  <option value="surrogateUuid">Surrogate (UUID)</option>
                  <option value="surrogateHash">Surrogate (Hash)</option>
                </select>

                <input
                  type="checkbox"
                  checked={field.pii ?? false}
                  onChange={(e) => updateField(i, { pii: e.target.checked })}
                  title="PII"
                  className="w-4 h-4 mx-auto block cursor-pointer accent-red-500"
                />

                <select
                  value={field.isMeasure ? (field.measureType ?? "additive") : "none"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "none") {
                      updateField(i, { isMeasure: false, measureType: undefined });
                    } else {
                      updateField(i, { isMeasure: true, measureType: val as MeasureType });
                    }
                  }}
                  className="w-full text-[11px] px-[4px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
                  title="Measure aggregation type"
                >
                  <option value="none">None</option>
                  {MEASURE_TYPES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={field.alias ?? ""}
                  onChange={(e) => updateField(i, { alias: e.target.value || undefined })}
                  placeholder="alias"
                  className={inputCls}
                />

                <input
                  type="text"
                  value={field.description ?? ""}
                  onChange={(e) => updateField(i, { description: e.target.value || undefined })}
                  placeholder="description"
                  className={inputCls}
                />

                <button
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  title="Advanced Settings"
                  className={`border-none bg-transparent cursor-pointer p-[2px] rounded hover:bg-[#eef1f5] flex items-center justify-center transition-colors ${expandedIdx === i ? "text-[#1e88e5]" : "text-slate-400"}`}
                >
                  <Settings size={14} />
                </button>

                <button
                  onClick={() => removeField(i)}
                  title="Remove field"
                  className="border-none bg-transparent text-slate-300 cursor-pointer text-[15px] p-0 hover:text-[#ef4444] flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              {/* Advanced Panel */}
              {expandedIdx === i && (
                <div className="bg-[#f8fafc] px-[36px] py-[12px] border-t border-[#eef1f5] flex flex-wrap gap-6 shadow-inner">
                  {/* Composite Key */}
                  <div className="flex flex-col gap-1 w-[200px]">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Composite Key
                    </label>
                    <div className="flex items-center gap-2 mt-1 mb-1">
                      <input
                        type="checkbox"
                        checked={field.isComposite ?? false}
                        onChange={(e) =>
                          updateField(i, {
                            isComposite: e.target.checked,
                            compositeGroup: e.target.checked ? field.compositeGroup || "" : null,
                          })
                        }
                        className="accent-[#1e88e5] w-[14px] h-[14px] cursor-pointer"
                      />
                      <span className="text-[12px] text-slate-700">Part of a composite key</span>
                    </div>
                    {field.isComposite && (
                      <input
                        type="text"
                        placeholder="Group Name (e.g. loc_bk)"
                        value={field.compositeGroup ?? ""}
                        onChange={(e) => updateField(i, { compositeGroup: e.target.value })}
                        className={inputCls}
                      />
                    )}
                  </div>

                  {/* Hash Config */}
                  {field.keyType === "surrogateHash" && (
                    <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Hash Configuration
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="Source Columns (comma sep)"
                          value={field.hashConfig?.sourceColumns?.join(", ") ?? ""}
                          onChange={(e) => {
                            const cols = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            updateField(i, {
                              hashConfig: {
                                ...(field.hashConfig || { algorithm: "md5", delimiter: "|" }),
                                sourceColumns: cols,
                              },
                            });
                          }}
                          className={inputCls}
                          title="Source Columns"
                        />
                        <select
                          value={field.hashConfig?.algorithm ?? "md5"}
                          onChange={(e) =>
                            updateField(i, {
                              hashConfig: {
                                ...(field.hashConfig || { sourceColumns: [], delimiter: "|" }),
                                algorithm: e.target.value as any,
                              },
                            })
                          }
                          className={inputCls}
                        >
                          <option value="md5">MD5</option>
                          <option value="sha1">SHA1</option>
                          <option value="sha256">SHA256</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Delimiter (e.g. |)"
                          value={field.hashConfig?.delimiter ?? ""}
                          onChange={(e) =>
                            updateField(i, {
                              hashConfig: {
                                ...(field.hashConfig || { sourceColumns: [], algorithm: "md5" }),
                                delimiter: e.target.value,
                              },
                            })
                          }
                          className={inputCls}
                          title="Delimiter"
                        />
                        <input
                          type="text"
                          placeholder="Prefix / Salt (Optional)"
                          value={field.hashConfig?.prefix ?? ""}
                          onChange={(e) =>
                            updateField(i, {
                              hashConfig: {
                                ...(field.hashConfig || {
                                  sourceColumns: [],
                                  algorithm: "md5",
                                  delimiter: "|",
                                }),
                                prefix: e.target.value,
                              },
                            })
                          }
                          className={inputCls}
                          title="Prefix / Salt"
                        />
                      </div>
                    </div>
                  )}

                  {/* Foreign Key Target */}
                  {field.role === "fk" && (
                    <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Foreign Key Target
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="Target Table"
                          value={field.foreignKeyRef?.targetTable ?? ""}
                          onChange={(e) =>
                            updateField(i, {
                              foreignKeyRef: {
                                targetTable: e.target.value,
                                targetColumn: field.foreignKeyRef?.targetColumn ?? "",
                              },
                            })
                          }
                          className={inputCls}
                        />
                        <input
                          type="text"
                          placeholder="Target Column"
                          value={field.foreignKeyRef?.targetColumn ?? ""}
                          onChange={(e) =>
                            updateField(i, {
                              foreignKeyRef: {
                                targetTable: field.foreignKeyRef?.targetTable ?? "",
                                targetColumn: e.target.value,
                              },
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}
                  {/* Additional Constraints */}
                  <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      SQL Constraints
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Default Value (e.g. CURRENT_DATE)"
                        value={field.defaultValue ?? ""}
                        onChange={(e) =>
                          updateField(i, { defaultValue: e.target.value || undefined })
                        }
                        className={inputCls}
                        title="Default Value"
                      />
                      <input
                        type="text"
                        placeholder="Check Expression (e.g. amount > 0)"
                        value={field.checkExpression ?? ""}
                        onChange={(e) =>
                          updateField(i, { checkExpression: e.target.value || undefined })
                        }
                        className={inputCls}
                        title="Check Expression"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        checked={field.unique ?? false}
                        onChange={(e) => updateField(i, { unique: e.target.checked })}
                        className="accent-[#1e88e5] w-[14px] h-[14px] cursor-pointer"
                        id={`unique-${i}`}
                      />
                      <label
                        htmlFor={`unique-${i}`}
                        className="text-[12px] text-slate-700 cursor-pointer"
                      >
                        Unique Constraint
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add field */}
      <button
        onClick={addField}
        className="w-full border-none bg-white px-2 py-[8px] text-[12.5px] font-semibold text-[#1e88e5] cursor-pointer hover:bg-[#f8fafc] transition-colors border-t border-[#eef1f5]"
      >
        + Add field
      </button>
    </div>
  );
}
