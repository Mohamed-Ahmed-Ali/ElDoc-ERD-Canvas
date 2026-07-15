import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow as ReactFlowBase,
  type ReactFlowProps,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FC } from "react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";

import dagre from "@dagrejs/dagre";
import {
  Code,
  LayoutDashboard,
  ListFilter,
  Maximize,
  MousePointer2,
  PanelRightOpen,
  Plus,
  Share2,
  Sparkles,
  X,
} from "lucide-react";

import { type ModelEdge, type ModelGraph, type ModelNode, parseSql } from "@mc/okf";
import { createModelStore } from "../../state/model";
import { loadPersistedGraph, persistGraph } from "../../state/persist";
import { useTheme } from "../../state/theme";
import { type ViewMode, loadViewMode, persistViewMode } from "../../state/viewMode";

import {
  downloadBundle,
  downloadCsv,
  downloadDbml,
  downloadSql,
  graphToBundleFiles,
  graphToCsv,
  graphToDbmlFile,
  graphToSqlFile,
} from "../../okf/io";
import { buildShareUrl, clearSharedModelFromUrl, readSharedModel } from "../../share/url";

import { isTauri } from "@tauri-apps/api/core";
import { BaseDirectory, readTextFile, watch, writeTextFile } from "@tauri-apps/plugin-fs";

import { ClearCanvasDialog } from "../ClearCanvasDialog";
import { GlossaryDialog } from "../GlossaryDialog";
import { ImportDialog } from "../ImportDialog";
import { LibraryDialog } from "../LibraryDialog";
import { LinterDialog } from "../LinterDialog";
import { SelectionPanel } from "../SelectionPanel";
import { SqlEditorPanel } from "../SqlEditorPanel";
import { TemplateApplyDialog } from "../TemplateApplyDialog";
import { TopBar } from "../TopBar";
import { Inspector } from "../inspector/Inspector";
import { CommandPalette } from "./CommandPalette";
import { Dock, type Tool } from "./Dock";
import { GroupNode } from "./GroupNode";
import { MartNode } from "./MartNode";
import { RelEdge } from "./RelEdge";
import { buildRfEdges, isEdgeReconnectable } from "./edges";
import { erdAwareNodeSize } from "./layoutSize";

// cast to FC to avoid generic component JSX typing issues with @types/react 18.3
const ReactFlow = ReactFlowBase as unknown as FC<ReactFlowProps>;

import { store, isFirstVisit } from "../../state/store";

// a truly first-ever visit has no persisted model and no shared link. Captured at
// module load — before the persist effect writes an (empty) graph — so it stays
// true for the session. A shared link is detected inside `CanvasApp` once it
// decodes, so a first visit can still be opened from #m=… (see applySharedModel
// in CanvasApp). Kept here as a stable flag so `WelcomeDialog` reads once.

// ── helpers to convert between model and RF types ───────────────────────────
function toRFNode(n: ModelNode, viewMode: ViewMode, keyFields?: string[]): Node {
  return {
    id: n.key,
    type: n.type === "group" ? "group" : "mart",
    position: n.position,
    parentId: n.parentId,
    extent: n.parentId ? "parent" : undefined,
    width: n.type === "group" ? n.width : undefined,
    height: n.type === "group" ? n.height : undefined,
    style: n.type === "group" ? { width: n.width, height: n.height } : undefined,
    zIndex: n.type === "group" ? -1 : 2000,
    data: {
      ...n,
      _viewMode: viewMode,
      _keyFields: keyFields,
    } as unknown as Record<string, unknown>,
  };
}

// field names involved in a relationship, per node key — so the ERD node can keep
// its join keys visible even when it collapses the rest of its fields behind the
// expand toggle (edges anchor to those field handles).
function keyFieldsByNode(edges: ModelEdge[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (key: string, field?: string) => {
    if (!field) return;
    (m.get(key) ?? m.set(key, new Set()).get(key)!).add(field);
  };
  for (const e of edges)
    for (const k of e.keys) {
      add(e.from, k.left);
      add(e.to, k.right);
    }
  return m;
}

function mergeGraphs(current: ModelGraph, imported: ModelGraph) {
  const newKeys = new Set<string>();
  const nodes = [...current.nodes];
  for (const n of imported.nodes) {
    if (!nodes.some((existing) => existing.key === n.key)) {
      nodes.push(n);
      newKeys.add(n.key);
    }
  }
  const edges = [...current.edges];
  for (const e of imported.edges) {
    if (!edges.some((existing) => existing.id === e.id)) {
      edges.push(e);
    }
  }
  return { graph: { storageId: current.storageId, nodes, edges }, newKeys };
}

// ── Dagre auto-layout ────────────────────────────────────────────────────────
const NODE_W = 200;
const NODE_H = 90;

function runDagreLayout(
  nodes: ModelNode[],
  edges: ModelEdge[],
  viewMode: ViewMode,
): Map<string, { x: number; y: number; width?: number; height?: number }> {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 100 });

  // Add all nodes
  nodes.forEach((n) => {
    // Only pass fixed sizes for non-group nodes. Dagre auto-sizes compound parents.
    if (n.type === "group") {
      g.setNode(n.key, {});
    } else {
      const s = erdAwareNodeSize(n, viewMode);
      g.setNode(n.key, { width: s.width, height: s.height });
    }
  });

  // Assign parents
  nodes.forEach((n) => {
    if (n.parentId) {
      g.setParent(n.key, n.parentId);
    }
  });

  edges.forEach((e) => g.setEdge(e.from, e.to));
  dagre.layout(g);

  const updates = new Map<string, { x: number; y: number; width?: number; height?: number }>();

  nodes.forEach((n) => {
    const pos = g.node(n.key);
    let absX = pos.x - pos.width / 2;
    let absY = pos.y - pos.height / 2;

    if (n.type === "group") {
      // Pad the group node visually
      updates.set(n.key, {
        x: absX,
        y: absY,
        width: pos.width + 40,
        height: pos.height + 60,
      });
    } else {
      if (n.parentId) {
        // Child node: convert to relative position and shift for group padding
        const parentPos = g.node(n.parentId);
        const parentAbsX = parentPos.x - parentPos.width / 2;
        const parentAbsY = parentPos.y - parentPos.height / 2;

        absX = absX - parentAbsX + 20; // 20px left padding
        absY = absY - parentAbsY + 40; // 40px top padding for title
      }
      updates.set(n.key, { x: absX, y: absY });
    }
  });

  return updates;
}

// ── Selection types ──────────────────────────────────────────────────────────
type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

// ── Inner canvas (needs ReactFlowProvider context) ────────────────────────────
const nodeTypes = { mart: MartNode, group: GroupNode };
const edgeTypes = { rel: RelEdge };

function CanvasInner() {
  const graph = useSyncExternalStore(store.subscribe, store.get);
  const { screenToFlowPosition, fitView } = useReactFlow();
  // true briefly during auto-layout so nodes glide (CSS transition) to their new
  // positions instead of snapping.
  const [layoutAnimating, setLayoutAnimating] = useState(false);

  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const activeTheme = useTheme();
  const [showImport, setShowImport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  // a template chosen from the library while the canvas already had content —
  // held until the user confirms Replace vs Merge in the TemplateApplyDialog.
  const [pendingTemplate, setPendingTemplate] = useState<{
    graph: ModelGraph;
    name: string;
  } | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [showSqlEditor, setShowSqlEditor] = useState(false);
  const [showLinter, setShowLinter] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    show: boolean;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const [showSelectionPane, setShowSelectionPane] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [highlightDepth, setHighlightDepth] = useState<"None" | "1 Level" | "2 Levels" | "All">(
    "None",
  );

  const activeKeys = useMemo(() => {
    if (!selection || selection.type !== "node" || highlightDepth === "None") return null;
    const active = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: selection.id, depth: 0 }];
    const maxDepth =
      highlightDepth === "1 Level"
        ? 1
        : highlightDepth === "2 Levels"
          ? 2
          : Number.POSITIVE_INFINITY;
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
    }
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (!active.has(id)) {
        active.add(id);
        if (depth < maxDepth) {
          const neighbors = adj.get(id) || [];
          for (const n of neighbors) {
            queue.push({ id: n, depth: depth + 1 });
          }
        }
      }
    }
    return active;
  }, [selection, highlightDepth, graph.edges]);

  // react Flow owns the live node/edge arrays so dragging follows the cursor
  // smoothly (RF applies position changes frame-by-frame). The model store stays
  // the source of truth: we sync store → RF on structural/data changes, and write
  // positions back to the store only at drag end.
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const kf = keyFieldsByNode(graph.edges);
    setRfNodes(
      graph.nodes.map((n) => {
        const matchesTags =
          activeTagFilters.length === 0 || n.tags?.some((t) => activeTagFilters.includes(t));
        const physicallyHidden = n.isHidden || !matchesTags;
        const rfNode = toRFNode(n, viewMode, [...(kf.get(n.key) ?? [])]);

        const isDimmed = activeKeys !== null && !activeKeys.has(n.key);

        rfNode.hidden = physicallyHidden;
        if (!rfNode.style) rfNode.style = {};
        rfNode.style.opacity = isDimmed ? 0.2 : 1;
        rfNode.style.transition = "opacity 0.2s ease";

        return rfNode;
      }),
    );
  }, [graph.nodes, graph.edges, viewMode, setRfNodes, activeTagFilters, activeKeys]);

  useEffect(() => {
    const rawEdges = buildRfEdges(graph.edges, graph.nodes, viewMode, store.updateEdge);
    setRfEdges(
      rawEdges.map((e) => {
        const mEdge = graph.edges.find((ge) => e.id.startsWith(ge.id));
        const sourceNode = graph.nodes.find((n) => n.key === e.source);
        const targetNode = graph.nodes.find((n) => n.key === e.target);

        const sourceHidden =
          sourceNode?.isHidden ||
          (activeTagFilters.length > 0 &&
            !sourceNode?.tags?.some((t) => activeTagFilters.includes(t)));
        const targetHidden =
          targetNode?.isHidden ||
          (activeTagFilters.length > 0 &&
            !targetNode?.tags?.some((t) => activeTagFilters.includes(t)));

        const isDimmed =
          activeKeys !== null && (!activeKeys.has(e.source) || !activeKeys.has(e.target));

        return {
          ...e,
          hidden: sourceHidden || targetHidden,
          style: { ...e.style, opacity: isDimmed ? 0.2 : 1, transition: "opacity 0.2s ease" },
        };
      }),
    );
  }, [graph.edges, graph.nodes, viewMode, setRfEdges, activeTagFilters, activeKeys]);

  // mark only the selected relationship as reconnectable so dragging an endpoint
  // moves the line the user picked (not whichever overlapping edge RF would grab),
  // and raise it above the others so its reconnect anchor isn't buried under an
  // overlapping line (otherwise the drag handle never appears). Patches in place —
  // never touches `selected` — and re-applies after any rebuild of the edges array.
  useEffect(() => {
    const selId = selection?.type === "edge" ? selection.id : null;
    setRfEdges((eds) =>
      eds.map((e) => {
        const modelEdgeId = (e.data as { modelEdgeId?: string } | undefined)?.modelEdgeId;
        const reconnectable = isEdgeReconnectable(modelEdgeId, selId, viewMode);
        const zIndex = modelEdgeId != null && modelEdgeId === selId ? 1000 : 0;
        return e.reconnectable === reconnectable && e.zIndex === zIndex
          ? e
          : { ...e, reconnectable, zIndex };
      }),
    );
  }, [selection, viewMode, graph.edges, graph.nodes, setRfEdges]);

  // mirror the model to localStorage on every change so a refresh/crash doesn't
  // lose work.
  useEffect(() => {
    persistGraph(graph);
  }, [graph]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onRfNodesChange(changes); // animate the drag live
      for (const c of changes) {
        if (c.type === "position" && c.position && c.dragging === false) {
          store.updateNode(c.id, { position: c.position }); // persist final position
        }
        if (c.type === "dimensions" && c.dimensions && c.resizing === false) {
          store.updateNode(c.id, {
            width: c.dimensions.width,
            height: c.dimensions.height,
          });
        }
      }
    },
    [onRfNodesChange],
  );

  // ── Connect handler ────────────────────────────────────────────────────────
  // drag an existing edge end onto another port/node to re-route it (for a tidy picture).
  const onReconnect = useCallback(
    (oldEdge: Edge, conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const modelEdgeId = oldEdge.id.split("::")[0];
      const keyIndex = Number.parseInt(oldEdge.id.split("::")[1] || "0", 10);

      const extractField = (handle: string | null | undefined) => {
        if (!handle) return "";
        const parts = handle.split(":");
        return parts.length > 1 ? parts.slice(1).join(":") : "";
      };

      const leftField = extractField(conn.sourceHandle);
      const rightField = extractField(conn.targetHandle);

      const updatePayload: Partial<ModelEdge> = {
        from: conn.source,
        to: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
      };

      if (viewMode !== "compact") {
        const { edges } = store.get();
        const mEdge = edges.find((e) => e.id === modelEdgeId);
        if (mEdge) {
          const newKeys = [...mEdge.keys];
          newKeys[keyIndex] = { left: leftField, right: rightField };
          updatePayload.keys = newKeys;
        }
      }

      store.updateEdge(modelEdgeId, updatePayload);
    },
    [viewMode],
  );

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    // open the new edge in the inspector right away so the user can set join
    // keys without an extra click to select the freshly-drawn line.
    const e = store.addEdge(
      connection.source,
      connection.target,
      connection.sourceHandle,
      connection.targetHandle,
    );
    if (e) setSelection({ type: "edge", id: e.id });
  }, []);

  // ── Pane click → add (in Add/Group tool) or deselect ────────────────────────────
  const onPaneClick = useCallback(
    (e: any) => {
      if (tool === "add" || tool === "group") {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const type = tool === "group" ? "group" : "mart";
        const n = store.addNode({ x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 }, type);
        setSelection({ type: "node", id: n.key });
        setTool("select");
      } else {
        setSelection(null);
        if (contextMenu) setContextMenu(null);
        if (edgeContextMenu) setEdgeContextMenu(null);
      }
    },
    [tool, screenToFlowPosition, contextMenu, edgeContextMenu],
  );

  const onPaneContextMenu = useCallback((e: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, show: true });
    setEdgeContextMenu(null);
  }, []);

  // ── Node click → select ────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (contextMenu) setContextMenu(null);
      if (edgeContextMenu) setEdgeContextMenu(null);
      setSelection({ type: "node", id: node.id });
    },
    [contextMenu, edgeContextMenu],
  );

  // ── Edge click → select ────────────────────────────────────────────────────
  // eRD mode may render several RF edges per model edge (e.g. "e1::0"); strip
  // the suffix so the inspector still selects the underlying model edge.
  // invariant: model edge ids are generated as "e<n>" and never contain "::",
  // so this split is a safe no-op in compact mode (plain ids pass through unchanged).
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (contextMenu) setContextMenu(null);
      if (edgeContextMenu) setEdgeContextMenu(null);
      setSelection({ type: "edge", id: edge.id.split("::")[0] });
    },
    [contextMenu, edgeContextMenu],
  );

  const onEdgeDoubleClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.stopPropagation();
      if (contextMenu) setContextMenu(null);
      const modelEdgeId = edge.id.split("::")[0];
      setEdgeContextMenu({ id: modelEdgeId, x: e.clientX, y: e.clientY });
    },
    [contextMenu],
  );

  // ── Auto-layout + tool handler ─────────────────────────────────────────────
  // read the graph from the store at call time so this stays stable and doesn't
  // re-create (and churn the Dock keydown listener) on every drag-move tick.
  const handleAutoLayout = useCallback(() => {
    const { nodes, edges } = store.get();
    const positions = runDagreLayout(nodes, edges, viewMode);
    setLayoutAnimating(true);
    positions.forEach((pos, key) => {
      store.updateNode(key, {
        position: { x: pos.x, y: pos.y },
        ...(pos.width !== undefined ? { width: pos.width } : {}),
        ...(pos.height !== undefined ? { height: pos.height } : {}),
      });
    });
    setTimeout(() => fitView({ duration: 500, padding: 0.18 }), 30);
    setTimeout(() => setLayoutAnimating(false), 560);
  }, [viewMode, fitView]);

  const handleToolChange = useCallback(
    (t: Tool) => {
      if (t === "layout") {
        handleAutoLayout();
        return;
      }
      setTool(t);
    },
    [handleAutoLayout],
  );

  // ── Keyboard delete & undo/redo ────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setShowCommandPalette(true);
          return;
        }
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            if (store.canRedo()) store.redo();
          } else {
            if (store.canUndo()) store.undo();
          }
          return;
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          if (store.canRedo()) store.redo();
          return;
        }
        if (e.key.toLowerCase() === "c" && selection?.type === "node") {
          const n = graph.nodes.find((n) => n.key === selection.id);
          if (n) {
            sessionStorage.setItem("erdflow_clipboard", JSON.stringify(n));
          }
          return;
        }
        if (e.key.toLowerCase() === "v") {
          const data = sessionStorage.getItem("erdflow_clipboard");
          if (data) {
            try {
              const n: ModelNode = JSON.parse(data);
              const position = { x: n.position.x + 20, y: n.position.y + 20 };
              // addNode only accepts 'mart'|'group'; bridge is set afterwards via updateNode.
              const baseType: "mart" | "group" = n.type === "group" ? "group" : "mart";
              const newNode = store.addNode(position, baseType);
              store.updateNode(newNode.key, {
                title: `${n.title} (copy)`,
                type: n.type,
                schema: [...n.schema],
                description: n.description,
                grain: n.grain,
                inputSource: n.inputSource,
                width: n.width,
                height: n.height,
              });
              setSelection({ type: "node", id: newNode.key });
            } catch (e) {}
          }
          return;
        }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        if (selection.type === "node") store.removeNode(selection.id);
        else store.removeEdge(selection.id);
        setSelection(null);
      }
    },
    [selection],
  );

  // ── Double-click on empty pane → add node (works in any tool, like the prototype) ──
  const handleWrapperDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // only fire when clicking the pane (not on a node card or edge)
      const target = e.target as HTMLElement;
      if (target.closest(".react-flow__node") || target.closest(".react-flow__edge")) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const n = store.addNode({
        x: position.x - NODE_W / 2,
        y: position.y - NODE_H / 2,
      });
      setSelection({ type: "node", id: n.key });
      setTool("select");
    },
    [screenToFlowPosition],
  );

  // ── Import / Export handlers ───────────────────────────────────────
  const handleExport = useCallback(() => {
    const title = "model-okf";
    const files = graphToBundleFiles(store.get(), title);
    downloadBundle(files, title);
  }, []);

  const handleExportCsv = useCallback(() => {
    const title = "model_dictionary";
    const csv = graphToCsv(store.get());
    downloadCsv(csv, title);
  }, []);

  const handleExportSql = useCallback((dialect = "postgres") => {
    const title = `model_${dialect}`;
    const sql = graphToSqlFile(store.get(), dialect);
    downloadSql(sql, title);
  }, []);

  const handleExportDbml = useCallback(() => {
    const title = "model";
    const dbml = graphToDbmlFile(store.get());
    downloadDbml(dbml, title);
  }, []);

  // clear the canvas: permanently wipe every node + edge
  const clearCanvas = useCallback(() => {
    store.set({ storageId: null, nodes: [], edges: [] });
    setSelection(null);
    setShowClear(false);
  }, []);

  const handleExportAndClear = useCallback(() => {
    handleExport();
    clearCanvas();
  }, [handleExport, clearCanvas]);

  // copy a shareable link that reopens this exact model. Falls back to a prompt
  // if the clipboard API is blocked (insecure context / permissions).
  const handleShare = useCallback(async () => {
    const url = await buildShareUrl(store.get());
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
    const msg = isLocal
      ? "Link copied — note: a localhost link only opens on this machine. Deploy to share it."
      : "Link copied — anyone with it can open this model.";
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(msg);
    } catch {
      window.prompt("Copy this shareable link:", url);
    }
  }, []);

  // auto-layout a freshly loaded graph (import or template).
  const withLayout = useCallback(
    (g: ModelGraph): ModelGraph => {
      const positions = runDagreLayout(g.nodes, g.edges, viewMode);
      return {
        ...g,
        nodes: g.nodes.map((n) => {
          const pos = positions.get(n.key);
          if (!pos) return n;
          return {
            ...n,
            position: { x: pos.x, y: pos.y },
            ...(pos.width !== undefined ? { width: pos.width } : {}),
            ...(pos.height !== undefined ? { height: pos.height } : {}),
          };
        }),
      };
    },
    [viewMode],
  );

  // merge a freshly loaded graph into the canvas, laying out only the new nodes
  // so the existing layout isn't reshuffled.
  const applyMergeWithLayout = useCallback(
    (g: ModelGraph) => {
      const { graph, newKeys } = mergeGraphs(store.get(), g);
      const positions = runDagreLayout(graph.nodes, graph.edges, viewMode);
      store.set({
        ...graph,
        nodes: graph.nodes.map((n) => {
          if (!newKeys.has(n.key)) return n;
          const pos = positions.get(n.key);
          if (!pos) return n;
          return {
            ...n,
            position: { x: pos.x, y: pos.y },
            ...(pos.width !== undefined ? { width: pos.width } : {}),
            ...(pos.height !== undefined ? { height: pos.height } : {}),
          };
        }),
      });
    },
    [viewMode],
  );

  const handleImportConfirm = useCallback(
    (g: ModelGraph, mode: "replace" | "merge") => {
      if (mode === "merge") {
        applyMergeWithLayout(g);
      } else {
        store.set({ ...withLayout(g), storageId: null });
      }
      setShowImport(false);
    },
    [withLayout, applyMergeWithLayout],
  );

  const applyTemplate = useCallback(
    (g: ModelGraph, mode: "replace" | "merge") => {
      // auto-layout the template.
      if (mode === "merge") applyMergeWithLayout(g);
      else store.set({ ...withLayout(g), storageId: null });
    },
    [withLayout, applyMergeWithLayout],
  );

  const handleUseTemplate = useCallback(
    (g: ModelGraph, name: string) => {
      // empty canvas → drop the template straight in. Non-empty → ask Replace vs
      // merge first so existing work isn't silently wiped.
      if (store.get().nodes.length === 0) {
        applyTemplate(g, "replace");
        setShowLibrary(false);
      } else {
        setPendingTemplate({ graph: g, name });
      }
    },
    [applyTemplate],
  );

  const handleTemplateApplyConfirm = useCallback(
    (mode: "replace" | "merge") => {
      if (pendingTemplate) applyTemplate(pendingTemplate.graph, mode);
      setPendingTemplate(null);
      setShowLibrary(false);
    },
    [pendingTemplate, applyTemplate],
  );

  const handleApplySql = useCallback(
    (sql: string) => {
      try {
        const g = parseSql(sql);
        const positions = runDagreLayout(g.nodes, g.edges, viewMode);
        store.set({
          ...g,
          nodes: g.nodes.map((n) => ({
            ...n,
            position: positions.get(n.key) ?? n.position,
          })),
          storageId: null,
        });
        setShowSqlEditor(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [viewMode],
  );

  // ── Canvas class based on tool ─────────────────────────────────────────────
  const canvasClass = [
    tool === "add" ? "canvas-add" : tool === "connect" ? "canvas-connect" : "",
    layoutAnimating ? "canvas-animating" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden theme-${activeTheme}`}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
      }}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="ERD Canvas"
    >
      <TopBar
        viewMode={viewMode}
        onViewModeChange={(m) => {
          setViewMode(m);
          persistViewMode(m);
        }}
        onImport={() => setShowImport(true)}
        onExport={handleExport}
        onExportSql={handleExportSql}
        onExportCsv={handleExportCsv}
        onExportDbml={handleExportDbml}
        exportDisabled={graph.nodes.length === 0}
        onShare={handleShare}
        shareDisabled={graph.nodes.length === 0}
        onUndo={() => store.undo()}
        canUndo={store.canUndo()}
        onRedo={() => store.redo()}
        canRedo={store.canRedo()}
        onLibrary={() => setShowLibrary(true)}
        onOpenSqlEditor={() => setShowSqlEditor(true)}
        onValidate={() => setShowLinter(true)}
        onDictionary={() => setShowGlossary(true)}
        highlightDepth={highlightDepth}
        onHighlightDepthChange={setHighlightDepth}
      />
      {shareToast && <ShareToast message={shareToast} onClose={() => setShareToast(null)} />}
      {showImport && (
        <ImportDialog onConfirm={handleImportConfirm} onClose={() => setShowImport(false)} />
      )}
      {showClear && (
        <ClearCanvasDialog
          counts={{
            marts: graph.nodes.length,
            relationships: graph.edges.length,
          }}
          onDelete={clearCanvas}
          onExportAndDelete={handleExportAndClear}
          onClose={() => setShowClear(false)}
        />
      )}
      {showLinter && <LinterDialog graph={graph} onClose={() => setShowLinter(false)} />}
      {showGlossary && (
        <GlossaryDialog
          graph={graph}
          onSetGlossary={(entries) => store.setGlossary(entries)}
          onSetKpis={(entries) => store.setKpis(entries)}
          onClose={() => setShowGlossary(false)}
        />
      )}
      {showLibrary && (
        <LibraryDialog onUse={handleUseTemplate} onClose={() => setShowLibrary(false)} />
      )}
      {pendingTemplate && (
        <TemplateApplyDialog
          graph={pendingTemplate.graph}
          name={pendingTemplate.name}
          onConfirm={handleTemplateApplyConfirm}
          onClose={() => setPendingTemplate(null)}
        />
      )}

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      <div className="flex flex-1 min-h-0 relative">
        {/* Left tool dock */}
        {/* Left tool dock */}
        <Dock
          activeTool={tool}
          onToolChange={handleToolChange}
          viewMode={viewMode}
          onToggleView={() => {
            const next = viewMode === "compact" ? "logical" : "compact";
            setViewMode(next);
            persistViewMode(next);
          }}
          onClear={() => setShowClear(true)}
          clearDisabled={graph.nodes.length === 0}
        />

        {/* React Flow canvas */}
        <div
          className={`flex-1 relative ${canvasClass} theme-${activeTheme}`}
          onContextMenu={onPaneContextMenu}
          onDoubleClick={handleWrapperDoubleClick}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onRfEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable={false}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            connectionMode={ConnectionMode.Loose}
            fitView={false}
            minZoom={0.4}
            maxZoom={1.6}
            nodesDraggable={tool === "select"}
            nodesConnectable={true}
            selectNodesOnDrag={false}
            panOnDrag={tool === "select"}
            zoomOnScroll={true}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="var(--canvas-dot)"
            />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor="var(--canvas-node)"
              maskColor="var(--canvas-mask)"
              className="rounded-lg border border-[#e2e6ec] shadow-sm"
            />
            {/* Nudged up to leave room for the feedback link directly below. */}
            <Controls
              position="bottom-left"
              style={{ bottom: 60, left: 15, margin: 0 }}
              className="bg-white border-[#e2e8f0] shadow-sm rounded-lg"
            />
          </ReactFlow>

          {/* Empty canvas CTA */}
          {graph.nodes.length === 0 && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-slate-500 pointer-events-none z-[1]"
              style={{ fontSize: 15 }}
            >
              <div>
                <strong className="text-slate-900">Empty canvas</strong>
              </div>
              <div className="mt-[6px] text-[13px] leading-[1.6]">
                Double-click anywhere to add an object.
                <br />
                Drag from a node's port to create a relationship.
              </div>
            </div>
          )}

          {/* Floating Right Side Toolbar (Code & Inspector toggles) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-[2px]">
            <button
              onClick={() => setShowSelectionPane(!showSelectionPane)}
              title="Toggle Selection Pane"
              className="group flex h-[46px] w-[32px] items-center justify-center rounded-l-xl border border-r-0 border-[#d8dee8] bg-white text-slate-500 shadow-[-3px_0_12px_rgba(15,23,42,0.07)] cursor-pointer transition-colors hover:bg-[#f1f3f7] hover:text-[#1e88e5]"
            >
              <ListFilter size={18} />
              <span className="pointer-events-none absolute right-[calc(100%+8px)] top-[14px] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-[0_6px_18px_rgba(15,23,42,0.28)]">
                Toggle Selection Pane
              </span>
            </button>
            <button
              onClick={() => setShowSqlEditor(!showSqlEditor)}
              title="Toggle SQL Editor"
              className="group flex h-[46px] w-[32px] items-center justify-center rounded-l-xl border border-r-0 border-[#d8dee8] bg-white text-slate-500 shadow-[-3px_0_12px_rgba(15,23,42,0.07)] cursor-pointer transition-colors hover:bg-[#f1f3f7] hover:text-[#1e88e5]"
            >
              <Code size={18} />
              <span className="pointer-events-none absolute right-[calc(100%+8px)] top-[62px] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-[0_6px_18px_rgba(15,23,42,0.28)]">
                Toggle SQL Editor
              </span>
            </button>
            {!inspectorOpen && (
              <button
                onClick={() => setInspectorOpen(true)}
                title="Open inspector"
                className="group flex h-[46px] w-[32px] items-center justify-center rounded-l-xl border border-r-0 border-[#d8dee8] bg-white text-slate-500 shadow-[-3px_0_12px_rgba(15,23,42,0.07)] cursor-pointer transition-colors hover:bg-[#f1f3f7] hover:text-[#1e88e5]"
              >
                <PanelRightOpen size={18} />
                <span className="pointer-events-none absolute right-[calc(100%+8px)] top-[110px] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-[0_6px_18px_rgba(15,23,42,0.28)]">
                  Open inspector
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Context Menu */}
        {contextMenu?.show && (
          <div
            className="absolute z-50 bg-white border border-[#e2e8f0] shadow-lg rounded-xl overflow-hidden py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors flex items-center gap-2"
              onClick={() => {
                const position = screenToFlowPosition({
                  x: contextMenu.x,
                  y: contextMenu.y,
                });
                const n = store.addNode({
                  x: position.x - NODE_W / 2,
                  y: position.y - NODE_H / 2,
                });
                setSelection({ type: "node", id: n.key });
                setContextMenu(null);
              }}
            >
              <Plus size={14} /> Add Table
            </button>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors flex items-center gap-2"
              onClick={() => {
                const position = screenToFlowPosition({
                  x: contextMenu.x,
                  y: contextMenu.y,
                });
                const n = store.addNode(
                  { x: position.x - 200 / 2, y: position.y - 150 / 2 },
                  "group",
                );
                setSelection({ type: "node", id: n.key });
                setContextMenu(null);
              }}
            >
              <Plus size={14} /> Add Domain
            </button>
            <div className="w-full h-px bg-slate-100 my-1" />
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors flex items-center gap-2"
              onClick={() => {
                handleAutoLayout();
                setContextMenu(null);
              }}
            >
              <LayoutDashboard size={14} /> Auto Layout
            </button>
          </div>
        )}

        {/* Edge Context Menu */}
        {edgeContextMenu && (
          <div
            className="absolute z-50 bg-white border border-[#e2e8f0] shadow-lg rounded-xl overflow-hidden py-1 min-w-[140px]"
            style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
            onMouseLeave={() => setEdgeContextMenu(null)}
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Cardinality
            </div>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                store.updateEdge(edgeContextMenu.id, { cardinality: "1:1" });
                setEdgeContextMenu(null);
              }}
            >
              1:1 (One to One)
            </button>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                store.updateEdge(edgeContextMenu.id, { cardinality: "1:N" });
                setEdgeContextMenu(null);
              }}
            >
              1:N (One to Many)
            </button>
            <div className="w-full h-px bg-slate-100 my-1" />
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Style
            </div>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                store.updateEdge(edgeContextMenu.id, { lineType: "bezier" });
                setEdgeContextMenu(null);
              }}
            >
              Curved
            </button>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                store.updateEdge(edgeContextMenu.id, { lineType: "step" });
                setEdgeContextMenu(null);
              }}
            >
              Stepped
            </button>
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                store.updateEdge(edgeContextMenu.id, { lineType: "straight" });
                setEdgeContextMenu(null);
              }}
            >
              Straight
            </button>
            <div className="w-full h-px bg-slate-100 my-1" />
            <button
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-[#f1f5fb] hover:text-[#1e88e5] transition-colors"
              onClick={() => {
                const colors = ["#94a3b8", "#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#a78bfa"];
                const edge = store.get().edges.find((e) => e.id === edgeContextMenu.id);
                if (edge) {
                  const nextIdx = (colors.indexOf(edge.color || "#94a3b8") + 1) % colors.length;
                  store.updateEdge(edgeContextMenu.id, {
                    color: colors[nextIdx],
                  });
                }
                setEdgeContextMenu(null);
              }}
            >
              Change Color
            </button>
          </div>
        )}

        {/* Right side panels */}
        <SelectionPanel
          open={showSelectionPane}
          onClose={() => setShowSelectionPane(false)}
          activeTagFilters={activeTagFilters}
          onTagFiltersChange={setActiveTagFilters}
        />
        <SqlEditorPanel
          initialSql={graphToSqlFile(graph)}
          onApply={handleApplySql}
          onClose={() => setShowSqlEditor(false)}
          open={showSqlEditor}
        />

        {/* Right inspector drawer */}
        <Inspector
          selection={selection}
          nodes={graph.nodes}
          edges={graph.edges}
          graph={graph}
          onUpdateNode={store.updateNode}
          onUpdateEdge={store.updateEdge}
          onAddComment={(entry) => store.addComment(entry)}
          onResolveComment={(id) => store.resolveComment(id)}
          onDeleteComment={(id) => store.deleteComment(id)}
          onClose={() => setSelection(null)}
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
        />
      </div>
    </div>
  );
}

// ── Share confirmation toast (auto-dismisses) ─────────────────────────────────
function ShareToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-[13px] shadow-2xl">
      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
      <span className="text-slate-800">{message}</span>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
// ponytail: async shared-link decode lives here, after React mounts. A corrupt
// #m=… payload no longer crashes boot — the catch just opens the empty canvas.
let sharedApplied = false;
export function CanvasApp() {
  useEffect(() => {
    if (sharedApplied) return;
    let cancelled = false;
    (async () => {
      const shared = await readSharedModel();
      if (cancelled || !shared) {
        if (!cancelled) clearSharedModelFromUrl();
        return;
      }
      sharedApplied = true;
      store.set(shared);
      persistGraph(store.get()); // mirror so a refresh keeps it
      clearSharedModelFromUrl(); // keep the address bar clean
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // listen for VS Code IPC messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "LOAD_OKF_RESPONSE" && event.data.payload) {
        try {
          const loadedGraph = JSON.parse(event.data.payload);
          store.set(loadedGraph);
        } catch (e) {
          console.error("Failed to parse VS Code loaded model:", e);
        }
      }
    };
    window.addEventListener("message", handleMessage);

    // tell VS Code to load the initial model if it exists
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "LOAD_OKF" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
