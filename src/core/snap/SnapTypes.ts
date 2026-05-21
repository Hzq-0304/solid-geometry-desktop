import type { EntityId, EntityKind } from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";

export type SnapTargetType =
  | "none"
  | "grid"
  | "point"
  | "origin"
  | "axis"
  | "axisGridPoint"
  | "segment"
  | "segmentExtension"
  | "boundary"
  | "plane";

export interface SnapResult {
  readonly position: Vec3;
  readonly type: SnapTargetType;
  readonly targetEntityId?: EntityId;
  readonly targetEntityType?: EntityKind;
  readonly description?: string;
  readonly distance?: number;
  readonly screenDistance?: number;
  readonly cameraDistance?: number;
  readonly priority?: number;
  readonly worldDistance?: number;
}
