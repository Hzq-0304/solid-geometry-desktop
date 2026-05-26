import type { CalculationExpression } from "../calculation/CalculationTypes";
import type { Vec3 } from "../geometry/Vec3";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export type Plane2DSectionRelation =
  | "line-plane-intersection-point"
  | "line-contained-in-section-plane"
  | "plane-plane-intersection-line"
  | "plane-coincident-with-section-plane"
  | "face-extension-intersection-line"
  | "section-local-point"
  | "section-local-segment";

export interface Plane2DSectionSourceRef {
  readonly sourceDocumentId?: string;
  readonly sourceTabId?: string;
  readonly sourceEntityId: string;
  readonly sourceEntityType: string;
  readonly sourceName?: string;
  readonly relation: Plane2DSectionRelation;
}

export interface Plane2DSectionObjectRef {
  readonly kind: "section-object";
  readonly sectionResultId: string;
  readonly sourceKey?: string;
  readonly source3DTabId?: string;
  readonly source3DEntityId?: string;
  readonly source3DEntityType?: string;
  readonly syncDirection?: "from3d" | "to3d" | "bidirectional" | "local2d";
  readonly syncBackMode?:
    | "create-3d-point"
    | "create-3d-segment"
    | "update-3d-point"
    | "update-3d-segment"
    | "readonly"
    | "unsupported";
  readonly createdBySection2DSync?: boolean;
  readonly sourceRef: Plane2DSectionSourceRef;
  readonly position3D?: Vec3;
  readonly linePoint3D?: Vec3;
  readonly lineDirection3D?: Vec3;
  readonly lineKind?: "point" | "segment" | "line";
}

export interface Plane2DSectionMetadata {
  readonly kind: "section-from-3d";
  readonly source3DTabId: string;
  readonly source3DDocumentId?: string;
  readonly sourceSectionEntityId?: string;
  readonly sectionPlane: {
    readonly origin: Vec3;
    readonly normal: Vec3;
    readonly u: Vec3;
    readonly v: Vec3;
  };
  readonly sourceGeometryRevision: number;
  readonly lastSyncedAt: string;
  readonly needsSync?: boolean;
  readonly needsSyncFrom3D?: boolean;
  readonly needsSyncTo3D?: boolean;
  readonly lastSyncedTo3DAt?: string;
  readonly localEditRevision?: number;
  readonly lastSyncedTo3DLocalRevision?: number;
  readonly pendingSyncTo3DDeletes?: readonly {
    readonly source3DEntityId: string;
    readonly source3DEntityType: string;
    readonly sourceKey: string;
    readonly deleted2DEntityId: string;
  }[];
  readonly coincidentPlanes?: readonly Plane2DSectionSourceRef[];
  readonly createdAt: string;
  readonly liveUpdateEnabled: false;
  readonly syncBackEnabled: boolean;
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
      readonly constructionGroupId?: string;
    }
  | {
      readonly kind: "perpendicularEndpoint";
      readonly pointId: string;
      readonly segmentId: string;
      readonly side: 1 | -1;
      readonly length: number;
      readonly constructionGroupId?: string;
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
  readonly locked?: boolean;
  readonly draggable?: boolean;
  readonly pointKind?: "free" | "constructed";
  readonly construction?: Plane2DPointConstruction;
  readonly sectionRef?: Plane2DSectionObjectRef;
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
      readonly constructionGroupId?: string;
    }
  | {
      readonly kind: "perpendicularTargetExtension";
      readonly pointId: string;
      readonly targetSegmentId: string;
      readonly footPointId: string;
      readonly endpointRole: "start" | "end";
      readonly constructionGroupId?: string;
    };

export interface Plane2DSegmentEntity {
  readonly id: string;
  readonly type: "plane2d-segment";
  readonly startPointId: string;
  readonly endPointId: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly draggable?: boolean;
  readonly segmentKind?: "free" | "constructed" | "extension";
  readonly construction?: Plane2DSegmentConstruction;
  readonly sectionRef?: Plane2DSectionObjectRef;
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
  readonly section?: Plane2DSectionMetadata;
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
