import type { EntityId } from "../document/EntityTypes";
import { getPlaneFromThreePoints } from "../geometry/planeUtils";
import { getPointWorldPosition } from "../geometry/pointPositionUtils";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

export type PlaneToolMessage =
  | "empty"
  | "duplicate-point"
  | "collinear"
  | "created"
  | null;

export class PlaneTool implements Tool {
  readonly name = "plane";

  private selectedPointIds: EntityId[] = [];
  private lastMessage: PlaneToolMessage = null;
  private lastCreatedPointIds: readonly [EntityId, EntityId, EntityId] | null =
    null;

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
      this.lastMessage = "empty";
      this.lastCreatedPointIds = null;
      return;
    }

    if (this.selectedPointIds.includes(clickedPointId)) {
      this.lastMessage = "duplicate-point";
      this.lastCreatedPointIds = null;
      return;
    }

    const nextPointIds = [...this.selectedPointIds, clickedPointId];

    if (nextPointIds.length < 3) {
      this.selectedPointIds = nextPointIds;
      this.lastMessage = null;
      this.lastCreatedPointIds = null;
      return;
    }

    const positions = nextPointIds.map((pointId) =>
      getPointWorldPosition(context.getDocument(), pointId),
    );

    if (
      !positions[0] ||
      !positions[1] ||
      !positions[2] ||
      !getPlaneFromThreePoints(
        positions[0],
        positions[1],
        positions[2],
      )
    ) {
      this.lastMessage = "collinear";
      this.lastCreatedPointIds = null;
      return;
    }

    context.addPlane(nextPointIds[0], nextPointIds[1], nextPointIds[2]);
    this.lastCreatedPointIds = [nextPointIds[0], nextPointIds[1], nextPointIds[2]];
    this.selectedPointIds = [];
    this.lastMessage = "created";
  }

  cancel(): void {
    this.selectedPointIds = [];
    this.lastMessage = null;
    this.lastCreatedPointIds = null;
  }

  getSelectedPointIds(): readonly EntityId[] {
    return this.selectedPointIds;
  }

  getLastMessage(): PlaneToolMessage {
    return this.lastMessage;
  }

  getLastCreatedPointIds(): readonly [EntityId, EntityId, EntityId] | null {
    return this.lastCreatedPointIds;
  }
}
