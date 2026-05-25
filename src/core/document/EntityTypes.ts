import type { CalculationExpression } from "../calculation/CalculationTypes";
import type { Vec3 } from "../geometry/Vec3";

export type EntityId = string;

export type EntityKind =
  | "point"
  | "segment"
  | "perpendicularLine"
  | "linePlanePerpendicular"
  | "extension"
  | "plane"
  | "polygon"
  | "solid"
  | "label"
  | "measurement"
  | "calculation";

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

export type PointConstruction =
  | {
      readonly kind: "footToLine";
      readonly sourcePointId: EntityId;
      readonly targetSegmentId: EntityId;
    }
  | {
      readonly kind: "footToPlane";
      readonly sourcePointId: EntityId;
      readonly targetPlaneId: EntityId;
    }
  | {
      readonly kind: "midpoint";
      readonly pointAId: EntityId;
      readonly pointBId: EntityId;
    }
  | {
      readonly kind: "perpendicularDirectionToLine";
      readonly sourcePointId: EntityId;
      readonly targetSegmentId: EntityId;
      readonly guidePosition: Vec3;
    }
  | {
      readonly kind: "perpendicularDirectionToPlane";
      readonly sourcePointId: EntityId;
      readonly targetPlaneId: EntityId;
      readonly sign: 1 | -1;
      readonly length: number;
    }
  | {
      readonly kind: "parallelSegmentEndpoint";
      readonly anchorPointId: EntityId;
      readonly sourceSegmentId: EntityId;
      readonly sourceAnchorEndpoint: "start" | "end";
      readonly targetEndpoint: "other";
    }
  | {
      readonly kind: "parallelPlaneVertex";
      readonly anchorPointId: EntityId;
      readonly sourcePlaneId: EntityId;
      readonly sourceAnchorVertexIndex: 0 | 1 | 2;
      readonly sourceVertexIndex: 0 | 1 | 2;
    }
  | {
      readonly kind: "lineLineIntersection";
      readonly segmentAId: EntityId;
      readonly segmentBId: EntityId;
    }
  | {
      readonly kind: "linePlaneIntersection";
      readonly segmentId: EntityId;
      readonly planeId: EntityId;
    }
  | {
      readonly kind: "planePlaneIntersectionEndpoint";
      readonly planeAId: EntityId;
      readonly planeBId: EntityId;
      readonly endpoint: "start" | "end";
    };

export interface PointEntity extends BaseEntity {
  readonly kind: "point";
  readonly position: Vec3;
  readonly nameSource?: "auto" | "manual";
  readonly pointKind?: "free" | "constructed";
  readonly construction?: PointConstruction;
}

export interface SegmentEntity extends BaseEntity {
  readonly kind: "segment";
  readonly pointIds: readonly [EntityId, EntityId];
  readonly nameSource?: "auto" | "manual";
}

export interface PerpendicularLineStyle extends EntityStyle {
  readonly lineColor?: string;
  readonly lineWidth?: number;
  readonly extensionColor?: string;
  readonly extensionLineWidth?: number;
  readonly extensionDash?: boolean;
  readonly showExtensionHelper?: boolean;
}

export interface PerpendicularLineEntity extends BaseEntity {
  readonly kind: "perpendicularLine";
  readonly type: "perpendicularLine";
  readonly pointId: EntityId;
  readonly segmentId: EntityId;
  readonly footPointId?: EntityId;
  readonly directionPointId?: EntityId;
  readonly constructionMode?: "foot" | "userDirection";
  readonly directionMode?: "auto" | "userPick";
  readonly nameSource?: "auto" | "manual";
  readonly style?: PerpendicularLineStyle;
}

export interface LinePlanePerpendicularStyle extends EntityStyle {
  readonly lineColor?: string;
  readonly lineWidth?: number;
  readonly extensionFillColor?: string;
  readonly extensionFillOpacity?: number;
  readonly helperLineColor?: string;
  readonly helperLineDash?: boolean;
  readonly showExtensionHelper?: boolean;
}

export interface LinePlanePerpendicularEntity extends BaseEntity {
  readonly kind: "linePlanePerpendicular";
  readonly type: "linePlanePerpendicular";
  readonly pointId: EntityId;
  readonly planeId: EntityId;
  readonly footPointId?: EntityId;
  readonly directionPointId?: EntityId;
  readonly constructionMode?: "foot" | "userDirection";
  readonly directionMode?: "auto" | "userPick";
  readonly nameSource?: "auto" | "manual";
  readonly style?: LinePlanePerpendicularStyle;
}

export interface ExtensionEntityStyle extends EntityStyle {
  readonly lineExtensionColor?: string;
  readonly lineExtensionWidth?: number;
  readonly lineExtensionDash?: boolean;
  readonly planeExtensionColor?: string;
  readonly planeExtensionOpacity?: number;
  readonly boundaryLineColor?: string;
}

export interface ExtensionEntity extends BaseEntity {
  readonly kind: "extension";
  readonly type: "extension";
  readonly targetId: EntityId;
  readonly targetType: "segment" | "plane";
  readonly mode: "toBoundaryCube";
  readonly snapEnabled?: boolean;
  readonly nameSource?: "auto" | "manual";
  readonly style?: ExtensionEntityStyle;
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
  readonly nameSource?: "auto" | "manual";
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

export interface CalculationEntity extends BaseEntity {
  readonly kind: "calculation";
  readonly type: "calculation";
  readonly expression: CalculationExpression;
  readonly labelPosition?: {
    readonly mode: "screen" | "world";
    readonly x: number;
    readonly y: number;
    readonly z?: number;
  };
  readonly nameSource?: "auto" | "manual";
}

export type BoardEntity =
  | PointEntity
  | SegmentEntity
  | PerpendicularLineEntity
  | LinePlanePerpendicularEntity
  | ExtensionEntity
  | PlaneEntity
  | PolygonEntity
  | SolidEntity
  | LabelEntity
  | MeasurementEntity
  | CalculationEntity;
