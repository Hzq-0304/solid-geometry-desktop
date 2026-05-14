import type { EntityId } from "../document/EntityTypes";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

export class MeasureAngleTool implements Tool {
  readonly name = "measureAngle";

  private selectedPointIds: EntityId[] = [];
  private lastMessage: string | null = null;

  private getPointIdFromPointer(
    pointerInfo: PointerInfo,
    context: ToolContext,
  ): EntityId | null {
    if (pointerInfo.hitEntityId && pointerInfo.hitEntityType === "point") {
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
    this.lastMessage = null;

    const pointId = this.getPointIdFromPointer(pointerInfo, context);

    if (!pointId) {
      this.lastMessage = "empty";
      return;
    }

    if (this.selectedPointIds.includes(pointId)) {
      this.lastMessage = "duplicate-point";
      return;
    }

    this.selectedPointIds = [...this.selectedPointIds, pointId];

    if (this.selectedPointIds.length < 3) {
      return;
    }

    const [pointAId, vertexBId, pointCId] = this.selectedPointIds;
    context.addAngleMeasurement(pointAId, vertexBId, pointCId);
    this.selectedPointIds = [];
    this.lastMessage = "measured-angle";
  }

  cancel(): void {
    this.selectedPointIds = [];
    this.lastMessage = null;
  }

  getSelectedPointIds(): readonly EntityId[] {
    return this.selectedPointIds;
  }

  getLastMessage(): string | null {
    return this.lastMessage;
  }
}
