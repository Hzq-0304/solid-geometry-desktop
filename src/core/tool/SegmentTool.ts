import type { EntityId } from "../document/EntityTypes";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

export class SegmentTool implements Tool {
  readonly name = "segment";

  private firstPointId: EntityId | null = null;

  private getPointIdFromPointer(
    pointerInfo: PointerInfo,
    context: ToolContext,
  ): EntityId | null {
    if (pointerInfo.hitEntityId) {
      if (pointerInfo.hitEntityType !== "point") {
        return null;
      }

      return context.getPoint(pointerInfo.hitEntityId)
        ? pointerInfo.hitEntityId
        : null;
    }

    if (
      pointerInfo.snapResult?.type === "point" &&
      pointerInfo.snapResult.targetEntityId
    ) {
      return context.getPoint(pointerInfo.snapResult.targetEntityId)
        ? pointerInfo.snapResult.targetEntityId
        : null;
    }

    return null;
  }

  onPointerDown(pointerInfo: PointerInfo, context: ToolContext): void {
    const clickedPointId = this.getPointIdFromPointer(pointerInfo, context);

    if (!clickedPointId) {
      return;
    }

    if (!this.firstPointId) {
      this.firstPointId = clickedPointId;
      return;
    }

    if (this.firstPointId === clickedPointId) {
      return;
    }

    if (!context.getPoint(this.firstPointId)) {
      this.firstPointId = clickedPointId;
      return;
    }

    context.addSegment(this.firstPointId, clickedPointId);
    this.firstPointId = null;
  }

  cancel(): void {
    this.firstPointId = null;
  }

  getFirstPointId(): EntityId | null {
    return this.firstPointId;
  }
}
