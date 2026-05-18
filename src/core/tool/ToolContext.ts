import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  EntityStyle,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import type { SnapResult } from "../snap/SnapTypes";
import type { EntityUpdate } from "../command/UpdateEntityCommand";

export interface AddPointOptions {
  readonly id?: EntityId;
  readonly name?: string;
  readonly style?: EntityStyle;
}

export interface ToolContext {
  addPoint(position: Vec3, options?: AddPointOptions): void;
  addSegment(startPointId: EntityId, endPointId: EntityId): void;
  addPlane(pointAId: EntityId, pointBId: EntityId, pointCId: EntityId): void;
  addLengthMeasurement(targetIds: readonly EntityId[]): void;
  addAngleMeasurement(
    pointAId: EntityId,
    vertexBId: EntityId,
    pointCId: EntityId,
  ): void;
  selectEntity(entityId: EntityId): void;
  toggleSelection(entityId: EntityId): void;
  clearSelection(): void;
  setSelection(entityIds: readonly EntityId[]): void;
  getSelectedEntityIds(): readonly EntityId[];
  deleteSelectedEntities(): void;
  updateEntity(entityId: EntityId, patch: EntityUpdate): void;
  getEntity(entityId: EntityId): BoardEntity | null;
  getPoint(entityId: EntityId): PointEntity | null;
  getSegment(entityId: EntityId): SegmentEntity | null;
  getPlane(entityId: EntityId): PlaneEntity | null;
  getDocument(): BoardDocument;
  getActiveDrawingPlane(): ActiveDrawingPlane;
  snapPosition(position: Vec3): SnapResult;
}
