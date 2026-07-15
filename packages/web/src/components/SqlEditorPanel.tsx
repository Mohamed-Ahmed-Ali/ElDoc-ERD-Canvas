import { Code, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SqlEditorPanelProps {
  initialSql: string;
  onApply: (sql: string) => void;
  onClose: () => void;
  open: boolean;
}

export function SqlEditorPanel({ initialSql, onApply, onClose, open }: SqlEditorPanelProps) {
  const [sql, setSql] = useState(initialSql);

  // sync if external sql changes significantly (e.g. they opened it fresh)
  useEffect(() => {
    setSql(initialSql);
  }, [initialSql]);

  const [width, setWidth] = useState(500);
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
      setWidth(Math.max(300, Math.min(1000, startWidthRef.current + diff)));
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

  return (
    <div
      className="bg-white border-l border-[#d8dee8] flex-shrink-0 flex flex-col z-10 shadow-[-4px_0_16px_rgba(15,23,42,0.04)] relative transition-[width,border-color] duration-300 ease-in-out"
      style={{
        width: open ? width : 0,
        overflow: "hidden",
        borderLeft: open ? "1px solid var(--border-panel)" : "none",
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
        <Code size={18} className="text-slate-500" />
        <h3 className="text-[14px] font-[650] flex-1 text-slate-900">SQL Editor</h3>

        <button
          onClick={() => onApply(sql)}
          title="Apply SQL changes to canvas"
          className="flex items-center gap-[6px] rounded-lg bg-[#10b981] px-3 py-[6px] text-[13px] font-semibold text-white hover:bg-[#059669] transition-colors"
        >
          <Play size={14} /> Apply to Canvas
        </button>

        <button
          onClick={onClose}
          title="Close editor"
          className="cursor-pointer text-slate-400 hover:text-slate-700 bg-transparent border-none p-[6px] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Editor Body */}
      <div className="flex-1 bg-white p-4 overflow-hidden flex flex-col">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          className="w-full h-full bg-[#f8fafc] text-slate-800 border border-[#d8dee8] rounded-lg p-3 font-mono text-[13px] leading-[1.6] resize-none focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
          placeholder="-- Write your CREATE TABLE and CREATE VIEW statements here..."
        />
      </div>
    </div>
  );
}
