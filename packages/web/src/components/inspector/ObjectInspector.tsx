import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ModelNode, InputSource, SchemaField, TagEntry } from "@mc/okf";
import { SchemaEditor } from "./SchemaEditor";
import { InfoTip } from "./InfoTip";
import { InputSourceIcon, OutputSchemaIcon } from "../../lib/icons";

const INPUT_SOURCES: InputSource[] = ["SQL", "CONNECTOR", "VIEW", "TABLE"];

const NODE_TYPE_OPTIONS: { value: "mart" | "bridge"; label: string; hint: string }[] = [
  { value: "mart", label: "Mart", hint: "Standard dimension or fact table." },
  {
    value: "bridge",
    label: "Bridge",
    hint: "Factless-fact / bridge table. Resolves an N:N relationship between two dimensions (only FK columns, no measures).",
  },
];

const DEFINITION_HINT: Record<InputSource, { label: string; placeholder: string }> = {
  SQL: { label: "SQL query", placeholder: "SELECT … FROM `project.dataset.table`" },
  VIEW: { label: "View reference", placeholder: "project.dataset.view" },
  TABLE: { label: "Table reference", placeholder: "project.dataset.table" },
  CONNECTOR: { label: "Connector details", placeholder: "Configured after creation" },
};

function usDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ObjectInspectorProps {
  node: ModelNode;
  nodes?: ModelNode[];
  tags?: TagEntry[];
  onUpdate: (patch: Partial<ModelNode>) => void;
}

export function ObjectInspector({ node, nodes = [], tags = [], onUpdate }: ObjectInspectorProps) {
  if (node.type === "group") {
    return (
      <div className="flex flex-col gap-[15px]">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
            Group Title
          </label>
          <input
            type="text"
            value={node.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
            Color
          </label>
          <input
            type="color"
            value={node.color || "#e2e8f0"}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-full h-[40px] cursor-pointer border border-[#d8dee8] rounded-lg"
          />
        </div>
      </div>
    );
  }

  const isCreated = node.status === "created";
  const [defOpen, setDefOpen] = useState(false);
  // input source / definition / output schema live under a collapsed "Advanced"
  // section so the title and description are visible first.
  const [advOpen, setAdvOpen] = useState(false);
  const defHint = DEFINITION_HINT[node.inputSource];

  const statusClass = isCreated ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#f1f5f9] text-[#475569]";
  const statusText = isCreated ? `✓ Created` : "◷ Draft";

  return (
    <div className="flex flex-col gap-[15px]">
      {/* Status pill */}
      <div
        className={`text-[12px] px-[11px] py-[9px] rounded-lg flex items-center gap-2 ${statusClass}`}
      >
        {statusText}
      </div>

      {/* Node type — mart vs bridge (factless-fact) */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Object type
          <InfoTip text="Mart: a standard dimension or fact. Bridge: a factless-fact table that resolves an N:N — two FK columns into the bridged dimensions, no measures." />
        </label>
        <div className="flex gap-2">
          {NODE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              title={opt.hint}
              onClick={() => onUpdate({ type: opt.value })}
              className={`flex-1 text-[12px] font-medium py-[7px] rounded-lg border transition-colors ${
                node.type === opt.value || (opt.value === "mart" && !node.type)
                  ? "bg-[#1e88e5] text-white border-[#1e88e5]"
                  : "border-[#d8dee8] text-slate-600 hover:bg-[#f1f3f7]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {node.type === "bridge" && (
          <p className="mt-[6px] text-[11.5px] text-slate-400 leading-[1.5]">
            Bridge tables should have exactly two FK fields — one into each bridged dimension.
          </p>
        )}
      </div>

      {/* Domain Group Selector */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Domain
        </label>
        <select
          value={node.parentId || ""}
          onChange={(e) => onUpdate({ parentId: e.target.value || undefined })}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        >
          <option value="">None (Root)</option>
          {nodes
            .filter((n) => n.type === "group")
            .map((g) => (
              <option key={g.key} value={g.key}>
                {g.title || "Unnamed Group"}
              </option>
            ))}
        </select>
      </div>

      {/* Namespace */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Namespace
          <InfoTip text="Schema or dataset name (e.g. 'public' or 'analytics')." />
        </label>
        <input
          type="text"
          value={node.namespace ?? ""}
          onChange={(e) => onUpdate({ namespace: e.target.value || undefined })}
          placeholder="optional"
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Title
        </label>
        <input
          type="text"
          value={node.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        />
      </div>

      {/* Description — kept right under the title so the mart reads clearly. */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Description
          <InfoTip text="Plain-language summary of what this object represents. Shown in OKF export and used by the AI to suggest questions." />
        </label>
        <textarea
          value={node.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={3}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 resize-y min-h-[60px] focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Tags
          <InfoTip text="Categorize and filter tables using tags." />
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isActive = node.tags?.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => {
                  const newTags = isActive
                    ? (node.tags || []).filter((t) => t !== tag.id)
                    : [...(node.tags || []), tag.id];
                  onUpdate({ tags: newTags });
                }}
                className={`flex items-center gap-[6px] px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  isActive
                    ? "border-transparent text-white"
                    : "border-[#d8dee8] text-slate-600 hover:bg-[#f1f3f7]"
                }`}
                style={isActive ? { backgroundColor: tag.color } : {}}
              >
                {!isActive && (
                  <div
                    className="w-2 h-2 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </button>
            );
          })}
          {tags.length === 0 && (
            <div className="text-[12px] text-slate-400 italic">
              No tags defined. Create tags in the Selection Pane.
            </div>
          )}
        </div>
      </div>

      {/* Grain — visible on mart and bridge, hidden on group */}
      {(node.type === "mart" || node.type === "bridge" || !node.type) && (
        <div>
          <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
            Grain
            <InfoTip text='One row per … (e.g. "one row per order line"). Documenting grain prevents silent double-counting downstream.' />
          </label>
          <input
            type="text"
            value={node.grain ?? ""}
            onChange={(e) => onUpdate({ grain: e.target.value || undefined })}
            placeholder="one row per …"
            className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
          />
        </div>
      )}

      {/* Advanced — input source, definition and output schema. Collapsed by
          default to keep the panel light; expand to edit the table's plumbing. */}
      <div className="border border-[#d8dee8] rounded-lg overflow-hidden">
        <button
          onClick={() => setAdvOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]"
        >
          {advOpen ? (
            <ChevronDown size={14} className="text-slate-400" />
          ) : (
            <ChevronRight size={14} className="text-slate-400" />
          )}
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] flex-1">
            Advanced
          </span>
          <span className="text-[11px] text-slate-400">input source · schema</span>
        </button>
        {advOpen && (
          <div className="px-3 pb-3 pt-3 border-t border-[#eef1f5] flex flex-col gap-[15px]">
            {/* Input source */}
            <div>
              <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
                <InputSourceIcon size={13} className="text-slate-400" />
                Input source
                <InfoTip text="How this table gets its data. New objects default to SQL; can also be Connector, View or Table." />
              </label>
              <select
                value={node.inputSource}
                onChange={(e) => onUpdate({ inputSource: e.target.value as InputSource })}
                className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
              >
                {INPUT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Definition (collapsible, optional) */}
            <div className="border border-[#d8dee8] rounded-lg overflow-hidden">
              <button
                onClick={() => setDefOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]"
              >
                {defOpen ? (
                  <ChevronDown size={14} className="text-slate-400" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400" />
                )}
                <span className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] flex-1">
                  Definition
                  <InfoTip text="The table's source: a SQL query, or a fully-qualified View/Table reference." />
                </span>
                <span className="text-[11px] text-slate-400">
                  {node.definition?.trim() ? "set" : "optional"}
                </span>
              </button>
              {defOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[#eef1f5]">
                  <label className="block text-[11px] text-slate-500 mb-[5px]">
                    {defHint.label}
                  </label>
                  <textarea
                    value={node.definition ?? ""}
                    onChange={(e) => onUpdate({ definition: e.target.value })}
                    placeholder={defHint.placeholder}
                    rows={4}
                    className="w-full text-[12px] font-mono px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 resize-y min-h-[64px] focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
                  />
                </div>
              )}
            </div>

            {/* Output schema */}
            <div>
              <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
                <OutputSchemaIcon size={13} className="text-slate-400" />
                Output schema
                <InfoTip text="Fields this table outputs. Set the data type and mark primary keys. Drag the handle to reorder." />
              </label>
              <SchemaEditor
                nodeType={node.type ?? "mart"}
                schema={node.schema}
                onChange={(schema) => onUpdate({ schema: schema as SchemaField[] })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Details
        </label>
        {isCreated ? (
          <div className="text-[12px] text-slate-500 flex flex-col gap-1 p-[2px]">
            <span>
              Created:{" "}
              <strong className="text-slate-900 font-semibold">{usDate(node.createdAt)}</strong>
            </span>
            <span>
              By: <strong className="text-slate-900 font-semibold">{node.createdBy ?? "—"}</strong>
            </span>
          </div>
        ) : (
          <div className="text-[12px] text-slate-400 italic p-[2px]">
            Unsaved drafts do not have a created date.
          </div>
        )}
      </div>
    </div>
  );
}
