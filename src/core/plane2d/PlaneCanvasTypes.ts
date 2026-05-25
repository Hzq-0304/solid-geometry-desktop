import type { CalculationExpression } from "../calculation/CalculationTypes";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export type Plane2DToolName =
  | "select"
  | "point"
  | "segment"
  | "circle"
  | "copyCircle"
  | "polygon"
  | "midpoint"
  | "perpendicular"
  | "extend"
  | "function"
  | "length"
  | "angle"
  | "calculation";

export type Plane2DIntersectionEdgeRef =
  | {
      readonly sourceType: "segment";
      readonly sourceEntityId: string;
    }
  | {
      readonly sourceType: "extension";
      readonly sourceEntityId: string;
      readonly edgeIndex: number;
    }
  | {
      readonly sourceType: "polygon-edge" | "regular-polygon-edge";
      readonly sourceEntityId: string;
      readonly edgeIndex: number;
    };

export type Plane2DPointConstruction =
  | {
      readonly kind: "segmentIntersection";
      readonly segmentAId?: string;
      readonly segmentBId?: string;
      readonly edgeA?: Plane2DIntersectionEdgeRef;
      readonly edgeB?: Plane2DIntersectionEdgeRef;
    }
  | {
      readonly kind: "midpoint";
      readonly pointAId: string;
      readonly pointBId: string;
    }
  | {
      readonly kind: "perpendicularFoot";
      readonly pointId: string;
      readonly segmentId: string;
    }
  | {
      readonly kind: "perpendicularEndpoint";
      readonly pointId: string;
      readonly segmentId: string;
      readonly side: 1 | -1;
      readonly length: number;
    }
  | {
      readonly kind: "copiedCircleRadiusPoint";
      readonly sourceCircleId: string;
      readonly centerPointId: string;
    }
  | {
      readonly kind: "regularPolygonVertex";
      readonly polygonId: string;
      readonly centerPointId: string;
      readonly radiusPointId: string;
      readonly vertexIndex: number;
      readonly sides: number;
      readonly rotationOffset?: number;
    }
  | {
      readonly kind: "regularPolygonVertexBySide";
      readonly polygonId: string;
      readonly firstPointId: string;
      readonly secondPointId: string;
      readonly vertexIndex: number;
      readonly sides: number;
      readonly side: 1 | -1;
    };

export interface Plane2DPointEntity {
  readonly id: string;
  readonly type: "plane2d-point";
  readonly position: Vec2;
  readonly visible?: boolean;
  readonly pointKind?: "free" | "constructed";
  readonly construction?: Plane2DPointConstruction;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export type Plane2DSegmentConstruction =
  | {
      readonly kind: "perpendicular";
      readonly pointId: string;
      readonly segmentId: string;
    }
  | {
      readonly kind: "perpendicularTargetExtension";
      readonly pointId: string;
      readonly targetSegmentId: string;
      readonly footPointId: string;
      readonly endpointRole: "start" | "end";
    };

export interface Plane2DSegmentEntity {
  readonly id: string;
  readonly type: "plane2d-segment";
  readonly startPointId: string;
  readonly endPointId: string;
  readonly visible?: boolean;
  readonly segmentKind?: "free" | "constructed" | "extension";
  readonly construction?: Plane2DSegmentConstruction;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface Plane2DCircleEntity {
  readonly id: string;
  readonly type: "plane2d-circle";
  readonly centerPointId: string;
  readonly radiusPointId: string;
  readonly visible?: boolean;
  readonly circleKind?: "free" | "constructed";
  readonly construction?: {
    readonly kind: "copyCircle";
    readonly sourceCircleId: string;
    readonly centerPointId: string;
  };
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export type Plane2DPolygonConstruction =
  | {
      readonly kind: "regularPolygon";
      readonly centerPointId: string;
      readonly radiusPointId: string;
      readonly sides: number;
      readonly rotationOffset?: number;
    }
  | {
      readonly kind: "regularPolygonBySide";
      readonly firstPointId: string;
      readonly secondPointId: string;
      readonly sides: number;
      readonly side: 1 | -1;
    };

export interface Plane2DPolygonEntity {
  readonly id: string;
  readonly type: "plane2d-polygon";
  readonly vertexPointIds: readonly string[];
  readonly visible?: boolean;
  readonly polygonKind?: "free" | "regular";
  readonly construction?: Plane2DPolygonConstruction;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export type Plane2DLengthMeasurementDefinition =
  | {
      readonly kind: "segmentLength";
      readonly segmentId: string;
    }
  | {
      readonly kind: "pointDistance";
      readonly pointAId: string;
      readonly pointBId: string;
    };

export type Plane2DAngleMeasurementDefinition =
  | {
      readonly kind: "segmentSegmentAngle";
      readonly segmentAId: string;
      readonly segmentBId: string;
    }
  | {
      readonly kind: "threePointAngle";
      readonly pointAId: string;
      readonly vertexPointId: string;
      readonly pointCId: string;
    };

export interface Plane2DMeasurementEntity {
  readonly id: string;
  readonly type: "plane2d-measurement";
  readonly measurementKind: "length" | "angle";
  readonly definition:
    | Plane2DLengthMeasurementDefinition
    | Plane2DAngleMeasurementDefinition;
  readonly labelPosition?: Vec2;
  readonly visible?: boolean;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface Plane2DExtensionEntity {
  readonly id: string;
  readonly type: "plane2d-extension";
  readonly targetSegmentId: string;
  readonly extensionKind: "segmentExtension";
  readonly visible: boolean;
  readonly snapEnabled: boolean;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface Plane2DCalculationEntity {
  readonly id: string;
  readonly type: "plane2d-calculation";
  readonly expression: CalculationExpression;
  readonly labelPosition: Vec2;
  readonly visible?: boolean;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface Plane2DFunctionGraphEntity {
  readonly id: string;
  readonly type: "plane2d-function-graph";
  readonly expression: string;
  readonly variable: "x";
  readonly xMin: number;
  readonly xMax: number;
  readonly sampleCount: number;
  readonly strokeWidth?: number;
  readonly visible?: boolean;
  readonly name?: string;
  readonly nameSource?: "auto" | "manual";
  readonly showName?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export type Plane2DEntity =
  | Plane2DPointEntity
  | Plane2DSegmentEntity
  | Plane2DCircleEntity
  | Plane2DPolygonEntity
  | Plane2DMeasurementEntity
  | Plane2DExtensionEntity
  | Plane2DCalculationEntity
  | Plane2DFunctionGraphEntity;

export interface PlaneCanvasDocument {
  readonly id: string;
  readonly type: "plane2d";
  readonly name: string;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly entities: Record<string, Plane2DEntity>;
  readonly selectedEntityIds: readonly string[];
  readonly settings: {
    readonly showGrid: false;
    readonly snapToPoints: boolean;
    readonly snapToSegments: boolean;
    readonly snapDistancePx: number;
    readonly pointSizePx: number;
    readonly lineWidthPx: number;
  };
}

export interface PlaneCanvasProjectFile {
  readonly fileVersion: 1;
  readonly appName: "Solid Geometry Studio";
  readonly appVersion: string;
  readonly savedAt: string;
  readonly document: PlaneCanvasDocument;
}
