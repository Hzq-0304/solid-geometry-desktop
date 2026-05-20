import type { Vec3 } from "../geometry/Vec3";
import type { BoardEntity, EntityId } from "./EntityTypes";

export type ActiveDrawingPlane = "XY" | "XZ" | "YZ";

export interface BoardSettings {
  readonly showGrid: boolean;
  readonly showAxes: boolean;
  readonly snapEnabled: boolean;
  readonly snapToGrid: boolean;
  readonly snapToPoints: boolean;
  readonly snapToSegments: boolean;
  readonly snapToPlanes: boolean;
  readonly snapToOrigin: boolean;
  readonly snapToAxes: boolean;
  readonly snapDistance: number;
  readonly snapPixelRadius: number;
  readonly pointSnapPixelRadius: number;
  readonly segmentSnapPixelRadius: number;
  readonly axisSnapPixelRadius: number;
  readonly originSnapPixelRadius: number;
  readonly axisGridPointSnapPixelRadius: number;
  readonly gridSnapPixelRadius: number;
  readonly forceGridSnap: boolean;
  readonly gridSize: number;
  readonly activeDrawingPlane: ActiveDrawingPlane;
  readonly showDrawingPlane: boolean;
  readonly drawingPlaneOpacity: number;
  readonly drawingPlaneSolid: boolean;
  readonly coordinateHalfSize: number;
  readonly showBoundaryCube: boolean;
}

export interface CameraState {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly zoom: number;
}

export type BoardEntityMap = Readonly<Record<EntityId, BoardEntity>>;

export interface BoardDocument {
  readonly id: EntityId;
  readonly name: string;
  readonly fileVersion: number;
  readonly appVersion: string;
  readonly entities: BoardEntityMap;
  readonly selectedEntityIds: readonly EntityId[];
  readonly settings: BoardSettings;
  readonly cameraState: CameraState;
  readonly createdAt: string;
  readonly updatedAt: string;
}
