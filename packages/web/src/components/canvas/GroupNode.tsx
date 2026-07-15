import { type NodeProps, NodeResizer, NodeToolbar, Position } from "@xyflow/react";
import { Palette, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { store } from "../../state/store";

export interface GroupNodeData {
  title?: string;
  color?: string;
}

function GroupNodeInner(props: NodeProps) {
  const node = props.data as unknown as GroupNodeData & { key: string; description?: string };
  const title = node.title || "Domain Group";
  const rawColor = node.color;

  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [isHovered, setIsHovered] = useState(false);

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex.startsWith("#")) return hex;
    const r = Number.parseInt(hex.slice(1, 3), 16) || 226;
    const g = Number.parseInt(hex.slice(3, 5), 16) || 232;
    const b = Number.parseInt(hex.slice(5, 7), 16) || 240;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgColor = rawColor ? hexToRgba(rawColor, 0.15) : "var(--group-bg)";
  const borderColor = rawColor || "var(--group-border)";

  const commitTitle = () => {
    setEditingTitle(false);
    if (localTitle.trim() && localTitle !== title) {
      store.updateNode(node.key, { title: localTitle.trim() });
    } else {
      setLocalTitle(title);
    }
  };

  const removeNode = () => {
    store.removeNode(node.key);
  };

  const cycleColor = () => {
    const colors = ["#cbd5e1", "#fca5a5", "#fcd34d", "#86efac", "#93c5fd", "#c4b5fd"];
    const nextIdx = (colors.indexOf(rawColor || "#cbd5e1") + 1) % colors.length;
    store.updateNode(node.key, { color: colors[nextIdx] });
  };

  return (
    <>
      <NodeResizer color="#1e88e5" isVisible={props.selected} minWidth={200} minHeight={150} />
      <div
        className="w-full h-full rounded-xl border-2 border-dashed relative transition-colors"
        style={{ backgroundColor: bgColor, borderColor: borderColor }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeToolbar
          isVisible={props.selected || isHovered}
          position={Position.Top}
          offset={6}
          className="flex items-center gap-1 bg-white border border-[#e2e8f0] shadow-sm rounded-lg p-1 z-50"
        >
          <button
            onClick={cycleColor}
            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors"
            title="Change Color"
          >
            <Palette size={13} />
          </button>
          <div className="w-px h-3 bg-slate-200 mx-1" />
          <button
            onClick={removeNode}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
            title="Delete Domain"
          >
            <Trash2 size={13} />
          </button>
        </NodeToolbar>

        <div
          className="absolute top-0 left-0 w-full px-3 py-2 font-semibold text-sm uppercase tracking-wider border-b border-dashed rounded-t-xl backdrop-blur-sm truncate cursor-text"
          style={{
            borderColor: borderColor,
            backgroundColor: "var(--group-header-bg)",
            color: "var(--group-header-text)",
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingTitle(true);
          }}
        >
          {editingTitle ? (
            <input
              className="w-full text-[var(--group-header-text)] bg-transparent border border-blue-400 rounded px-1 outline-none min-w-0"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setLocalTitle(title);
                }
              }}
            />
          ) : (
            title
          )}
        </div>
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeInner);
