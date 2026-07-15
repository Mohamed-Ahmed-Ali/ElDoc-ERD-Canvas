import { useState, useSyncExternalStore, useRef, useCallback, useEffect } from "react";
import { store } from "./canvas/Canvas";
import { TagEntry, ModelNode } from "@mc/okf";
import { X, Plus, Trash2, ListFilter } from "lucide-react";

interface SelectionPanelProps {
  onClose: () => void;
  activeTagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  open: boolean;
}

export function SelectionPanel({
  onClose,
  activeTagFilters,
  onTagFiltersChange,
  open,
}: SelectionPanelProps) {
  const graph = useSyncExternalStore(store.subscribe, store.get) as any;
  const nodes: ModelNode[] = graph.nodes || [];
  const tags: TagEntry[] = graph.tags || [];

  const [activeTab, setActiveTab] = useState<"tables" | "tags">("tables");

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");

  const [width, setWidth] = useState(320);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = "col-resize";
    },
    [width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = startXRef.current - e.clientX;
      setWidth(Math.max(250, Math.min(800, startWidthRef.current + diff)));
    };
    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleShowAll = () => store.setAllNodesHidden(false);
  const handleHideAll = () => store.setAllNodesHidden(true);
  const handleToggleNode = (key: string, currentHidden: boolean) => {
    store.setNodeHidden(key, !currentHidden);
  };
  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const newTag: TagEntry = {
      id: "tag_" + Date.now().toString(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    store.setTags([...tags, newTag]);
    setNewTagName("");
  };
  const handleDeleteTag = (id: string) => {
    store.setTags(tags.filter((t: TagEntry) => t.id !== id));
    if (activeTagFilters.includes(id)) {
      onTagFiltersChange(activeTagFilters.filter((tid) => tid !== id));
    }
  };
  const handleToggleTagFilter = (id: string) => {
    if (activeTagFilters.includes(id)) {
      onTagFiltersChange(activeTagFilters.filter((tid) => tid !== id));
    } else {
      onTagFiltersChange([...activeTagFilters, id]);
    }
  };

  return (
    <div
      className="bg-white border-l border-[#d8dee8] flex-shrink-0 flex flex-col z-10 shadow-[-4px_0_16px_rgba(15,23,42,0.04)] relative transition-[width,border-color] duration-300 ease-in-out"
      style={{
        width: open ? width : 0,
        overflow: "hidden",
        borderLeft: open ? "1px solid var(--border-panel)" : "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
      }}
    >
      {open && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[7px] -ml-[3px] cursor-col-resize z-20 group"
          onMouseDown={onResizeMouseDown}
        >
          <div className="absolute left-[2px] top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-[#1e88e5] transition-colors" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-white border border-[#d8dee8] rounded-md shadow-sm flex flex-col justify-center items-center gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-[14px] border-b border-[#d8dee8] flex-shrink-0 bg-[#f8fafc]">
        <ListFilter size={18} className="text-slate-500" />
        <h3 className="text-[14px] font-[650] flex-1 text-slate-900">Selection Pane</h3>
        <button
          onClick={onClose}
          title="Close pane"
          className="cursor-pointer text-slate-400 hover:text-slate-700 bg-transparent border-none p-[6px] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-[#d8dee8] text-[13px] bg-white">
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex-1 py-[10px] font-semibold transition-colors ${
            activeTab === "tables"
              ? "text-[#1e88e5] border-b-2 border-[#1e88e5]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Tables
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`flex-1 py-[10px] font-semibold transition-colors ${
            activeTab === "tags"
              ? "text-[#1e88e5] border-b-2 border-[#1e88e5]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Tags
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {activeTab === "tables" ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0]">
              <button
                onClick={handleShowAll}
                className="text-[12px] font-semibold text-[#1e88e5] hover:text-[#1565c0] px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Show All
              </button>
              <button
                onClick={handleHideAll}
                className="text-[12px] font-semibold text-[#1e88e5] hover:text-[#1565c0] px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Hide All
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {nodes.map((n: ModelNode) => (
                <label
                  key={n.key}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[#f8fafc] rounded-md cursor-pointer group transition-colors border border-transparent hover:border-[#e2e8f0]"
                >
                  <span className="text-[13px] text-slate-700 truncate mr-2 flex-1 font-medium" title={n.title || n.key}>
                    {n.title || n.key}
                  </span>
                  <input
                    type="checkbox"
                    checked={!n.isHidden}
                    onChange={() => handleToggleNode(n.key, !!n.isHidden)}
                    className="w-[14px] h-[14px] text-[#1e88e5] rounded-[3px] border-slate-300 focus:ring-[#1e88e5] cursor-pointer"
                  />
                </label>
              ))}
              {nodes.length === 0 && (
                <div className="text-[13px] text-slate-400 text-center py-6">
                  No tables in model
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-[700] text-slate-400 uppercase tracking-wider">Create Tag</h3>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-[28px] h-[28px] rounded cursor-pointer p-0 border-0 flex-shrink-0"
                />
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag name..."
                  className="flex-1 px-3 py-[6px] text-[13px] border border-[#d8dee8] rounded-md bg-white focus:outline-none focus:border-[#1e88e5] focus:ring-1 focus:ring-[#1e88e5] text-slate-700"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTag();
                  }}
                />
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="flex items-center justify-center w-[28px] h-[28px] bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-600 rounded-md disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="h-px bg-[#e2e8f0] w-full" />

            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-[700] text-slate-400 uppercase tracking-wider">Filter by Tag</h3>
              {tags.length === 0 ? (
                <div className="text-[13px] text-slate-400 py-2">No tags defined</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {tags.map((t: TagEntry) => (
                    <label
                      key={t.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-[#f8fafc] rounded-md cursor-pointer group transition-colors border border-transparent hover:border-[#e2e8f0]"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={activeTagFilters.includes(t.id)}
                          onChange={() => handleToggleTagFilter(t.id)}
                          className="w-[14px] h-[14px] text-[#1e88e5] rounded-[3px] border-slate-300 focus:ring-[#1e88e5] cursor-pointer"
                        />
                        <div
                          className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-[13px] font-medium text-slate-700">{t.name}</span>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTag(t.id); }}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete tag"
                      >
                        <Trash2 size={14} />
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
