import { memo, useState, useRef } from "react";
import { Handle, Position, NodeResizer, NodeToolbar, type NodeProps } from "@xyflow/react";
import {
  KeyRound,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Plus,
  Trash2,
  X,
  Hash,
  Link,
} from "lucide-react";
import type { ModelNode, SchemaField } from "@mc/okf";
import type { ViewMode } from "../../state/viewMode";
import { VIEW_CONFIG, toBusinessType } from "../../state/viewMode";
import { DataMartIcon } from "../../lib/icons";
import { ERD_COLLAPSED_ROWS } from "./layoutSize";

const SOURCE_COLOR: Record<string, string> = {
  SQL: "#10b981",
  CONNECTOR: "#f59e0b",
  VIEW: "#3b82f6",
  TABLE: "#8b5cf6",
};

const STATUS_TIP: Record<string, string> = {
  created: "Created",
  pending: "Draft",
  creating: "Creating…",
  error: "Error — check details",
};

export type MartNodeData = ModelNode & { _viewMode?: ViewMode; _keyFields?: string[] };

function StatusDot({ status }: { status: string }) {
  const base = "absolute top-[10px] right-[10px] w-[9px] h-[9px] rounded-full z-10";
  const colors: Record<string, string> = {
    created: "bg-[#10b981]",
    pending: "bg-slate-300",
    creating: "bg-[#1e88e5] animate-pulse",
    error: "bg-[#ef4444]",
  };
  return (
    <span
      className={`${base} ${colors[status] ?? "bg-slate-300"}`}
      title={STATUS_TIP[status] ?? status}
    />
  );
}

// node-level connectable ports (the only way to draw a new relationship).
function NodePorts() {
  const common = {
    width: 13,
    height: 13,
    borderRadius: "50%",
    background: "#fff",
    border: "2px solid #1e88e5",
    top: 24,
    opacity: 0,
    transition: "opacity 0.12s",
  } as const;
  return (
    <>
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ ...common, left: -7 }}
        className="mart-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...common, right: -7 }}
        className="mart-handle"
      />
    </>
  );
}

function MartHeader({ node, color }: { node: MartNodeData; color: string }) {
  const mode = node._viewMode ?? "physical";
  const config = VIEW_CONFIG[mode];
  const headerProp = config.nodeHeader;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node[headerProp]);

  const commit = () => {
    setEditing(false);
    if (title.trim() && title !== node[headerProp]) {
      import("./Canvas").then(({ store }) => {
        store.updateNode(node.key, { [headerProp]: title.trim() });
      });
    } else {
      setTitle(node[headerProp]);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 pt-[11px] pb-2">
      <span
        className="w-1 self-stretch min-h-[18px] rounded-sm flex-shrink-0"
        style={{ background: color }}
      />
      <DataMartIcon size={15} className="text-slate-400 flex-shrink-0" />
      {editing ? (
        <input
          autoFocus
          className="text-[13.5px] font-semibold flex-1 leading-tight pr-3 text-[var(--node-header-text)] bg-[var(--node-bg)] border border-blue-400 rounded px-1 outline-none min-w-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setTitle(node[headerProp]);
            }
          }}
        />
      ) : (
        <span
          className="text-[13.5px] font-semibold flex-1 leading-tight pr-3 text-[var(--node-header-text)] line-clamp-2 cursor-text"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (config.editableFields) setEditing(true);
          }}
        >
          {node[headerProp]}
        </span>
      )}
    </div>
  );
}

// display-only anchor handles on a field row. isConnectable={false} keeps them
// from starting new connections — they only give existing edges a place to land.
function FieldAnchors({ name }: { name: string }) {
  const baseClasses =
    "!opacity-0 group-hover:!opacity-100 transition-opacity !w-2.5 !h-2.5 !bg-white !border-[1.5px] !border-[#1e88e5]";
  return (
    <>
      <Handle
        type="source"
        position={Position.Left}
        id={`fl:${name}`}
        isConnectable={true}
        className={baseClasses}
        style={{ left: -5, top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={`fr:${name}`}
        isConnectable={true}
        className={baseClasses}
        style={{ right: -5, top: "50%" }}
      />
    </>
  );
}

function FieldRow({
  node,
  f,
  schema,
}: { node: MartNodeData; f: SchemaField; schema: SchemaField[] }) {
  const mode = node._viewMode ?? "physical";
  const config = VIEW_CONFIG[mode];

  const [editingName, setEditingName] = useState(false);
  const [editingType, setEditingType] = useState(false);
  const [hovered, setHovered] = useState(false);

  const displayVal = (f[config.fieldName] as string) || f.name;
  const [nameVal, setNameVal] = useState(displayVal);
  const [typeVal, setTypeVal] = useState(f.type);

  const commitName = () => {
    setEditingName(false);
    if (nameVal.trim() && nameVal !== displayVal) {
      import("./Canvas").then(({ store }) => {
        const newSchema = schema.map((sf) =>
          sf.name === f.name ? { ...sf, [config.fieldName]: nameVal.trim() } : sf,
        );
        store.updateNode(node.key, { schema: newSchema });
      });
    } else {
      setNameVal(displayVal);
    }
  };

  const commitType = () => {
    setEditingType(false);
    if (typeVal.trim() && typeVal !== f.type) {
      import("./Canvas").then(({ store }) => {
        const newSchema = schema.map((sf) =>
          sf.name === f.name ? { ...sf, type: typeVal.trim().toUpperCase() } : sf,
        );
        store.updateNode(node.key, { schema: newSchema });
      });
    } else {
      setTypeVal(f.type);
    }
  };

  const removeField = (e: React.MouseEvent) => {
    e.stopPropagation();
    import("./Canvas").then(({ store }) => {
      const newSchema = schema.filter((sf) => sf.name !== f.name);
      store.updateNode(node.key, { schema: newSchema });
    });
  };

  let displayedType = config.showType === "business" ? toBusinessType(f.type) : f.type;
  if (config.showType === "physical" && f.sk && f.generationRule) {
    displayedType += ` [${f.generationRule}]`;
  }

  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-[5px] text-[11.5px] border-b border-[var(--node-field-border)] last:border-b-0 hover:bg-[var(--node-field-hover-bg)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FieldAnchors name={f.name} />
      {config.showKeys &&
      (f.role === "pk" || f.role === "fk" || (config.showIndexes && f.index)) ? (
        <div className="flex items-center gap-[2px] flex-shrink-0 w-max pr-0.5">
          {f.role === "pk" && (
            <span title={f.sk ? `Primary Key (Surrogate: ${f.generationRule})` : "Primary Key"}>
              <KeyRound size={11} className="text-amber-500" />
            </span>
          )}
          {f.fk && (
            <span title="Foreign Key">
              <Link size={11} className="text-emerald-500" />
            </span>
          )}
          {f.role !== "pk" && f.role !== "fk" && config.showIndexes && f.index && (
            <span title="Index">
              <Hash size={11} className="text-blue-500" />
            </span>
          )}
        </div>
      ) : (
        <span className="w-[11px] flex-shrink-0" />
      )}

      {editingName ? (
        <input
          autoFocus
          className="flex-1 text-[var(--node-field-text)] bg-[var(--node-bg)] border border-blue-400 rounded px-1 outline-none min-w-0"
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setEditingName(false);
              setNameVal(displayVal);
            }
          }}
        />
      ) : (
        <span
          className="flex-1 flex items-center gap-1.5 text-[var(--node-field-text)] truncate cursor-text"
          title={displayVal}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (config.editableFields) setEditingName(true);
          }}
        >
          <span className="truncate">{displayVal}</span>
          {f.pii && (
            <span title="PII (Sensitive)">
              <EyeOff size={11} className="text-red-500 flex-shrink-0" />
            </span>
          )}
        </span>
      )}

      {config.showType !== "none" &&
        (editingType ? (
          <input
            autoFocus
            className="text-[var(--node-field-type-text)] font-mono text-[10.5px] w-20 bg-[var(--node-bg)] border border-blue-400 rounded px-1 outline-none min-w-0"
            value={typeVal}
            onChange={(e) => setTypeVal(e.target.value)}
            onBlur={commitType}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitType();
              if (e.key === "Escape") {
                setEditingType(false);
                setTypeVal(f.type);
              }
            }}
          />
        ) : (
          <span
            className="text-[var(--node-field-type-text)] font-mono text-[10.5px] truncate cursor-text pr-4"
            onDoubleClick={(e) => {
              e.stopPropagation();
              // business types are derived from physical type, so we only allow editing
              // the physical type. If they want to change the type, they change the underlying physical type.
              if (config.editableFields) {
                // pre-fill with actual physical type for editing
                setTypeVal(f.type);
                setEditingType(true);
              }
            }}
            title={config.showType === "business" ? `Physical type: ${f.type}` : undefined}
          >
            {displayedType}
          </span>
        ))}

      {hovered && !editingName && !editingType && (
        <button
          onClick={removeField}
          className="absolute right-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded p-[1px]"
          title="Remove field"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// eRD body shows at most ERD_COLLAPSED_ROWS fields by default so dense marts stay
// readable; the rest hide behind a "+N more" toggle. PK and relationship-key
// fields are always kept in the visible set so their edge handles exist even
// while collapsed (edges anchor to those field rows).
function ErdBody({ node }: { node: MartNodeData }) {
  const [expanded, setExpanded] = useState(false);
  const schema = node.schema;
  if (schema.length === 0) {
    return (
      <div className="px-3 pb-[10px] text-[11px] text-[var(--node-header-info-text)]">
        no fields
      </div>
    );
  }

  const mode = node._viewMode ?? "physical";
  const config = VIEW_CONFIG[mode];
  const keyFields = new Set(node._keyFields ?? []);
  const isKey = (f: SchemaField) =>
    f.role === "pk" || f.role === "fk" || keyFields.has(f.name) || (config.showIndexes && f.index);
  // keys first, then the rest — keeps a stable order whether collapsed or expanded.
  const ordered = [...schema.filter(isKey), ...schema.filter((f) => !isKey(f))];
  const collapsedCount = Math.max(ERD_COLLAPSED_ROWS, ordered.filter(isKey).length);
  const visible = expanded ? ordered : ordered.slice(0, collapsedCount);
  const hidden = schema.length - collapsedCount;

  return (
    <div className="border-t border-[var(--node-header-border)] max-h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar">
      {visible.map((f) => (
        <FieldRow key={f.name} node={node} f={f} schema={schema} />
      ))}
      {hidden > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="w-full flex items-center justify-center gap-1 px-3 py-[5px] text-[11px] font-medium text-[#1e88e5] hover:bg-[var(--node-field-hover-bg)] border-t border-[var(--node-field-border)]"
        >
          {expanded ? (
            <>
              <ChevronDown size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronRight size={12} /> +{hidden} more field{hidden > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}

function MartNodeInner(props: NodeProps) {
  const node = props.data as unknown as MartNodeData;
  const viewMode = node._viewMode ?? "physical";
  const config = VIEW_CONFIG[viewMode];
  const color = SOURCE_COLOR[node.inputSource] ?? "#94a3b8";
  const isErd = viewMode !== "compact";
  const fieldCount = node.schema?.length ?? 0;
  const fieldText =
    fieldCount > 0 ? `${fieldCount} field${fieldCount > 1 ? "s" : ""}` : "no fields";

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(node.description || "");
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 400); // 400ms delay to allow moving mouse to toolbar
  };

  const commitDesc = () => {
    setEditingDesc(false);
    if (desc.trim() !== (node.description || "")) {
      import("./Canvas").then(({ store }) => {
        store.updateNode(node.key, { description: desc.trim() });
      });
    } else {
      setDesc(node.description || "");
    }
  };

  const addField = () => {
    import("./Canvas").then(({ store }) => {
      const newField = { name: `new_col_${node.schema.length + 1}`, type: "STRING", pk: false };
      store.updateNode(node.key, { schema: [...node.schema, newField] });
    });
  };

  const removeNode = () => {
    import("./Canvas").then(({ store }) => {
      store.removeNode(node.key);
    });
  };

  return (
    <div
      className={`mart-node relative border-[1.5px] border-[var(--node-border)] rounded-xl shadow-[var(--node-shadow)] cursor-grab select-none ${isErd ? "w-[250px]" : "w-[200px]"}`}
      style={{
        background: "var(--node-bg)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
        width: node.width ?? (isErd ? 250 : 200),
        height: "100%",
        minHeight: 90,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="article"
      aria-label={`Table node: ${node.title}`}
      tabIndex={0}
    >
      <NodeToolbar
        isVisible={props.selected || isHovered}
        position={Position.Top}
        offset={6}
        className="flex items-center gap-1 bg-white border border-[#e2e8f0] shadow-sm rounded-lg p-1"
      >
        <div
          className="flex items-center gap-1"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={addField}
            className="flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded text-[11px] font-medium text-slate-700 transition-colors"
            title="Add Column"
          >
            <Plus size={12} /> Column
          </button>
          <div className="w-px h-3 bg-slate-200 mx-1" />
          <button
            onClick={removeNode}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
            title="Delete Table"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </NodeToolbar>

      <NodeResizer isVisible={props.selected} minWidth={200} minHeight={90} />
      <StatusDot status={node.status} />
      <MartHeader node={node} color={color} />

      {/* Meta row: type chip + (compact) field count */}
      <div className="flex items-center gap-2 px-3 pb-[10px]">
        <span
          className="text-[10.5px] font-[650] uppercase tracking-[0.3px] px-[7px] py-[2px] rounded-full text-white"
          style={{ background: color }}
        >
          {node.inputSource}
        </span>
        {!isErd && (
          <span className="text-[11px] text-[var(--node-header-info-text)]">{fieldText}</span>
        )}
      </div>

      {isErd && (
        <div className="px-3 pb-2">
          {editingDesc ? (
            <textarea
              autoFocus
              className="w-full text-[11px] text-[var(--node-header-info-text)] bg-[var(--node-bg)] border border-blue-400 rounded px-1 py-1 outline-none min-h-[40px] resize-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingDesc(false);
                  setDesc(node.description || "");
                }
              }}
            />
          ) : (
            <div
              className={`text-[11px] text-[var(--node-header-info-text)] cursor-text ${node.description ? "" : "italic opacity-50 hover:opacity-100"}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingDesc(true);
              }}
            >
              {node.description || "Double-click to add description..."}
            </div>
          )}
        </div>
      )}

      {isErd && <ErdBody node={node} />}

      <NodePorts />
    </div>
  );
}

export const MartNode = memo(MartNodeInner);
