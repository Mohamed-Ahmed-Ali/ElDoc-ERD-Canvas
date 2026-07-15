export type InputSource = "SQL" | "CONNECTOR" | "VIEW" | "TABLE";
export type NodeStatus = "pending" | "creating" | "created" | "error";
export type Cardinality = "1:1" | "1:N" | "N:1" | "N:N";
// how a measure aggregates across dimensions. `additive` sums/avgs along every
// dimension; `semi-additive` along some (e.g. over time); `non-additive` only
// on the grain (ratios, medians). Stored on the field, surfaced in the linter.
export type MeasureType = "additive" | "semi-additive" | "non-additive";

export interface SchemaField {
  name: string;
  type: string;

  // legacy fields kept temporarily for backward compatibility
  // (Removed pk and fk in favor of role/keyType)
  pk?: boolean;
  fk?: boolean;

  index?: boolean;
  sk?: boolean;
  generationRule?: string;
  alias?: string;
  description?: string;
  pii?: boolean;
  isMeasure?: boolean;
  measureType?: MeasureType;
  nullable?: boolean;
  defaultValue?: string;
  unique?: boolean;
  checkExpression?: string;

  // dimensional Modeling & Data Vault Semantics
  role?: "none" | "pk" | "fk" | "ak";
  keyType?: "attribute" | "businessKey" | "surrogateSequence" | "surrogateUuid" | "surrogateHash";
  isComposite?: boolean;
  compositeGroup?: string | null;
  hashConfig?: {
    sourceColumns: string[];
    algorithm: "md5" | "sha1" | "sha256";
    delimiter: string;
    prefix?: string;
  };
  foreignKeyRef?: {
    targetTable: string;
    targetColumn: string;
  };
}
export interface JoinKey {
  left: string;
  right: string;
}

export interface ModelNode {
  key: string;
  namespace?: string;
  // `mart` is a normal dimension/fact. `bridge` is a factless-fact (resolves an
  // n:N — two FKs into the bridged dimensions, no measures). `group` is visual.
  type?: "mart" | "group" | "bridge";
  title: string;
  inputSource: InputSource;
  description?: string;
  eldocId?: string;
  definition?: string | null; // optional source definition (SQL / table ref / view)
  schema: SchemaField[];
  position: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string;
  color?: string;
  status: NodeStatus;
  createdAt?: string | null;
  createdBy?: string | null;
  error?: string | null;
  // the grain of a fact (e.g. "one row per order line"). Empty on dimensions.
  grain?: string;
  tags?: string[];
  isHidden?: boolean;
}
export type RelationDirection = "unspecified" | "from_to" | "to_from" | "bidirectional";

export interface ModelEdge {
  id: string;
  from: string;
  to: string;
  keys: JoinKey[];
  bidirectional: boolean;
  direction?: RelationDirection;
  waypoints?: { x: number; y: number }[];
  cardinality?: Cardinality;
  lineType?: "straight" | "step" | "bezier";
  color?: string;
  // canvas-only hints for which ports the edge attaches to (not encoded in OKF).
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
}
export interface ModelGraph {
  storageId: string | null;
  version?: number;
  warnings?: any[];
  nodes: ModelNode[];
  edges: ModelEdge[];
  // optional business glossary + KPI/metric dictionary. Lives on the graph so it
  // travels with the canvas, OKF round-trips, templates, and share links. The
  // list is intentionally flat — a glossary entry maps a business term to one or
  // more `nodeKey/fldName` references; a KPI entry is the same plus an owner and
  // a plain-language formula. Kept off the OKF markdown surface (no spec for it
  // yet) and dropped by `share/url.ts` only if it's the cleanest path.
  glossary?: GlossaryEntry[];
  kpis?: KpiEntry[];
  // lightweight review/collaboration: a thread anchor (node or edge) + an array
  // of comments. No users in an anonymous-first tool; `author` is a free text
  // handle the user types once and we persist locally. Resolved threads stay in
  // history but are filtered out of the open-threads count.
  comments?: CommentEntry[];
  // manual tags that can be assigned to nodes for filtering
  tags?: TagEntry[];
}

/** A tag that can be assigned to a node for filtering/coloring. */
export interface TagEntry {
  id: string;
  name: string;
  color: string;
}

/** A business term in the glossary. `refs` links the term to concrete columns. */
export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  refs?: { nodeKey: string; fieldName?: string }[];
}

/** A KPI/metric definition with a plain-language formula and owner. */
export interface KpiEntry {
  id: string;
  name: string;
  definition: string; // what it is
  formula: string; // how it's calculated (plain language)
  owner?: string; // accountable team / person
  refs?: { nodeKey: string; fieldName?: string }[];
}

/** A comment on a node or an edge. Thread = `anchorType + anchorId`. */
export interface CommentEntry {
  id: string;
  anchorType: "node" | "edge";
  anchorId: string;
  author: string;
  body: string;
  createdAt: string; // ISO
  resolved?: boolean;
}
