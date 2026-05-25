import type { ActiveDrawingPlane } from "../document/BoardDocument";
import type { EntityId, EntityKind } from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import type { SnapResult } from "../snap/SnapTypes";
import type { ToolContext } from "./ToolContext";

export type ToolName =
  | "select"
  | "point"
  | "segment"
  | "perpendicular"
  | "midpoint"
  | "extend"
  | "parallel"
  | "intersection"
  | "plane"
  | "functionSurface"
  | "move"
  | "measureLength"
  | "measureAngle"
  | "calculation";

export interface PointerRay {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface PointerViewInfo {
  readonly cameraPosition: Vec3;
  readonly viewportHeight: number;
  readonly perspectiveFovRadians?: number;
  readonly orthographicWorldHeight?: number;
}

export interface PointerInfo {
  readonly worldPosition: Vec3 | null;
  readonly rawPositionSource?: "drawingPlane" | "boundary";
  readonly pointerRay?: PointerRay;
  readonly pointerViewInfo?: PointerViewInfo;
  readonly hitEntityId: EntityId | null;
  readonly hitEntityType: EntityKind | null;
  readonly planeSnapEntityId?: EntityId | null;
  readonly drawingPlane: ActiveDrawingPlane;
  readonly snapResult: SnapResult | null;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export interface Tool {
  readonly name: ToolName;
  onPointerDown(pointerInfo: PointerInfo, context: ToolContext): void;
}
