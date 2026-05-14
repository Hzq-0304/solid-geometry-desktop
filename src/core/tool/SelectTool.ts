import type { EntityKind } from "../document/EntityTypes";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

const SELECTABLE_ENTITY_KINDS = new Set<EntityKind>([
  "point",
  "segment",
  "measurement",
  "polygon",
  "solid",
]);

export class SelectTool implements Tool {
  readonly name = "select";

  onPointerDown(pointerInfo: PointerInfo, context: ToolContext): void {
    const { hitEntityId, hitEntityType } = pointerInfo;

    if (
      hitEntityId &&
      hitEntityType &&
      SELECTABLE_ENTITY_KINDS.has(hitEntityType) &&
      context.getEntity(hitEntityId)
    ) {
      if (pointerInfo.ctrlKey) {
        context.toggleSelection(hitEntityId);
        return;
      }

      context.selectEntity(hitEntityId);
      return;
    }

    if (!pointerInfo.ctrlKey) {
      context.clearSelection();
    }
  }
}
