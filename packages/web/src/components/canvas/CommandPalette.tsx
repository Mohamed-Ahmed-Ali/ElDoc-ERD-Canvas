import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { store } from "./Canvas";
import { useReactFlow } from "@xyflow/react";

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCenter } = useReactFlow();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nodes = store.get().nodes;
  const results: any[] = [];

  if (query.trim()) {
    const q = query.toLowerCase();
    for (const n of nodes) {
      if (
        n.title.toLowerCase().includes(q) ||
        (n.description && n.description.toLowerCase().includes(q))
      ) {
        results.push({ type: "table", node: n, match: n.title });
      }
      if (n.schema) {
        for (const f of n.schema) {
          if (f.name.toLowerCase().includes(q) || (f.alias && f.alias.toLowerCase().includes(q))) {
            results.push({ type: "column", node: n, field: f, match: `${n.title} > ${f.name}` });
          }
        }
      }
    }
  }

  const navigateTo = (node: any) => {
    onClose();
    const x = node.position.x + (node.width || 200) / 2;
    const y = node.position.y + (node.height || 90) / 2;
    setCenter(x, y, { zoom: 1.2, duration: 800 });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="bg-white w-[500px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 text-slate-800 bg-transparent outline-none text-[15px] placeholder-slate-400"
            placeholder="Search tables and columns..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) {
                navigateTo(results[0].node);
              }
            }}
          />
          <button
            onClick={onClose}
            className="text-[11px] font-medium text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded"
          >
            ESC
          </button>
        </div>

        {query.trim() && (
          <div className="max-h-[350px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-slate-500">
                No results found for "{query}"
              </div>
            ) : (
              results.slice(0, 50).map((r, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  onClick={() => navigateTo(r.node)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12">
                      {r.type}
                    </span>
                    <span className="text-[13px] text-slate-700 font-medium">{r.match}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Jump to &rarr;
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
