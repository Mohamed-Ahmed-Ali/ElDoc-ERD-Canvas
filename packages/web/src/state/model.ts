import type {
  CommentEntry,
  GlossaryEntry,
  KpiEntry,
  ModelEdge,
  ModelGraph,
  ModelNode,
  TagEntry,
} from "@mc/okf";

function migrateGraph(initial?: Partial<ModelGraph>): ModelGraph {
  const next = { storageId: null, version: 1, nodes: [], edges: [], ...initial } as ModelGraph;
  if (!next.tags) next.tags = [];

  const needsLegacyMigration = !initial?.version || initial.version < 1;

  if (needsLegacyMigration) {
    next.nodes.forEach((n) => {
      n.schema.forEach((f: any) => {
        if (f.pk !== undefined) {
          if (f.pk) {
            f.role = f.role ?? "pk";
            f.keyType = f.keyType ?? "surrogateSequence";
            f.isComposite = f.isComposite ?? false;
          } else {
            f.role = f.role ?? "none";
            f.keyType = f.keyType ?? "attribute";
            f.isComposite = f.isComposite ?? false;
          }
          f.pk = undefined;
        }
        if (f.fk !== undefined) {
          if (f.fk && f.role !== "pk") {
            f.role = "fk";
          }
          f.fk = undefined;
        }
      });
    });
  }

  next.version = 1;
  return next;
}

export function createModelStore(initial?: Partial<ModelGraph>) {
  let g: ModelGraph = migrateGraph(initial);

  const past: ModelGraph[] = [];
  let future: ModelGraph[] = [];
  let lastStateStr = JSON.stringify(g);

  // it doesn't flood the undo stack.
  let debounceTimer: any = null;
  // the snapshot the pending timer would have pushed to `past` — i.e. the state
  // *before* the in-flight debounced edits. Kept so undo during the debounce
  // window can commit it instead of dropping those edits on the floor.
  let pendingPreEditStr: string | null = null;
  const saveHistory = (force = false) => {
    const currentStr = JSON.stringify(g);
    if (currentStr === lastStateStr) return;

    if (force) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        pendingPreEditStr = null;
      }
      past.push(JSON.parse(lastStateStr));
      if (past.length > 50) past.shift();
      future = [];
      lastStateStr = currentStr;
    } else {
      // ponytail: capture the *current* lastStateStr as the pre-edit snapshot
      // exactly once at the start of a debounce burst. The old code captured it
      // on fire, which meant an undo during the window popped the snapshot AFTER
      // the edits were already applied — silently dropping the in-flight edits.
      if (pendingPreEditStr === null) pendingPreEditStr = lastStateStr;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (pendingPreEditStr !== null) {
          past.push(JSON.parse(pendingPreEditStr));
          if (past.length > 50) past.shift();
          future = [];
        }
        debounceTimer = null;
        pendingPreEditStr = null;
        lastStateStr = JSON.stringify(g);
      }, 500);
    }
  };

  // per-store counter so independent stores (and HMR reloads) don't share ids.
  let counter = Math.max(
    0,
    ...[...g.nodes.map((n) => n.key), ...g.edges.map((e) => e.id)].map((s) => {
      const m = /(\d+)$/.exec(s);
      return m ? Number(m[1]) : 0;
    }),
  );
  const uid = (p: string) => `${p}${++counter}`;

  const subs = new Set<() => void>();
  const emit = () => {
    subs.forEach((f) => f());

    // sync to VS Code Extension if running inside the Webview
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "SAVE_OKF", payload: lastStateStr }, "*");
    }
  };
  return {
    get: () => g,
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    set: (next: ModelGraph) => {
      saveHistory(true);
      g = migrateGraph(next);
      for (const s of [...g.nodes.map((n) => n.key), ...g.edges.map((e) => e.id)]) {
        const m = /(\d+)$/.exec(s);
        if (m) counter = Math.max(counter, Number(m[1]));
      }
      lastStateStr = JSON.stringify(g);
      emit();
    },
    addNode(position: { x: number; y: number }, type: "mart" | "group" = "mart"): ModelNode {
      saveHistory(true);
      const isGroup = type === "group";
      const n: ModelNode = {
        key: uid("n"),
        type,
        title: isGroup ? "Domain Group" : "New object",
        inputSource: "SQL",
        schema: [],
        position,
        width: isGroup ? 400 : undefined,
        height: isGroup ? 300 : undefined,
      };
      g = { ...g, nodes: [...g.nodes, n] };
      lastStateStr = JSON.stringify(g);
      emit();
      return n;
    },
    updateNode(key: string, patch: Partial<ModelNode>) {
      saveHistory(false);
      g = { ...g, nodes: g.nodes.map((n) => (n.key === key ? { ...n, ...patch } : n)) };
      emit();
    },
    removeNode(key: string) {
      saveHistory(true);
      g = {
        ...g,
        nodes: g.nodes.filter((n) => n.key !== key),
        edges: g.edges.filter((e) => e.from !== key && e.to !== key),
      };
      lastStateStr = JSON.stringify(g);
      emit();
    },
    addEdge(
      from: string,
      to: string,
      sourceHandle?: string | null,
      targetHandle?: string | null,
    ): ModelEdge | null {
      saveHistory(true);
      const pair = [from, to].sort().join("|");
      const existing = g.edges.find((e) => [e.from, e.to].sort().join("|") === pair);
      if (existing && from !== to) {
        g = {
          ...g,
          edges: g.edges.map((e) =>
            e === existing ? { ...e, bidirectional: true, direction: "bidirectional" } : e,
          ),
        };
        lastStateStr = JSON.stringify(g);
        emit();
        return existing;
      }

      const extractField = (handle: string | null | undefined) => {
        if (!handle) return "";
        const parts = handle.split(":");
        return parts.length > 1 ? parts.slice(1).join(":") : "";
      };

      const leftKey = extractField(sourceHandle);
      const rightKey = extractField(targetHandle);

      const e: ModelEdge = {
        id: uid("e"),
        from,
        to,
        keys: [{ left: leftKey, right: rightKey }],
        bidirectional: false,
        sourceHandle,
        targetHandle,
        lineType: "bezier",
        animated: true,
      };
      g = { ...g, edges: [...g.edges, e] };
      lastStateStr = JSON.stringify(g);
      emit();
      return e;
    },
    updateEdge(id: string, patch: Partial<ModelEdge>) {
      saveHistory(false);
      g = { ...g, edges: g.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
      emit();
    },
    removeEdge(id: string) {
      saveHistory(true);
      g = { ...g, edges: g.edges.filter((e) => e.id !== id) };
      lastStateStr = JSON.stringify(g);
      emit();
    },
    undo: () => {
      // ponytail: if a debounced edit burst is in flight, commit its pre-edit
      // snapshot to `past` first (so it's the thing we pop), and snapshot the
      // current live state to `future` (so redo replays the in-flight edits,
      // not the stale pre-edit lastStateStr the timer hadn't written yet).
      if (debounceTimer && pendingPreEditStr !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        past.push(JSON.parse(pendingPreEditStr));
        if (past.length > 50) past.shift();
        future = [];
        pendingPreEditStr = null;
        lastStateStr = JSON.stringify(g);
      }
      if (past.length === 0) return;
      future.push(JSON.parse(lastStateStr));
      g = past.pop()!;
      lastStateStr = JSON.stringify(g);
      emit();
    },
    redo: () => {
      if (future.length === 0) return;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        pendingPreEditStr = null;
      }
      past.push(JSON.parse(lastStateStr));
      g = future.pop()!;
      lastStateStr = JSON.stringify(g);
      emit();
    },
    // ponytail: include the pending-snapshot in canUndo so the inspector's
    // undo button stays greyed only when there's genuinely nothing to revert.
    canUndo: () => past.length > 0 || (debounceTimer !== null && pendingPreEditStr !== null),
    canRedo: () => future.length > 0,

    // ── Glossary / KPI / Comments mutations ──────────────────────────────────
    // text-edit bursts (glossary/kpi typing) use saveHistory(false) — debounced
    // so one undo point per editing session. Resolve/delete use force=true for
    // discrete, intentional undo points.

    setGlossary(entries: GlossaryEntry[]) {
      saveHistory(false);
      g = { ...g, glossary: entries };
      emit();
    },
    setKpis(entries: KpiEntry[]) {
      saveHistory(false);
      g = { ...g, kpis: entries };
      emit();
    },
    setTags(entries: TagEntry[]) {
      saveHistory(false);
      g = { ...g, tags: entries };
      emit();
    },
    setNodeHidden(key: string, isHidden: boolean) {
      saveHistory(true);
      g = {
        ...g,
        nodes: g.nodes.map((n) => (n.key === key ? { ...n, isHidden } : n)),
      };
      lastStateStr = JSON.stringify(g);
      emit();
    },
    setAllNodesHidden(isHidden: boolean) {
      saveHistory(true);
      g = {
        ...g,
        nodes: g.nodes.map((n) => ({ ...n, isHidden })),
      };
      lastStateStr = JSON.stringify(g);
      emit();
    },
    addComment(entry: Omit<CommentEntry, "id" | "createdAt">) {
      saveHistory(false);
      const comment: CommentEntry = {
        ...entry,
        id: uid("c"),
        createdAt: new Date().toISOString(),
      };
      g = { ...g, comments: [...(g.comments ?? []), comment] };
      emit();
    },
    resolveComment(id: string) {
      saveHistory(true);
      g = {
        ...g,
        comments: (g.comments ?? []).map((c) => (c.id === id ? { ...c, resolved: true } : c)),
      };
      lastStateStr = JSON.stringify(g);
      emit();
    },
    deleteComment(id: string) {
      saveHistory(true);
      g = { ...g, comments: (g.comments ?? []).filter((c) => c.id !== id) };
      lastStateStr = JSON.stringify(g);
      emit();
    },
  };
}

export type ModelStore = ReturnType<typeof createModelStore>;
