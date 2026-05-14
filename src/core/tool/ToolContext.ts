import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  EntityStyle,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import type { SnapResult } from "../snap/SnapTypes";

export interface AddPointOptions {
  readonly id?: EntityId;
  readonly name?: string;
  readonly style?: EntityStyle;
}

export interface ToolContext {
  addPoint(position: Vec3, options?: AddPointOptions): void;
  addSegment(startPointId: EntityId, endPointId: EntityId): void;
  addLengthMeasurement(targetIds: readonly EntityId[]): void;
  addAngleMeasurement(
    pointAId: EntityId,
    vertexBId: EntityId,
    pointCId: EntityId,
  ): void;
  getEntity(entityId: EntityId): BoardEntity | null;
  getPoint(entityId: EntityId): PointEntity | null;
  getSegment(entityId: EntityId): SegmentEntity | null;
  getDocument(): BoardDocument;
  getActiveDrawingPlane(): ActiveDrawingPlane;
  snapPosition(position: Vec3): SnapResult;
}
