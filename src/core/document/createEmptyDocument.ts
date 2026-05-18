import { createVec3 } from "../geometry/geometryUtils";
import type { BoardDocument, BoardSettings, CameraState } from "./BoardDocument";
import { createEntityId } from "./idGenerator";

export interface CreateEmptyDocumentOptions {
  readonly id?: string;
  readonly name?: string;
  readonly appVersion?: string;
  readonly now?: string;
}

const DEFAULT_FILE_VERSION = 1;
const DEFAULT_APP_VERSION = "0.1.0";

export const createDefaultBoardSettings = (): BoardSettings => ({
  showGrid: true,
  showAxes: true,
  snapEnabled: true,
  snapToGrid: true,
  snapToPoints: true,
  snapToSegments: true,
  snapToPlanes: true,
  snapToOrigin: true,
  snapToAxes: true,
  snapDistance: 0.12,
  snapPixelRadius: 12,
  pointSnapPixelRadius: 6,
  segmentSnapPixelRadius: 10,
  axisSnapPixelRadius: 8,
  originSnapPixelRadius: 8,
  axisGridPointSnapPixelRadius: 7,
  gridSnapPixelRadius: 8,
  forceGridSnap: false,
  gridSize: 1,
  activeDrawingPlane: "XY",
  showDrawingPlane: true,
  drawingPlaneOpacity: 0.18,
  drawingPlaneSolid: false,
});

export const createDefaultCameraState = (): CameraState => ({
  position: createVec3(6, -8, 6),
  target: createVec3(0, 0, 0),
  zoom: 1,
});

export const createEmptyDocument = (
  options: CreateEmptyDocumentOptions = {},
): BoardDocument => {
  const timestamp = options.now ?? new Date().toISOString();

  return {
    id: options.id ?? createEntityId("document"),
    name: options.name ?? "Untitled Board",
    fileVersion: DEFAULT_FILE_VERSION,
    appVersion: options.appVersion ?? DEFAULT_APP_VERSION,
    entities: {},
    selectedEntityIds: [],
    settings: createDefaultBoardSettings(),
    cameraState: createDefaultCameraState(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
