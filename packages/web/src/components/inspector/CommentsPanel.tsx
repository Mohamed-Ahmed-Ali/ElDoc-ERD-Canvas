import type { CommentEntry, ModelGraph } from "@mc/okf";
import { Check, ChevronDown, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

// author handle: free-text, persisted locally. Anonymous-first — no login.
const AUTHOR_KEY = "mc.author.v1";
function loadAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || "";
  } catch {
    return "";
  }
}
function saveAuthor(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    /* private mode */
  }
}

interface CommentsPanelProps {
  anchorType: "node" | "edge";
  anchorId: string;
  graph: ModelGraph;
  onAdd: (entry: Omit<CommentEntry, "id" | "createdAt">) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CommentsPanel({
  anchorType,
  anchorId,
  graph,
  onAdd,
  onResolve,
  onDelete,
}: CommentsPanelProps) {
  const [author, setAuthor] = useState(loadAuthor);
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  // persist author handle whenever it changes.
  useEffect(() => {
    saveAuthor(author);
  }, [author]);

  const all = (graph.comments ?? []).filter((c) => c.anchorId === anchorId);
  const open = all.filter((c) => !c.resolved);
  const resolved = all.filter((c) => c.resolved);

  function submit() {
    const text = body.trim();
    if (!text) return;
    onAdd({ anchorType, anchorId, author: author.trim() || "Anonymous", body: text });
    setBody("");
  }

  return (
    <div className="border-t border-[#eef1f5] mt-4 pt-4 flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MessageSquare size={13} className="text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px]">
          Comments
        </span>
        {open.length > 0 && (
          <span className="ml-auto text-[10.5px] font-semibold bg-[#1e88e5] text-white rounded-full px-[6px] py-[1px]">
            {open.length}
          </span>
        )}
      </div>

      {/* Open threads */}
      {open.length === 0 && <p className="text-[12px] text-slate-400 italic">No comments yet.</p>}
      {open.map((c) => (
        <CommentBubble key={c.id} comment={c} onResolve={onResolve} onDelete={onDelete} />
      ))}

      {/* Resolved threads (collapsed by default) */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            {showResolved ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Resolved ({resolved.length})
          </button>
          {showResolved && (
            <div className="mt-2 flex flex-col gap-2">
              {resolved.map((c) => (
                <CommentBubble key={c.id} comment={c} resolved onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose */}
      <div className="flex flex-col gap-[6px]">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={60}
          className="w-full text-[12px] px-[8px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          placeholder="Add a comment… (Ctrl+Enter to post)"
          rows={2}
          className="w-full text-[12.5px] px-[8px] py-[6px] border border-[#d8dee8] rounded-lg text-slate-900 resize-none focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
        />
        <button
          onClick={submit}
          disabled={!body.trim()}
          className="self-end text-[12px] font-semibold px-3 py-[5px] rounded-lg bg-[#1e88e5] text-white hover:bg-[#1976d2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Post
        </button>
      </div>
    </div>
  );
}

function CommentBubble({
  comment,
  resolved = false,
  onResolve,
  onDelete,
}: {
  comment: CommentEntry;
  resolved?: boolean;
  onResolve?: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 flex flex-col gap-1 ${resolved ? "border-[#eef1f5] bg-[#f8fafc] opacity-60" : "border-[#d8dee8] bg-white"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold text-slate-700 flex-1 truncate">
          {comment.author || "Anonymous"}
        </span>
        <span className="text-[10.5px] text-slate-400 shrink-0">
          {relativeTime(comment.createdAt)}
        </span>
        {!resolved && onResolve && (
          <button
            onClick={() => onResolve(comment.id)}
            title="Mark resolved"
            className="text-slate-300 hover:text-emerald-500 transition-colors cursor-pointer"
          >
            <Check size={13} />
          </button>
        )}
        <button
          onClick={() => onDelete(comment.id)}
          title="Delete"
          className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <p className="text-[12.5px] text-slate-700 leading-[1.5] whitespace-pre-wrap break-words">
        {comment.body}
      </p>
    </div>
  );
}
