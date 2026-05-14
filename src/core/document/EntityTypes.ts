import type { Vec3 } from "../geometry/Vec3";

export type EntityId = string;

export type EntityKind =
  | "point"
  | "segment"
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
}

export interface SegmentEntity extends BaseEntity {
  readonly kind: "segment";
  readonly pointIds: readonly [EntityId, EntityId];
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
  | "area"
  | "volume";

export interface MeasurementEntity extends BaseEntity {
  readonly kind: "measurement";
  readonly measurementKind: MeasurementKind;
  readonly targetIds: readonly EntityId[];
  readonly pointIds: readonly EntityId[];
  readonly targetEntityIds: readonly EntityId[];
  readonly value?: number;
  readonly unit?: string;
}

export type BoardEntity =
  | PointEntity
  | SegmentEntity
  | PolygonEntity
  | SolidEntity
  | LabelEntity
  | MeasurementEntity;
