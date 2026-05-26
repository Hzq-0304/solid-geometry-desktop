import type { EntityId } from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import type {
  Plane2DSectionMetadata,
  Plane2DSectionRelation,
  Plane2DSectionSourceRef,
  Vec2,
} from "../plane2d/PlaneCanvasTypes";

export interface SectionPlane3D {
  readonly origin: Vec3;
  readonly normal: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

export type SectionSourceRelation = Plane2DSectionRelation;
export type SectionSourceRef = Plane2DSectionSourceRef;

export interface SectionPointResult {
  readonly id: string;
  readonly kind: "point";
  readonly position3D: Vec3;
  readonly position2D: Vec2;
  readonly sourceRef: SectionSourceRef;
  readonly label?: string;
}

export interface SectionLineResult {
  readonly id: string;
  readonly kind: "line";
  readonly point3D: Vec3;
  readonly direction3D: Vec3;
  readonly point2D: Vec2;
  readonly direction2D: Vec2;
  readonly sourceRef: SectionSourceRef;
  readonly label?: string;
  readonly lineKind: "segment" | "line";
  readonly endPoint3D?: Vec3;
  readonly endPoint2D?: Vec2;
}

export interface SectionCoincidentPlaneResult {
  readonly id: string;
  readonly kind: "coincidentPlane";
  readonly sourceRef: SectionSourceRef;
  readonly label?: string;
}

export type SectionResult =
  | SectionPointResult
  | SectionLineResult
  | SectionCoincidentPlaneResult;

export interface SectionSolveOptions {
  readonly sourceDocumentId?: string;
  readonly sourceTabId?: string;
  readonly sectionPlane: SectionPlane3D;
  readonly sectionPlaneSourceEntityId?: EntityId;
}

export interface SectionDocumentOptions {
  readonly title: string;
  readonly source3DTabId: string;
  readonly source3DDocumentId?: string;
  readonly sourceSectionEntityId?: string;
  readonly sectionPlane: SectionPlane3D;
  readonly sourceGeometryRevision?: number;
  readonly lastSyncedAt?: string;
  readonly needsSync?: boolean;
  readonly needsSyncFrom3D?: boolean;
  readonly needsSyncTo3D?: boolean;
  readonly syncBackEnabled?: boolean;
  readonly lastSyncedTo3DAt?: string;
  readonly localEditRevision?: number;
  readonly lastSyncedTo3DLocalRevision?: number;
}

export type Plane2DSectionDocumentMetadata = Plane2DSectionMetadata;
