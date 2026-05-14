import type { EntityId } from "../document/EntityTypes";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

export class MeasureLengthTool implements Tool {
  readonly name = "measureLength";

  private firstPointId: EntityId | null = null;
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

    if (pointerInfo.hitEntityId && pointerInfo.hitEntityType === "segment") {
      if (context.getSegment(pointerInfo.hitEntityId)) {
        context.addLengthMeasurement([pointerInfo.hitEntityId]);
        this.firstPointId = null;
        this.lastMessage = "measured-segment";
      }
      return;
    }

    const clickedPointId = this.getPointIdFromPointer(pointerInfo, context);

    if (!clickedPointId) {
      this.lastMessage = "empty";
      return;
    }

    if (!this.firstPointId) {
      this.firstPointId = clickedPointId;
      return;
    }

    if (this.firstPointId === clickedPointId) {
      this.lastMessage = "same-point";
      return;
    }

    if (!context.getPoint(this.firstPointId)) {
      this.firstPointId = clickedPointId;
      return;
    }

    context.addLengthMeasurement([this.firstPointId, clickedPointId]);
    this.firstPointId = null;
    this.lastMessage = "measured-points";
  }

  cancel(): void {
    this.firstPointId = null;
    this.lastMessage = null;
  }

  getFirstPointId(): EntityId | null {
    return this.firstPointId;
  }

  getLastMessage(): string | null {
    return this.lastMessage;
  }
}
