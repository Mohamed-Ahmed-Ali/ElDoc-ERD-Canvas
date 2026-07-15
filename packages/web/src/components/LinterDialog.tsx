import type { ModelGraph } from "@mc/okf";
import { AlertCircle, AlertTriangle, CheckCircle, X } from "lucide-react";

interface LinterDialogProps {
  graph: ModelGraph;
  onClose: () => void;
}

export function LinterDialog({ graph, onClose }: LinterDialogProps) {
  const issues: { type: "error" | "warning"; message: string }[] = [];

  for (const node of graph.nodes) {
    if (node.type === "group") continue;

    // table missing description
    if (!node.description || node.description.trim() === "") {
      issues.push({ type: "warning", message: `Table "${node.title}" is missing a description.` });
    }

    // column missing description
    for (const field of node.schema) {
      if (!field.description || field.description.trim() === "") {
        issues.push({
          type: "warning",
          message: `Column "${field.name}" in table "${node.title}" is missing a description.`,
        });
      }
    }

    // unconnected tables
    const isConnected = graph.edges.some((e) => e.from === node.key || e.to === node.key);
    if (!isConnected) {
      issues.push({
        type: "warning",
        message: `Table "${node.title}" is completely isolated (no relationships).`,
      });
    }

    // ── Data-model semantics rules ───────────────────────────────────────────

    const pkFields = node.schema.filter((f) => f.role === "pk");
    if (pkFields.length === 0) {
      issues.push({ type: "error", message: `Table "${node.title}" has no primary key defined.` });
    } else if (pkFields.length > 1 && pkFields.some((f) => !f.isComposite)) {
      issues.push({
        type: "error",
        message: `Table "${node.title}" has multiple primary keys, but they are not marked as composite. Use "Composite Key" setting.`,
      });
    }

    for (const field of node.schema) {
      // 1. PK should not be simple attribute
      if (field.role === "pk" && field.keyType === "attribute") {
        issues.push({
          type: "warning",
          message: `Column "${field.name}" is a Primary Key but its Key Type is set to "Attribute". Consider using a Surrogate or Business Key.`,
        });
      }

      // 2. Missing Composite Group
      if (field.isComposite && (!field.compositeGroup || !field.compositeGroup.trim())) {
        issues.push({
          type: "error",
          message: `Column "${field.name}" is marked as Composite but has no group name.`,
        });
      }

      // 3 & 4. Hash Config Validation
      if (field.keyType === "surrogateHash") {
        const sourceCols = field.hashConfig?.sourceColumns || [];
        if (sourceCols.length === 0) {
          issues.push({
            type: "error",
            message: `Surrogate Hash "${field.name}" is missing source columns in its Hash Config.`,
          });
        } else {
          for (const colName of sourceCols) {
            if (!node.schema.some((f) => f.name === colName)) {
              issues.push({
                type: "error",
                message: `Hash config for "${field.name}" references column "${colName}" which does not exist in table "${node.title}".`,
              });
            }
          }
        }
      }

      // 5. Incomplete FK Config
      if (field.role === "fk") {
        if (!field.foreignKeyRef || !field.foreignKeyRef.targetTable.trim()) {
          issues.push({
            type: "warning",
            message: `Foreign Key "${field.name}" is missing a target table reference in its Advanced Settings.`,
          });
        }
      }

      // measure missing aggregation type
      if (field.isMeasure && !field.measureType) {
        issues.push({
          type: "warning",
          message: `Measure "${field.name}" in "${node.title}" has no aggregation type. Set it to Additive, Semi-additive, or Non-additive.`,
        });
      }
      // non-additive measure without a description — silent bug waiting to happen
      if (
        field.isMeasure &&
        field.measureType === "non-additive" &&
        (!field.description || !field.description.trim())
      ) {
        issues.push({
          type: "error",
          message: `Non-additive measure "${field.name}" in "${node.title}" must have a description explaining how it aggregates (ratios and medians cannot be SUMed across dimensions).`,
        });
      }
    }

    // bridge-specific rules
    if (node.type === "bridge") {
      const fkFields = node.schema.filter((f) => f.fk);
      if (fkFields.length !== 2) {
        issues.push({
          type: "warning",
          message: `Bridge table "${node.title}" should have exactly 2 FK fields (one per bridged dimension) — found ${fkFields.length}.`,
        });
      }
      if (!node.grain || !node.grain.trim()) {
        issues.push({
          type: "warning",
          message: `Bridge table "${node.title}" is missing a grain. Document what one row represents (e.g. "one row per customer–product pairing").`,
        });
      }
    }
  }

  // foreign key type mismatches
  for (const edge of graph.edges) {
    const fromNode = graph.nodes.find((n) => n.key === edge.from);
    const toNode = graph.nodes.find((n) => n.key === edge.to);

    if (!fromNode || !toNode) continue;

    for (const keyPair of edge.keys) {
      const leftField = fromNode.schema.find((f) => f.name === keyPair.left);
      const rightField = toNode.schema.find((f) => f.name === keyPair.right);

      if (leftField && rightField) {
        if (leftField.type !== rightField.type) {
          issues.push({
            type: "error",
            message: `Type mismatch in relationship between "${fromNode.title}.${leftField.name}" (${leftField.type}) and "${toNode.title}.${rightField.name}" (${rightField.type}).`,
          });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.type === "error");
  const warnings = issues.filter((i) => i.type === "warning");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-semibold text-slate-900">Schema Validation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8fafc]">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <CheckCircle size={48} className="text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800">Looking Good!</h3>
              <p className="text-slate-500 mt-1">No schema issues found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <AlertCircle size={16} className="text-red-500" /> {errors.length} Errors
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <AlertTriangle size={16} className="text-amber-500" /> {warnings.length} Warnings
                </div>
              </div>

              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${issue.type === "error" ? "bg-red-50/50 border-red-100" : "bg-amber-50/50 border-amber-100"}`}
                >
                  {issue.type === "error" ? (
                    <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <p
                    className={`text-[13.5px] leading-relaxed ${issue.type === "error" ? "text-red-900" : "text-amber-900"}`}
                  >
                    {issue.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
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
