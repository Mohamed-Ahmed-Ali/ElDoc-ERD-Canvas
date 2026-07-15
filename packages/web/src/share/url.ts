import type { ModelEdge, ModelGraph, ModelNode, SchemaField } from "@mc/okf";

// shareable model links. The whole model is gzip-compressed and packed into the
// uRL hash (#m=…) — no backend, fully anonymous, and the hash never leaves the
// browser for the server. Opening the link reopens the exact model (layout
// included). Every shared/forked model is a backlink and an impression: the
// growth loop for a free tool.

const HASH_KEY = "m";

// extraneous fields (status, createdBy, …) are dropped: a shared model
// is a clean draft, and we never leak another project's info into a public URL.
function sanitize(g: ModelGraph): ModelGraph {
  return {
    storageId: null,
    nodes: g.nodes.map(
      (n): ModelNode => ({
        key: n.key,
        title: n.title,
        inputSource: n.inputSource,
        description: n.description,
        schema: n.schema.map(
          (f): SchemaField => ({
            name: f.name,
            type: f.type,
            ...(f.role !== undefined ? { role: f.role } : {}),
            ...(f.index !== undefined ? { index: f.index } : {}),
            ...(f.sk !== undefined ? { sk: f.sk } : {}),
            ...(f.generationRule !== undefined ? { generationRule: f.generationRule } : {}),
            ...(f.alias !== undefined ? { alias: f.alias } : {}),
            ...(f.description !== undefined ? { description: f.description } : {}),
            ...(f.pii !== undefined ? { pii: f.pii } : {}),
            ...(f.isMeasure !== undefined ? { isMeasure: f.isMeasure } : {}),
            ...(f.measureType !== undefined ? { measureType: f.measureType } : {}),
          }),
        ),
        position: n.position,
        status: "pending",
        ...(n.type ? { type: n.type } : {}),
        ...(n.definition !== undefined && n.definition !== null
          ? { definition: n.definition }
          : {}),
        ...(n.grain !== undefined ? { grain: n.grain } : {}),
        ...(n.parentId !== undefined ? { parentId: n.parentId } : {}),
        ...(n.width !== undefined ? { width: n.width } : {}),
        ...(n.height !== undefined ? { height: n.height } : {}),
        ...(n.color !== undefined ? { color: n.color } : {}),
        ...(n.isHidden !== undefined ? { isHidden: n.isHidden } : {}),
        ...(n.tags?.length ? { tags: n.tags } : {}),
      }),
    ),
    edges: g.edges.map(
      (e): ModelEdge => ({
        id: e.id,
        from: e.from,
        to: e.to,
        keys: e.keys,
        bidirectional: e.bidirectional,
        cardinality: e.cardinality,
        ...(e.direction !== undefined ? { direction: e.direction } : {}),
      }),
    ),
    ...(g.glossary?.length ? { glossary: g.glossary } : {}),
    ...(g.kpis?.length ? { kpis: g.kpis } : {}),
    ...(g.tags?.length ? { tags: g.tags } : {}),
    // ponytail: comments travel in the share link too — anonymous-first means
    // there's no separate persistence path, so dropping them on share would
    // silently delete a review thread. Authors are free-text handles, not PII.
    ...(g.comments?.length ? { comments: g.comments } : {}),
  };
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compress a model graph into a compact, URL-safe payload string. */
export async function encodeModel(graph: ModelGraph): Promise<string> {
  const json = JSON.stringify(sanitize(graph));
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToB64url(new Uint8Array(buffer));
}

/** Reverse of encodeModel. Returns null on any malformed/corrupt payload. */
export async function decodeModel(payload: string): Promise<ModelGraph | null> {
  // ponytail: refuse empty/blank payloads explicitly. The old regex captured an
  // empty value for `#m=` and b64urlToBytes produced a valid (empty) gzip frame,
  // so `JSON.parse("")` threw and returned null — but a siblings case (`#m=&x=…`)
  // captured `""` then fell through to `sanitize({nodes:[],edges:[]})`, opening
  // an empty canvas with no error. Guard at the trust boundary.
  if (!payload) return null;
  try {
    const bytes = b64urlToBytes(payload);
    const stream = new Blob([bytes.buffer as ArrayBuffer])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const json = await new Response(stream).text();
    const g = JSON.parse(json) as ModelGraph;
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
    return sanitize(g); // re-normalize (defends against hand-edited payloads)
  } catch {
    return null;
  }
}

/** Fetch a model graph from a public GitHub Gist. */
export async function fetchGistModel(gistId: string): Promise<ModelGraph | null> {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.files) return null;

    for (const filename of Object.keys(data.files)) {
      const file = data.files[filename];
      if (file.content) {
        try {
          const parsed = JSON.parse(file.content);
          if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            return parsed as ModelGraph;
          }
        } catch {
          // ignore and try other files
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch Gist model:", e);
  }
  return null;
}

// ponytail: most browsers cap a URL around 32k–2MB and some Chrome versions
// silently truncate `location.hash` past that. If a 50-node template ever
// encodes bigger, building the link should fail loudly rather than emitting a
// truncated URL that decodes to garbage on the other end. 2MB is a generous
// ceiling well under Chrome's per-hash limit; raise if real models exceed it.
const MAX_SHARE_BYTES = 2 * 1024 * 1024;

/** Full shareable URL for the current page that reopens `graph`. */
export async function buildShareUrl(graph: ModelGraph): Promise<string> {
  const payload = await encodeModel(graph);
  if (payload.length > MAX_SHARE_BYTES) {
    throw new Error(
      `Share link too large (${payload.length} bytes > ${MAX_SHARE_BYTES}). Export OKF instead.`,
    );
  }
  return `${location.origin}${location.pathname}#${HASH_KEY}=${payload}`;
}

/** If the current URL carries a shared model, decode it; otherwise null. */
export async function readSharedModel(): Promise<ModelGraph | null> {
  const matchM = new RegExp(`[#&]${HASH_KEY}=([^&]+)`).exec(location.hash);
  if (matchM) {
    return await decodeModel(matchM[1]);
  }

  const matchG = /[#&](?:g|gist)=([^&]+)/.exec(location.hash);
  if (matchG) {
    const gistId = matchG[1];
    const graph = await fetchGistModel(gistId);
    return graph ? sanitize(graph) : null;
  }

  return null;
}

/** Strip the shared-model payload from the address bar (after we've loaded it),
 *  so a refresh doesn't re-clobber the canvas and the URL stays clean. */
export function clearSharedModelFromUrl(): void {
  if (new RegExp(`[#&](?:${HASH_KEY}|g|gist)=`).test(location.hash)) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}
