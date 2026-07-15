import type { ModelNode } from "@mc/okf";
import { VIEW_CONFIG, type ViewMode } from "../../state/viewMode";

const ERD_HEADER = 66; // header + type-chip row
const ERD_ROW = 24;
const ERD_EXPAND_ROW = 26; // "show N more / less" toggle row

export const ERD_COLLAPSED_ROWS = 4;

export function erdAwareNodeSize(
  node: ModelNode,
  viewMode: ViewMode,
): { width: number; height: number } {
  const config = VIEW_CONFIG[viewMode];
  if (viewMode === "compact") return { width: config.nodeWidth, height: 90 };

  const total = node.schema.length;
  const rows = Math.max(Math.min(total, ERD_COLLAPSED_ROWS), 1);
  const expandRow = total > ERD_COLLAPSED_ROWS ? ERD_EXPAND_ROW : 0;
  return { width: config.nodeWidth, height: ERD_HEADER + rows * ERD_ROW + expandRow };
}
