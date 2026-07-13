import { useState } from "react";
import { X, BookOpen, TrendingUp, Plus, Trash2, Link } from "lucide-react";
import type { GlossaryEntry, KpiEntry, ModelGraph } from "@mc/okf";

interface GlossaryDialogProps {
  graph: ModelGraph;
  onSetGlossary: (entries: GlossaryEntry[]) => void;
  onSetKpis: (entries: KpiEntry[]) => void;
  onClose: () => void;
}

type Tab = "glossary" | "kpis";

// cheap uid that doesn't need crypto.randomUUID (not available in HTTP)
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Glossary tab ─────────────────────────────────────────────────────────────
function GlossaryTab({
  entries,
  nodes,
  onChange,
}: {
  entries: GlossaryEntry[];
  nodes: ModelGraph["nodes"];
  onChange: (entries: GlossaryEntry[]) => void;
}) {
  function add() {
    onChange([...entries, { id: uid(), term: "", definition: "" }]);
  }
  function update(id: string, patch: Partial<GlossaryEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function remove(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  const inputCls =
    "w-full text-[12.5px] px-[8px] py-[6px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]";

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 && (
        <p className="text-[13px] text-slate-400 italic py-4 text-center">
          No terms yet. Add a business term to build your shared vocabulary.
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="border border-[#d8dee8] rounded-xl p-3 flex flex-col gap-2 bg-white"
        >
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="text"
                value={entry.term}
                onChange={(e) => update(entry.id, { term: e.target.value })}
                placeholder="Term (e.g. Gross Revenue)"
                className={inputCls + " font-semibold"}
              />
              <textarea
                value={entry.definition}
                onChange={(e) => update(entry.id, { definition: e.target.value })}
                placeholder="Plain-language definition…"
                rows={2}
                className={inputCls + " resize-none"}
              />
            </div>
            <button
              onClick={() => remove(entry.id)}
              title="Remove term"
              className="mt-1 text-slate-300 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>
          {/* Field references — node:field chips */}
          <RefEditor
            refs={entry.refs ?? []}
            nodes={nodes}
            onChange={(refs) => update(entry.id, { refs })}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 text-[13px] font-semibold text-[#1e88e5] hover:text-[#1565c0] transition-colors cursor-pointer self-start"
      >
        <Plus size={14} /> Add term
      </button>
    </div>
  );
}

// ── KPI tab ──────────────────────────────────────────────────────────────────
function KpiTab({
  entries,
  nodes,
  onChange,
}: {
  entries: KpiEntry[];
  nodes: ModelGraph["nodes"];
  onChange: (entries: KpiEntry[]) => void;
}) {
  function add() {
    onChange([...entries, { id: uid(), name: "", definition: "", formula: "" }]);
  }
  function update(id: string, patch: Partial<KpiEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function remove(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  const inputCls =
    "w-full text-[12.5px] px-[8px] py-[6px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]";

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 && (
        <p className="text-[13px] text-slate-400 italic py-4 text-center">
          No KPIs yet. Define a metric with its formula and owner so stakeholders know what it
          means.
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="border border-[#d8dee8] rounded-xl p-3 flex flex-col gap-2 bg-white"
        >
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="text"
                value={entry.name}
                onChange={(e) => update(entry.id, { name: e.target.value })}
                placeholder="KPI name (e.g. Monthly Recurring Revenue)"
                className={inputCls + " font-semibold"}
              />
              <textarea
                value={entry.definition}
                onChange={(e) => update(entry.id, { definition: e.target.value })}
                placeholder="What it is (business meaning)…"
                rows={2}
                className={inputCls + " resize-none"}
              />
              <textarea
                value={entry.formula}
                onChange={(e) => update(entry.id, { formula: e.target.value })}
                placeholder="How it's calculated (plain language)…"
                rows={2}
                className={inputCls + " resize-none font-mono text-[11.5px]"}
              />
              <input
                type="text"
                value={entry.owner ?? ""}
                onChange={(e) => update(entry.id, { owner: e.target.value || undefined })}
                placeholder="Owner (team or person)"
                className={inputCls}
              />
            </div>
            <button
              onClick={() => remove(entry.id)}
              title="Remove KPI"
              className="mt-1 text-slate-300 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>
          {/* Field references */}
          <RefEditor
            refs={entry.refs ?? []}
            nodes={nodes}
            onChange={(refs) => update(entry.id, { refs })}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 text-[13px] font-semibold text-[#1e88e5] hover:text-[#1565c0] transition-colors cursor-pointer self-start"
      >
        <Plus size={14} /> Add KPI
      </button>
    </div>
  );
}

// ── Field reference editor — node+field chips ────────────────────────────────
type Ref = { nodeKey: string; fieldName?: string };

function RefEditor({
  refs,
  nodes,
  onChange,
}: {
  refs: Ref[];
  nodes: ModelGraph["nodes"];
  onChange: (refs: Ref[]) => void;
}) {
  const [nodeKey, setNodeKey] = useState("");
  const [fieldName, setFieldName] = useState("");

  const selectedNode = nodes.find((n) => n.key === nodeKey);
  const martNodes = nodes.filter((n) => n.type !== "group");

  function addRef() {
    if (!nodeKey) return;
    // avoid duplicates
    if (refs.some((r) => r.nodeKey === nodeKey && r.fieldName === (fieldName || undefined))) return;
    onChange([...refs, { nodeKey, fieldName: fieldName || undefined }]);
    setNodeKey("");
    setFieldName("");
  }

  function removeRef(i: number) {
    onChange(refs.filter((_, idx) => idx !== i));
  }

  const nodeTitle = (key: string) => nodes.find((n) => n.key === key)?.title ?? key;

  return (
    <div className="flex flex-col gap-[5px]">
      {/* Existing ref chips */}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-[4px]">
          {refs.map((r, i) => (
            <span
              key={i}
              className="flex items-center gap-[4px] text-[11px] bg-[#e6f1fb] text-[#1565c0] rounded-full px-[8px] py-[2px] font-medium"
            >
              <Link size={10} />
              {nodeTitle(r.nodeKey)}
              {r.fieldName ? `.${r.fieldName}` : ""}
              <button
                onClick={() => removeRef(i)}
                className="ml-[2px] hover:text-red-500 cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Add ref */}
      <div className="flex gap-[5px] items-center flex-wrap">
        <select
          value={nodeKey}
          onChange={(e) => {
            setNodeKey(e.target.value);
            setFieldName("");
          }}
          className="text-[11.5px] px-[6px] py-[4px] border border-[#d8dee8] rounded-lg text-slate-700 focus:outline-none focus:border-[#1e88e5]"
        >
          <option value="">Link to table…</option>
          {martNodes.map((n) => (
            <option key={n.key} value={n.key}>
              {n.title || n.key}
            </option>
          ))}
        </select>
        {nodeKey && selectedNode && selectedNode.schema.length > 0 && (
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="text-[11.5px] px-[6px] py-[4px] border border-[#d8dee8] rounded-lg text-slate-700 focus:outline-none focus:border-[#1e88e5]"
          >
            <option value="">Any field</option>
            {selectedNode.schema.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {nodeKey && (
          <button
            onClick={addRef}
            className="text-[11.5px] font-semibold text-[#1e88e5] hover:text-[#1565c0] cursor-pointer"
          >
            + Link
          </button>
        )}
      </div>
    </div>
  );
}

// ── Dialog shell ─────────────────────────────────────────────────────────────
export function GlossaryDialog({ graph, onSetGlossary, onSetKpis, onClose }: GlossaryDialogProps) {
  const [tab, setTab] = useState<Tab>("glossary");

  // local draft copies — edits are committed to the store on every change
  // (debounced by the store), so closing the dialog without a Save button is fine.
  const glossary = graph.glossary ?? [];
  const kpis = graph.kpis ?? [];

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-[6px] px-4 py-2 text-[13px] font-semibold border-b-2 transition-colors ${
        tab === t
          ? "border-[#1e88e5] text-[#1e88e5]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon} {label}
      {t === "glossary" && glossary.length > 0 && (
        <span className="ml-1 text-[10.5px] bg-slate-100 text-slate-600 rounded-full px-[6px] py-[1px]">
          {glossary.length}
        </span>
      )}
      {t === "kpis" && kpis.length > 0 && (
        <span className="ml-1 text-[10.5px] bg-slate-100 text-slate-600 rounded-full px-[6px] py-[1px]">
          {kpis.length}
        </span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-[#1e88e5]" />
            <h2 className="text-[17px] font-semibold text-slate-900">Business Dictionary</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 flex-shrink-0">
          {tabBtn("glossary", "Glossary", <BookOpen size={14} />)}
          {tabBtn("kpis", "KPI / Metrics", <TrendingUp size={14} />)}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#f8fafc]">
          {tab === "glossary" && (
            <GlossaryTab entries={glossary} nodes={graph.nodes} onChange={onSetGlossary} />
          )}
          {tab === "kpis" && <KpiTab entries={kpis} nodes={graph.nodes} onChange={onSetKpis} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
          <p className="text-[12px] text-slate-400">Changes save automatically to this model.</p>
          <button
            onClick={onClose}
            className="px-5 py-2 text-[13.5px] font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
