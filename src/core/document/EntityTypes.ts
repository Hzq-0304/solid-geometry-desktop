import type { Vec3 } from "../geometry/Vec3";

export type EntityId = string;

export type EntityKind =
  | "point"
  | "segment"
  | "plane"
  | "polygon"
  | "solid"
  | "label"
  | "measurement";

export interface EntityStyle {
  readonly color?: string;
}

export interface BaseEntity {
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly name?: string;
  readonly style?: EntityStyle;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PointEntity extends BaseEntity {
  readonly kind: "point";
  readonly position: Vec3;
  readonly nameSource?: "auto" | "manual";
}

export interface SegmentEntity extends BaseEntity {
  readonly kind: "segment";
  readonly pointIds: readonly [EntityId, EntityId];
}

export interface PlaneEntityStyle extends EntityStyle {
  readonly triangleColor?: string;
  readonly triangleOpacity?: number;
  readonly extensionColor?: string;
  readonly extensionOpacity?: number;
  readonly showExtensionWhenSelected?: boolean;
}

export interface PlaneEntity extends BaseEntity {
  readonly kind: "plane";
  readonly type: "plane";
  readonly pointIds: readonly [EntityId, EntityId, EntityId];
  readonly style?: PlaneEntityStyle;
}

export interface PolygonEntity extends BaseEntity {
  readonly kind: "polygon";
  readonly pointIds: readonly [EntityId, EntityId, EntityId, ...EntityId[]];
}

export interface SolidEntity extends BaseEntity {
  readonly kind: "solid";
  readonly pointIds: readonly EntityId[];
  readonly edgeIds: readonly EntityId[];
  readonly faceIds: readonly EntityId[];
}

export interface LabelEntity extends BaseEntity {
  readonly kind: "label";
  readonly text: string;
  readonly anchorPointId: EntityId;
  readonly targetEntityId?: EntityId;
}

export type MeasurementKind =
  | "length"
  | "distance"
  | "angle"
  | "linePlaneAngle"
  | "planePlaneAngle"
  | "area"
  | "volume";

export interface MeasurementEntity extends BaseEntity {
  readonly kind: "measurement";
  readonly measurementKind: MeasurementKind;
  readonly targetIds: readonly EntityId[];
  readonly pointIds: readonly EntityId[];
  readonly targetEntityIds: readonly EntityId[];
  readonly displayPosition?: {
    readonly mode: "screen" | "world";
    readonly x: number;
    readonly y: number;
    readonly z?: number;
  };
  readonly plane?: "XY" | "XZ" | "YZ";
  readonly value?: number;
  readonly unit?: string;
}

export type BoardEntity =
  | PointEntity
  | SegmentEntity
  | PlaneEntity
  | PolygonEntity
  | SolidEntity
  | LabelEntity
  | MeasurementEntity;
