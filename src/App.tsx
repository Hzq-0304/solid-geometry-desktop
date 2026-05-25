import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import {
  Grid3X3,
  MousePointer2,
  Ruler,
} from "lucide-react";
import GreekLetterKeyboard from "./components/GreekLetterKeyboard";
import ObjectListPanel, {
  type ObjectListGroup,
  type ObjectListItem,
} from "./components/ObjectListPanel";
import FloatingSubmenu from "./components/FloatingSubmenu";
import FormulaView from "./core/calculation/FormulaView";
import type { CalculationExpression } from "./core/calculation/CalculationTypes";
import { evaluateCalculationExpression } from "./core/calculation/calculationEvaluator";
import { formatCalculationValue } from "./core/calculation/calculationUnits";
import PlaneCanvasViewport from "./components/PlaneCanvasViewport";
import TopMenuBar from "./components/TopMenuBar";
import WorkspaceTabBar, {
  type WorkspaceTabBarItem,
} from "./components/WorkspaceTabBar";
import { AddEntityCommand } from "./core/command/AddEntityCommand";
import { AddExtensionCommand } from "./core/command/AddExtensionCommand";
import { AddIntersectionPointCommand } from "./core/command/AddIntersectionPointCommand";
import SceneViewport, {
  type SceneViewportViewState,
} from "./components/SceneViewport";
import { AddLinePlanePerpendicularCommand } from "./core/command/AddLinePlanePerpendicularCommand";
import { AddMeasurementCommand } from "./core/command/AddMeasurementCommand";
import { AddMidpointCommand } from "./core/command/AddMidpointCommand";
import { AddParallelPlaneCommand } from "./core/command/AddParallelPlaneCommand";
import { AddParallelSegmentCommand } from "./core/command/AddParallelSegmentCommand";
import { AddPlanePlaneIntersectionCommand } from "./core/command/AddPlanePlaneIntersectionCommand";
import { AddPerpendicularLineCommand } from "./core/command/AddPerpendicularLineCommand";
import { AddPlaneCommand } from "./core/command/AddPlaneCommand";
import { AddPointCommand } from "./core/command/AddPointCommand";
import { AddSegmentCommand } from "./core/command/AddSegmentCommand";
import type { Command } from "./core/command/Command";
import { CommandManager } from "./core/command/CommandManager";
import { CompositeCommand } from "./core/command/CompositeCommand";
import { DeleteEntityCommand } from "./core/command/DeleteEntityCommand";
import { MovePointCommand } from "./core/command/MovePointCommand";
import {
  UpdateEntityCommand,
  type EntityUpdate,
} from "./core/command/UpdateEntityCommand";
import { UpdateDocumentSettingsCommand } from "./core/command/UpdateDocumentSettingsCommand";
import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "./core/document/BoardDocument";
import { createEmptyDocument } from "./core/document/createEmptyDocument";
import type {
  BoardEntity,
  CalculationEntity,
  EntityId,
  EntityStyle,
  ExtensionEntity,
  FunctionSurface3DEntity,
  LinePlanePerpendicularEntity,
  MeasurementEntity,
  PerpendicularLineEntity,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "./core/document/EntityTypes";
import { createEntityId } from "./core/document/idGenerator";
import { generatePointNames } from "./core/document/pointNameUtils";
import {
  areVec3Equal,
  calculatePerpendicularFromPointToSegment,
  addVec3,
  cloneVec3,
  createVec3,
  distanceBetweenVec3,
  dotVec3,
  normalizeVec3,
  projectPointToLine,
  scaleVec3,
  subtractVec3,
} from "./core/geometry/geometryUtils";
import {
  calculatePlaneBoundaryExtension,
  calculateSegmentBoundaryExtension,
  getExtensionStatus,
} from "./core/geometry/extensionUtils";
import {
  getExtensionPartsForEntity,
  type ExtensionPartInfo,
} from "./core/geometry/extensionPartUtils";
import {
  getPlanePlaneIntersection,
  getSegmentPlaneIntersection,
  getSegmentSegmentIntersection,
  type IntersectionFailureReason,
} from "./core/geometry/intersectionUtils";
import {
  getPlaneFromThreePoints,
  getPlaneValidationStatus,
} from "./core/geometry/planeUtils";
import {
  getParallelPlaneInfo,
  getParallelSegmentInfo,
} from "./core/geometry/parallelObjectUtils";
import {
  calculateLinePlanePerpendicular,
} from "./core/geometry/linePlanePerpendicularUtils";
import { getObjectInspectorInfo } from "./core/geometry/objectInspector";
import { getPointWorldPosition } from "./core/geometry/pointPositionUtils";
import {
  calculateMeasurementValue,
  getLinePlaneAngleBySegmentAndPlaneId,
  getLinePlaneAngleByPointIds,
  getLinePlaneAngleBySegmentId,
  getPlanePlaneAngleByPlaneIds,
  getPlaneXYPlaneAngleByPlaneId,
  getAngleByPointIds,
  getPointDistanceByIds,
  getSegmentLengthById,
} from "./core/geometry/measurementUtils";
import type { Vec3 } from "./core/geometry/Vec3";
import { exportProject } from "./core/io/exportProject";
import { importProject } from "./core/io/importProject";
import {
  PROJECT_APP_NAME,
  PROJECT_APP_VERSION,
  PROJECT_FILE_VERSION,
} from "./core/io/projectFile";
import { getSnapResult } from "./core/snap/SnapSystem";
import type { SnapResult } from "./core/snap/SnapTypes";
import type {
  Plane2DEntity,
  Plane2DCalculationEntity,
  Plane2DCircleEntity,
  Plane2DExtensionEntity,
  Plane2DFunctionGraphEntity,
  Plane2DIntersectionEdgeRef,
  Plane2DMeasurementEntity,
  Plane2DPointEntity,
  Plane2DPolygonEntity,
  Plane2DSegmentEntity,
  Plane2DToolName,
  PlaneCanvasDocument,
  PlaneCanvasProjectFile,
} from "./core/plane2d/PlaneCanvasTypes";
import {
  createPlaneCanvasDocument,
  createPlane2DExtension,
  deletePlane2DEntities,
  distanceBetweenVec2,
  evaluatePlane2DCalculation,
  getPlane2DCalculationInfo,
  getPlane2DMeasurementInfo,
  getPlane2DPolygonPoints,
  normalizePlaneCanvasDocument,
  plane2DExtensionId,
  syncPlane2DIntersections,
} from "./core/plane2d/planeCanvasUtils";
import {
  normalizeFunctionSampleCount2D,
  sampleFunction2D,
} from "./core/function-plot/FunctionSampler2D";
import {
  normalizeFunctionSurfaceResolution,
  sampleFunctionSurface3D,
} from "./core/function-plot/FunctionSampler3D";
import {
  createPlane2DHistoryState,
  pushPlane2DHistoryEntry,
  redoPlane2DHistory,
  undoPlane2DHistory,
} from "./core/plane2d/plane2DHistory";
import type {
  Plane2DDocumentChangeOptions,
  Plane2DHistoryState,
} from "./core/plane2d/plane2DHistory";
import {
  findDuplicatePlane2DNames,
  findPlane2DNameOwner,
  normalizePlane2DName,
} from "./core/plane2d/plane2DNameUtils";
import { MeasureAngleTool } from "./core/tool/MeasureAngleTool";
import { MeasureLengthTool } from "./core/tool/MeasureLengthTool";
import { PointTool } from "./core/tool/PointTool";
import { PlaneTool } from "./core/tool/PlaneTool";
import { SegmentTool } from "./core/tool/SegmentTool";
import { SelectTool } from "./core/tool/SelectTool";
import type { ToolContext } from "./core/tool/ToolContext";
import type { PointerInfo, ToolName } from "./core/tool/ToolTypes";
import { isTauriEnvironment } from "./platform/platform";

type PointCreationMode = "free" | "coordinate";
type WorkspaceMode = "none" | "geometry3d" | "plane2d";
type WorkspaceTabKind = "geometry3d" | "plane2d";
type WorkspaceTab = {
  readonly id: string;
  readonly kind: WorkspaceTabKind;
  readonly title: string;
  readonly filePath: string | null;
  readonly document: BoardDocument | PlaneCanvasDocument;
  readonly isDirty: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly plane2DState?: {
    readonly history: Plane2DHistoryState;
    readonly activeTool: Plane2DToolName;
    readonly pendingSegmentPointId: string | null;
    readonly viewport: {
      readonly panX: number;
      readonly panY: number;
      readonly zoom: number;
    };
  };
  readonly geometry3DState?: {
    readonly commandManager: CommandManager;
    readonly activeTool: ToolName;
    readonly viewState: SceneViewportViewState | null;
  };
};
type AngleMeasureMode =
  | "threePoint"
  | "lineXYPlane"
  | "linePlane"
  | "planeXYPlane"
  | "planePlane";
type PlaneCreationMode = "threePoint";
type PerpendicularMode = "pointLine" | "linePlane";
type ExtendMode = "auto" | "segmentToBoundary" | "planeToBoundary";
type ParallelMode = "auto" | "segment" | "plane";
type CalculationPointPickerState = {
  readonly mode: "distance" | "angle";
  readonly selectedPointIds: readonly EntityId[];
  readonly searchQuery: string;
};
type FunctionSurfaceDialogState = {
  readonly expression: string;
  readonly xMin: string;
  readonly xMax: string;
  readonly yMin: string;
  readonly yMax: string;
  readonly resolutionX: string;
  readonly resolutionY: string;
  readonly opacity: string;
  readonly wireframe: boolean;
  readonly error: string | null;
};
type IntersectionTarget = {
  readonly entityId: EntityId;
  readonly entityType: "segment" | "plane";
};
type PreselectedEntityType =
  | "point"
  | "segment"
  | "perpendicularLine"
  | "linePlanePerpendicular"
  | "extension"
  | "plane"
  | "functionSurface"
  | "measurement"
  | "calculation";

const incrementLetters = (startLetters: string, offset: number): string => {
  const isLowerCase = startLetters === startLetters.toLowerCase();
  const normalized = startLetters.toUpperCase();
  let value = 0;

  for (const char of normalized) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  value += offset;

  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return isLowerCase ? result.toLowerCase() : result;
};

const generateSequentialNames = (startName: string, count: number): string[] => {
  const trimmed = startName.trim();

  if (!trimmed || count <= 0) {
    return [];
  }

  const alphaNumericMatch = trimmed.match(/^([A-Za-z]+)(\d+)$/);
  if (alphaNumericMatch) {
    const [, prefix, numericText] = alphaNumericMatch;
    const startNumber = Number.parseInt(numericText, 10);

    return Array.from({ length: count }, (_, index) => `${prefix}${startNumber + index}`);
  }

  if (/^[A-Za-z]+$/.test(trimmed)) {
    return Array.from({ length: count }, (_, index) => incrementLetters(trimmed, index));
  }

  return Array.from({ length: count }, (_, index) => `${trimmed}${index + 1}`);
};

interface Preselection {
  readonly entityId: EntityId;
  readonly entityType: PreselectedEntityType;
}

type ParallelDraft =
  | {
      readonly kind: "segment";
      readonly sourceSegmentId: EntityId;
      readonly sourceAnchorEndpoint: "start" | "end";
    }
  | {
      readonly kind: "plane";
      readonly sourcePlaneId: EntityId;
      readonly sourceAnchorVertexIndex: 0 | 1 | 2;
    };

interface ToolIconProps {
  readonly size?: string | number;
  readonly "aria-hidden"?: string | boolean;
}

const SolidPointIcon = ({ size = 18 }: ToolIconProps) => (
  <span
    aria-hidden="true"
    className="solid-point-tool-icon"
    style={{ width: size, height: size }}
  >
    <span />
  </span>
);

const SolidPlaneIcon = ({ size = 18 }: ToolIconProps) => (
  <span
    aria-hidden="true"
    className="solid-plane-tool-icon"
    style={{ width: size, height: size }}
  >
    <span />
  </span>
);

const constructTools: Array<{
  readonly name: ToolName;
  readonly label: string;
  readonly icon: ElementType;
  readonly disabled?: boolean;
}> = [
  { name: "select", label: "\u9009\u62e9", icon: MousePointer2 },
  { name: "point", label: "\u70b9", icon: SolidPointIcon },
  { name: "segment", label: "\u7ebf\u6bb5", icon: Ruler },
  { name: "perpendicular", label: "\u5782\u7ebf", icon: Ruler },
  { name: "midpoint", label: "\u4e2d\u70b9", icon: SolidPointIcon },
  { name: "extend", label: "\u5ef6\u957f", icon: Ruler },
  { name: "parallel", label: "\u5e73\u884c", icon: Ruler },
  { name: "intersection", label: "\u4ea4\u70b9/\u4ea4\u7ebf", icon: Ruler },
  { name: "plane", label: "\u5e73\u9762", icon: SolidPlaneIcon },
  { name: "functionSurface", label: "函数曲面", icon: Grid3X3 },
];

const measureTools: Array<{
  readonly name: ToolName;
  readonly label: string;
  readonly icon: ElementType;
}> = [
  { name: "measureLength", label: "\u957f\u5ea6", icon: Ruler },
  { name: "measureAngle", label: "\u89d2\u5ea6", icon: Ruler },
  { name: "calculation", label: "计算", icon: Ruler },
];

const toolLabels: Record<ToolName, string> = {
  select: "\u9009\u62e9",
  point: "\u70b9",
  segment: "\u7ebf\u6bb5",
  perpendicular: "\u5782\u7ebf",
  midpoint: "\u4e2d\u70b9",
  extend: "\u5ef6\u957f",
  parallel: "\u5e73\u884c",
  intersection: "\u4ea4\u70b9/\u4ea4\u7ebf",
  plane: "\u5e73\u9762",
  functionSurface: "函数曲面",
  move: "\u79fb\u52a8",
  measureLength: "\u957f\u5ea6",
  measureAngle: "\u89d2\u5ea6",
  calculation: "计算",
};

const drawingPlanes: readonly ActiveDrawingPlane[] = ["XY", "XZ", "YZ"];

const TEST_POINT_A_ID = "debug-point-a";
const TEST_POINT_B_ID = "debug-point-b";
const TEST_SEGMENT_AB_ID = "debug-segment-ab";
const DEFAULT_POINT_COLOR = "#111111";
const MIN_DRAWING_PLANE_OPACITY = 0.04;
const MAX_DRAWING_PLANE_OPACITY = 0.5;
const DRAWING_PLANE_OPACITY_STEP = 0.06;
const MIN_POINT_SNAP_PIXEL_RADIUS = 3;
const MAX_POINT_SNAP_PIXEL_RADIUS = 12;
const MIN_SEGMENT_SNAP_PIXEL_RADIUS = 6;
const MAX_SEGMENT_SNAP_PIXEL_RADIUS = 20;
const MIN_AXIS_SNAP_PIXEL_RADIUS = 5;
const MAX_AXIS_SNAP_PIXEL_RADIUS = 18;
const SNAP_PIXEL_RADIUS_STEP = 1;
const MAX_POINT_DRAG_COORDINATE = 10000;
const MAX_POINT_DRAG_STEP = 1000;
const COORDINATE_POINT_LIMIT = 10000;
const CONSTRUCTION_EPSILON = 1e-6;

const createPointEntity = (
  id: EntityId,
  name: string,
  position: PointEntity["position"],
  style: EntityStyle = { color: DEFAULT_POINT_COLOR },
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style,
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "free",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createFootToPlanePointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  sourcePointId: EntityId,
  targetPlaneId: EntityId,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "footToPlane",
      sourcePointId,
      targetPlaneId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createFootToLinePointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  sourcePointId: EntityId,
  targetSegmentId: EntityId,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "footToLine",
      sourcePointId,
      targetSegmentId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createMidpointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  pointAId: EntityId,
  pointBId: EntityId,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "midpoint",
      pointAId,
      pointBId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLineDirectionPointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  sourcePointId: EntityId,
  targetSegmentId: EntityId,
  guidePosition: Vec3,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "perpendicularDirectionToLine",
      sourcePointId,
      targetSegmentId,
      guidePosition,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPlaneDirectionPointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  sourcePointId: EntityId,
  targetPlaneId: EntityId,
  sign: 1 | -1,
  length: number,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "perpendicularDirectionToPlane",
      sourcePointId,
      targetPlaneId,
      sign,
      length,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createParallelSegmentEndpointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  anchorPointId: EntityId,
  sourceSegmentId: EntityId,
  sourceAnchorEndpoint: "start" | "end",
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "parallelSegmentEndpoint",
      anchorPointId,
      sourceSegmentId,
      sourceAnchorEndpoint,
      targetEndpoint: "other",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createParallelPlaneVertexEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  anchorPointId: EntityId,
  sourcePlaneId: EntityId,
  sourceAnchorVertexIndex: 0 | 1 | 2,
  sourceVertexIndex: 0 | 1 | 2,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "parallelPlaneVertex",
      anchorPointId,
      sourcePlaneId,
      sourceAnchorVertexIndex,
      sourceVertexIndex,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLineLineIntersectionPointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  segmentAId: EntityId,
  segmentBId: EntityId,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "lineLineIntersection",
      segmentAId,
      segmentBId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLinePlaneIntersectionPointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  segmentId: EntityId,
  planeId: EntityId,
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "linePlaneIntersection",
      segmentId,
      planeId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPlanePlaneIntersectionEndpointEntity = (
  id: EntityId,
  name: string,
  position: Vec3,
  planeAId: EntityId,
  planeBId: EntityId,
  endpoint: "start" | "end",
): PointEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "point",
    name,
    style: { color: DEFAULT_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "constructed",
    construction: {
      kind: "planePlaneIntersectionEndpoint",
      planeAId,
      planeBId,
      endpoint,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createSegmentEntity = (
  id: EntityId,
  name: string,
  startPointId: EntityId,
  endPointId: EntityId,
  color: string,
): SegmentEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "segment",
    name,
    style: { color },
    visible: true,
    locked: false,
    pointIds: [startPointId, endPointId],
    nameSource: "auto",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPlaneEntity = (
  id: EntityId,
  name: string,
  pointAId: EntityId,
  pointBId: EntityId,
  pointCId: EntityId,
): PlaneEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "plane",
    type: "plane",
    name,
    visible: true,
    locked: false,
    pointIds: [pointAId, pointBId, pointCId],
    nameSource: "auto",
    style: {
      triangleColor: "#cbd5e1",
      triangleOpacity: 1,
      extensionColor: "#60a5fa",
      extensionOpacity: 0.12,
      showExtensionWhenSelected: true,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPerpendicularLineEntity = (
  id: EntityId,
  pointId: EntityId,
  segmentId: EntityId,
  footPointId: EntityId,
  name: string,
): PerpendicularLineEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "perpendicularLine",
    type: "perpendicularLine",
    pointId,
    segmentId,
    footPointId,
    constructionMode: "foot",
    directionMode: "auto",
    name,
    nameSource: "auto",
    style: {
      lineColor: "#111827",
      lineWidth: 3,
      extensionColor: "#64748b",
      extensionLineWidth: 1,
      extensionDash: true,
      showExtensionHelper: true,
    },
    visible: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLinePlanePerpendicularEntity = (
  id: EntityId,
  pointId: EntityId,
  planeId: EntityId,
  footPointId: EntityId,
  name: string,
): LinePlanePerpendicularEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "linePlanePerpendicular",
    type: "linePlanePerpendicular",
    pointId,
    planeId,
    footPointId,
    constructionMode: "foot",
    directionMode: "auto",
    name,
    nameSource: "auto",
    style: {
      lineColor: "#111827",
      lineWidth: 3,
      extensionFillColor: "#93c5fd",
      extensionFillOpacity: 0.14,
      helperLineColor: "#64748b",
      helperLineDash: true,
      showExtensionHelper: true,
    },
    visible: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLineDirectionPerpendicularEntity = (
  id: EntityId,
  pointId: EntityId,
  segmentId: EntityId,
  directionPointId: EntityId,
  name: string,
): PerpendicularLineEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "perpendicularLine",
    type: "perpendicularLine",
    pointId,
    segmentId,
    directionPointId,
    constructionMode: "userDirection",
    directionMode: "userPick",
    name,
    nameSource: "auto",
    style: {
      lineColor: "#111827",
      lineWidth: 3,
      extensionColor: "#64748b",
      extensionLineWidth: 1,
      extensionDash: true,
      showExtensionHelper: true,
    },
    visible: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPlaneDirectionPerpendicularEntity = (
  id: EntityId,
  pointId: EntityId,
  planeId: EntityId,
  directionPointId: EntityId,
  name: string,
): LinePlanePerpendicularEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "linePlanePerpendicular",
    type: "linePlanePerpendicular",
    pointId,
    planeId,
    directionPointId,
    constructionMode: "userDirection",
    directionMode: "userPick",
    name,
    nameSource: "auto",
    style: {
      lineColor: "#111827",
      lineWidth: 3,
      extensionFillColor: "#93c5fd",
      extensionFillOpacity: 0.14,
      helperLineColor: "#64748b",
      helperLineDash: true,
      showExtensionHelper: true,
    },
    visible: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createExtensionEntity = (
  id: EntityId,
  targetId: EntityId,
  targetType: ExtensionEntity["targetType"],
  name: string,
): ExtensionEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "extension",
    type: "extension",
    targetId,
    targetType,
    mode: "toBoundaryCube",
    name,
    nameSource: "auto",
    style: {
      lineExtensionColor: "#6b7280",
      lineExtensionWidth: 1,
      lineExtensionDash: true,
      planeExtensionColor: "#93c5fd",
      planeExtensionOpacity: 0.14,
      boundaryLineColor: "#60a5fa",
    },
    visible: true,
    snapEnabled: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLengthMeasurementEntity = (
  id: EntityId,
  name: string,
  targetEntityIds: readonly EntityId[],
  pointIds: readonly EntityId[],
  value: number,
): MeasurementEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "measurement",
    measurementKind: "length",
    name,
    style: { color: "#7c3aed" },
    visible: true,
    locked: false,
    targetIds: targetEntityIds.length > 0 ? targetEntityIds : pointIds,
    targetEntityIds,
    pointIds,
    value,
    unit: "unit",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createAngleMeasurementEntity = (
  id: EntityId,
  name: string,
  pointIds: readonly [EntityId, EntityId, EntityId],
  value: number,
): MeasurementEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "measurement",
    measurementKind: "angle",
    name,
    style: { color: "#9333ea" },
    visible: true,
    locked: false,
    targetIds: pointIds,
    targetEntityIds: [],
    pointIds,
    value,
    unit: "deg",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createLinePlaneAngleMeasurementEntity = (
  id: EntityId,
  name: string,
  targetIds: readonly EntityId[],
  value: number,
): MeasurementEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "measurement",
    measurementKind: "linePlaneAngle",
    name,
    style: { color: "#9333ea" },
    visible: true,
    locked: false,
    targetIds,
    targetEntityIds: targetIds.length === 1 ? targetIds : [],
    pointIds: targetIds.length === 2 ? targetIds : [],
    plane: "XY",
    value,
    unit: "deg",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPlanePlaneAngleMeasurementEntity = (
  id: EntityId,
  name: string,
  targetIds: readonly EntityId[],
  value: number,
): MeasurementEntity => {
  const timestamp = new Date().toISOString();

  return {
    id,
    kind: "measurement",
    measurementKind: "planePlaneAngle",
    name,
    style: { color: "#9333ea" },
    visible: true,
    locked: false,
    targetIds,
    targetEntityIds: targetIds,
    pointIds: [],
    plane: targetIds.length === 1 ? "XY" : undefined,
    value,
    unit: "deg",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

interface PointDragState {
  readonly pointId: EntityId;
  readonly movePointId: EntityId;
  readonly oldPosition: Vec3;
  latestPosition: Vec3;
}

interface ResolvedPointerResult {
  readonly rawPosition: Vec3 | null;
  readonly snapResult: SnapResult | null;
  readonly finalPosition: Vec3 | null;
}

interface ToastMessage {
  readonly id: number;
  readonly text: string;
}

interface PointInputResult {
  readonly pointId: EntityId;
  readonly point: PointEntity;
  readonly position: Vec3;
  readonly created: boolean;
}

type PerpendicularDirectionPickState =
  | {
      readonly kind: "line";
      readonly pointId: EntityId;
      readonly segmentId: EntityId;
      readonly basePoint: Vec3;
    }
  | {
      readonly kind: "plane";
      readonly pointId: EntityId;
      readonly planeId: EntityId;
      readonly basePoint: Vec3;
    };

const formatCoordinate = (value: number): string => value.toFixed(2);
const formatMeasurementValue = (value: number): string => value.toFixed(3);
const formatAngleValue = (value: number): string => `${value.toFixed(2)}\u00b0`;

const formatVec3 = (position: Vec3 | null | undefined): string => {
  if (!position) {
    return "X -- / Y -- / Z --";
  }

  return `X ${formatCoordinate(position.x)} / Y ${formatCoordinate(
    position.y,
  )} / Z ${formatCoordinate(position.z)}`;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface LineDirectionPreview {
  readonly guidePosition: Vec3;
  readonly directionPoint: Vec3;
  readonly source: "rayDirectionPlane" | "snapProjected";
  readonly snapResult: SnapResult;
}

interface LineDirectionSnapCandidate {
  readonly position: Vec3;
  readonly type: SnapResult["type"];
  readonly description: string;
  readonly priority: number;
  readonly targetEntityId?: EntityId;
  readonly targetEntityType?: BoardEntity["kind"];
  readonly worldDistance: number;
}

interface PlaneDirectionPreview {
  readonly sign: 1 | -1;
  readonly length: number;
  readonly directionPoint: Vec3;
}

type PerpendicularDirectionPreview =
  | {
      readonly kind: "line";
      readonly preview: LineDirectionPreview;
    }
  | {
      readonly kind: "plane";
      readonly preview: PlaneDirectionPreview;
    };

const getLinePerpendicularDirectionPreview = (
  basePoint: Vec3,
  segmentStart: Vec3,
  segmentEnd: Vec3,
  guidePosition: Vec3,
  source: LineDirectionPreview["source"] = "snapProjected",
  snapResult?: SnapResult,
): LineDirectionPreview | null => {
  const segmentDirection = normalizeVec3(
    subtractVec3(segmentEnd, segmentStart),
  );

  if (!segmentDirection) {
    return null;
  }

  const guideVector = subtractVec3(guidePosition, basePoint);
  // Project the resolved 3D pointer position onto the plane through P
  // perpendicular to AB. This keeps point-line direction picking fully 3D.
  const perpendicularVector = subtractVec3(
    guideVector,
    scaleVec3(segmentDirection, dotVec3(guideVector, segmentDirection)),
  );

  if (distanceBetweenVec3(perpendicularVector, { x: 0, y: 0, z: 0 }) < CONSTRUCTION_EPSILON) {
    return null;
  }

  const directionPoint = addVec3(basePoint, perpendicularVector);

  return {
    guidePosition: directionPoint,
    directionPoint,
    source,
    snapResult: snapResult ?? {
      position: directionPoint,
      type: "none",
      description: "perpendicular direction",
    },
  };
};

const getWorldUnitsPerScreenPixel = (
  pointerInfo: PointerInfo,
  position: Vec3,
): number | null => {
  const viewInfo = pointerInfo.pointerViewInfo;

  if (!viewInfo || viewInfo.viewportHeight <= 0) {
    return null;
  }

  if (viewInfo.perspectiveFovRadians) {
    const cameraDistance = distanceBetweenVec3(
      viewInfo.cameraPosition,
      position,
    );

    return (
      (2 *
        cameraDistance *
        Math.tan(viewInfo.perspectiveFovRadians / 2)) /
      viewInfo.viewportHeight
    );
  }

  return viewInfo.orthographicWorldHeight
    ? viewInfo.orthographicWorldHeight / viewInfo.viewportHeight
    : null;
};

const getDirectionSnapPixelRadius = (document: BoardDocument): number =>
  Math.max(
    document.settings.pointSnapPixelRadius,
    document.settings.segmentSnapPixelRadius,
    document.settings.axisSnapPixelRadius,
    document.settings.axisGridPointSnapPixelRadius,
    document.settings.gridSnapPixelRadius,
    document.settings.snapPixelRadius,
  );

const intersectRayWithPlane = (
  rayOrigin: Vec3,
  rayDirection: Vec3,
  planePoint: Vec3,
  planeNormal: Vec3,
): Vec3 | null => {
  const denominator = dotVec3(rayDirection, planeNormal);

  if (Math.abs(denominator) < CONSTRUCTION_EPSILON) {
    return null;
  }

  const t =
    dotVec3(subtractVec3(planePoint, rayOrigin), planeNormal) / denominator;

  if (t <= CONSTRUCTION_EPSILON || !Number.isFinite(t)) {
    return null;
  }

  const intersection = addVec3(rayOrigin, scaleVec3(rayDirection, t));

  return Number.isFinite(intersection.x) &&
    Number.isFinite(intersection.y) &&
    Number.isFinite(intersection.z)
    ? intersection
    : null;
};

const getExplicitDirectionSnapPosition = (
  snapResult: SnapResult | null,
): Vec3 | null => {
  if (!snapResult || snapResult.type === "boundary") {
    return null;
  }

  if (snapResult.type === "plane" && !snapResult.targetEntityId) {
    return null;
  }

  return snapResult.position;
};

const isGridLikeDirectionSnap = (snapResult: SnapResult): boolean =>
  snapResult.type === "grid" ||
  snapResult.type === "axisGridPoint" ||
  snapResult.type === "origin";

const projectPointToPlane = (
  point: Vec3,
  planePoint: Vec3,
  planeNormal: Vec3,
): Vec3 =>
  subtractVec3(
    point,
    scaleVec3(
      planeNormal,
      dotVec3(subtractVec3(point, planePoint), planeNormal),
    ),
  );

const getLineDirectionSnapPriority = (
  type: SnapResult["type"],
): number => {
  switch (type) {
    case "point":
    case "origin":
      return 0;
    case "segment":
      return 1;
    case "segmentExtension":
      return 2;
    case "axis":
      return 3;
    case "axisGridPoint":
    case "grid":
      return 4;
    case "plane":
      return 5;
    default:
      return 6;
  }
};

const createLineDirectionSnapCandidate = (
  candidatePosition: Vec3,
  q0: Vec3,
  maxWorldDistance: number,
  options: Omit<LineDirectionSnapCandidate, "position" | "worldDistance">,
): LineDirectionSnapCandidate | null => {
  const worldDistance = distanceBetweenVec3(candidatePosition, q0);

  if (
    worldDistance > maxWorldDistance ||
    !Number.isFinite(candidatePosition.x) ||
    !Number.isFinite(candidatePosition.y) ||
    !Number.isFinite(candidatePosition.z)
  ) {
    return null;
  }

  return {
    ...options,
    position: candidatePosition,
    worldDistance,
  };
};

const getAxisDirectionSnapCandidates = (
  q0: Vec3,
  basePoint: Vec3,
  directionPlaneNormal: Vec3,
  maxWorldDistance: number,
): LineDirectionSnapCandidate[] => {
  const axes = [
    {
      description: "perpendicular direction / X axis",
      direction: createVec3(1, 0, 0),
    },
    {
      description: "perpendicular direction / Y axis",
      direction: createVec3(0, 1, 0),
    },
    {
      description: "perpendicular direction / Z axis",
      direction: createVec3(0, 0, 1),
    },
  ];

  return axes.flatMap((axis) => {
    const denominator = dotVec3(axis.direction, directionPlaneNormal);
    const origin = createVec3(0, 0, 0);
    let axisSnapPoint: Vec3 | null = null;

    if (Math.abs(denominator) >= CONSTRUCTION_EPSILON) {
      const t =
        dotVec3(
          subtractVec3(basePoint, origin),
          directionPlaneNormal,
        ) / denominator;
      axisSnapPoint = scaleVec3(axis.direction, t);
    } else {
      const planeDistance = Math.abs(
        dotVec3(subtractVec3(origin, basePoint), directionPlaneNormal),
      );

      if (planeDistance <= CONSTRUCTION_EPSILON) {
        axisSnapPoint =
          projectPointToLine(q0, origin, axis.direction)?.foot ?? null;
      }
    }

    const candidate = axisSnapPoint
      ? createLineDirectionSnapCandidate(axisSnapPoint, q0, maxWorldDistance, {
          type: "axis",
          description: axis.description,
          priority: getLineDirectionSnapPriority("axis"),
        })
      : null;

    return candidate ? [candidate] : [];
  });
};

const getGridDirectionSnapCandidates = (
  document: BoardDocument,
  q0: Vec3,
  basePoint: Vec3,
  directionPlaneNormal: Vec3,
  maxWorldDistance: number,
): LineDirectionSnapCandidate[] => {
  const gridSize = Math.max(document.settings.gridSize, CONSTRUCTION_EPSILON);
  const center = {
    x: Math.round(q0.x / gridSize),
    y: Math.round(q0.y / gridSize),
    z: Math.round(q0.z / gridSize),
  };
  const candidates: LineDirectionSnapCandidate[] = [];

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const gridPoint = createVec3(
          (center.x + dx) * gridSize,
          (center.y + dy) * gridSize,
          (center.z + dz) * gridSize,
        );
        const planeDistance = Math.abs(
          dotVec3(
            subtractVec3(gridPoint, basePoint),
            directionPlaneNormal,
          ),
        );

        if (planeDistance > maxWorldDistance) {
          continue;
        }

        const isOrigin =
          distanceBetweenVec3(gridPoint, createVec3(0, 0, 0)) <
          CONSTRUCTION_EPSILON;
        const isAxisGridPoint =
          !isOrigin &&
          ([gridPoint.x, gridPoint.y, gridPoint.z].filter(
            (value) => Math.abs(value) < CONSTRUCTION_EPSILON,
          ).length >= 2);
        const type: SnapResult["type"] = isOrigin
          ? "origin"
          : isAxisGridPoint
            ? "axisGridPoint"
            : "grid";
        const candidate = createLineDirectionSnapCandidate(
          gridPoint,
          q0,
          maxWorldDistance,
          {
            type,
            description:
              type === "origin"
                ? "perpendicular direction / origin"
                : type === "axisGridPoint"
                  ? "perpendicular direction / axis grid point"
                  : "perpendicular direction / grid point",
            priority: getLineDirectionSnapPriority(type),
          },
        );

        if (candidate) {
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
};

const getPlaneNormalDirectionPreview = (
  basePoint: Vec3,
  planeNormal: Vec3,
  guidePosition: Vec3,
  minLength: number,
): PlaneDirectionPreview => {
  const guideVector = subtractVec3(guidePosition, basePoint);
  const signedLength = dotVec3(guideVector, planeNormal);
  const sign: 1 | -1 = signedLength < 0 ? -1 : 1;
  const length = Math.max(Math.abs(signedLength), minLength);

  return {
    sign,
    length,
    directionPoint: addVec3(
      basePoint,
      scaleVec3(planeNormal, sign * length),
    ),
  };
};

const getSnapDescription = (snapResult: SnapResult | null): string => {
  if (!snapResult) {
    return "none";
  }

  return snapResult.description ?? snapResult.type;
};

const getPointDisplayName = (entity: BoardEntity | null | undefined): string =>
  entity?.kind === "point" ? entity.name ?? entity.id : "\u672a\u77e5\u70b9";

const getPointNameById = (document: BoardDocument, pointId: EntityId): string => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity.name ?? entity.id : pointId;
};

const getCompactPointNameById = (
  document: BoardDocument,
  pointId: EntityId,
): string => {
  const name = getPointNameById(document, pointId);
  const trimmedName = name.trim();
  const match = /([A-Za-z0-9]+)$/.exec(trimmedName);

  return match?.[1] ?? trimmedName;
};

const getPlaneDisplayName = (
  document: BoardDocument,
  plane: PlaneEntity,
): string => {
  if (plane.nameSource === "manual" && plane.name?.trim()) {
    return plane.name.trim();
  }

  const pointNames = plane.pointIds.map((pointId) =>
    getCompactPointNameById(document, pointId),
  );

  return pointNames.every(Boolean)
    ? pointNames.join("")
    : plane.name?.trim() || plane.id;
};

const getPlaneStatusText = (
  plane: PlaneEntity,
  document: BoardDocument,
): string => {
  const status = getPlaneValidationStatus(plane, document);

  if (status === "missing-points") {
    return "\u4f9d\u8d56\u70b9\u7f3a\u5931";
  }

  if (status === "collinear") {
    return "\u4e09\u70b9\u5171\u7ebf\uff0c\u5e73\u9762\u65e0\u6548";
  }

  return "\u6709\u6548";
};

const getPerpendicularFootStatusText = (
  perpendicularLine: PerpendicularLineEntity,
  document: BoardDocument,
): string => {
  const point = document.entities[perpendicularLine.pointId];
  const segment = document.entities[perpendicularLine.segmentId];
  const pointPosition = getPointWorldPosition(document, perpendicularLine.pointId);
  const startPosition =
    segment?.kind === "segment"
      ? getPointWorldPosition(document, segment.pointIds[0])
      : null;
  const endPosition =
    segment?.kind === "segment"
      ? getPointWorldPosition(document, segment.pointIds[1])
      : null;
  const projection =
    point?.kind === "point" &&
    segment?.kind === "segment" &&
    pointPosition &&
    startPosition &&
    endPosition
      ? projectPointToLine(pointPosition, startPosition, endPosition)
      : null;

  if (!projection) {
    return "invalid";
  }

  if (projection.t >= 0 && projection.t <= 1) {
    return "\u5728\u7ebf\u6bb5\u4e0a";
  }

  return projection.t < 0
    ? "\u5728 A \u7aef\u5ef6\u957f\u7ebf\u4e0a"
    : "\u5728 B \u7aef\u5ef6\u957f\u7ebf\u4e0a";
};

const getLinePlanePerpendicularFootStatusText = (
  linePlanePerpendicular: LinePlanePerpendicularEntity,
  document: BoardDocument,
): string => {
  const point = document.entities[linePlanePerpendicular.pointId];
  const plane = document.entities[linePlanePerpendicular.planeId];
  const projection =
    point?.kind === "point" && plane?.kind === "plane"
      ? calculateLinePlanePerpendicular(point, plane, document)
      : null;

  if (!projection) {
    return "invalid";
  }

  return projection.isFootInTriangle
    ? "\u5728\u4e09\u89d2\u5f62\u5185"
    : "\u5728\u4e09\u89d2\u5f62\u5916";
};

const getEntityDetail = (entity: BoardEntity, document: BoardDocument): string => {
  switch (entity.kind) {
    case "point":
      return formatVec3(getPointWorldPosition(document, entity.id) ?? entity.position);
    case "segment": {
      const [startPointId, endPointId] = entity.pointIds;
      const length = getSegmentLengthById(document, entity.id);

      return `start: ${getPointNameById(
        document,
        startPointId,
      )} / end: ${getPointNameById(document, endPointId)}${
        length === null ? "" : ` / length: ${formatMeasurementValue(length)}`
      }`;
    }
    case "perpendicularLine": {
      const point = document.entities[entity.pointId];
      const segment = document.entities[entity.segmentId];
      const projection =
        point?.kind === "point" && segment?.kind === "segment"
          ? calculatePerpendicularFromPointToSegment(point, segment, document)
          : null;
      const footText = !projection
        ? "invalid"
        : projection.isFootOnSegment
          ? "\u5782\u8db3\u5728\u7ebf\u6bb5\u4e0a"
          : projection.t < 0
            ? "Foot on A-side extension"
            : "Foot on B-side extension";

      return `point: ${
        point?.kind === "point" ? getPointNameById(document, point.id) : "invalid"
      } / segment: ${
        segment?.kind === "segment"
          ? getSegmentDisplayName(document, segment)
          : "invalid"
      } / ${footText}`;
    }
    case "linePlanePerpendicular": {
      const point = document.entities[entity.pointId];
      const plane = document.entities[entity.planeId];

      return `point: ${
        point?.kind === "point" ? getPointNameById(document, point.id) : "invalid"
      } / plane: ${
        plane?.kind === "plane" ? getPlaneDisplayName(document, plane) : "invalid"
      } / foot: ${getLinePlanePerpendicularFootStatusText(entity, document)}`;
    }
    case "plane":
      return `points: ${entity.pointIds
        .map((pointId) => getPointNameById(document, pointId))
        .join(", ")} / status: ${getPlaneStatusText(entity, document)}`;
    case "extension": {
      const target = document.entities[entity.targetId];
      const targetName =
        target?.kind === "segment"
          ? getSegmentDisplayName(document, target)
          : target?.kind === "plane"
            ? `plane ${getPlaneDisplayName(document, target)}`
            : "invalid";

      return `target: ${targetName} / boundary [-${document.settings.coordinateHalfSize}, ${document.settings.coordinateHalfSize}] / status: ${getExtensionStatus(entity, document)}`;
    }
    case "measurement": {
      const calculation = calculateMeasurementValue(entity, document);
      const targetIds =
        entity.targetIds.length > 0
          ? entity.targetIds
          : entity.targetEntityIds.length > 0
            ? entity.targetEntityIds
            : entity.pointIds;

      if (!calculation) {
        return `type: ${entity.measurementKind} / targets: ${targetIds.join(
          ", ",
        )} / invalid target`;
      }

      return `type: ${entity.measurementKind} / targets: ${targetIds.join(
        ", ",
      )} / value: ${calculation.formattedText}`;
    }
    default:
      return entity.kind;
  }
};

const getSegmentDisplayName = (
  document: BoardDocument,
  segment: SegmentEntity,
): string => {
  if (segment.nameSource === "manual" && segment.name?.trim()) {
    return segment.name.trim();
  }

  const [startPointId, endPointId] = segment.pointIds;
  const startName = getCompactPointNameById(document, startPointId);
  const endName = getCompactPointNameById(document, endPointId);

  return startName && endName ? `${startName}${endName}` : segment.id;
};

const isNameableEntity = (
  entity: BoardEntity | null,
): entity is
  | PointEntity
  | SegmentEntity
  | PerpendicularLineEntity
  | LinePlanePerpendicularEntity
  | ExtensionEntity
  | PlaneEntity
  | FunctionSurface3DEntity
  | CalculationEntity =>
  entity?.kind === "point" ||
  entity?.kind === "segment" ||
  entity?.kind === "perpendicularLine" ||
  entity?.kind === "linePlanePerpendicular" ||
  entity?.kind === "extension" ||
  entity?.kind === "plane" ||
  entity?.kind === "functionSurface" ||
  entity?.kind === "calculation";

const getManualNameDraft = (
  entity:
    | PointEntity
    | SegmentEntity
    | PerpendicularLineEntity
    | LinePlanePerpendicularEntity
    | ExtensionEntity
    | PlaneEntity
    | FunctionSurface3DEntity
    | CalculationEntity,
): string => (entity.nameSource === "manual" ? entity.name?.trim() ?? "" : "");

const isExtensionVisible = (extension: ExtensionEntity): boolean =>
  extension.visible !== false;

const getShortEntityId = (id: string): string =>
  id.length > 8 ? id.slice(0, 8) : id;

const isPlane2DEntityVisible = (entity: Plane2DEntity): boolean =>
  entity.visible !== false;

const getPlane2DEntityTypeLabel = (entity: Plane2DEntity): string => {
  switch (entity.type) {
    case "plane2d-point":
      if (entity.construction?.kind === "segmentIntersection") return "交点";
      if (entity.construction?.kind === "midpoint") return "中点";
      if (entity.construction?.kind === "perpendicularFoot") return "垂足";
      if (entity.construction?.kind === "perpendicularEndpoint") {
        return "垂线端点";
      }
      if (entity.construction?.kind === "copiedCircleRadiusPoint") {
        return "复制圆半径点";
      }
      if (
        entity.construction?.kind === "regularPolygonVertex" ||
        entity.construction?.kind === "regularPolygonVertexBySide"
      ) {
        return "正多边形顶点";
      }
      return "点";
    case "plane2d-segment":
      if (entity.segmentKind === "extension") return "延长线段";
      if (entity.construction?.kind === "perpendicular") return "垂线段";
      return "线段";
    case "plane2d-circle":
      return entity.construction?.kind === "copyCircle" ? "复制圆" : "圆";
    case "plane2d-polygon":
      return entity.polygonKind === "regular" ? "正多边形" : "多边形";
    case "plane2d-measurement":
      return entity.measurementKind === "length" ? "长度测量" : "角度测量";
    case "plane2d-extension":
      return "延长部分";
    case "plane2d-calculation":
      return "计算";
    case "plane2d-function-graph":
      return "函数图像";
    default:
      return "对象";
  }
};

const formatPlane2DIntersectionEdgeRef = (
  edge: Plane2DIntersectionEdgeRef | undefined,
): string => {
  if (!edge) {
    return "未知边";
  }

  if (edge.sourceType === "segment") {
    return `线段 ${edge.sourceEntityId}`;
  }

  if (edge.sourceType === "extension") {
    return `延长 ${edge.sourceEntityId}:${edge.edgeIndex + 1}`;
  }

  if (edge.sourceType === "regular-polygon-edge") {
    return `正多边形边 ${edge.sourceEntityId}:${edge.edgeIndex + 1}`;
  }

  return `多边形边 ${edge.sourceEntityId}:${edge.edgeIndex + 1}`;
};

const getPlane2DObjectGroupLabel = (entity: Plane2DEntity): string => {
  switch (entity.type) {
    case "plane2d-point":
      return "点";
    case "plane2d-segment":
      return "线段";
    case "plane2d-circle":
      return "圆";
    case "plane2d-polygon":
      return "多边形";
    case "plane2d-measurement":
      return "测量";
    case "plane2d-calculation":
      return "计算";
    case "plane2d-function-graph":
      return "函数图像";
    case "plane2d-extension":
      return "线段";
    default:
      return "对象";
  }
};

const getPlane2DObjectListItem = (
  entity: Plane2DEntity,
  selectedEntityIds: readonly string[],
): ObjectListItem => {
  const typeLabel = getPlane2DEntityTypeLabel(entity);
  const manualName =
    entity.showName && entity.name?.trim() ? entity.name.trim() : "";
  const expressionName =
    entity.type === "plane2d-function-graph" ? `y=${entity.expression}` : "";
  const name = manualName || expressionName || `${typeLabel} ${getShortEntityId(entity.id)}`;

  return {
    id: entity.id,
    name,
    detail:
      entity.type === "plane2d-function-graph"
        ? entity.expression
        : getShortEntityId(entity.id),
    searchText: `${name} ${typeLabel} ${entity.id} ${expressionName}`,
    visible: isPlane2DEntityVisible(entity),
    selected: selectedEntityIds.includes(entity.id),
  };
};

const getBoardEntityTypeLabel = (entity: BoardEntity): string => {
  switch (entity.kind) {
    case "point":
      return entity.pointKind === "constructed" ? "构造点" : "点";
    case "segment":
      return "线段";
    case "plane":
      return "平面";
    case "polygon":
      return "多边形";
    case "solid":
      return "立体";
    case "functionSurface":
      return "函数曲面";
    case "measurement":
      return "测量";
    case "calculation":
      return "计算";
    case "extension":
      return entity.targetType === "plane" ? "平面延展" : "线段延长";
    case "perpendicularLine":
      return "垂线";
    case "linePlanePerpendicular":
      return "线面垂直";
    case "label":
      return "标签";
    default:
      return "对象";
  }
};

const getBoardEntityGroupLabel = (entity: BoardEntity): string => {
  switch (entity.kind) {
    case "point":
      return "点";
    case "segment":
      return "线段 / 直线类对象";
    case "plane":
    case "polygon":
    case "solid":
      return "平面 / 多边形 / 立体对象";
    case "functionSurface":
      return "函数曲面";
    case "measurement":
      return "测量";
    case "calculation":
      return "计算";
    case "perpendicularLine":
    case "linePlanePerpendicular":
    case "extension":
      return "构造对象";
    default:
      return "对象";
  }
};

const getBoardObjectListItem = (
  entity: BoardEntity,
  selectedEntityIds: readonly EntityId[],
): ObjectListItem => {
  const typeLabel = getBoardEntityTypeLabel(entity);
  const manualName = entity.name?.trim() ?? "";
  const expressionName =
    entity.kind === "functionSurface" ? `z=${entity.expression}` : "";
  const name = manualName || expressionName || `${typeLabel} ${getShortEntityId(entity.id)}`;

  return {
    id: entity.id,
    name,
    detail:
      entity.kind === "functionSurface"
        ? entity.expression
        : getShortEntityId(entity.id),
    searchText: `${name} ${typeLabel} ${entity.kind} ${entity.id} ${expressionName}`,
    visible: entity.visible !== false,
    selected: selectedEntityIds.includes(entity.id),
  };
};

const getRelatedExtensionEntities = (
  document: BoardDocument,
  entity: BoardEntity | null,
): readonly ExtensionEntity[] => {
  if (!entity) {
    return [];
  }

  if (entity.kind === "extension") {
    return [entity];
  }

  if (entity.kind !== "segment" && entity.kind !== "plane") {
    return [];
  }

  return Object.values(document.entities).filter(
    (candidate): candidate is ExtensionEntity =>
      candidate.kind === "extension" &&
      candidate.targetId === entity.id &&
      candidate.targetType === entity.kind,
  );
};

const getExtensionVisibilityButtonText = (
  extensions: readonly ExtensionEntity[],
): string => {
  const hasHiddenExtension = extensions.some(
    (extension) => !isExtensionVisible(extension),
  );

  return hasHiddenExtension
    ? "\u663e\u793a\u5ef6\u957f\u90e8\u5206"
    : "\u9690\u85cf\u5ef6\u957f\u90e8\u5206";
};

const getPreselectionDescription = (
  preselection: Preselection | null,
  document: BoardDocument,
): string | null => {
  if (!preselection) {
    return null;
  }

  const entity = document.entities[preselection.entityId];

  if (!entity) {
    return null;
  }

  switch (entity.kind) {
    case "point":
      return `point ${entity.name ?? entity.id}`;
    case "segment":
      return `segment ${getSegmentDisplayName(document, entity)}`;
    case "perpendicularLine":
      return `perpendicular ${entity.name ?? entity.id}`;
    case "linePlanePerpendicular":
      return `line-plane perpendicular ${entity.name ?? entity.id}`;
    case "extension":
      return `extension ${entity.name ?? entity.id}`;
    case "plane":
      return `plane ${getPlaneDisplayName(document, entity)}`;
    case "measurement":
      return `measurement ${entity.name ?? entity.id}`;
    default:
      return entity.kind;
  }
};

const getSegmentToolStatus = (
  currentTool: ToolName,
  firstPointId: EntityId | null,
  documentEntities: readonly BoardEntity[],
): string | null => {
  if (currentTool !== "segment") {
    return null;
  }

  if (!firstPointId) {
    return "\u8bf7\u9009\u62e9\u7b2c\u4e00\u4e2a\u7aef\u70b9";
  }

  const firstPoint = documentEntities.find((entity) => entity.id === firstPointId);

  return `\u5df2\u9009\u62e9 ${getPointDisplayName(
    firstPoint,
  )}\uff0c\u8bf7\u9009\u62e9\u7b2c\u4e8c\u4e2a\u7aef\u70b9`;
};

const getPlaneToolStatus = (
  currentTool: ToolName,
  selectedPointIds: readonly EntityId[],
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "plane") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (selectedPointIds.length === 0) {
    return "\u8bf7\u9009\u62e9\u786e\u5b9a\u5e73\u9762\u7684\u7b2c\u4e00\u4e2a\u70b9";
  }

  if (selectedPointIds.length === 1) {
    return "\u8bf7\u9009\u62e9\u786e\u5b9a\u5e73\u9762\u7684\u7b2c\u4e8c\u4e2a\u70b9";
  }

  const pointNames = selectedPointIds
    .map((pointId) => getPointNameById(document, pointId))
    .join(", ");

  return `${pointNames} / \u8bf7\u9009\u62e9\u786e\u5b9a\u5e73\u9762\u7684\u7b2c\u4e09\u4e2a\u70b9`;
};

const getPerpendicularToolStatus = (
  currentTool: ToolName,
  perpendicularMode: PerpendicularMode,
  directionPick: PerpendicularDirectionPickState | null,
  pointId: EntityId | null,
  segmentId: EntityId | null,
  planeId: EntityId | null,
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "perpendicular") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (directionPick?.kind === "line") {
    return "\u70b9\u5df2\u5728\u7ebf\u4e0a\uff0c\u8bf7\u79fb\u52a8\u9f20\u6807\u9009\u62e9\u5782\u7ebf\u65b9\u5411";
  }

  if (directionPick?.kind === "plane") {
    return "\u70b9\u5df2\u5728\u5e73\u9762\u4e0a\uff0c\u8bf7\u9009\u62e9\u6cd5\u7ebf\u65b9\u5411";
  }

  if (perpendicularMode === "linePlane") {
    if (pointId) {
      return `\u8bf7\u9009\u62e9\u76ee\u6807\u5e73\u9762\uff0c\u4f5c\u8fc7 ${getPointNameById(
        document,
        pointId,
      )} \u7684\u9762\u5782\u7ebf`;
    }

    if (planeId) {
      const plane = document.entities[planeId];

      return `\u8bf7\u9009\u62e9\u8fc7\u5782\u7ebf\u7684\u70b9${
        plane?.kind === "plane"
          ? `\uff0c\u76ee\u6807\u5e73\u9762 ${getPlaneDisplayName(
              document,
              plane,
            )}`
          : ""
      }`;
    }

    return "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u6216\u4e00\u4e2a\u5e73\u9762";
  }

  if (pointId) {
    return `\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5\uff0c\u4f5c\u8fc7 ${getPointNameById(
      document,
      pointId,
    )} \u7684\u5782\u7ebf`;
  }

  if (segmentId) {
    const segment = document.entities[segmentId];

    return `\u8bf7\u9009\u62e9\u8fc7\u5782\u7ebf\u7684\u70b9${
      segment?.kind === "segment"
        ? `\uff0c\u76ee\u6807\u7ebf\u6bb5 ${getSegmentDisplayName(
            document,
            segment,
          )}`
        : ""
    }`;
  }

  return "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u6216\u4e00\u6761\u7ebf\u6bb5";
};

const getMidpointToolStatus = (
  currentTool: ToolName,
  firstPointId: EntityId | null,
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "midpoint") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (!firstPointId) {
    return "\u8bf7\u9009\u62e9\u7b2c\u4e00\u4e2a\u70b9\uff0c\u6216\u76f4\u63a5\u70b9\u51fb\u4e00\u6761\u7ebf\u6bb5";
  }

  return `\u5df2\u9009\u62e9 ${getPointNameById(
    document,
    firstPointId,
  )}\uff0c\u8bf7\u9009\u62e9\u7b2c\u4e8c\u4e2a\u70b9`;
};

const getExtendToolStatus = (
  currentTool: ToolName,
  extendMode: ExtendMode,
  statusMessage: string | null,
): string | null => {
  if (currentTool !== "extend") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (extendMode === "segmentToBoundary") {
    return "\u8bf7\u9009\u62e9\u8981\u5ef6\u957f\u5230\u8fb9\u754c\u7684\u7ebf\u6bb5";
  }

  if (extendMode === "planeToBoundary") {
    return "\u8bf7\u9009\u62e9\u8981\u5ef6\u5c55\u5230\u8fb9\u754c\u7684\u5e73\u9762";
  }

  return "\u8bf7\u9009\u62e9\u8981\u5ef6\u957f\u7684\u7ebf\u6bb5\u6216\u5e73\u9762";
};

const getParallelToolStatus = (
  currentTool: ToolName,
  parallelMode: ParallelMode,
  parallelDraft: ParallelDraft | null,
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "parallel") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (parallelDraft?.kind === "segment") {
    const segment = document.entities[parallelDraft.sourceSegmentId];

    return segment?.kind === "segment"
      ? `\u6b63\u5728\u521b\u5efa\u4e0e ${getSegmentDisplayName(
          document,
          segment,
        )} \u5e73\u884c\u7684\u7ebf\u6bb5`
      : "\u6b63\u5728\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5";
  }

  if (parallelDraft?.kind === "plane") {
    const plane = document.entities[parallelDraft.sourcePlaneId];

    return plane?.kind === "plane"
      ? `\u6b63\u5728\u521b\u5efa\u4e0e\u5e73\u9762 ${getPlaneDisplayName(
          document,
          plane,
        )} \u5e73\u884c\u7684\u5e73\u9762`
      : "\u6b63\u5728\u521b\u5efa\u5e73\u884c\u5e73\u9762";
  }

  if (parallelMode === "segment") {
    return "\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5";
  }

  if (parallelMode === "plane") {
    return "\u8bf7\u9009\u62e9\u76ee\u6807\u5e73\u9762";
  }

  return "\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5\u6216\u5e73\u9762";
};

const getIntersectionToolStatus = (
  currentTool: ToolName,
  firstTarget: IntersectionTarget | null,
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "intersection") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (!firstTarget) {
    return "\u8bf7\u9009\u62e9\u7b2c\u4e00\u4e2a\u7ebf\u6bb5\u6216\u5e73\u9762";
  }

  const entity = document.entities[firstTarget.entityId];
  const name =
    entity?.kind === "segment"
      ? getSegmentDisplayName(document, entity)
      : entity?.kind === "plane"
        ? getPlaneDisplayName(document, entity)
        : firstTarget.entityId;

  return `\u5df2\u9009\u62e9 ${name}\uff0c\u8bf7\u9009\u62e9\u7b2c\u4e8c\u4e2a\u7ebf\u6bb5\u6216\u5e73\u9762`;
};

const getParallelSegmentPreview = (
  document: BoardDocument,
  draft: Extract<ParallelDraft, { kind: "segment" }>,
  anchorPosition: Vec3 | null,
): { readonly start: Vec3; readonly end: Vec3 } | null => {
  if (!anchorPosition) {
    return null;
  }

  const sourceSegment = document.entities[draft.sourceSegmentId];

  if (sourceSegment?.kind !== "segment") {
    return null;
  }

  const startPosition = getPointWorldPosition(
    document,
    sourceSegment.pointIds[0],
  );
  const endPosition = getPointWorldPosition(
    document,
    sourceSegment.pointIds[1],
  );

  if (!startPosition || !endPosition) {
    return null;
  }

  if (draft.sourceAnchorEndpoint === "start") {
    return {
      start: anchorPosition,
      end: addVec3(anchorPosition, subtractVec3(endPosition, startPosition)),
    };
  }

  return {
    start: addVec3(anchorPosition, subtractVec3(startPosition, endPosition)),
    end: anchorPosition,
  };
};

const getParallelPlanePreview = (
  document: BoardDocument,
  draft: Extract<ParallelDraft, { kind: "plane" }>,
  anchorPosition: Vec3 | null,
): readonly [Vec3, Vec3, Vec3] | null => {
  if (!anchorPosition) {
    return null;
  }

  const sourcePlane = document.entities[draft.sourcePlaneId];

  if (sourcePlane?.kind !== "plane") {
    return null;
  }

  const sourcePositions = sourcePlane.pointIds.map((pointId) =>
    getPointWorldPosition(document, pointId),
  );
  const sourceAnchorPosition = sourcePositions[draft.sourceAnchorVertexIndex];

  if (!sourceAnchorPosition || sourcePositions.some((position) => !position)) {
    return null;
  }

  return sourcePositions.map((position, index) =>
    index === draft.sourceAnchorVertexIndex
      ? anchorPosition
      : addVec3(anchorPosition, subtractVec3(position!, sourceAnchorPosition)),
  ) as [Vec3, Vec3, Vec3];
};

const getMeasureLengthToolStatus = (
  currentTool: ToolName,
  firstPointId: EntityId | null,
  statusMessage: string | null,
  documentEntities: readonly BoardEntity[],
): string | null => {
  if (currentTool !== "measureLength") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (!firstPointId) {
    return "\u957f\u5ea6\u5de5\u5177\uff1a\u70b9\u51fb\u4e00\u6761\u7ebf\u6bb5\uff0c\u6216\u70b9\u51fb\u7b2c\u4e00\u4e2a\u70b9";
  }

  const firstPoint = documentEntities.find((entity) => entity.id === firstPointId);

  return `\u5df2\u9009\u62e9\u70b9 ${getPointDisplayName(
    firstPoint,
  )}\uff0c\u8bf7\u70b9\u51fb\u7b2c\u4e8c\u4e2a\u70b9`;
};

const getMeasureAngleToolStatus = (
  currentTool: ToolName,
  angleMeasureMode: AngleMeasureMode,
  selectedPointIds: readonly EntityId[],
  linePlaneSegmentId: EntityId | null,
  planePlaneFirstPlaneId: EntityId | null,
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "measureAngle") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (angleMeasureMode === "lineXYPlane") {
    return "Select a segment to measure its angle with the X-Y plane";
  }

  if (angleMeasureMode === "linePlane") {
    return linePlaneSegmentId ? "Select a plane" : "Select a segment";
  }

  if (angleMeasureMode === "planeXYPlane") {
    return "Select a plane to measure its angle with the X-Y plane";
  }

  if (angleMeasureMode === "planePlane") {
    return planePlaneFirstPlaneId ? "Select the second plane" : "Select the first plane";
  }

  if (selectedPointIds.length === 0) {
    return "\u91cf\u89d2\u5668\uff1a\u8bf7\u9009\u62e9\u89d2\u8fb9\u4e0a\u7684\u7b2c\u4e00\u4e2a\u70b9";
  }

  const pointAName = getPointNameById(document, selectedPointIds[0]);

  if (selectedPointIds.length === 1) {
    return `\u5df2\u9009\u62e9 ${pointAName}\uff0c\u8bf7\u9009\u62e9\u89d2\u7684\u9876\u70b9`;
  }

  const vertexBName = getPointNameById(document, selectedPointIds[1]);

  return `\u5df2\u9009\u62e9 ${pointAName} \u548c\u9876\u70b9 ${vertexBName}\uff0c\u8bf7\u9009\u62e9\u53e6\u4e00\u6761\u89d2\u8fb9\u4e0a\u7684\u70b9`;
};

function App() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("none");
  const [document, setDocument] = useState<BoardDocument | null>(null);
  const [planeCanvasDocument, setPlaneCanvasDocument] =
    useState<PlaneCanvasDocument | null>(null);
  const [plane2DTool, setPlane2DTool] = useState<Plane2DToolName>("select");
  const [plane2DPendingSegmentPointId, setPlane2DPendingSegmentPointId] =
    useState<string | null>(null);
  const [plane2DStatusMessage, setPlane2DStatusMessage] = useState<
    string | null
  >(null);
  const [plane2DBatchNameStart, setPlane2DBatchNameStart] = useState("A");
  const [plane2DHistory, setPlane2DHistory] = useState<Plane2DHistoryState>(
    createPlane2DHistoryState,
  );
  const [plane2DViewportState, setPlane2DViewportState] = useState({
    panX: 0,
    panY: 0,
    zoom: 1,
  });
  const [plane2DResetSignal, setPlane2DResetSignal] = useState(0);
  const [propertiesTab, setPropertiesTab] = useState<"properties" | "objects">(
    "properties",
  );
  const [objectListSearchQuery, setObjectListSearchQuery] = useState("");
  const [currentTool, setCurrentTool] = useState<ToolName>("select");
  const [geometry3DViewState, setGeometry3DViewState] =
    useState<SceneViewportViewState | null>(null);
  const pointToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const perpendicularToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const extendToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const parallelToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const angleToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const linePlaneAngleToggleRef = useRef<HTMLButtonElement | null>(null);
  const planePlaneAngleToggleRef = useRef<HTMLButtonElement | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [lastPointerInfo, setLastPointerInfo] = useState<PointerInfo | null>(
    null,
  );
  const [lastSnapResult, setLastSnapResult] = useState<SnapResult | null>(null);
  const [preselection, setPreselection] = useState<Preselection | null>(null);
  const [segmentFirstPointId, setSegmentFirstPointId] =
    useState<EntityId | null>(null);
  const [planeSelectedPointIds, setPlaneSelectedPointIds] = useState<
    readonly EntityId[]
  >([]);
  const [planeStatusMessage, setPlaneStatusMessage] = useState<string | null>(
    null,
  );
  const [perpendicularMode, setPerpendicularMode] =
    useState<PerpendicularMode>("pointLine");
  const [perpendicularPointId, setPerpendicularPointId] =
    useState<EntityId | null>(null);
  const [perpendicularSegmentId, setPerpendicularSegmentId] =
    useState<EntityId | null>(null);
  const [perpendicularPlaneId, setPerpendicularPlaneId] =
    useState<EntityId | null>(null);
  const [perpendicularStatusMessage, setPerpendicularStatusMessage] =
    useState<string | null>(null);
  const [perpendicularDirectionPick, setPerpendicularDirectionPick] =
    useState<PerpendicularDirectionPickState | null>(null);
  const [
    perpendicularDirectionPreviewEnd,
    setPerpendicularDirectionPreviewEnd,
  ] = useState<Vec3 | null>(null);
  const [midpointFirstPointId, setMidpointFirstPointId] =
    useState<EntityId | null>(null);
  const [midpointStatusMessage, setMidpointStatusMessage] =
    useState<string | null>(null);
  const [measureFirstPointId, setMeasureFirstPointId] =
    useState<EntityId | null>(null);
  const [measureStatusMessage, setMeasureStatusMessage] = useState<string | null>(
    null,
  );
  const [angleSelectedPointIds, setAngleSelectedPointIds] = useState<
    readonly EntityId[]
  >([]);
  const [linePlaneAngleSegmentId, setLinePlaneAngleSegmentId] =
    useState<EntityId | null>(null);
  const [planePlaneAngleFirstPlaneId, setPlanePlaneAngleFirstPlaneId] =
    useState<EntityId | null>(null);
  const [angleStatusMessage, setAngleStatusMessage] = useState<string | null>(
    null,
  );
  const [calculationExpression, setCalculationExpression] =
    useState<CalculationExpression | null>(null);
  const [calculationPendingOp, setCalculationPendingOp] = useState<
    "add" | "sub" | "mul" | "div" | null
  >(null);
  const [isPlacingCalculation, setIsPlacingCalculation] = useState(false);
  const [calculationPointPicker, setCalculationPointPicker] =
    useState<CalculationPointPickerState | null>(null);
  const [calculationStatusMessage, setCalculationStatusMessage] = useState<
    string | null
  >(null);
  const [functionSurfaceDialog, setFunctionSurfaceDialog] =
    useState<FunctionSurfaceDialogState | null>(null);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState<string | null>(
    null,
  );
  const [batchNameStart, setBatchNameStart] = useState("A");
  const [draftName, setDraftName] = useState("");
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [fileStatusMessage, setFileStatusMessage] = useState<string | null>(
    null,
  );
  const [dragPreviewDocument, setDragPreviewDocument] =
    useState<BoardDocument | null>(null);
  const [draggedPointId, setDraggedPointId] = useState<EntityId | null>(null);
  const [pointCreationMode, setPointCreationMode] =
    useState<PointCreationMode>("free");
  const [planeCreationMode, setPlaneCreationMode] =
    useState<PlaneCreationMode>("threePoint");
  const [showPointToolPanel, setShowPointToolPanel] = useState(false);
  const [showPlaneToolPanel, setShowPlaneToolPanel] = useState(false);
  const [showPerpendicularToolPanel, setShowPerpendicularToolPanel] =
    useState(false);
  const [extendMode, setExtendMode] = useState<ExtendMode>("auto");
  const [showExtendToolPanel, setShowExtendToolPanel] = useState(false);
  const [extendStatusMessage, setExtendStatusMessage] = useState<string | null>(
    null,
  );
  const [parallelMode, setParallelMode] = useState<ParallelMode>("auto");
  const [showParallelToolPanel, setShowParallelToolPanel] = useState(false);
  const [parallelDraft, setParallelDraft] = useState<ParallelDraft | null>(
    null,
  );
  const [parallelStatusMessage, setParallelStatusMessage] =
    useState<string | null>(null);
  const [intersectionFirstTarget, setIntersectionFirstTarget] =
    useState<IntersectionTarget | null>(null);
  const [intersectionStatusMessage, setIntersectionStatusMessage] =
    useState<string | null>(null);
  const [showCoordinatePointModal, setShowCoordinatePointModal] =
    useState(false);
  const [angleMeasureMode, setAngleMeasureMode] =
    useState<AngleMeasureMode>("threePoint");
  const [showAngleToolPanel, setShowAngleToolPanel] = useState(false);
  const [showLinePlaneAnglePanel, setShowLinePlaneAnglePanel] = useState(false);
  const [showPlanePlaneAnglePanel, setShowPlanePlaneAnglePanel] = useState(false);
  const [coordinatePointInput, setCoordinatePointInput] = useState({
    x: "0",
    y: "0",
    z: "0",
    name: "",
  });
  const [coordinatePointError, setCoordinatePointError] = useState<
    string | null
  >(null);
  const [coordinatePointStatus, setCoordinatePointStatus] = useState<
    string | null
  >(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const commandManagerRef = useRef<CommandManager | null>(null);
  const nextGeometryTabNumberRef = useRef(1);
  const nextPlaneTabNumberRef = useRef(1);
  const pointDragStateRef = useRef<PointDragState | null>(null);
  const preselectionRef = useRef<Preselection | null>(null);
  const latestPointToolResolvedResultRef =
    useRef<ResolvedPointerResult | null>(null);
  const perpendicularDirectionPreviewRef =
    useRef<PerpendicularDirectionPreview | null>(null);
  const nextToastIdRef = useRef(1);
  const pointToolRef = useRef(new PointTool());
  const planeToolRef = useRef(new PlaneTool());
  const segmentToolRef = useRef(new SegmentTool());
  const measureLengthToolRef = useRef(new MeasureLengthTool());
  const measureAngleToolRef = useRef(new MeasureAngleTool());
  const selectToolRef = useRef(new SelectTool());

  if (!commandManagerRef.current) {
    commandManagerRef.current = new CommandManager(
      document ?? createEmptyDocument({ name: "Untitled Board" }),
    );
  }

  const commandManager = commandManagerRef.current;
  const showToast = (text: string) => {
    const id = nextToastIdRef.current;
    nextToastIdRef.current += 1;
    setToastMessage({ id, text });
  };
  const createWorkspaceTabId = () =>
    `workspace-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getFileNameFromPath = (filePath: string) =>
    filePath.split(/[\\/]/).pop() ?? filePath;

  const getTabTitleFromPath = (filePath: string | null, fallback: string) =>
    filePath ? getFileNameFromPath(filePath) : fallback;

  const captureActiveWorkspaceTab = (tab: WorkspaceTab): WorkspaceTab => {
    const now = new Date().toISOString();

    if (workspaceMode === "geometry3d" && tab.kind === "geometry3d") {
      return {
        ...tab,
        document: commandManager.getDocument(),
        filePath: currentFilePath,
        title: getTabTitleFromPath(currentFilePath, tab.title),
        isDirty,
        updatedAt: now,
        geometry3DState: {
          commandManager,
          activeTool: currentTool,
          viewState: geometry3DViewState,
        },
      };
    }

    if (workspaceMode === "plane2d" && tab.kind === "plane2d" && planeCanvasDocument) {
      return {
        ...tab,
        document: planeCanvasDocument,
        filePath: currentFilePath,
        title: getTabTitleFromPath(currentFilePath, tab.title),
        isDirty,
        updatedAt: now,
        plane2DState: {
          history: plane2DHistory,
          activeTool: plane2DTool,
          pendingSegmentPointId: plane2DPendingSegmentPointId,
          viewport: plane2DViewportState,
        },
      };
    }

    return tab;
  };

  const syncActiveWorkspaceTab = () => {
    if (!activeTabId) {
      return;
    }

    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId ? captureActiveWorkspaceTab(tab) : tab,
      ),
    );
  };

  const loadWorkspaceTab = (tab: WorkspaceTab) => {
    resetTransientToolState();
    resetPlane2DTransientState();
    setPropertiesTab("properties");
    setObjectListSearchQuery("");
    setCurrentFilePath(tab.filePath);
    setIsDirty(tab.isDirty);

    if (tab.kind === "geometry3d") {
      const manager =
        tab.geometry3DState?.commandManager ??
        new CommandManager(tab.document as BoardDocument);

      commandManagerRef.current = manager;
      setDocument(manager.getDocument());
      setPlaneCanvasDocument(null);
      setPlane2DHistory(createPlane2DHistoryState());
      setCurrentTool(tab.geometry3DState?.activeTool ?? "select");
      setGeometry3DViewState(tab.geometry3DState?.viewState ?? null);
      setWorkspaceMode("geometry3d");
      return;
    }

    const planeDocument = syncPlane2DIntersections(
      normalizePlaneCanvasDocument(tab.document as PlaneCanvasDocument),
    );

    setPlaneCanvasDocument(planeDocument);
    setPlane2DHistory(tab.plane2DState?.history ?? createPlane2DHistoryState());
    setPlane2DTool(tab.plane2DState?.activeTool ?? "select");
    setPlane2DPendingSegmentPointId(
      tab.plane2DState?.pendingSegmentPointId ?? null,
    );
    setPlane2DViewportState(
      tab.plane2DState?.viewport ?? { panX: 0, panY: 0, zoom: 1 },
    );
    setGeometry3DViewState(null);
    setDocument(null);
    setWorkspaceMode("plane2d");
  };

  const activateWorkspaceTab = (tabId: string) => {
    const nextTab = tabs.find((tab) => tab.id === tabId);

    if (!nextTab || nextTab.id === activeTabId) {
      return;
    }

    syncActiveWorkspaceTab();
    setActiveTabId(nextTab.id);
    loadWorkspaceTab(nextTab);
  };

  const setCurrentPreselection = (nextPreselection: Preselection | null) => {
    preselectionRef.current = nextPreselection;
    setPreselection(nextPreselection);
  };
  const displayDocument =
    dragPreviewDocument ?? document ?? commandManager.getDocument();
  const entities = Object.values(displayDocument.entities);
  const selectedEntities = displayDocument.selectedEntityIds
    .map((entityId) => displayDocument.entities[entityId])
    .filter((entity): entity is BoardEntity => Boolean(entity));
  const selectedEntityCount = selectedEntities.length;
  const selectedPointEntities = selectedEntities.filter(
    (entity): entity is PointEntity => entity.kind === "point",
  );
  const selectedPointCount = selectedPointEntities.length;
  const singleSelectedEntity =
    selectedEntityCount === 1 ? selectedEntities[0] : null;
  const selectedNameableEntity = isNameableEntity(singleSelectedEntity)
    ? singleSelectedEntity
    : null;
  const objectInspectorInfo = singleSelectedEntity
    ? getObjectInspectorInfo(singleSelectedEntity.id, displayDocument)
    : null;
  const selectedExtensionParts =
    singleSelectedEntity?.kind === "segment" || singleSelectedEntity?.kind === "plane"
      ? getExtensionPartsForEntity(singleSelectedEntity.id, displayDocument)
      : [];
  const selectedConstructionExtensionParts =
    singleSelectedEntity?.kind === "perpendicularLine"
      ? getExtensionPartsForEntity(
          singleSelectedEntity.segmentId,
          displayDocument,
        ).filter((part) => part.sourceEntityId === singleSelectedEntity.id)
      : singleSelectedEntity?.kind === "linePlanePerpendicular"
        ? getExtensionPartsForEntity(
            singleSelectedEntity.planeId,
            displayDocument,
          ).filter((part) => part.sourceEntityId === singleSelectedEntity.id)
        : [];
  const selectedExtensionSourcePart =
    singleSelectedEntity?.kind === "extension"
      ? {
          id: `extension:${singleSelectedEntity.id}`,
          kind:
            singleSelectedEntity.targetType === "segment"
              ? "manualSegmentExtension"
              : "manualPlaneExtension",
          ownerEntityId: singleSelectedEntity.targetId,
          ownerEntityType: singleSelectedEntity.targetType,
          sourceEntityId: singleSelectedEntity.id,
          sourceEntityType: "extension",
          label:
            singleSelectedEntity.targetType === "segment"
              ? "Manual extension to coordinate boundary"
              : "Manual plane extension to coordinate boundary",
          visible: isExtensionVisible(singleSelectedEntity),
          canSnap:
            isExtensionVisible(singleSelectedEntity) &&
            singleSelectedEntity.snapEnabled !== false,
        } satisfies ExtensionPartInfo
      : null;
  const selectedExtensionControlParts = selectedExtensionSourcePart
    ? [selectedExtensionSourcePart]
    : selectedConstructionExtensionParts.length > 0
      ? selectedConstructionExtensionParts
      : selectedExtensionParts;
  const geometryObjectListGroups = useMemo<readonly ObjectListGroup[]>(() => {
    const groupOrder = [
      "点",
      "线段 / 直线类对象",
      "平面 / 多边形 / 立体对象",
      "函数曲面",
      "构造对象",
      "测量",
      "计算",
      "对象",
    ];
    const groups = new Map<string, ObjectListItem[]>();

    Object.values(displayDocument.entities).forEach((entity) => {
      const groupLabel = getBoardEntityGroupLabel(entity);
      const items = groups.get(groupLabel) ?? [];

      items.push(getBoardObjectListItem(entity, displayDocument.selectedEntityIds));
      groups.set(groupLabel, items);
    });

    return groupOrder
      .filter((label) => groups.has(label))
      .map((label) => ({
        id: label,
        label,
        items: groups.get(label) ?? [],
      }));
  }, [displayDocument.entities, displayDocument.selectedEntityIds]);
  const hasPointA = Boolean(displayDocument.entities[TEST_POINT_A_ID]);
  const hasPointB = Boolean(displayDocument.entities[TEST_POINT_B_ID]);
  const hasSegmentAB = Boolean(displayDocument.entities[TEST_SEGMENT_AB_ID]);
  const activeWorkspaceTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const currentFileName = currentFilePath
    ? currentFilePath.split(/[\\/]/).pop() ?? currentFilePath
    : activeWorkspaceTab?.title ?? "Untitled.sgb";
  const workspaceTabItems: readonly WorkspaceTabBarItem[] = tabs.map((tab) => ({
    id: tab.id,
    kind: tab.kind,
    title: tab.title,
    isDirty: tab.id === activeTabId ? isDirty : tab.isDirty,
  }));
  const parallelAnchorPreviewPosition =
    currentTool === "parallel" && parallelDraft
      ? lastSnapResult?.position ?? lastPointerInfo?.worldPosition ?? null
      : null;
  const parallelPreviewSegment =
    parallelDraft?.kind === "segment"
      ? getParallelSegmentPreview(
          displayDocument,
          parallelDraft,
          parallelAnchorPreviewPosition,
        )
      : null;
  const parallelPreviewPlane =
    parallelDraft?.kind === "plane"
      ? getParallelPlanePreview(
          displayDocument,
          parallelDraft,
          parallelAnchorPreviewPosition,
        )
      : null;
  const parallelFollowPreviewPosition =
    currentTool === "parallel" && parallelDraft?.kind === "segment"
      ? parallelAnchorPreviewPosition
      : null;
  const parallelOtherPreviewPosition =
    currentTool === "parallel" &&
    parallelDraft?.kind === "segment" &&
    parallelPreviewSegment
      ? parallelDraft.sourceAnchorEndpoint === "start"
        ? parallelPreviewSegment.end
        : parallelPreviewSegment.start
      : null;
  const parallelPlaneOtherPreviewPositions =
    currentTool === "parallel" &&
    parallelDraft?.kind === "plane" &&
    parallelPreviewPlane
      ? parallelPreviewPlane.filter(
          (_position, index) => index !== parallelDraft.sourceAnchorVertexIndex,
        )
      : [];
  const secondaryPreviewPosition =
    parallelOtherPreviewPosition ?? parallelPlaneOtherPreviewPositions[0] ?? null;
  const tertiaryPreviewPosition =
    parallelPlaneOtherPreviewPositions[1] ?? null;
  const previewPosition =
    currentTool === "point" && pointCreationMode === "free"
      ? latestPointToolResolvedResultRef.current?.finalPosition ??
        lastSnapResult?.position ??
        null
      : currentTool === "segment"
        ? lastSnapResult?.position ?? null
        : currentTool === "parallel" && parallelPreviewSegment
          ? parallelFollowPreviewPosition
          : currentTool === "parallel" && parallelDraft
            ? parallelAnchorPreviewPosition
        : currentTool === "perpendicular" && perpendicularDirectionPick
          ? perpendicularDirectionPreviewEnd
        : currentTool === "plane"
        ? lastSnapResult?.position ?? null
        : null;
  const segmentPreviewStartPosition =
    currentTool === "segment" &&
    segmentFirstPointId &&
    displayDocument.entities[segmentFirstPointId]?.kind === "point"
      ? getPointWorldPosition(displayDocument, segmentFirstPointId)
      : currentTool === "perpendicular" && perpendicularDirectionPick
        ? getPointWorldPosition(displayDocument, perpendicularDirectionPick.pointId) ??
          perpendicularDirectionPick.basePoint
      : currentTool === "parallel" && parallelPreviewSegment
        ? parallelOtherPreviewPosition
      : null;

  useEffect(() => {
    if (!selectedNameableEntity) {
      setDraftName("");
      return;
    }

    setDraftName(getManualNameDraft(selectedNameableEntity));
  }, [
    selectedNameableEntity?.id,
    selectedNameableEntity?.kind,
    selectedNameableEntity?.name,
    selectedNameableEntity?.nameSource,
  ]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage((currentToastMessage) =>
        currentToastMessage?.id === toastMessage.id ? null : currentToastMessage,
      );
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);
  const segmentToolStatus = getSegmentToolStatus(
    currentTool,
    segmentFirstPointId,
    entities,
  );
  const planeToolStatus = getPlaneToolStatus(
    currentTool,
    planeSelectedPointIds,
    planeStatusMessage,
    displayDocument,
  );
  const perpendicularToolStatus = getPerpendicularToolStatus(
    currentTool,
    perpendicularMode,
    perpendicularDirectionPick,
    perpendicularPointId,
    perpendicularSegmentId,
    perpendicularPlaneId,
    perpendicularStatusMessage,
    displayDocument,
  );
  const midpointToolStatus = getMidpointToolStatus(
    currentTool,
    midpointFirstPointId,
    midpointStatusMessage,
    displayDocument,
  );
  const extendToolStatus = getExtendToolStatus(
    currentTool,
    extendMode,
    extendStatusMessage,
  );
  const parallelToolStatus = getParallelToolStatus(
    currentTool,
    parallelMode,
    parallelDraft,
    parallelStatusMessage,
    displayDocument,
  );
  const intersectionToolStatus = getIntersectionToolStatus(
    currentTool,
    intersectionFirstTarget,
    intersectionStatusMessage,
    displayDocument,
  );
  const measureLengthToolStatus = getMeasureLengthToolStatus(
    currentTool,
    measureFirstPointId,
    measureStatusMessage,
    entities,
  );
  const measureAngleToolStatus = getMeasureAngleToolStatus(
    currentTool,
    angleMeasureMode,
    angleSelectedPointIds,
    linePlaneAngleSegmentId,
    planePlaneAngleFirstPlaneId,
    angleStatusMessage,
    displayDocument,
  );
  const calculationToolStatus =
    currentTool === "calculation"
      ? calculationStatusMessage ??
        (isPlacingCalculation
          ? "计算：请点击画布放置结果"
          : "计算：点击线段或测量对象插入引用")
      : null;
  const pointDragStatus =
    draggedPointId && displayDocument.entities[draggedPointId]?.kind === "point"
      ? `Moving point ${getPointDisplayName(
          displayDocument.entities[draggedPointId],
        )}`
      : null;
  const preselectionStatus = getPreselectionDescription(
    preselection,
    displayDocument,
  );
  const highlightedPointIds = useMemo(() => {
    const pointIds: EntityId[] = [];
    const addPointId = (entityId: EntityId | null | undefined) => {
      if (!entityId || displayDocument.entities[entityId]?.kind !== "point") {
        return;
      }

      pointIds.push(entityId);
    };

    displayDocument.selectedEntityIds.forEach(addPointId);
    addPointId(segmentFirstPointId);
    addPointId(measureFirstPointId);
    addPointId(draggedPointId);
    addPointId(perpendicularPointId);
    addPointId(midpointFirstPointId);
    planeSelectedPointIds.forEach(addPointId);
    angleSelectedPointIds.forEach(addPointId);

    return [...new Set(pointIds)];
  }, [
    angleSelectedPointIds,
    displayDocument.entities,
    displayDocument.selectedEntityIds,
    draggedPointId,
    measureFirstPointId,
    midpointFirstPointId,
    perpendicularPointId,
    planeSelectedPointIds,
    segmentFirstPointId,
  ]);
  const highlightedEntityIds = useMemo(
    () =>
      [
        perpendicularSegmentId &&
        displayDocument.entities[perpendicularSegmentId]?.kind === "segment"
          ? perpendicularSegmentId
          : null,
        perpendicularPlaneId &&
        displayDocument.entities[perpendicularPlaneId]?.kind === "plane"
          ? perpendicularPlaneId
          : null,
        parallelDraft?.kind === "segment" &&
        displayDocument.entities[parallelDraft.sourceSegmentId]?.kind ===
          "segment"
          ? parallelDraft.sourceSegmentId
          : null,
        parallelDraft?.kind === "plane" &&
        displayDocument.entities[parallelDraft.sourcePlaneId]?.kind === "plane"
          ? parallelDraft.sourcePlaneId
          : null,
        intersectionFirstTarget &&
        (displayDocument.entities[intersectionFirstTarget.entityId]?.kind ===
          "segment" ||
          displayDocument.entities[intersectionFirstTarget.entityId]?.kind ===
            "plane")
          ? intersectionFirstTarget.entityId
          : null,
      ].filter((entityId): entityId is EntityId => Boolean(entityId)),
    [
      displayDocument.entities,
      intersectionFirstTarget,
      parallelDraft,
      perpendicularPlaneId,
      perpendicularSegmentId,
    ],
  );

  const sanitizeSelection = (nextDocument: BoardDocument): BoardDocument => {
    const selectedEntityIds = nextDocument.selectedEntityIds.filter((entityId) =>
      Boolean(nextDocument.entities[entityId]),
    );

    return selectedEntityIds.length === nextDocument.selectedEntityIds.length
      ? nextDocument
      : {
          ...nextDocument,
          selectedEntityIds,
        };
  };

  const syncDocumentState = (nextDocument: BoardDocument) => {
    const sanitizedDocument = sanitizeSelection(nextDocument);

    commandManager.setDocument(sanitizedDocument);
    setDocument(sanitizedDocument);
  };

  const executeCommand = (command: Command) => {
    const previousDocument = commandManager.getDocument();
    const nextDocument = commandManager.execute(command);

    syncDocumentState(nextDocument);

    if (nextDocument !== previousDocument) {
      setIsDirty(true);
    }
  };

  const setSelection = (entityIds: readonly EntityId[]) => {
    const currentDocument = commandManager.getDocument();
    const selectedEntityIds = [...new Set(entityIds)].filter((entityId) =>
      Boolean(currentDocument.entities[entityId]),
    );

    syncDocumentState({
      ...currentDocument,
      selectedEntityIds,
    });
  };

  const selectEntity = (entityId: EntityId) => {
    setSelection([entityId]);
  };

  const toggleSelection = (entityId: EntityId) => {
    const currentSelectedEntityIds =
      commandManager.getDocument().selectedEntityIds;

    setSelection(
      currentSelectedEntityIds.includes(entityId)
        ? currentSelectedEntityIds.filter(
            (selectedEntityId) => selectedEntityId !== entityId,
          )
        : [...currentSelectedEntityIds, entityId],
    );
  };

  const clearSelection = () => {
    setSelection([]);
  };

  const createPointMovePreviewDocument = (
    sourceDocument: BoardDocument,
    pointId: EntityId,
    position: Vec3,
  ): BoardDocument => {
    const entity = sourceDocument.entities[pointId];

    if (!entity || entity.kind !== "point") {
      return sourceDocument;
    }

    return {
      ...sourceDocument,
      entities: {
        ...sourceDocument.entities,
        [pointId]: {
          ...entity,
          position: cloneVec3(position),
          updatedAt: new Date().toISOString(),
        },
      },
    };
  };

  const getParallelPointMoveAnchorPosition = (
    point: PointEntity,
    desiredPosition: Vec3,
    sourceDocument: BoardDocument,
  ): Vec3 | null => {
    if (point.construction?.kind === "parallelSegmentEndpoint") {
      const sourceSegment =
        sourceDocument.entities[point.construction.sourceSegmentId];

      if (sourceSegment?.kind !== "segment") {
        return null;
      }

      const startPosition = getPointWorldPosition(
        sourceDocument,
        sourceSegment.pointIds[0],
      );
      const endPosition = getPointWorldPosition(
        sourceDocument,
        sourceSegment.pointIds[1],
      );

      if (!startPosition || !endPosition) {
        return null;
      }

      const offset =
        point.construction.sourceAnchorEndpoint === "start"
          ? subtractVec3(endPosition, startPosition)
          : subtractVec3(startPosition, endPosition);

      return subtractVec3(desiredPosition, offset);
    }

    if (point.construction?.kind === "parallelPlaneVertex") {
      const sourcePlane = sourceDocument.entities[point.construction.sourcePlaneId];

      if (sourcePlane?.kind !== "plane") {
        return null;
      }

      const sourcePositions = sourcePlane.pointIds.map((pointId) =>
        getPointWorldPosition(sourceDocument, pointId),
      );
      const sourceAnchorPosition =
        sourcePositions[point.construction.sourceAnchorVertexIndex];
      const sourceVertexPosition =
        sourcePositions[point.construction.sourceVertexIndex];

      if (!sourceAnchorPosition || !sourceVertexPosition) {
        return null;
      }

      return subtractVec3(
        desiredPosition,
        subtractVec3(sourceVertexPosition, sourceAnchorPosition),
      );
    }

    return null;
  };

  const getParallelDragAnchorPointId = (
    point: PointEntity,
    sourceDocument: BoardDocument,
  ): EntityId | null => {
    if (point.construction?.kind === "parallelSegmentEndpoint") {
      const parallelInfo = Object.values(sourceDocument.entities)
        .filter((entity): entity is SegmentEntity => entity.kind === "segment")
        .map((segment) => getParallelSegmentInfo(segment.id, sourceDocument))
        .find((info) => info?.constructedPointId === point.id);

      return parallelInfo?.anchorPointId ?? null;
    }

    if (point.construction?.kind === "parallelPlaneVertex") {
      const parallelInfo = Object.values(sourceDocument.entities)
        .filter((entity): entity is PlaneEntity => entity.kind === "plane")
        .map((plane) => getParallelPlaneInfo(plane.id, sourceDocument))
        .find((info) => info?.constructedPointIds.includes(point.id));

      return parallelInfo?.anchorPointId ?? null;
    }

    return null;
  };

  const getDragPosition = (pointerInfo: PointerInfo): Vec3 | null =>
    pointerInfo.snapResult?.position ?? pointerInfo.worldPosition ?? null;

  const isFiniteVec3 = (position: Vec3): boolean =>
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);

  const isDragPositionSafe = (
    position: Vec3,
    referencePosition: Vec3,
  ): boolean => {
    if (!isFiniteVec3(position)) {
      return false;
    }

    if (
      Math.abs(position.x) > MAX_POINT_DRAG_COORDINATE ||
      Math.abs(position.y) > MAX_POINT_DRAG_COORDINATE ||
      Math.abs(position.z) > MAX_POINT_DRAG_COORDINATE
    ) {
      return false;
    }

    return (
      Math.hypot(
        position.x - referencePosition.x,
        position.y - referencePosition.y,
        position.z - referencePosition.z,
      ) <= MAX_POINT_DRAG_STEP
    );
  };

  const cancelPointDrag = () => {
    pointDragStateRef.current = null;
    setDragPreviewDocument(null);
    setDraggedPointId(null);
    setCurrentPreselection(null);
  };

  const resetTransientToolState = () => {
    cancelPointDrag();
    latestPointToolResolvedResultRef.current = null;
    segmentToolRef.current.cancel();
    planeToolRef.current.cancel();
    measureLengthToolRef.current.cancel();
    measureAngleToolRef.current.cancel();
    setSegmentFirstPointId(null);
    setPlaneSelectedPointIds([]);
    setPlaneStatusMessage(null);
    setPerpendicularPointId(null);
    setPerpendicularSegmentId(null);
    setPerpendicularPlaneId(null);
    clearPerpendicularDirectionPick();
    setPerpendicularStatusMessage(null);
    setShowPerpendicularToolPanel(false);
    setMeasureFirstPointId(null);
    setMeasureStatusMessage(null);
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    setCalculationExpression(null);
    setCalculationPendingOp(null);
    setIsPlacingCalculation(false);
    setCalculationPointPicker(null);
    setCalculationStatusMessage(null);
    setIntersectionFirstTarget(null);
    setIntersectionStatusMessage(null);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setLastPointerInfo(null);
    setLastSnapResult(null);
    setCurrentPreselection(null);
  };

  const resetPlane2DTransientState = () => {
    setPlane2DPendingSegmentPointId(null);
    setPlane2DStatusMessage(null);
    setPlane2DResetSignal((value) => value + 1);
  };

  const resetProjectDocument = (
    nextDocument: BoardDocument,
    nextFilePath: string | null,
  ) => {
    const sanitizedDocument = sanitizeSelection({
      ...nextDocument,
      selectedEntityIds: [],
    });
    const now = new Date().toISOString();
    const manager = new CommandManager(sanitizedDocument);
    const title = getTabTitleFromPath(
      nextFilePath,
      `三维画布 ${nextGeometryTabNumberRef.current}`,
    );
    const tab: WorkspaceTab = {
      id: createWorkspaceTabId(),
      kind: "geometry3d",
      title,
      filePath: nextFilePath,
      document: sanitizedDocument,
      isDirty: false,
      createdAt: now,
      updatedAt: now,
      geometry3DState: {
        commandManager: manager,
        activeTool: "select",
        viewState: null,
      },
    };

    nextGeometryTabNumberRef.current += 1;
    syncActiveWorkspaceTab();
    setTabs((currentTabs) => [...currentTabs, tab]);
    setActiveTabId(tab.id);
    commandManagerRef.current = manager;
    setDocument(sanitizedDocument);
    setCurrentFilePath(nextFilePath);
    setIsDirty(false);
    setCurrentTool("select");
    setPlaneCanvasDocument(null);
    setGeometry3DViewState(null);
    setPlane2DHistory(createPlane2DHistoryState());
    resetPlane2DTransientState();
    setWorkspaceMode("geometry3d");
    resetTransientToolState();
  };

  const resetPlaneCanvasDocument = (
    nextDocument: PlaneCanvasDocument,
    nextFilePath: string | null,
  ) => {
    const normalizedDocument = syncPlane2DIntersections(
      normalizePlaneCanvasDocument(nextDocument),
    );
    const now = new Date().toISOString();
    const title = getTabTitleFromPath(
      nextFilePath,
      `平面画布 ${nextPlaneTabNumberRef.current}`,
    );
    const tab: WorkspaceTab = {
      id: createWorkspaceTabId(),
      kind: "plane2d",
      title,
      filePath: nextFilePath,
      document: normalizedDocument,
      isDirty: false,
      createdAt: now,
      updatedAt: now,
      plane2DState: {
        history: createPlane2DHistoryState(),
        activeTool: "select",
        pendingSegmentPointId: null,
        viewport: { panX: 0, panY: 0, zoom: 1 },
      },
    };

    nextPlaneTabNumberRef.current += 1;
    syncActiveWorkspaceTab();
    setTabs((currentTabs) => [...currentTabs, tab]);
    setActiveTabId(tab.id);
    resetTransientToolState();
    setPlaneCanvasDocument(normalizedDocument);
    setPlane2DHistory(createPlane2DHistoryState());
    setPlane2DViewportState({ panX: 0, panY: 0, zoom: 1 });
    setCurrentFilePath(nextFilePath);
    setIsDirty(false);
    setPlane2DTool("select");
    resetPlane2DTransientState();
    setWorkspaceMode("plane2d");
  };

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId ? captureActiveWorkspaceTab(tab) : tab,
      ),
    );
  }, [
    activeTabId,
    currentFilePath,
    currentTool,
    document,
    geometry3DViewState,
    isDirty,
    plane2DHistory,
    plane2DPendingSegmentPointId,
    plane2DTool,
    plane2DViewportState,
    planeCanvasDocument,
    workspaceMode,
  ]);

  const isPlaneCanvasDocumentLike = (
    value: unknown,
  ): value is PlaneCanvasDocument =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as { type?: unknown }).type === "plane2d",
    );

  const tryImportPlaneCanvasDocument = (
    jsonText: string,
  ): PlaneCanvasDocument | null => {
    const parsed = JSON.parse(jsonText) as unknown;

    if (isPlaneCanvasDocumentLike(parsed)) {
      return normalizePlaneCanvasDocument(parsed);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      isPlaneCanvasDocumentLike(
        (parsed as { document?: unknown }).document,
      )
    ) {
      return normalizePlaneCanvasDocument(
        (parsed as { document: PlaneCanvasDocument }).document,
      );
    }

    return null;
  };

  const exportPlaneCanvasProject = (
    nextDocument: PlaneCanvasDocument,
  ): string => {
    const projectFile: PlaneCanvasProjectFile = {
      fileVersion: PROJECT_FILE_VERSION,
      appName: PROJECT_APP_NAME,
      appVersion: PROJECT_APP_VERSION,
      savedAt: new Date().toISOString(),
      document: syncPlane2DIntersections(nextDocument),
    };

    return JSON.stringify(projectFile, null, 2);
  };

  const showFileError = async (title: string, error: unknown) => {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const errorMessage = rawMessage.includes("not allowed by ACL")
      ? `${rawMessage}\n\nPlease check the application file-system permissions and choose a writable project file path.`
      : rawMessage;

    if (isTauriEnvironment()) {
      try {
        const { message } = await import("@tauri-apps/plugin-dialog");

        await message(errorMessage, { title, kind: "error" });
        return;
      } catch {
        // Fall back to alert below. This also covers browser dev mode.
      }
    }

    window.alert(`${title}\n${errorMessage}`);
  };

  const getDefaultProjectFileName = () => {
    if (workspaceMode === "plane2d") {
      return `${planeCanvasDocument?.name ?? "未命名平面画布"}.sgb`;
    }

    const currentDocument = commandManager.getDocument();
    const safeDocumentName = (currentDocument.name || "Untitled Board")
      .replace(/[<>:"\/\\|?*]+/g, "-")
      .trim();

    return `${safeDocumentName || "Untitled Board"}.sgb`;
  };

  const ensureProjectFileExtension = (filePath: string) =>
    /\.(sgb|json)$/i.test(filePath) ? filePath : `${filePath}.sgb`;

  const getDownloadFileName = () =>
    ensureProjectFileExtension(currentFileName || getDefaultProjectFileName());

  const downloadProjectInBrowser = (fileName: string) => {
    const projectJson =
      workspaceMode === "plane2d" && planeCanvasDocument
        ? exportPlaneCanvasProject(planeCanvasDocument)
        : exportProject(commandManager.getDocument());
    const blob = new Blob([projectJson], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = window.document.createElement("a");

    link.href = objectUrl;
    link.download = ensureProjectFileExtension(fileName);
    link.style.display = "none";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setCurrentFilePath(link.download);
    setIsDirty(false);
    setFileStatusMessage("Downloaded project file");
  };

  const readProjectInBrowser = async (): Promise<{
    readonly fileName: string;
    readonly jsonText: string;
  } | null> =>
    new Promise((resolve, reject) => {
      const input = window.document.createElement("input");

      input.type = "file";
      input.accept = ".sgb,.json,application/json";
      input.style.display = "none";

      input.addEventListener("change", async () => {
        const file = input.files?.[0] ?? null;

        input.remove();

        if (!file) {
          resolve(null);
          return;
        }

        try {
          resolve({
            fileName: file.name,
            jsonText: await file.text(),
          });
        } catch (error) {
          reject(error);
        }
      });

      window.document.body.appendChild(input);
      input.click();
    });

  const writeProjectToFile = async (filePath: string) => {
    if (!isTauriEnvironment()) {
      downloadProjectInBrowser(filePath);
      return;
    }

    const { writeTextFile } = await import("@tauri-apps/plugin-fs");

    const fileContents =
      workspaceMode === "plane2d" && planeCanvasDocument
        ? exportPlaneCanvasProject(planeCanvasDocument)
        : exportProject(commandManager.getDocument());

    await writeTextFile(filePath, fileContents);
    setCurrentFilePath(filePath);
    setIsDirty(false);
    setFileStatusMessage("Save succeeded");
  };

  const newProject = () => {
    resetProjectDocument(createEmptyDocument({ name: "Untitled Board" }), null);
    setFileStatusMessage("New project");
  };

  const newPlaneCanvas = () => {
    resetPlaneCanvasDocument(createPlaneCanvasDocument(), null);
    setFileStatusMessage("平面画布已创建");
  };

  const closeWorkspaceTab = (tabId: string) => {
    const currentTabs = tabs.map((tab) =>
      tab.id === activeTabId ? captureActiveWorkspaceTab(tab) : tab,
    );
    const closingTab = currentTabs.find((tab) => tab.id === tabId);

    if (!closingTab) {
      return;
    }

    if (
      closingTab.isDirty &&
      !window.confirm("文件尚未保存，确定关闭吗？")
    ) {
      return;
    }

    const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

    setTabs(nextTabs);

    if (tabId !== activeTabId) {
      return;
    }

    const nextTab =
      nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;

    if (nextTab) {
      setActiveTabId(nextTab.id);
      loadWorkspaceTab(nextTab);
      setFileStatusMessage("Closed workspace");
      return;
    }

    resetTransientToolState();
    setActiveTabId(null);
    setWorkspaceMode("none");
    setDocument(null);
    setPlaneCanvasDocument(null);
    setPlane2DHistory(createPlane2DHistoryState());
    setPlane2DViewportState({ panX: 0, panY: 0, zoom: 1 });
    resetPlane2DTransientState();
    setCurrentFilePath(null);
    setIsDirty(false);
    setCurrentTool("select");
    setFileStatusMessage("Closed workspace");
  };

  const closeWorkspace = () => {
    if (!activeTabId) {
      return;
    }

    closeWorkspaceTab(activeTabId);
  };

  const updatePlaneCanvasDocument = (
    nextDocument: PlaneCanvasDocument,
    dirty = true,
    options?: Plane2DDocumentChangeOptions,
  ) => {
    const syncedDocument = syncPlane2DIntersections(nextDocument);

    setPlaneCanvasDocument(syncedDocument);
    if (dirty) {
      setIsDirty(true);
    }

    const historyMode = options?.history ?? (dirty ? "record" : "silent");

    if (dirty && historyMode !== "silent") {
      const beforeDocument = options?.before ?? planeCanvasDocument;

      if (beforeDocument) {
        setPlane2DHistory((currentHistory) =>
          pushPlane2DHistoryEntry(
            currentHistory,
            options?.label ?? "更新平面画布",
            beforeDocument,
            syncedDocument,
          ),
        );
      }
    }
  };

  const deleteSelectedPlane2DEntities = () => {
    if (!planeCanvasDocument || planeCanvasDocument.selectedEntityIds.length === 0) {
      return;
    }

    updatePlaneCanvasDocument(
      deletePlane2DEntities(
        planeCanvasDocument,
        planeCanvasDocument.selectedEntityIds,
      ),
    );
    setPlane2DStatusMessage("已删除二维对象");
  };

  const selectPlane2DEntityFromList = (entityId: string) => {
    if (!planeCanvasDocument || !planeCanvasDocument.entities[entityId]) {
      return;
    }

    updatePlaneCanvasDocument(
      {
        ...planeCanvasDocument,
        selectedEntityIds: [entityId],
      },
      false,
    );
  };

  const setPlane2DEntityVisibility = (entityId: string, visible: boolean) => {
    if (!planeCanvasDocument) {
      return;
    }

    const entity = planeCanvasDocument.entities[entityId];

    if (!entity || isPlane2DEntityVisible(entity) === visible) {
      return;
    }

    const nextEntity =
      entity.type === "plane2d-extension"
        ? {
            ...entity,
            visible,
            snapEnabled: visible,
            updatedAt: new Date().toISOString(),
          }
        : {
            ...entity,
            visible,
            updatedAt: new Date().toISOString(),
          };

    updatePlaneCanvasDocument(
      {
        ...planeCanvasDocument,
        entities: {
          ...planeCanvasDocument.entities,
          [entity.id]: nextEntity,
        },
      },
      true,
      { label: visible ? "显示二维对象" : "隐藏二维对象" },
    );
    setPlane2DStatusMessage(visible ? "已显示对象" : "已隐藏对象");
  };

  const deletePlane2DEntityFromList = (entityId: string) => {
    if (!planeCanvasDocument || !planeCanvasDocument.entities[entityId]) {
      return;
    }

    updatePlaneCanvasDocument(
      deletePlane2DEntities(planeCanvasDocument, [entityId]),
      true,
      { label: "删除二维对象" },
    );
    setPlane2DStatusMessage("已删除二维对象");
  };

  const openProject = async () => {
    try {
      if (!isTauriEnvironment()) {
        const browserFile = await readProjectInBrowser();

        if (!browserFile) {
          return;
        }

        const existingTab = tabs.find((tab) => tab.filePath === browserFile.fileName);

        if (existingTab) {
          activateWorkspaceTab(existingTab.id);
          setFileStatusMessage("文件已打开");
          return;
        }

        const importedPlaneCanvas = tryImportPlaneCanvasDocument(
          browserFile.jsonText,
        );

        if (importedPlaneCanvas) {
          resetPlaneCanvasDocument(importedPlaneCanvas, browserFile.fileName);
          setFileStatusMessage("已打开浏览器平面画布");
          return;
        }

        const importedDocument = importProject(browserFile.jsonText);

        resetProjectDocument(importedDocument, browserFile.fileName);
        setFileStatusMessage("Opened browser file");
        return;
      }

      const { open: openFileDialog } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const selectedFilePath = await openFileDialog({
        title: "Open Solid Geometry project",
        multiple: false,
        filters: [
          {
            name: "Solid Geometry Board",
            extensions: ["sgb", "json"],
          },
        ],
      });

      if (!selectedFilePath || Array.isArray(selectedFilePath)) {
        return;
      }

      const existingTab = tabs.find((tab) => tab.filePath === selectedFilePath);

      if (existingTab) {
        activateWorkspaceTab(existingTab.id);
        setFileStatusMessage("文件已打开");
        return;
      }

      const jsonText = await readTextFile(selectedFilePath);
      const importedPlaneCanvas = tryImportPlaneCanvasDocument(jsonText);

      if (importedPlaneCanvas) {
        resetPlaneCanvasDocument(importedPlaneCanvas, selectedFilePath);
        setFileStatusMessage("已打开平面画布");
        return;
      }

      const importedDocument = importProject(jsonText);

      resetProjectDocument(importedDocument, selectedFilePath);
      setFileStatusMessage("Opened");
    } catch (error) {
      setFileStatusMessage("Open failed");
      await showFileError("Open failed", error);
    }
  };

  const saveProjectAs = async () => {
    if (
      workspaceMode === "none" ||
      (workspaceMode === "plane2d" && !planeCanvasDocument)
    ) {
      setFileStatusMessage("No canvas to save");
      return;
    }

    try {
      if (!isTauriEnvironment()) {
        downloadProjectInBrowser(getDefaultProjectFileName());
        return;
      }

      const { save: saveFileDialog } = await import(
        "@tauri-apps/plugin-dialog"
      );
      const selectedFilePath = await saveFileDialog({
        title: "Save Solid Geometry project",
        defaultPath: currentFilePath ?? getDefaultProjectFileName(),
        filters: [
          {
            name: "Solid Geometry Board",
            extensions: ["sgb"],
          },
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (!selectedFilePath) {
        return;
      }

      await writeProjectToFile(ensureProjectFileExtension(selectedFilePath));
    } catch (error) {
      setFileStatusMessage("Save failed");
      await showFileError("Save failed", error);
    }
  };

  const saveProject = async () => {
    if (
      workspaceMode === "none" ||
      (workspaceMode === "plane2d" && !planeCanvasDocument)
    ) {
      setFileStatusMessage("No canvas to save");
      return;
    }

    if (!isTauriEnvironment()) {
      downloadProjectInBrowser(getDownloadFileName());
      return;
    }

    if (!currentFilePath) {
      await saveProjectAs();
      return;
    }

    try {
      await writeProjectToFile(currentFilePath);
    } catch (error) {
      setFileStatusMessage("Save failed");
      await showFileError("Save failed", error);
    }
  };

  const deleteSelectedEntities = () => {
    if (workspaceMode !== "geometry3d") {
      return;
    }

    const selectedEntityIds = commandManager
      .getDocument()
      .selectedEntityIds.filter((entityId) =>
        Boolean(commandManager.getDocument().entities[entityId]),
      );

    if (selectedEntityIds.length === 0) {
      return;
    }

    let nextDocument = commandManager.getDocument();

    selectedEntityIds.forEach((entityId) => {
      nextDocument = commandManager.execute(new DeleteEntityCommand(entityId));
    });

    syncDocumentState({
      ...nextDocument,
      selectedEntityIds: [],
    });
    setIsDirty(true);
    setDeleteStatusMessage(
      selectedEntityIds.length === 1
        ? "Deleted selected entity"
        : `Deleted ${selectedEntityIds.length} selected entities`,
    );
  };

  const updateEntity = (entityId: EntityId, patch: EntityUpdate) => {
    executeCommand(new UpdateEntityCommand(entityId, patch));
  };

  const createFunctionSurfaceEntity = (
    input: Omit<
      FunctionSurface3DEntity,
      "id" | "kind" | "type" | "visible" | "locked" | "createdAt" | "updatedAt"
    > &
      Partial<Pick<FunctionSurface3DEntity, "visible" | "locked">>,
  ): FunctionSurface3DEntity => {
    const now = new Date().toISOString();

    return {
      id: createEntityId("function-surface"),
      kind: "functionSurface",
      type: "function-surface-3d",
      visible: input.visible ?? true,
      locked: input.locked ?? false,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
  };

  const confirmFunctionSurfaceDialog = () => {
    if (!functionSurfaceDialog) {
      return;
    }

    const expression = functionSurfaceDialog.expression.trim();
    const xMin = Number(functionSurfaceDialog.xMin);
    const xMax = Number(functionSurfaceDialog.xMax);
    const yMin = Number(functionSurfaceDialog.yMin);
    const yMax = Number(functionSurfaceDialog.yMax);
    const resolutionX = normalizeFunctionSurfaceResolution(
      Number(functionSurfaceDialog.resolutionX),
    );
    const resolutionY = normalizeFunctionSurfaceResolution(
      Number(functionSurfaceDialog.resolutionY),
    );
    const opacity = Math.min(
      1,
      Math.max(0.05, Number(functionSurfaceDialog.opacity)),
    );

    if (
      !Number.isFinite(xMin) ||
      !Number.isFinite(xMax) ||
      !Number.isFinite(yMin) ||
      !Number.isFinite(yMax) ||
      xMin >= xMax ||
      yMin >= yMax
    ) {
      setFunctionSurfaceDialog({
        ...functionSurfaceDialog,
        error: "范围错误。",
      });
      return;
    }

    const sample = sampleFunctionSurface3D(
      expression,
      { min: xMin, max: xMax },
      { min: yMin, max: yMax },
      resolutionX,
      resolutionY,
    );

    if (!sample.ok || sample.sample.indices.length === 0) {
      setFunctionSurfaceDialog({
        ...functionSurfaceDialog,
        error: "表达式错误，无法绘制曲面。",
      });
      return;
    }

    const surface = createFunctionSurfaceEntity({
      expression,
      xMin,
      xMax,
      yMin,
      yMax,
      resolutionX,
      resolutionY,
      opacity: Number.isFinite(opacity) ? opacity : 0.6,
      wireframe: functionSurfaceDialog.wireframe,
      nameSource: "auto",
      showName: false,
    });

    executeCommand(new AddEntityCommand(surface, "创建函数曲面"));
    setSelection([surface.id]);
    setFunctionSurfaceDialog(null);
    showToast("已创建函数曲面。");
  };

  const updateFunctionSurface = (
    surfaceId: EntityId,
    patch: Partial<
      Pick<
        FunctionSurface3DEntity,
        | "expression"
        | "xMin"
        | "xMax"
        | "yMin"
        | "yMax"
        | "resolutionX"
        | "resolutionY"
        | "opacity"
        | "wireframe"
      >
    >,
  ) => {
    const surface = commandManager.getDocument().entities[surfaceId];

    if (surface?.kind !== "functionSurface") {
      return;
    }

    const nextSurface = {
      ...surface,
      ...patch,
      resolutionX:
        patch.resolutionX === undefined
          ? surface.resolutionX
          : normalizeFunctionSurfaceResolution(patch.resolutionX),
      resolutionY:
        patch.resolutionY === undefined
          ? surface.resolutionY
          : normalizeFunctionSurfaceResolution(patch.resolutionY),
      opacity:
        patch.opacity === undefined
          ? surface.opacity
          : Math.min(1, Math.max(0.05, patch.opacity)),
    };
    const sample = sampleFunctionSurface3D(
      nextSurface.expression,
      { min: nextSurface.xMin, max: nextSurface.xMax },
      { min: nextSurface.yMin, max: nextSurface.yMax },
      nextSurface.resolutionX,
      nextSurface.resolutionY,
    );

    if (!sample.ok || sample.sample.indices.length === 0) {
      showToast("表达式错误，无法绘制曲面。");
      return;
    }

    executeCommand(new UpdateEntityCommand<FunctionSurface3DEntity>(surfaceId, patch));
  };

  const setBoardEntityVisibility = (entityId: EntityId, visible: boolean) => {
    const entity = commandManager.getDocument().entities[entityId];

    if (!entity || entity.visible === visible) {
      return;
    }

    executeCommand(new UpdateEntityCommand(entityId, { visible }));
    showToast(visible ? "已显示对象" : "已隐藏对象");
  };

  const deleteBoardEntityFromList = (entityId: EntityId) => {
    if (!commandManager.getDocument().entities[entityId]) {
      return;
    }

    executeCommand(new DeleteEntityCommand(entityId));
    syncDocumentState({
      ...commandManager.getDocument(),
      selectedEntityIds: commandManager
        .getDocument()
        .selectedEntityIds.filter((selectedEntityId) => selectedEntityId !== entityId),
    });
    setDeleteStatusMessage("Deleted selected entity");
  };

  const setExtensionPartVisibility = (
    part: ExtensionPartInfo,
    visible: boolean,
  ) => {
    const currentDocument = commandManager.getDocument();
    const sourceEntity = currentDocument.entities[part.sourceEntityId];
    const command =
      part.sourceEntityType === "extension" && sourceEntity?.kind === "extension"
        ? new UpdateEntityCommand<ExtensionEntity>(sourceEntity.id, {
            visible,
            snapEnabled: visible,
          })
        : part.sourceEntityType === "perpendicularLine" &&
            sourceEntity?.kind === "perpendicularLine"
          ? new UpdateEntityCommand<PerpendicularLineEntity>(sourceEntity.id, {
              style: {
                ...sourceEntity.style,
                showExtensionHelper: visible,
              },
            })
          : part.sourceEntityType === "linePlanePerpendicular" &&
              sourceEntity?.kind === "linePlanePerpendicular"
            ? new UpdateEntityCommand<LinePlanePerpendicularEntity>(
                sourceEntity.id,
                {
                  style: {
                    ...sourceEntity.style,
                    showExtensionHelper: visible,
                  },
                },
              )
            : null;

    if (!command || part.visible === visible) {
      return;
    }

    executeCommand(command);
    showToast(
      visible
        ? `\u5df2\u663e\u793a\uff1a${part.label}`
        : `\u5df2\u9690\u85cf\uff1a${part.label}`,
    );
  };

  const commitDraftName = () => {
    if (!selectedNameableEntity) {
      return;
    }

    const trimmedName = draftName.trim();
    const nextPatch = trimmedName
      ? {
          name: trimmedName,
          nameSource: "manual" as const,
          ...(selectedNameableEntity.kind === "functionSurface"
            ? { showName: true }
            : {}),
        }
      : {
          name: "",
          nameSource: "auto" as const,
          ...(selectedNameableEntity.kind === "functionSurface"
            ? { showName: false }
            : {}),
        };
    const currentName = selectedNameableEntity.name?.trim() ?? "";
    const currentNameSource = selectedNameableEntity.nameSource ?? "auto";
    const hasChanged = trimmedName
      ? currentName !== trimmedName || currentNameSource !== "manual"
      : currentName !== "" || currentNameSource !== "auto";

    if (hasChanged) {
      updateEntity(selectedNameableEntity.id, nextPatch);
    }

    setDraftName(trimmedName);
  };

  const renameSelectedPoints = () => {
    const trimmedStartName = batchNameStart.trim();

    if (selectedPointCount === 0 || !trimmedStartName) {
      return;
    }

    const pointNames = generatePointNames(trimmedStartName, selectedPointCount);

    selectedPointEntities.forEach((point, index) => {
      updateEntity(point.id, {
        name: pointNames[index],
        nameSource: "manual",
      });
    });
    setBatchNameStart("");
    clearSelection();
  };

  const getNextPointName = () => {
    const pointCount = Object.values(commandManager.getDocument().entities).filter(
      (entity) => entity.kind === "point",
    ).length;

    return `P${pointCount + 1}`;
  };

  const getNextSegmentName = () => {
    const segmentCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "segment").length;

    return `S${segmentCount + 1}`;
  };

  const getNextPlaneName = () => {
    const planeCount = Object.values(commandManager.getDocument().entities).filter(
      (entity) => entity.kind === "plane",
    ).length;

    return `Plane ${planeCount + 1}`;
  };

  const getNextPerpendicularLineName = () => {
    const perpendicularCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "perpendicularLine").length;

    return `Perpendicular ${perpendicularCount + 1}`;
  };

  const getNextLinePlanePerpendicularName = () => {
    const perpendicularCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "linePlanePerpendicular").length;

    return `Line Plane Perpendicular ${perpendicularCount + 1}`;
  };

  const getNextExtensionName = () => {
    const extensionCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "extension").length;

    return `Extension ${extensionCount + 1}`;
  };

  const getNextMeasurementName = () => {
    const measurementCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "measurement").length;

    return `L${measurementCount + 1}`;
  };

  const getNextMeasurementDisplayPosition = () => {
    const measurementCount = Object.values(
      commandManager.getDocument().entities,
    ).filter((entity) => entity.kind === "measurement").length;

    return {
      mode: "screen" as const,
      x: 20,
      y: 20 + measurementCount * 20,
    };
  };

  const getSegmentName = (
    startPointId: EntityId,
    endPointId: EntityId,
  ): string => {
    const startPoint = commandManager.getDocument().entities[startPointId];
    const endPoint = commandManager.getDocument().entities[endPointId];
    const startName = startPoint?.kind === "point" ? startPoint.name : undefined;
    const endName = endPoint?.kind === "point" ? endPoint.name : undefined;

    if (startName && endName && !/\s/.test(startName) && !/\s/.test(endName)) {
      return `${startName}${endName}`;
    }

    return getNextSegmentName();
  };

  const getPlaneName = (
    pointAId: EntityId,
    pointBId: EntityId,
    pointCId: EntityId,
  ): string => {
    const currentDocument = commandManager.getDocument();
    const pointNames = [pointAId, pointBId, pointCId].map((pointId) =>
      getCompactPointNameById(currentDocument, pointId),
    );

    return pointNames.every(Boolean) ? pointNames.join("") : getNextPlaneName();
  };

  const getLineDirectionPreviewForState = (
    state: Extract<PerpendicularDirectionPickState, { kind: "line" }>,
    pointerInfo: PointerInfo,
  ): LineDirectionPreview | null => {
    const currentDocument = commandManager.getDocument();
    const segment = currentDocument.entities[state.segmentId];

    if (segment?.kind !== "segment") {
      return null;
    }

    const startPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[0],
    );
    const endPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[1],
    );
    const basePoint =
      getPointWorldPosition(currentDocument, state.pointId) ?? state.basePoint;

    if (!startPosition || !endPosition) {
      return null;
    }

    const snapGuidePosition = getExplicitDirectionSnapPosition(
      pointerInfo.snapResult,
    );

    const segmentDirection = normalizeVec3(
      subtractVec3(endPosition, startPosition),
    );

    if (!segmentDirection || !pointerInfo.pointerRay) {
      return null;
    }

    const directionPlanePoint = intersectRayWithPlane(
      pointerInfo.pointerRay.origin,
      pointerInfo.pointerRay.direction,
      basePoint,
      segmentDirection,
    );

    const rawPreview = directionPlanePoint
      ? getLinePerpendicularDirectionPreview(
          basePoint,
          startPosition,
          endPosition,
          directionPlanePoint,
          "rayDirectionPlane",
        )
      : null;

    if (rawPreview && currentDocument.settings.snapEnabled) {
      const worldUnitsPerPixel = getWorldUnitsPerScreenPixel(
        pointerInfo,
        rawPreview.directionPoint,
      );
      const maxWorldDistance =
        (worldUnitsPerPixel ?? 0) *
        getDirectionSnapPixelRadius(currentDocument);

      if (worldUnitsPerPixel !== null && maxWorldDistance > 0) {
        const candidates: LineDirectionSnapCandidate[] = [];
        const addCandidate = (
          candidate: LineDirectionSnapCandidate | null,
        ): void => {
          if (candidate) {
            candidates.push(candidate);
          }
        };

        if (snapGuidePosition && pointerInfo.snapResult) {
          const constrainedSnapPosition = projectPointToPlane(
            snapGuidePosition,
            basePoint,
            segmentDirection,
          );
          const snapPlaneDistance = Math.abs(
            dotVec3(
              subtractVec3(snapGuidePosition, basePoint),
              segmentDirection,
            ),
          );
          const isGridLikeSnap = isGridLikeDirectionSnap(pointerInfo.snapResult);

          if (!isGridLikeSnap || snapPlaneDistance <= maxWorldDistance) {
            addCandidate(
              createLineDirectionSnapCandidate(
                constrainedSnapPosition,
                rawPreview.directionPoint,
                maxWorldDistance,
                {
                  type: pointerInfo.snapResult.type,
                  description: `perpendicular direction / ${
                    pointerInfo.snapResult.description ??
                    pointerInfo.snapResult.type
                  }`,
                  priority: getLineDirectionSnapPriority(
                    pointerInfo.snapResult.type,
                  ),
                  targetEntityId: pointerInfo.snapResult.targetEntityId,
                  targetEntityType: pointerInfo.snapResult.targetEntityType,
                },
              ),
            );
          }
        }

        if (currentDocument.settings.snapToPoints) {
          Object.values(currentDocument.entities).forEach((entity) => {
            if (entity.kind !== "point" || entity.id === state.pointId) {
              return;
            }

            const pointPosition = getPointWorldPosition(
              currentDocument,
              entity.id,
            );

            if (!pointPosition) {
              return;
            }

            addCandidate(
              createLineDirectionSnapCandidate(
                projectPointToPlane(pointPosition, basePoint, segmentDirection),
                rawPreview.directionPoint,
                maxWorldDistance,
                {
                  type: "point",
                  description: `perpendicular direction / ${
                    entity.name || "point"
                  }`,
                  priority: getLineDirectionSnapPriority("point"),
                  targetEntityId: entity.id,
                  targetEntityType: "point",
                },
              ),
            );
          });
        }

        if (currentDocument.settings.snapToSegments) {
          Object.values(currentDocument.entities).forEach((entity) => {
            if (entity.kind !== "segment" || entity.id === state.segmentId) {
              return;
            }

            const candidateStart = getPointWorldPosition(
              currentDocument,
              entity.pointIds[0],
            );
            const candidateEnd = getPointWorldPosition(
              currentDocument,
              entity.pointIds[1],
            );

            if (!candidateStart || !candidateEnd) {
              return;
            }

            const candidateDirection = subtractVec3(
              candidateEnd,
              candidateStart,
            );

            if (
              distanceBetweenVec3(candidateDirection, createVec3(0, 0, 0)) <
              CONSTRUCTION_EPSILON
            ) {
              return;
            }

            const startPlaneDistance = dotVec3(
              subtractVec3(candidateStart, basePoint),
              segmentDirection,
            );
            const denominator = dotVec3(candidateDirection, segmentDirection);
            let constrainedSegmentPoint: Vec3 | null = null;

            if (Math.abs(denominator) >= CONSTRUCTION_EPSILON) {
              const t = -startPlaneDistance / denominator;

              if (t >= 0 && t <= 1) {
                constrainedSegmentPoint = addVec3(
                  candidateStart,
                  scaleVec3(candidateDirection, t),
                );
              }
            }

            if (!constrainedSegmentPoint) {
              const projection = projectPointToLine(
                rawPreview.directionPoint,
                candidateStart,
                candidateEnd,
              );

              if (projection) {
                const clampedT = clamp(projection.t, 0, 1);
                const closestPoint = addVec3(
                  candidateStart,
                  scaleVec3(candidateDirection, clampedT),
                );
                constrainedSegmentPoint = projectPointToPlane(
                  closestPoint,
                  basePoint,
                  segmentDirection,
                );
              }
            }

            addCandidate(
              constrainedSegmentPoint
                ? createLineDirectionSnapCandidate(
                    constrainedSegmentPoint,
                    rawPreview.directionPoint,
                    maxWorldDistance,
                    {
                      type: "segment",
                      description: `perpendicular direction / ${
                        entity.name || "segment"
                      }`,
                      priority: getLineDirectionSnapPriority("segment"),
                      targetEntityId: entity.id,
                      targetEntityType: "segment",
                    },
                  )
                : null,
            );
          });
        }

        if (currentDocument.settings.snapToAxes) {
          candidates.push(
            ...getAxisDirectionSnapCandidates(
              rawPreview.directionPoint,
              basePoint,
              segmentDirection,
              maxWorldDistance,
            ),
          );
        }

        if (currentDocument.settings.snapToGrid) {
          candidates.push(
            ...getGridDirectionSnapCandidates(
              currentDocument,
              rawPreview.directionPoint,
              basePoint,
              segmentDirection,
              maxWorldDistance,
            ),
          );
        }

        const [bestCandidate] = candidates.sort(
          (a, b) =>
            a.priority - b.priority || a.worldDistance - b.worldDistance,
        );

        if (bestCandidate) {
          const snapPreview = getLinePerpendicularDirectionPreview(
            basePoint,
            startPosition,
            endPosition,
            bestCandidate.position,
            "snapProjected",
            {
              position: bestCandidate.position,
              type: bestCandidate.type,
              targetEntityId: bestCandidate.targetEntityId,
              targetEntityType: bestCandidate.targetEntityType,
              description: bestCandidate.description,
              worldDistance: bestCandidate.worldDistance,
              priority: bestCandidate.priority,
            },
          );

          if (snapPreview) {
            return snapPreview;
          }
        }
      }
    }

    return rawPreview;
  };

  const getPlaneDirectionPreviewForState = (
    state: Extract<PerpendicularDirectionPickState, { kind: "plane" }>,
    guidePosition: Vec3 | null,
  ): PlaneDirectionPreview | null => {
    if (!guidePosition) {
      return null;
    }

    const currentDocument = commandManager.getDocument();
    const plane = currentDocument.entities[state.planeId];

    if (plane?.kind !== "plane") {
      return null;
    }

    const points = [
      getPointWorldPosition(currentDocument, plane.pointIds[0]),
      getPointWorldPosition(currentDocument, plane.pointIds[1]),
      getPointWorldPosition(currentDocument, plane.pointIds[2]),
    ] as const;

    if (!points[0] || !points[1] || !points[2]) {
      return null;
    }

    const planeEquation = getPlaneFromThreePoints(points[0], points[1], points[2]);
    const basePoint =
      getPointWorldPosition(currentDocument, state.pointId) ?? state.basePoint;

    return planeEquation
      ? getPlaneNormalDirectionPreview(
          basePoint,
          planeEquation.normal,
          guidePosition,
          Math.max(currentDocument.settings.coordinateHalfSize * 0.2, 1),
        )
      : null;
  };

  const clearPerpendicularDirectionPick = () => {
    perpendicularDirectionPreviewRef.current = null;
    setPerpendicularDirectionPick(null);
    setPerpendicularDirectionPreviewEnd(null);
  };

  const addPerpendicularLine = (pointId: EntityId, segmentId: EntityId) => {
    const currentDocument = commandManager.getDocument();
    const point = currentDocument.entities[pointId];
    const segment = currentDocument.entities[segmentId];

    if (point?.kind !== "point" || segment?.kind !== "segment") {
      setPerpendicularStatusMessage(
        "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u548c\u4e00\u6761\u7ebf\u6bb5",
      );
      return;
    }

    const pointPosition = getPointWorldPosition(currentDocument, pointId);
    const startPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[0],
    );
    const endPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[1],
    );
    const projection =
      pointPosition && startPosition && endPosition
        ? projectPointToLine(pointPosition, startPosition, endPosition)
        : null;

    if (!projection) {
      showToast("\u76ee\u6807\u7ebf\u6bb5\u957f\u5ea6\u4e3a 0\uff0c\u65e0\u6cd5\u4f5c\u5782\u7ebf");
      setPerpendicularStatusMessage(
        "\u76ee\u6807\u7ebf\u6bb5\u957f\u5ea6\u4e3a 0\uff0c\u65e0\u6cd5\u4f5c\u5782\u7ebf",
      );
      return;
    }

    if (
      pointPosition &&
      distanceBetweenVec3(pointPosition, projection.foot) < CONSTRUCTION_EPSILON
    ) {
      showToast("\u70b9\u5df2\u5728\u7ebf\u4e0a\uff0c\u8bf7\u79fb\u52a8\u9f20\u6807\u9009\u62e9\u5782\u7ebf\u65b9\u5411");
      setPerpendicularDirectionPick({
        kind: "line",
        pointId,
        segmentId,
        basePoint: cloneVec3(pointPosition),
      });
      setPerpendicularPointId(null);
      setPerpendicularSegmentId(null);
      setPerpendicularStatusMessage(
        "\u70b9\u5df2\u5728\u7ebf\u4e0a\uff0c\u8bf7\u79fb\u52a8\u9f20\u6807\u9009\u62e9\u5782\u7ebf\u65b9\u5411",
      );
      return;
    }

    const footPointId = createEntityId("point");
    const perpendicularLine = createPerpendicularLineEntity(
      createEntityId("perpendicularLine"),
      pointId,
      segmentId,
      footPointId,
      getNextPerpendicularLineName(),
    );
    const footPoint = createFootToLinePointEntity(
      footPointId,
      getNextPointName(),
      cloneVec3(projection.foot),
      pointId,
      segmentId,
    );

    executeCommand(new AddPerpendicularLineCommand(perpendicularLine, footPoint));
    clearPerpendicularDirectionPick();
    setPerpendicularPointId(null);
    setPerpendicularSegmentId(null);
    setPerpendicularStatusMessage(
      `\u5df2\u521b\u5efa\u8fc7 ${getPointNameById(
        currentDocument,
        pointId,
      )} \u5782\u76f4\u4e8e ${getSegmentDisplayName(
        currentDocument,
        segment,
      )} \u7684\u5782\u7ebf`,
    );
  };

  const addLinePlanePerpendicular = (pointId: EntityId, planeId: EntityId) => {
    const currentDocument = commandManager.getDocument();
    const point = currentDocument.entities[pointId];
    const plane = currentDocument.entities[planeId];

    if (point?.kind !== "point" || plane?.kind !== "plane") {
      setPerpendicularStatusMessage(
        "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u548c\u4e00\u4e2a\u5e73\u9762",
      );
      return;
    }

    const projection = calculateLinePlanePerpendicular(
      point,
      plane,
      currentDocument,
    );

    if (!projection) {
      showToast("\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u4f5c\u5782\u7ebf");
      setPerpendicularStatusMessage(
        "\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u4f5c\u5782\u7ebf",
      );
      return;
    }

    if (distanceBetweenVec3(projection.point, projection.foot) < CONSTRUCTION_EPSILON) {
      showToast("\u70b9\u5df2\u5728\u5e73\u9762\u4e0a\uff0c\u8bf7\u9009\u62e9\u6cd5\u7ebf\u65b9\u5411");
      setPerpendicularDirectionPick({
        kind: "plane",
        pointId,
        planeId,
        basePoint: cloneVec3(projection.point),
      });
      setPerpendicularPointId(null);
      setPerpendicularPlaneId(null);
      setPerpendicularStatusMessage(
        "\u70b9\u5df2\u5728\u5e73\u9762\u4e0a\uff0c\u8bf7\u9009\u62e9\u6cd5\u7ebf\u65b9\u5411",
      );
      return;
    }

    const footPointId = createEntityId("point");
    const linePlanePerpendicular = createLinePlanePerpendicularEntity(
      createEntityId("linePlanePerpendicular"),
      pointId,
      planeId,
      footPointId,
      getNextLinePlanePerpendicularName(),
    );
    const footPoint = createFootToPlanePointEntity(
      footPointId,
      getNextPointName(),
      cloneVec3(projection.foot),
      pointId,
      planeId,
    );

    executeCommand(
      new AddLinePlanePerpendicularCommand(footPoint, linePlanePerpendicular),
    );
    clearPerpendicularDirectionPick();
    setPerpendicularPointId(null);
    setPerpendicularSegmentId(null);
    setPerpendicularPlaneId(null);
    setPerpendicularStatusMessage(
      `\u5df2\u521b\u5efa\u8fc7 ${getPointNameById(
        currentDocument,
        pointId,
      )} \u5782\u76f4\u4e8e\u5e73\u9762 ${getPlaneDisplayName(
        currentDocument,
        plane,
      )} \u7684\u5782\u7ebf`,
    );
  };

  const confirmPerpendicularDirection = (
    pointerInfo: PointerInfo,
    resolvedPointer: ResolvedPointerResult,
  ): boolean => {
    const directionPick = perpendicularDirectionPick;

    if (!directionPick) {
      return false;
    }

    if (directionPick.kind === "line") {
      const preview =
        getLineDirectionPreviewForState(directionPick, pointerInfo) ??
        (perpendicularDirectionPreviewRef.current?.kind === "line"
            ? perpendicularDirectionPreviewRef.current.preview
            : null);

      if (!preview) {
        showToast("\u8bf7\u79fb\u52a8\u9f20\u6807\u9009\u62e9\u5782\u7ebf\u65b9\u5411");
        setPerpendicularStatusMessage(
          "\u8bf7\u79fb\u52a8\u9f20\u6807\u9009\u62e9\u5782\u7ebf\u65b9\u5411",
        );
        return true;
      }

      const directionPointId = createEntityId("point");
      const directionPoint = createLineDirectionPointEntity(
        directionPointId,
        getNextPointName(),
        cloneVec3(preview.directionPoint),
        directionPick.pointId,
        directionPick.segmentId,
        cloneVec3(preview.guidePosition),
      );
      const perpendicularLine = createLineDirectionPerpendicularEntity(
        createEntityId("perpendicularLine"),
        directionPick.pointId,
        directionPick.segmentId,
        directionPointId,
        getNextPerpendicularLineName(),
      );

      executeCommand(
        new AddPerpendicularLineCommand(perpendicularLine, directionPoint),
      );
      clearPerpendicularDirectionPick();
      setPerpendicularStatusMessage(
        "\u5df2\u521b\u5efa\u7528\u6237\u65b9\u5411\u5782\u7ebf",
      );
      return true;
    }

    const preview =
      resolvedPointer.finalPosition !== null
        ? getPlaneDirectionPreviewForState(
            directionPick,
            resolvedPointer.finalPosition,
          )
        : perpendicularDirectionPreviewRef.current?.kind === "plane"
          ? perpendicularDirectionPreviewRef.current.preview
          : null;

    if (!preview) {
      showToast("\u8bf7\u9009\u62e9\u6cd5\u7ebf\u65b9\u5411");
      setPerpendicularStatusMessage("\u8bf7\u9009\u62e9\u6cd5\u7ebf\u65b9\u5411");
      return true;
    }

    const directionPointId = createEntityId("point");
    const directionPoint = createPlaneDirectionPointEntity(
      directionPointId,
      getNextPointName(),
      cloneVec3(preview.directionPoint),
      directionPick.pointId,
      directionPick.planeId,
      preview.sign,
      preview.length,
    );
    const linePlanePerpendicular = createPlaneDirectionPerpendicularEntity(
      createEntityId("linePlanePerpendicular"),
      directionPick.pointId,
      directionPick.planeId,
      directionPointId,
      getNextLinePlanePerpendicularName(),
    );

    executeCommand(
      new AddLinePlanePerpendicularCommand(
        directionPoint,
        linePlanePerpendicular,
      ),
    );
    clearPerpendicularDirectionPick();
    setPerpendicularStatusMessage(
      "\u5df2\u521b\u5efa\u7528\u6237\u65b9\u5411\u7ebf\u9762\u5782\u76f4",
    );
    return true;
  };

  const addExtension = (
    targetId: EntityId,
    targetType: ExtensionEntity["targetType"],
  ) => {
    const currentDocument = commandManager.getDocument();
    const target = currentDocument.entities[targetId];

    if (!target || target.kind !== targetType) {
      showToast("\u76ee\u6807\u7f3a\u5931\uff0c\u65e0\u6cd5\u5ef6\u957f");
      setExtendStatusMessage("\u76ee\u6807\u7f3a\u5931\uff0c\u65e0\u6cd5\u5ef6\u957f");
      return;
    }

    const existingExtension = Object.values(currentDocument.entities).find(
      (entity): entity is ExtensionEntity =>
        entity.kind === "extension" &&
        entity.targetId === targetId &&
        entity.targetType === targetType &&
        entity.mode === "toBoundaryCube",
    );

    if (existingExtension) {
      showToast("\u8be5\u5bf9\u8c61\u5df2\u7ecf\u5ef6\u957f\u5230\u8fb9\u754c");
      selectEntity(existingExtension.id);
      setExtendStatusMessage("\u8be5\u5bf9\u8c61\u5df2\u7ecf\u5ef6\u957f\u5230\u8fb9\u754c");
      return;
    }

    if (targetType === "segment" && target.kind === "segment") {
      const result = calculateSegmentBoundaryExtension(target, currentDocument);

      if (result.status === "degenerate") {
        showToast("\u7ebf\u6bb5\u957f\u5ea6\u4e3a 0\uff0c\u65e0\u6cd5\u5ef6\u957f");
        setExtendStatusMessage("\u7ebf\u6bb5\u957f\u5ea6\u4e3a 0\uff0c\u65e0\u6cd5\u5ef6\u957f");
        return;
      }

      if (result.status !== "valid") {
        showToast("\u8be5\u7ebf\u65e0\u6cd5\u5ef6\u957f\u5230\u5f53\u524d\u8fb9\u754c");
        setExtendStatusMessage("\u8be5\u7ebf\u65e0\u6cd5\u5ef6\u957f\u5230\u5f53\u524d\u8fb9\u754c");
        return;
      }
    }

    if (targetType === "plane" && target.kind === "plane") {
      const result = calculatePlaneBoundaryExtension(target, currentDocument);

      if (result.status === "invalid-plane") {
        showToast("\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u5ef6\u5c55");
        setExtendStatusMessage("\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u5ef6\u5c55");
        return;
      }

      if (result.status !== "valid") {
        showToast("\u5e73\u9762\u65e0\u6cd5\u4e0e\u5f53\u524d\u8fb9\u754c\u76f8\u4ea4");
        setExtendStatusMessage("\u5e73\u9762\u65e0\u6cd5\u4e0e\u5f53\u524d\u8fb9\u754c\u76f8\u4ea4");
        return;
      }
    }

    const extension = createExtensionEntity(
      createEntityId("extension"),
      targetId,
      targetType,
      getNextExtensionName(),
    );

    executeCommand(new AddExtensionCommand(extension));
    setExtendStatusMessage(
      targetType === "segment"
        ? "\u5df2\u5ef6\u957f\u7ebf\u6bb5\u5230\u8fb9\u754c"
        : "\u5df2\u5ef6\u5c55\u5e73\u9762\u5230\u8fb9\u754c",
    );
  };

  const getNextPointNameAtOffset = (offset: number) => {
    const pointCount = Object.values(commandManager.getDocument().entities).filter(
      (entity) => entity.kind === "point",
    ).length;

    return `P${pointCount + offset}`;
  };

  const chooseParallelSegmentAnchor = (
    sourceSegmentId: EntityId,
    pointerPosition: Vec3 | null,
  ): "start" | "end" | null => {
    const currentDocument = commandManager.getDocument();
    const segment = currentDocument.entities[sourceSegmentId];

    if (segment?.kind !== "segment") {
      return null;
    }

    const startPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[0],
    );
    const endPosition = getPointWorldPosition(
      currentDocument,
      segment.pointIds[1],
    );

    if (!startPosition || !endPosition) {
      return null;
    }

    if (!pointerPosition) {
      return "start";
    }

    return distanceBetweenVec3(pointerPosition, startPosition) <=
      distanceBetweenVec3(pointerPosition, endPosition)
      ? "start"
      : "end";
  };

  const chooseParallelPlaneAnchor = (
    sourcePlaneId: EntityId,
    pointerPosition: Vec3 | null,
  ): 0 | 1 | 2 | null => {
    const currentDocument = commandManager.getDocument();
    const plane = currentDocument.entities[sourcePlaneId];

    if (plane?.kind !== "plane") {
      return null;
    }

    const positions = plane.pointIds.map((pointId) =>
      getPointWorldPosition(currentDocument, pointId),
    );

    if (positions.some((position) => !position)) {
      return null;
    }

    if (!pointerPosition) {
      return 0;
    }

    const distances = positions.map((position) =>
      distanceBetweenVec3(pointerPosition, position!),
    );
    const minIndex = distances.indexOf(Math.min(...distances));

    return (minIndex === 1 ? 1 : minIndex === 2 ? 2 : 0) as 0 | 1 | 2;
  };

  const startParallelSegmentPreview = (
    sourceSegmentId: EntityId,
    pointerPosition: Vec3 | null,
  ) => {
    const sourceAnchorEndpoint = chooseParallelSegmentAnchor(
      sourceSegmentId,
      pointerPosition,
    );

    if (!sourceAnchorEndpoint) {
      showToast("\u76ee\u6807\u7ebf\u6bb5\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5");
      setParallelStatusMessage(
        "\u76ee\u6807\u7ebf\u6bb5\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5",
      );
      return;
    }

    setParallelDraft({
      kind: "segment",
      sourceSegmentId,
      sourceAnchorEndpoint,
    });
    setParallelStatusMessage(null);
    showToast("\u53ef\u6309 Ctrl+J \u5207\u6362\u8ddf\u968f\u7aef\u70b9");
  };

  const startParallelPlanePreview = (
    sourcePlaneId: EntityId,
    pointerPosition: Vec3 | null,
  ) => {
    const sourceAnchorVertexIndex = chooseParallelPlaneAnchor(
      sourcePlaneId,
      pointerPosition,
    );

    if (sourceAnchorVertexIndex === null) {
      showToast("\u76ee\u6807\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u5e73\u9762");
      setParallelStatusMessage(
        "\u76ee\u6807\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u5e73\u9762",
      );
      return;
    }

    setParallelDraft({
      kind: "plane",
      sourcePlaneId,
      sourceAnchorVertexIndex,
    });
    setParallelStatusMessage(null);
    showToast("\u53ef\u6309 Ctrl+J \u5207\u6362\u8ddf\u968f\u9876\u70b9");
  };

  const switchParallelFollowTarget = () => {
    if (!parallelDraft) {
      return false;
    }

    if (parallelDraft.kind === "segment") {
      const nextEndpoint =
        parallelDraft.sourceAnchorEndpoint === "start" ? "end" : "start";

      setParallelDraft({
        ...parallelDraft,
        sourceAnchorEndpoint: nextEndpoint,
      });
      setParallelStatusMessage(
        nextEndpoint === "start"
          ? "\u5df2\u5207\u6362\u4e3a\u8ddf\u968f\u8d77\u70b9"
          : "\u5df2\u5207\u6362\u4e3a\u8ddf\u968f\u7ec8\u70b9",
      );
      showToast("\u5df2\u5207\u6362\u8ddf\u968f\u7aef\u70b9");
      return true;
    }

    const nextVertexIndex =
      ((parallelDraft.sourceAnchorVertexIndex + 1) % 3) as 0 | 1 | 2;

    setParallelDraft({
      ...parallelDraft,
      sourceAnchorVertexIndex: nextVertexIndex,
    });
    setParallelStatusMessage(
      `\u5df2\u5207\u6362\u4e3a\u8ddf\u968f\u7b2c ${nextVertexIndex + 1} \u4e2a\u9876\u70b9`,
    );
    showToast("\u5df2\u5207\u6362\u8ddf\u968f\u9876\u70b9");
    return true;
  };

  const confirmParallelDraft = (anchorPosition: Vec3 | null): boolean => {
    if (!parallelDraft) {
      return false;
    }

    if (!anchorPosition) {
      showToast("\u65e0\u6cd5\u786e\u5b9a\u5e73\u884c\u5bf9\u8c61\u4f4d\u7f6e");
      setParallelStatusMessage("\u65e0\u6cd5\u786e\u5b9a\u5e73\u884c\u5bf9\u8c61\u4f4d\u7f6e");
      return true;
    }

    if (parallelDraft.kind === "segment") {
      const preview = getParallelSegmentPreview(
        commandManager.getDocument(),
        parallelDraft,
        anchorPosition,
      );

      if (!preview) {
        showToast("\u76ee\u6807\u7ebf\u6bb5\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5");
        setParallelStatusMessage(
          "\u76ee\u6807\u7ebf\u6bb5\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5",
        );
        return true;
      }

      const anchorPointId = createEntityId("point");
      const constructedPointId = createEntityId("point");
      const anchorPoint = createPointEntity(
        anchorPointId,
        getNextPointNameAtOffset(1),
        cloneVec3(anchorPosition),
      );
      const constructedPoint = createParallelSegmentEndpointEntity(
        constructedPointId,
        getNextPointNameAtOffset(2),
        cloneVec3(
          parallelDraft.sourceAnchorEndpoint === "start"
            ? preview.end
            : preview.start,
        ),
        anchorPointId,
        parallelDraft.sourceSegmentId,
        parallelDraft.sourceAnchorEndpoint,
      );
      const segment = createSegmentEntity(
        createEntityId("segment"),
        getNextSegmentName(),
        anchorPointId,
        constructedPointId,
        "#111827",
      );

      executeCommand(
        new AddParallelSegmentCommand(anchorPoint, constructedPoint, segment),
      );
      setParallelDraft(null);
      setParallelStatusMessage("\u5df2\u521b\u5efa\u5e73\u884c\u7ebf\u6bb5");
      return true;
    }

    const preview = getParallelPlanePreview(
      commandManager.getDocument(),
      parallelDraft,
      anchorPosition,
    );

    if (!preview) {
      showToast("\u76ee\u6807\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u5e73\u9762");
      setParallelStatusMessage(
        "\u76ee\u6807\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u521b\u5efa\u5e73\u884c\u5e73\u9762",
      );
      return true;
    }

    const anchorPointId = createEntityId("point");
    const anchorPoint = createPointEntity(
      anchorPointId,
      getNextPointNameAtOffset(1),
      cloneVec3(anchorPosition),
    );
    const constructedVertices = ([0, 1, 2] as const)
      .filter((index) => index !== parallelDraft.sourceAnchorVertexIndex)
      .map((sourceVertexIndex, index) =>
        createParallelPlaneVertexEntity(
          createEntityId("point"),
          getNextPointNameAtOffset(index + 2),
          cloneVec3(preview[sourceVertexIndex]),
          anchorPointId,
          parallelDraft.sourcePlaneId,
          parallelDraft.sourceAnchorVertexIndex,
          sourceVertexIndex,
        ),
      ) as [PointEntity, PointEntity];
    const pointIds = ([0, 1, 2] as const).map((index) => {
      if (index === parallelDraft.sourceAnchorVertexIndex) {
        return anchorPointId;
      }

      const vertex = constructedVertices.find(
        (constructedPoint) =>
          constructedPoint.construction?.kind === "parallelPlaneVertex" &&
          constructedPoint.construction.sourceVertexIndex === index,
      );

      return vertex?.id ?? anchorPointId;
    }) as [EntityId, EntityId, EntityId];
    const plane = createPlaneEntity(
      createEntityId("plane"),
      getNextPlaneName(),
      pointIds[0],
      pointIds[1],
      pointIds[2],
    );

    executeCommand(
      new AddParallelPlaneCommand(anchorPoint, constructedVertices, plane),
    );
    setParallelDraft(null);
    setParallelStatusMessage("\u5df2\u521b\u5efa\u5e73\u884c\u5e73\u9762");
    return true;
  };

  const getIntersectionFailureMessage = (
    reason: IntersectionFailureReason,
  ): string => {
    switch (reason) {
      case "degenerate-segment":
        return "\u76ee\u6807\u7ebf\u6bb5\u9000\u5316\uff0c\u65e0\u6cd5\u6c42\u4ea4";
      case "parallel-lines":
        return "\u4e24\u6761\u7ebf\u5e73\u884c\uff0c\u65e0\u6cd5\u6784\u9020\u4ea4\u70b9";
      case "coincident-lines":
        return "\u4e24\u6761\u7ebf\u91cd\u5408\uff0c\u4ea4\u70b9\u4e0d\u552f\u4e00";
      case "skew-lines":
        return "\u4e24\u6761\u7ebf\u5f02\u9762\uff0c\u65e0\u6cd5\u6784\u9020\u4ea4\u70b9";
      case "invalid-plane":
        return "\u5e73\u9762\u65e0\u6548\uff0c\u65e0\u6cd5\u6c42\u4ea4";
      case "line-plane-parallel":
        return "\u7ebf\u4e0e\u5e73\u9762\u5e73\u884c\uff0c\u65e0\u6cd5\u6784\u9020\u4ea4\u70b9";
      case "line-in-plane":
        return "\u7ebf\u5728\u5e73\u9762\u5185\uff0c\u4ea4\u70b9\u4e0d\u552f\u4e00";
      case "parallel-planes":
        return "\u4e24\u4e2a\u5e73\u9762\u5e73\u884c\uff0c\u65e0\u6cd5\u6784\u9020\u4ea4\u7ebf";
      case "coincident-planes":
        return "\u4e24\u4e2a\u5e73\u9762\u91cd\u5408\uff0c\u4ea4\u7ebf\u4e0d\u552f\u4e00";
      case "line-out-of-bounds":
        return "\u4ea4\u7ebf\u4e0d\u5728\u5f53\u524d\u5750\u6807\u8fb9\u754c\u5185";
    }
  };

  const createIntersectionForPair = (
    firstTarget: IntersectionTarget,
    secondTarget: IntersectionTarget,
  ): boolean => {
    const currentDocument = commandManager.getDocument();
    const firstEntity = currentDocument.entities[firstTarget.entityId];
    const secondEntity = currentDocument.entities[secondTarget.entityId];

    if (
      firstTarget.entityId === secondTarget.entityId ||
      !firstEntity ||
      !secondEntity
    ) {
      showToast("\u8bf7\u9009\u62e9\u4e24\u4e2a\u4e0d\u540c\u7684\u7ebf\u6bb5\u6216\u5e73\u9762");
      return false;
    }

    if (firstEntity.kind === "segment" && secondEntity.kind === "segment") {
      const intersection = getSegmentSegmentIntersection(
        currentDocument,
        firstEntity,
        secondEntity,
      );

      if (!intersection.ok) {
        showToast(getIntersectionFailureMessage(intersection.reason));
        return false;
      }

      executeCommand(
        new AddIntersectionPointCommand(
          createLineLineIntersectionPointEntity(
            createEntityId("point"),
            getNextPointName(),
            cloneVec3(intersection.value),
            firstEntity.id,
            secondEntity.id,
          ),
        ),
      );
      setIntersectionStatusMessage("\u5df2\u521b\u5efa\u7ebf\u7ebf\u4ea4\u70b9");
      return true;
    }

    if (
      (firstEntity.kind === "segment" && secondEntity.kind === "plane") ||
      (firstEntity.kind === "plane" && secondEntity.kind === "segment")
    ) {
      const segment = (
        firstEntity.kind === "segment" ? firstEntity : secondEntity
      ) as SegmentEntity;
      const plane = (
        firstEntity.kind === "plane" ? firstEntity : secondEntity
      ) as PlaneEntity;
      const intersection = getSegmentPlaneIntersection(
        currentDocument,
        segment,
        plane,
      );

      if (!intersection.ok) {
        showToast(getIntersectionFailureMessage(intersection.reason));
        return false;
      }

      executeCommand(
        new AddIntersectionPointCommand(
          createLinePlaneIntersectionPointEntity(
            createEntityId("point"),
            getNextPointName(),
            cloneVec3(intersection.value),
            segment.id,
            plane.id,
          ),
        ),
      );
      setIntersectionStatusMessage("\u5df2\u521b\u5efa\u7ebf\u9762\u4ea4\u70b9");
      return true;
    }

    if (firstEntity.kind === "plane" && secondEntity.kind === "plane") {
      const intersection = getPlanePlaneIntersection(
        currentDocument,
        firstEntity,
        secondEntity,
      );

      if (!intersection.ok) {
        showToast(getIntersectionFailureMessage(intersection.reason));
        return false;
      }

      const startPointId = createEntityId("point");
      const endPointId = createEntityId("point");
      const startPoint = createPlanePlaneIntersectionEndpointEntity(
        startPointId,
        getNextPointNameAtOffset(1),
        cloneVec3(intersection.value[0]),
        firstEntity.id,
        secondEntity.id,
        "start",
      );
      const endPoint = createPlanePlaneIntersectionEndpointEntity(
        endPointId,
        getNextPointNameAtOffset(2),
        cloneVec3(intersection.value[1]),
        firstEntity.id,
        secondEntity.id,
        "end",
      );
      const segment = createSegmentEntity(
        createEntityId("segment"),
        getNextSegmentName(),
        startPointId,
        endPointId,
        "#111827",
      );

      executeCommand(
        new AddPlanePlaneIntersectionCommand(startPoint, endPoint, segment),
      );
      setIntersectionStatusMessage("\u5df2\u521b\u5efa\u9762\u9762\u4ea4\u7ebf");
      return true;
    }

    showToast("\u8bf7\u9009\u62e9\u7ebf\u6bb5\u6216\u5e73\u9762");
    return false;
  };

  const addMidpoint = (pointAId: EntityId, pointBId: EntityId) => {
    const currentDocument = commandManager.getDocument();
    const pointA = currentDocument.entities[pointAId];
    const pointB = currentDocument.entities[pointBId];
    const pointAPosition = getPointWorldPosition(currentDocument, pointAId);
    const pointBPosition = getPointWorldPosition(currentDocument, pointBId);

    if (pointAId === pointBId) {
      showToast("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
      setMidpointStatusMessage("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
      return;
    }

    if (
      pointA?.kind !== "point" ||
      pointB?.kind !== "point" ||
      !pointAPosition ||
      !pointBPosition
    ) {
      setMidpointStatusMessage("\u8bf7\u9009\u62e9\u4e24\u4e2a\u6709\u6548\u70b9");
      return;
    }

    const midpointPosition = {
      x: (pointAPosition.x + pointBPosition.x) / 2,
      y: (pointAPosition.y + pointBPosition.y) / 2,
      z: (pointAPosition.z + pointBPosition.z) / 2,
    };
    const midpoint = createMidpointEntity(
      createEntityId("point"),
      getNextPointName(),
      midpointPosition,
      pointAId,
      pointBId,
    );

    executeCommand(new AddMidpointCommand(midpoint));
    setMidpointFirstPointId(null);
    setMidpointStatusMessage(
      `\u5df2\u521b\u5efa ${getPointNameById(
        currentDocument,
        pointAId,
      )}${getPointNameById(currentDocument, pointBId)} \u7684\u4e2d\u70b9`,
    );
  };

  const getLengthMeasurementName = (
    targetIds: readonly EntityId[],
  ): string => {
    const currentDocument = commandManager.getDocument();

    if (targetIds.length === 1) {
      const segment = currentDocument.entities[targetIds[0]];

      if (segment?.kind === "segment" && segment.name) {
        return `Length ${segment.name}`;
      }
    }

    if (targetIds.length === 2) {
      const firstPoint = currentDocument.entities[targetIds[0]];
      const secondPoint = currentDocument.entities[targetIds[1]];

      if (firstPoint?.kind === "point" && secondPoint?.kind === "point") {
        return `Distance ${firstPoint.name ?? firstPoint.id}-${
          secondPoint.name ?? secondPoint.id
        }`;
      }
    }

    return getNextMeasurementName();
  };

  const addLengthMeasurement = (targetIds: readonly EntityId[]) => {
    const currentDocument = commandManager.getDocument();
    let value: number | null = null;
    let pointIds: readonly EntityId[] = [];
    let targetEntityIds: readonly EntityId[] = [];

    if (targetIds.length === 1) {
      const segment = currentDocument.entities[targetIds[0]];

      if (segment?.kind !== "segment") {
        setMeasureStatusMessage("\u957f\u5ea6\u5de5\u5177\uff1a\u8bf7\u9009\u62e9\u7ebf\u6bb5\u6216\u70b9");
        return;
      }

      value = getSegmentLengthById(currentDocument, targetIds[0]);
      pointIds = segment.pointIds;
      targetEntityIds = [targetIds[0]];
    } else if (targetIds.length === 2) {
      const [firstPointId, secondPointId] = targetIds;

      if (firstPointId === secondPointId) {
        setMeasureStatusMessage("\u957f\u5ea6\u5de5\u5177\uff1a\u8bf7\u9009\u62e9\u4e24\u4e2a\u4e0d\u540c\u7684\u70b9");
        return;
      }

      value = getPointDistanceByIds(
        currentDocument,
        firstPointId,
        secondPointId,
      );
      pointIds = [firstPointId, secondPointId];
    }

    if (value === null) {
      setMeasureStatusMessage("\u957f\u5ea6\u5de5\u5177\uff1a\u65e0\u6cd5\u8ba1\u7b97\u957f\u5ea6");
      return;
    }

    const measurement = {
      ...createLengthMeasurementEntity(
        createEntityId("measurement"),
        getLengthMeasurementName(targetIds),
        targetEntityIds,
        pointIds,
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setMeasureStatusMessage(
      `${measurement.name} = ${formatMeasurementValue(value)}`,
    );
  };

  const getAngleMeasurementName = (
    pointAId: EntityId,
    vertexBId: EntityId,
    pointCId: EntityId,
  ): string => {
    const currentDocument = commandManager.getDocument();

    return `Angle ${getCompactPointNameById(
      currentDocument,
      pointAId,
    )}${getCompactPointNameById(currentDocument, vertexBId)}${getCompactPointNameById(
      currentDocument,
      pointCId,
    )}`;
  };

  const addAngleMeasurement = (
    pointAId: EntityId,
    vertexBId: EntityId,
    pointCId: EntityId,
  ) => {
    const currentDocument = commandManager.getDocument();
    const uniquePointIds = new Set([pointAId, vertexBId, pointCId]);

    if (uniquePointIds.size !== 3) {
      setAngleStatusMessage(
        "\u91cf\u89d2\u5668\uff1a\u8bf7\u9009\u62e9\u4e09\u4e2a\u4e0d\u540c\u7684\u70b9",
      );
      return;
    }

    const value = getAngleByPointIds(
      currentDocument,
      pointAId,
      vertexBId,
      pointCId,
    );

    if (value === null) {
      setAngleStatusMessage("\u91cf\u89d2\u5668\uff1a\u65e0\u6cd5\u8ba1\u7b97\u89d2\u5ea6");
      return;
    }

    const measurement = {
      ...createAngleMeasurementEntity(
        createEntityId("measurement"),
        getAngleMeasurementName(pointAId, vertexBId, pointCId),
        [pointAId, vertexBId, pointCId],
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setAngleStatusMessage(`${measurement.name} = ${formatAngleValue(value)}`);
  };

  const getLinePlaneAngleMeasurementName = (
    targetIds: readonly EntityId[],
  ): string => {
    const currentDocument = commandManager.getDocument();

    if (targetIds.length === 1) {
      const segment = currentDocument.entities[targetIds[0]];

      if (segment?.kind === "segment") {
        const [startPointId, endPointId] = segment.pointIds;
        return `${getCompactPointNameById(
          currentDocument,
          startPointId,
        )}${getCompactPointNameById(currentDocument, endPointId)} and XY plane`;
      }
    }

    if (targetIds.length === 2) {
      return `${getCompactPointNameById(
        currentDocument,
        targetIds[0],
      )}${getCompactPointNameById(currentDocument, targetIds[1])} and XY plane`;
    }

    return "Segment and XY plane";
  };

  const addLinePlaneAngleMeasurement = (targetIds: readonly EntityId[]) => {
    const currentDocument = commandManager.getDocument();
    const value =
      targetIds.length === 1
        ? getLinePlaneAngleBySegmentId(currentDocument, targetIds[0])
        : targetIds.length === 2
          ? getLinePlaneAngleByPointIds(currentDocument, targetIds[0], targetIds[1])
          : null;

    if (value === null) {
      setAngleStatusMessage("线面角工具：无法计算线段与 XY 面的夹角");
      return;
    }

    const measurement = {
      ...createLinePlaneAngleMeasurementEntity(
        createEntityId("measurement"),
        getLinePlaneAngleMeasurementName(targetIds),
        targetIds,
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setAngleStatusMessage(
      `Measured ${measurement.name}: ${formatAngleValue(value)}`,
    );
  };

  const getSegmentPlaneAngleMeasurementName = (
    segmentId: EntityId,
    planeId: EntityId,
  ): string => {
    const currentDocument = commandManager.getDocument();
    const segment = currentDocument.entities[segmentId];
    const plane = currentDocument.entities[planeId];
    const segmentName =
      segment?.kind === "segment"
        ? getSegmentDisplayName(currentDocument, segment)
        : segmentId;
    const planeName =
      plane?.kind === "plane"
        ? getPlaneDisplayName(currentDocument, plane)
        : planeId;

    return `${segmentName} and plane ${planeName}`;
  };

  const addSegmentPlaneAngleMeasurement = (
    segmentId: EntityId,
    planeId: EntityId,
  ) => {
    const currentDocument = commandManager.getDocument();
    const value = getLinePlaneAngleBySegmentAndPlaneId(
      currentDocument,
      segmentId,
      planeId,
    );

    if (value === null) {
      setAngleStatusMessage("线面角工具：无法计算线段与平面的夹角");
      return;
    }

    const measurement = {
      ...createLinePlaneAngleMeasurementEntity(
        createEntityId("measurement"),
        getSegmentPlaneAngleMeasurementName(segmentId, planeId),
        [segmentId, planeId],
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setAngleStatusMessage(`${measurement.name} = ${formatAngleValue(value)}`);
  };

  const getPlanePlaneAngleMeasurementName = (
    firstPlaneId: EntityId,
    secondPlaneId?: EntityId,
  ): string => {
    const currentDocument = commandManager.getDocument();
    const firstPlane = currentDocument.entities[firstPlaneId];
    const firstName =
      firstPlane?.kind === "plane"
        ? getPlaneDisplayName(currentDocument, firstPlane)
        : firstPlaneId;

    if (!secondPlaneId) {
      return `Plane ${firstName} and X-Y plane`;
    }

    const secondPlane = currentDocument.entities[secondPlaneId];
    const secondName =
      secondPlane?.kind === "plane"
        ? getPlaneDisplayName(currentDocument, secondPlane)
        : secondPlaneId;

    return `Plane ${firstName} and plane ${secondName}`;
  };

  const addPlaneXYPlaneAngleMeasurement = (planeId: EntityId) => {
    const currentDocument = commandManager.getDocument();
    const value = getPlaneXYPlaneAngleByPlaneId(currentDocument, planeId);

    if (value === null) {
      setAngleStatusMessage("Invalid plane; cannot measure");
      return;
    }

    const measurement = {
      ...createPlanePlaneAngleMeasurementEntity(
        createEntityId("measurement"),
        getPlanePlaneAngleMeasurementName(planeId),
        [planeId],
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setAngleStatusMessage(`${measurement.name} = ${formatAngleValue(value)}`);
  };

  const addPlanePlaneAngleMeasurement = (
    firstPlaneId: EntityId,
    secondPlaneId: EntityId,
  ) => {
    const currentDocument = commandManager.getDocument();
    const value = getPlanePlaneAngleByPlaneIds(
      currentDocument,
      firstPlaneId,
      secondPlaneId,
    );

    if (value === null) {
      setAngleStatusMessage("Invalid planes; cannot measure");
      return;
    }

    const measurement = {
      ...createPlanePlaneAngleMeasurementEntity(
        createEntityId("measurement"),
        getPlanePlaneAngleMeasurementName(firstPlaneId, secondPlaneId),
        [firstPlaneId, secondPlaneId],
        value,
      ),
      displayPosition: getNextMeasurementDisplayPosition(),
    };

    executeCommand(new AddMeasurementCommand(measurement));
    setAngleStatusMessage(
      `Measured ${measurement.name}: ${formatAngleValue(value)}`,
    );
  };

  const resolveBoardCalculationReference = (
    document: BoardDocument,
    targetId: EntityId,
  ) => {
    const entity = document.entities[targetId];

    if (entity?.kind === "segment") {
      const value = getSegmentLengthById(document, targetId);

      return value === null ? null : { value, unit: "length" as const };
    }

    if (entity?.kind === "measurement") {
      const value = calculateMeasurementValue(entity, document);

      if (!value) {
        return null;
      }

      return {
        value: value.value,
        unit: value.unit === "deg" ? ("angle" as const) : ("length" as const),
      };
    }

    return null;
  };

  const resolveBoardCalculationGeometry = (document: BoardDocument) => ({
    pointDistance: (pointAId: EntityId, pointBId: EntityId) => {
      const pointA = getPointWorldPosition(document, pointAId);
      const pointB = getPointWorldPosition(document, pointBId);

      return pointA && pointB
        ? { value: distanceBetweenVec3(pointA, pointB), unit: "length" as const }
        : null;
    },
    threePointAngle: (
      pointAId: EntityId,
      vertexPointId: EntityId,
      pointCId: EntityId,
    ) => {
      const pointA = getPointWorldPosition(document, pointAId);
      const vertex = getPointWorldPosition(document, vertexPointId);
      const pointC = getPointWorldPosition(document, pointCId);

      if (!pointA || !vertex || !pointC) {
        return null;
      }

      const vectorA = subtractVec3(pointA, vertex);
      const vectorC = subtractVec3(pointC, vertex);
      const lengthA = distanceBetweenVec3(pointA, vertex);
      const lengthC = distanceBetweenVec3(pointC, vertex);

      if (lengthA <= 1e-9 || lengthC <= 1e-9) {
        return null;
      }

      const cosine = Math.min(
        1,
        Math.max(-1, dotVec3(vectorA, vectorC) / (lengthA * lengthC)),
      );

      return { value: (Math.acos(cosine) * 180) / Math.PI, unit: "angle" as const };
    },
  });

  const getBoardCalculationReferenceLabel = (targetId: EntityId): string => {
    const entity = displayDocument.entities[targetId];

    if (!entity) {
      return "引用失效";
    }

    if (entity.kind === "segment") {
      return `|${entity.name?.trim() || entity.id}|`;
    }

    return entity.name?.trim() || entity.id;
  };

  const boardCalculationPoints = Object.values(displayDocument.entities).filter(
    (entity): entity is PointEntity =>
      entity.kind === "point" && entity.visible !== false,
  );

  const getBoardCalculationPointTypeLabel = (point: PointEntity): string => {
    if (!point.construction) {
      return "自由点";
    }

    switch (point.construction.kind) {
      case "midpoint":
        return "中点";
      case "footToLine":
      case "footToPlane":
        return "垂足";
      case "lineLineIntersection":
      case "linePlaneIntersection":
        return "交点";
      case "parallelSegmentEndpoint":
      case "parallelPlaneVertex":
        return "平行构造点";
      case "perpendicularDirectionToLine":
      case "perpendicularDirectionToPlane":
        return "垂线方向点";
      default:
        return "构造点";
    }
  };

  const openBoardCalculationPointPicker = (mode: "distance" | "angle") => {
    const minimumPointCount = mode === "distance" ? 2 : 3;

    if (boardCalculationPoints.length < minimumPointCount) {
      setCalculationStatusMessage(
        mode === "distance"
          ? "当前画布中至少需要两个点"
          : "当前画布中至少需要三个点",
      );
      return;
    }

    setCalculationPointPicker({ mode, selectedPointIds: [], searchQuery: "" });
    setIsPlacingCalculation(false);
    setCalculationStatusMessage(
      mode === "distance"
        ? "请选择两个点作为边。"
        : "请选择三个点作为角，第二个点为顶点。",
    );
  };

  const insertBoardCalculationPointExpression = (
    expression: CalculationExpression,
    statusMessage: string,
  ) => {
    insertBoardCalculationReference(expression);
    setCalculationPointPicker(null);
    setCalculationStatusMessage(statusMessage);
  };

  const toggleBoardCalculationPoint = (pointId: EntityId) => {
    if (!calculationPointPicker) {
      return;
    }

    const selectedPointIds = calculationPointPicker.selectedPointIds.includes(pointId)
      ? calculationPointPicker.selectedPointIds.filter((id) => id !== pointId)
      : [...calculationPointPicker.selectedPointIds, pointId];

    if (calculationPointPicker.mode === "distance" && selectedPointIds.length === 2) {
      const [pointAId, pointBId] = selectedPointIds;

      if (pointAId === pointBId) {
        setCalculationStatusMessage("请选择两个不同的点。");
        setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
        return;
      }

      insertBoardCalculationPointExpression(
        { kind: "pointDistance", pointAId, pointBId },
        "已插入两点距离引用。",
      );
      return;
    }

    if (calculationPointPicker.mode === "angle" && selectedPointIds.length === 3) {
      const [pointAId, vertexPointId, pointCId] = selectedPointIds;

      if (pointAId === vertexPointId || pointCId === vertexPointId) {
        setCalculationStatusMessage("角度退化，无法加入角。");
        setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
        return;
      }

      insertBoardCalculationPointExpression(
        { kind: "threePointAngle", pointAId, vertexPointId, pointCId },
        "已插入三点角引用。",
      );
      return;
    }

    setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
  };

  const insertBoardCalculationReference = (expression: CalculationExpression) => {
    setCalculationExpression((current) => {
      if (current && calculationPendingOp) {
        return {
          kind: "binary",
          op: calculationPendingOp,
          left: current,
          right: expression,
        };
      }

      return expression;
    });
    setCalculationPendingOp(null);
    setIsPlacingCalculation(false);
    setCalculationPointPicker(null);
  };

  const createCalculationEntity = (
    expression: CalculationExpression,
  ): CalculationEntity => {
    const now = new Date().toISOString();

    return {
      id: createEntityId("calculation"),
      kind: "calculation",
      type: "calculation",
      expression,
      labelPosition: getNextMeasurementDisplayPosition(),
      nameSource: "auto",
      visible: true,
      locked: false,
      createdAt: now,
      updatedAt: now,
    };
  };

  const addCalculation = () => {
    if (!calculationExpression || calculationPendingOp) {
      setCalculationStatusMessage("请先完成计算表达式。");
      return;
    }

    const calculation = createCalculationEntity(calculationExpression);

    executeCommand(new AddEntityCommand(calculation, "添加计算"));
    setCalculationExpression(null);
    setCalculationPendingOp(null);
    setIsPlacingCalculation(false);
    setCalculationPointPicker(null);
    setCalculationStatusMessage("已创建计算结果。");
  };

  const createToolContext = (): ToolContext => ({
    addPoint: (position, options) => {
      executeCommand(
        new AddPointCommand(
          createPointEntity(
            options?.id ?? createEntityId("point"),
            options?.name ?? getNextPointName(),
            position,
            options?.style ?? { color: DEFAULT_POINT_COLOR },
          ),
        ),
      );
    },
    addSegment: (startPointId, endPointId) => {
      executeCommand(
        new AddSegmentCommand(
          createSegmentEntity(
            createEntityId("segment"),
            getSegmentName(startPointId, endPointId),
            startPointId,
            endPointId,
            "#111827",
          ),
        ),
      );
    },
    addPlane: (pointAId, pointBId, pointCId) => {
      executeCommand(
        new AddPlaneCommand(
          createPlaneEntity(
            createEntityId("plane"),
            getPlaneName(pointAId, pointBId, pointCId),
            pointAId,
            pointBId,
            pointCId,
          ),
        ),
      );
    },
    addLengthMeasurement,
    addAngleMeasurement,
    selectEntity,
    toggleSelection,
    clearSelection,
    setSelection,
    getSelectedEntityIds: () =>
      commandManager.getDocument().selectedEntityIds,
    deleteSelectedEntities,
    updateEntity,
    getEntity: (entityId) => commandManager.getDocument().entities[entityId] ?? null,
    getPoint: (entityId) => {
      const entity = commandManager.getDocument().entities[entityId];

      return entity?.kind === "point" ? entity : null;
    },
    getSegment: (entityId) => {
      const entity = commandManager.getDocument().entities[entityId];

      return entity?.kind === "segment" ? entity : null;
    },
    getPlane: (entityId) => {
      const entity = commandManager.getDocument().entities[entityId];

      return entity?.kind === "plane" ? entity : null;
    },
    getDocument: () => commandManager.getDocument(),
    getActiveDrawingPlane: () =>
      commandManager.getDocument().settings.activeDrawingPlane,
    snapPosition: (position) => {
      const currentDocument = commandManager.getDocument();

      return getSnapResult(
        position,
        currentDocument,
        currentDocument.settings.activeDrawingPlane,
      );
    },
  });

  const addTestPointA = () => {
    executeCommand(
      new AddPointCommand(
        createPointEntity(
          TEST_POINT_A_ID,
          "Point A",
          createVec3(-1.4, 0.08, 0),
          { color: "#2563eb" },
        ),
      ),
    );
  };

  const addTestPointB = () => {
    executeCommand(
      new AddPointCommand(
        createPointEntity(
          TEST_POINT_B_ID,
          "Point B",
          createVec3(1.4, 0.08, 0),
          { color: "#dc2626" },
        ),
      ),
    );
  };

  const addTestSegmentAB = () => {
    executeCommand(
      new AddSegmentCommand(
        createSegmentEntity(
          TEST_SEGMENT_AB_ID,
          "Segment AB",
          TEST_POINT_A_ID,
          TEST_POINT_B_ID,
          "#111827",
        ),
      ),
    );
  };

  const undo = () => {
    if (workspaceMode === "plane2d") {
      const result = undoPlane2DHistory(plane2DHistory);

      if (!result.document) {
        return;
      }

      setPlane2DHistory(result.history);
      setPlaneCanvasDocument(syncPlane2DIntersections(result.document));
      resetPlane2DTransientState();
      setPlane2DStatusMessage("已撤销");
      setIsDirty(true);
      return;
    }

    if (workspaceMode !== "geometry3d") {
      return;
    }

    const previousDocument = commandManager.getDocument();
    const nextDocument = commandManager.undo();

    syncDocumentState(nextDocument);

    if (nextDocument !== previousDocument) {
      setIsDirty(true);
    }
  };

  const redo = () => {
    if (workspaceMode === "plane2d") {
      const result = redoPlane2DHistory(plane2DHistory);

      if (!result.document) {
        return;
      }

      setPlane2DHistory(result.history);
      setPlaneCanvasDocument(syncPlane2DIntersections(result.document));
      resetPlane2DTransientState();
      setPlane2DStatusMessage("已重做");
      setIsDirty(true);
      return;
    }

    if (workspaceMode !== "geometry3d") {
      return;
    }

    const previousDocument = commandManager.getDocument();
    const nextDocument = commandManager.redo();

    syncDocumentState(nextDocument);

    if (nextDocument !== previousDocument) {
      setIsDirty(true);
    }
  };

  const updateDocumentSettings = (
    update: Partial<BoardDocument["settings"]>,
  ) => {
    executeCommand(new UpdateDocumentSettingsCommand(update));
  };

  const setDrawingPlane = (activeDrawingPlane: ActiveDrawingPlane) => {
    updateDocumentSettings({ activeDrawingPlane });
  };

  const activatePointFreeMode = () => {
    setPointCreationMode("free");
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setCoordinatePointError(null);
    changeTool("point");
  };

  const openPointToolPanel = () => {
    setShowPointToolPanel((isOpen) => !isOpen);
    setShowPerpendicularToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    changeTool("point");
  };

  const activateCoordinatePointMode = () => {
    setPointCreationMode("coordinate");
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(true);
    setCoordinatePointError(null);
    changeTool("point");
  };

  const activateThreePointPlaneMode = () => {
    setPlaneCreationMode("threePoint");
    setShowPlaneToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setPlaneStatusMessage(null);
    changeTool("plane");
  };

  const openPlaneToolPanel = () => {
    setShowPlaneToolPanel(false);
    activateThreePointPlaneMode();
  };

  const activatePointLinePerpendicularMode = () => {
    setPerpendicularMode("pointLine");
    setShowPerpendicularToolPanel(false);
    setShowPointToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setPerpendicularPointId(null);
    setPerpendicularSegmentId(null);
    setPerpendicularPlaneId(null);
    clearPerpendicularDirectionPick();
    setPerpendicularStatusMessage(null);
    changeTool("perpendicular");
  };

  const activateLinePlanePerpendicularMode = () => {
    setPerpendicularMode("linePlane");
    setShowPerpendicularToolPanel(false);
    setShowPointToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setPerpendicularPointId(null);
    setPerpendicularSegmentId(null);
    setPerpendicularPlaneId(null);
    clearPerpendicularDirectionPick();
    setPerpendicularStatusMessage(null);
    changeTool("perpendicular");
  };

  const activateExtendAutoMode = () => {
    setExtendMode("auto");
    setShowExtendToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowParallelToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setExtendStatusMessage(null);
    changeTool("extend");
  };

  const activateSegmentExtendMode = () => {
    setExtendMode("segmentToBoundary");
    setShowExtendToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowParallelToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setExtendStatusMessage(null);
    changeTool("extend");
  };

  const activatePlaneExtendMode = () => {
    setExtendMode("planeToBoundary");
    setShowExtendToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowParallelToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setExtendStatusMessage(null);
    changeTool("extend");
  };

  const openPerpendicularToolPanel = () => {
    setShowPerpendicularToolPanel((isOpen) => !isOpen);
    setShowPointToolPanel(false);
    setShowExtendToolPanel(false);
    setShowParallelToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    changeTool("perpendicular");
  };

  const openExtendToolPanel = () => {
    setShowExtendToolPanel((isOpen) => !isOpen);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowParallelToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    changeTool("extend");
  };

  const activateParallelAutoMode = () => {
    setParallelMode("auto");
    setShowParallelToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowExtendToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setParallelDraft(null);
    setParallelStatusMessage(null);
    changeTool("parallel");
  };

  const activateParallelSegmentMode = () => {
    setParallelMode("segment");
    setShowParallelToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowExtendToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setParallelDraft(null);
    setParallelStatusMessage(null);
    changeTool("parallel");
  };

  const activateParallelPlaneMode = () => {
    setParallelMode("plane");
    setShowParallelToolPanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowExtendToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    setParallelDraft(null);
    setParallelStatusMessage(null);
    changeTool("parallel");
  };

  const openParallelToolPanel = () => {
    setShowParallelToolPanel((isOpen) => !isOpen);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowExtendToolPanel(false);
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowCoordinatePointModal(false);
    changeTool("parallel");
  };

  const activateThreePointAngleMode = () => {
    setAngleMeasureMode("threePoint");
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const openAngleToolPanel = () => {
    setShowAngleToolPanel((isOpen) => {
      const nextIsOpen = !isOpen;

      if (!nextIsOpen) {
        setShowLinePlaneAnglePanel(false);
        setShowPlanePlaneAnglePanel(false);
      }

      return nextIsOpen;
    });
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    setShowCoordinatePointModal(false);
    changeTool("measureAngle");
  };

  const toggleLinePlaneAnglePanel = () => {
    setShowLinePlaneAnglePanel((isOpen) => {
      const nextIsOpen = !isOpen;

      if (nextIsOpen) {
        setShowPlanePlaneAnglePanel(false);
      }

      return nextIsOpen;
    });
  };

  const togglePlanePlaneAnglePanel = () => {
    setShowPlanePlaneAnglePanel((isOpen) => {
      const nextIsOpen = !isOpen;

      if (nextIsOpen) {
        setShowLinePlaneAnglePanel(false);
      }

      return nextIsOpen;
    });
  };

  const activateLineXYPlaneAngleMode = () => {
    setAngleMeasureMode("lineXYPlane");
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const activateLinePlaneAngleMode = () => {
    setAngleMeasureMode("linePlane");
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const activatePlaneXYPlaneAngleMode = () => {
    setAngleMeasureMode("planeXYPlane");
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowPointToolPanel(false);
    setShowPerpendicularToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const activatePlanePlaneAngleMode = () => {
    setAngleMeasureMode("planePlane");
    setShowAngleToolPanel(false);
    setShowLinePlaneAnglePanel(false);
    setShowPlanePlaneAnglePanel(false);
    setShowPointToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setLinePlaneAngleSegmentId(null);
    setPlanePlaneAngleFirstPlaneId(null);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const closeCoordinatePointModal = () => {
    setShowCoordinatePointModal(false);
    setCoordinatePointError(null);
  };

  const updateCoordinatePointInput = (
    field: keyof typeof coordinatePointInput,
    value: string,
  ) => {
    setCoordinatePointInput((currentInput) => ({
      ...currentInput,
      [field]: value,
    }));
    setCoordinatePointError(null);
  };

  const parseCoordinateValue = (rawValue: string): number | null => {
    if (!rawValue.trim()) {
      return null;
    }

    const value = Number(rawValue);

    return Number.isFinite(value) ? value : null;
  };

  const createCoordinatePoint = () => {
    const x = parseCoordinateValue(coordinatePointInput.x);
    const y = parseCoordinateValue(coordinatePointInput.y);
    const z = parseCoordinateValue(coordinatePointInput.z);

    if (x === null || y === null || z === null) {
      setCoordinatePointError("请输入有效坐标");
      return;
    }

    if (
      [x, y, z].some(
        (value) => Math.abs(value) > COORDINATE_POINT_LIMIT,
      )
    ) {
      setCoordinatePointError("Coordinates are too large; enter values between -10000 and 10000");
      return;
    }

    const trimmedName = coordinatePointInput.name.trim();
    const pointId = createEntityId("point");
    const point = {
      ...createPointEntity(
        pointId,
        trimmedName || getNextPointName(),
        createVec3(x, y, z),
        { color: DEFAULT_POINT_COLOR },
      ),
      nameSource: trimmedName ? "manual" as const : "auto" as const,
    };

    executeCommand(new AddPointCommand(point));
    setSelection([pointId]);
    setCoordinatePointInput({
      x: "0",
      y: "0",
      z: "0",
      name: "",
    });
    setCoordinatePointError(null);
    setShowCoordinatePointModal(false);
    setCoordinatePointStatus(
      `Created point ${point.name ?? point.id} (${formatCoordinate(x)}, ${formatCoordinate(
        y,
      )}, ${formatCoordinate(z)})`,
    );
  };

  const focusCurrentDrawingPlane = () => {
    setFocusRequestId((requestId) => requestId + 1);
  };

  const toggleSetting = (
    settingName:
      | "snapToGrid"
      | "snapEnabled"
      | "snapToPoints"
      | "snapToSegments"
      | "snapToPlanes"
      | "snapToOrigin"
      | "snapToAxes"
      | "showDrawingPlane"
      | "drawingPlaneSolid"
      | "showBoundaryCube",
  ) => {
    const currentSettings = commandManager.getDocument().settings;

    updateDocumentSettings({
      [settingName]: !currentSettings[settingName],
    });
  };

  const updateCoordinateHalfSize = (rawValue: string) => {
    const nextHalfSize = Number(rawValue);

    if (!Number.isFinite(nextHalfSize) || nextHalfSize <= 0) {
      showToast("\u8bf7\u8f93\u5165\u5927\u4e8e 0 \u7684\u5750\u6807\u8f74\u534a\u957f");
      return;
    }

    updateDocumentSettings({ coordinateHalfSize: nextHalfSize });
  };

  const adjustPointSnapPixelRadius = (direction: -1 | 1) => {
    const currentSettings = commandManager.getDocument().settings;

    updateDocumentSettings({
      pointSnapPixelRadius: clamp(
        currentSettings.pointSnapPixelRadius +
          direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_POINT_SNAP_PIXEL_RADIUS,
        MAX_POINT_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustSegmentSnapPixelRadius = (direction: -1 | 1) => {
    const currentSettings = commandManager.getDocument().settings;

    updateDocumentSettings({
      segmentSnapPixelRadius: clamp(
        currentSettings.segmentSnapPixelRadius +
          direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_SEGMENT_SNAP_PIXEL_RADIUS,
        MAX_SEGMENT_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustAxisSnapPixelRadius = (direction: -1 | 1) => {
    const currentSettings = commandManager.getDocument().settings;

    updateDocumentSettings({
      axisSnapPixelRadius: clamp(
        currentSettings.axisSnapPixelRadius + direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_AXIS_SNAP_PIXEL_RADIUS,
        MAX_AXIS_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustDrawingPlaneOpacity = (direction: -1 | 1) => {
    const currentSettings = commandManager.getDocument().settings;

    updateDocumentSettings({
      drawingPlaneOpacity: clamp(
        currentSettings.drawingPlaneOpacity +
          direction * DRAWING_PLANE_OPACITY_STEP,
        MIN_DRAWING_PLANE_OPACITY,
        MAX_DRAWING_PLANE_OPACITY,
      ),
    });
  };

  const getPointerSnapResult = (pointerInfo: PointerInfo): SnapResult | null => {
    if (pointerInfo.snapResult) {
      return pointerInfo.snapResult;
    }

    if (!pointerInfo.worldPosition) {
      return null;
    }

    return getSnapResult(
      pointerInfo.worldPosition,
      commandManager.getDocument(),
      pointerInfo.drawingPlane,
    );
  };

  const resolvePointerPosition = (
    pointerInfo: PointerInfo,
  ): ResolvedPointerResult => {
    const snapResult = getPointerSnapResult(pointerInfo);

    return {
      rawPosition: pointerInfo.worldPosition,
      snapResult,
      finalPosition: snapResult?.position ?? pointerInfo.worldPosition ?? null,
    };
  };

  const isPointCreatePositionValid = (position: Vec3 | null): position is Vec3 =>
    Boolean(
      position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.z) &&
        Math.abs(position.x) <= COORDINATE_POINT_LIMIT &&
        Math.abs(position.y) <= COORDINATE_POINT_LIMIT &&
        Math.abs(position.z) <= COORDINATE_POINT_LIMIT,
    );

  const resolvePointInputFromPointer = (
    pointerInfo: PointerInfo,
    clickPreselection: Preselection | null,
    resolvedPointer: ResolvedPointerResult,
  ): PointInputResult | null => {
    const currentDocument = commandManager.getDocument();
    const selectedPointId =
      clickPreselection?.entityType === "point"
        ? clickPreselection.entityId
        : pointerInfo.hitEntityType === "point"
          ? pointerInfo.hitEntityId
          : pointerInfo.snapResult?.type === "point"
            ? pointerInfo.snapResult.targetEntityId ?? null
            : null;
    const selectedPoint = selectedPointId
      ? currentDocument.entities[selectedPointId]
      : null;

    if (selectedPoint?.kind === "point") {
      const position =
        getPointWorldPosition(currentDocument, selectedPoint.id) ??
        selectedPoint.position;

      return {
        pointId: selectedPoint.id,
        point: selectedPoint,
        position,
        created: false,
      };
    }

    const position = resolvedPointer.finalPosition;

    if (!isPointCreatePositionValid(position)) {
      showToast("\u65e0\u6cd5\u786e\u5b9a\u521b\u5efa\u70b9\u4f4d\u7f6e");
      return null;
    }

    const point = createPointEntity(
      createEntityId("point"),
      getNextPointName(),
      cloneVec3(position),
      { color: DEFAULT_POINT_COLOR },
    );

    return {
      pointId: point.id,
      point,
      position,
      created: true,
    };
  };

  const getPointPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entityId =
      pointerInfo.hitEntityType === "point"
        ? pointerInfo.hitEntityId
        : pointerInfo.snapResult?.type === "point"
          ? pointerInfo.snapResult.targetEntityId ?? null
          : null;
    const entity = entityId ? sourceDocument.entities[entityId] : null;

    return entity?.kind === "point" && entity.visible
      ? { entityId: entity.id, entityType: "point" }
      : null;
  };

  const getSegmentPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entityId =
      pointerInfo.hitEntityType === "segment"
        ? pointerInfo.hitEntityId
        : pointerInfo.snapResult?.type === "segment"
          ? pointerInfo.snapResult.targetEntityId ?? null
          : null;
    const entity = entityId ? sourceDocument.entities[entityId] : null;

    return entity?.kind === "segment" && entity.visible
      ? { entityId: entity.id, entityType: "segment" }
      : null;
  };

  const getPlanePreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      pointerInfo.hitEntityType === "plane" && pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return entity?.kind === "plane" && entity.visible
      ? { entityId: entity.id, entityType: "plane" }
      : null;
  };

  const getFunctionSurfacePreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      pointerInfo.hitEntityType === "functionSurface" && pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return entity?.kind === "functionSurface" && entity.visible
      ? { entityId: entity.id, entityType: "functionSurface" }
      : null;
  };

  const getPerpendicularLinePreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      pointerInfo.hitEntityType === "perpendicularLine" &&
      pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return entity?.kind === "perpendicularLine" && entity.visible
      ? { entityId: entity.id, entityType: "perpendicularLine" }
      : null;
  };

  const getLinePlanePerpendicularPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      pointerInfo.hitEntityType === "linePlanePerpendicular" &&
      pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return entity?.kind === "linePlanePerpendicular" && entity.visible
      ? { entityId: entity.id, entityType: "linePlanePerpendicular" }
      : null;
  };

  const getExtensionPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      pointerInfo.hitEntityType === "extension" && pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return entity?.kind === "extension" && entity.visible
      ? { entityId: entity.id, entityType: "extension" }
      : null;
  };

  const getMeasurementPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const entity =
      (pointerInfo.hitEntityType === "measurement" ||
        pointerInfo.hitEntityType === "calculation") &&
      pointerInfo.hitEntityId
        ? sourceDocument.entities[pointerInfo.hitEntityId]
        : null;

    return (entity?.kind === "measurement" || entity?.kind === "calculation") &&
      entity.visible
      ? { entityId: entity.id, entityType: entity.kind }
      : null;
  };

  const getSnapTargetPreselection = (
    pointerInfo: PointerInfo,
    sourceDocument: BoardDocument,
  ): Preselection | null => {
    const { snapResult } = pointerInfo;

    if (!snapResult?.targetEntityId) {
      return null;
    }

    const entity = sourceDocument.entities[snapResult.targetEntityId];

    if (!entity?.visible) {
      return null;
    }

    if (snapResult.type === "point" && entity.kind === "point") {
      return { entityId: entity.id, entityType: "point" };
    }

    if (snapResult.type === "segment" && entity.kind === "segment") {
      return { entityId: entity.id, entityType: "segment" };
    }

    if (
      snapResult.type === "plane" &&
      snapResult.targetEntityType === "plane" &&
      entity.kind === "plane"
    ) {
      return { entityId: entity.id, entityType: "plane" };
    }

    return null;
  };

  const getPointerPreselection = (
    pointerInfo: PointerInfo,
  ): Preselection | null => {
    const sourceDocument = commandManager.getDocument();

    if (pointDragStateRef.current) {
      return null;
    }

    switch (currentTool) {
      case "select":
        return (
          getPointPreselection(pointerInfo, sourceDocument) ??
          getSegmentPreselection(pointerInfo, sourceDocument) ??
          getPerpendicularLinePreselection(pointerInfo, sourceDocument) ??
          getLinePlanePerpendicularPreselection(pointerInfo, sourceDocument) ??
          getPlanePreselection(pointerInfo, sourceDocument) ??
          getFunctionSurfacePreselection(pointerInfo, sourceDocument) ??
          getExtensionPreselection(pointerInfo, sourceDocument) ??
          getMeasurementPreselection(pointerInfo, sourceDocument)
        );
      case "point":
        return getSnapTargetPreselection(pointerInfo, sourceDocument);
      case "plane":
        return (
          getPointPreselection(pointerInfo, sourceDocument) ??
          getSnapTargetPreselection(pointerInfo, sourceDocument)
        );
      case "segment":
        return (
          getPointPreselection(pointerInfo, sourceDocument) ??
          getSnapTargetPreselection(pointerInfo, sourceDocument)
        );
      case "midpoint":
        return midpointFirstPointId
          ? getPointPreselection(pointerInfo, sourceDocument)
          : getPointPreselection(pointerInfo, sourceDocument) ??
              getSegmentPreselection(pointerInfo, sourceDocument);
      case "extend":
        if (extendMode === "segmentToBoundary") {
          return getSegmentPreselection(pointerInfo, sourceDocument);
        }

        if (extendMode === "planeToBoundary") {
          return getPlanePreselection(pointerInfo, sourceDocument);
        }

        return (
          getSegmentPreselection(pointerInfo, sourceDocument) ??
          getPlanePreselection(pointerInfo, sourceDocument)
        );
      case "parallel":
        if (parallelDraft) {
          return getSnapTargetPreselection(pointerInfo, sourceDocument);
        }

        if (parallelMode === "segment") {
          return getSegmentPreselection(pointerInfo, sourceDocument);
        }

        if (parallelMode === "plane") {
          return getPlanePreselection(pointerInfo, sourceDocument);
        }

        return (
          getSegmentPreselection(pointerInfo, sourceDocument) ??
          getPlanePreselection(pointerInfo, sourceDocument)
        );
      case "intersection": {
        const candidate =
          getSegmentPreselection(pointerInfo, sourceDocument) ??
          getPlanePreselection(pointerInfo, sourceDocument);

        return candidate?.entityId === intersectionFirstTarget?.entityId
          ? null
          : candidate;
      }
      case "perpendicular":
        if (perpendicularDirectionPick) {
          return getSnapTargetPreselection(pointerInfo, sourceDocument);
        }

        if (perpendicularMode === "linePlane") {
          if (perpendicularPointId) {
            return getPlanePreselection(pointerInfo, sourceDocument);
          }

          if (perpendicularPlaneId) {
            return getPointPreselection(pointerInfo, sourceDocument);
          }

          return (
            getPointPreselection(pointerInfo, sourceDocument) ??
            getPlanePreselection(pointerInfo, sourceDocument)
          );
        }

        if (perpendicularPointId) {
          return getSegmentPreselection(pointerInfo, sourceDocument);
        }

        if (perpendicularSegmentId) {
          return getPointPreselection(pointerInfo, sourceDocument);
        }

        return (
          getPointPreselection(pointerInfo, sourceDocument) ??
          getSegmentPreselection(pointerInfo, sourceDocument)
        );
      case "measureLength":
        return (
          getSegmentPreselection(pointerInfo, sourceDocument) ??
          getPointPreselection(pointerInfo, sourceDocument)
        );
      case "measureAngle":
        if (angleMeasureMode === "lineXYPlane") {
          return getSegmentPreselection(pointerInfo, sourceDocument);
        }

        if (angleMeasureMode === "linePlane") {
          return linePlaneAngleSegmentId
            ? getPlanePreselection(pointerInfo, sourceDocument)
            : getSegmentPreselection(pointerInfo, sourceDocument);
        }

        if (angleMeasureMode === "planeXYPlane") {
          return getPlanePreselection(pointerInfo, sourceDocument);
        }

        if (angleMeasureMode === "planePlane") {
          const planePreselection = getPlanePreselection(
            pointerInfo,
            sourceDocument,
          );

          return planePreselection?.entityId === planePlaneAngleFirstPlaneId
            ? null
            : planePreselection;
        }

        return getPointPreselection(pointerInfo, sourceDocument);
      default:
        return null;
    }
  };

  const handleSelectPointDragStart = (pointerInfo: PointerInfo) => {
    if (
      currentTool !== "select" ||
      !pointerInfo.hitEntityId ||
      pointerInfo.hitEntityType !== "point"
    ) {
      return;
    }

    const entity = commandManager.getDocument().entities[pointerInfo.hitEntityId];

    if (!entity || entity.kind !== "point") {
      return;
    }

    if (
      entity.pointKind === "constructed" &&
      entity.construction?.kind !== "parallelSegmentEndpoint" &&
      entity.construction?.kind !== "parallelPlaneVertex"
    ) {
      setCurrentPreselection(null);
      setDraggedPointId(null);
      selectEntity(entity.id);
      showToast("\u6784\u9020\u70b9\u4e0d\u80fd\u76f4\u63a5\u62d6\u52a8");
      setDeleteStatusMessage("\u6784\u9020\u70b9\u4e0d\u80fd\u76f4\u63a5\u62d6\u52a8");
      return;
    }

    const movePointId =
      entity.pointKind === "constructed"
        ? getParallelDragAnchorPointId(entity, commandManager.getDocument())
        : entity.id;

    if (!movePointId) {
      showToast("\u5e73\u884c\u5bf9\u8c61\u4f9d\u8d56\u7f3a\u5931\uff0c\u65e0\u6cd5\u62d6\u52a8");
      return;
    }

    const movePoint = commandManager.getDocument().entities[movePointId];

    if (!movePoint || movePoint.kind !== "point" || movePoint.pointKind === "constructed") {
      showToast("\u5e73\u884c\u5bf9\u8c61\u4f9d\u8d56\u7f3a\u5931\uff0c\u65e0\u6cd5\u62d6\u52a8");
      return;
    }

    pointDragStateRef.current = {
      pointId: entity.id,
      movePointId,
      oldPosition: cloneVec3(
        getPointWorldPosition(commandManager.getDocument(), movePointId) ??
          movePoint.position,
      ),
      latestPosition: cloneVec3(
        getPointWorldPosition(commandManager.getDocument(), movePointId) ??
          movePoint.position,
      ),
    };
    setCurrentPreselection(null);
    setDraggedPointId(entity.id);
    selectEntity(entity.id);
  };

  const handleSelectPointDragMove = (pointerInfo: PointerInfo) => {
    const dragState = pointDragStateRef.current;
    const desiredPosition = getDragPosition(pointerInfo);

    if (!dragState || !desiredPosition) {
      return;
    }

    const sourceDocument = commandManager.getDocument();
    const draggedPoint = sourceDocument.entities[dragState.pointId];
    const nextPosition =
      draggedPoint?.kind === "point" && draggedPoint.pointKind === "constructed"
        ? getParallelPointMoveAnchorPosition(
            draggedPoint,
            desiredPosition,
            sourceDocument,
          )
        : desiredPosition;

    if (!nextPosition) {
      showToast("\u5e73\u884c\u5bf9\u8c61\u4f9d\u8d56\u7f3a\u5931\uff0c\u65e0\u6cd5\u62d6\u52a8");
      return;
    }

    if (!isDragPositionSafe(nextPosition, dragState.latestPosition)) {
      setLastPointerInfo(pointerInfo);
      setLastSnapResult(null);
      return;
    }

    dragState.latestPosition = cloneVec3(nextPosition);
    setLastPointerInfo(pointerInfo);
    setLastSnapResult(pointerInfo.snapResult ?? null);
    setCurrentPreselection(
      getSnapTargetPreselection(pointerInfo, commandManager.getDocument()),
    );
    setDragPreviewDocument(
      createPointMovePreviewDocument(
        commandManager.getDocument(),
        dragState.movePointId,
        nextPosition,
      ),
    );
  };

  const handleSelectPointDragEnd = (pointerInfo: PointerInfo) => {
    const dragState = pointDragStateRef.current;

    if (!dragState) {
      return;
    }

    const finalPosition = cloneVec3(dragState.latestPosition);
    const { pointId, movePointId, oldPosition } = dragState;

    cancelPointDrag();

    if (!isDragPositionSafe(finalPosition, dragState.latestPosition)) {
      setSelection([pointId]);
      return;
    }

    if (!areVec3Equal(oldPosition, finalPosition)) {
      executeCommand(
        new MovePointCommand(movePointId, oldPosition, finalPosition),
      );
    }

    setSelection([pointId]);
  };

  const handleCanvasPointerMove = (pointerInfo: PointerInfo) => {
    const resolvedPointer = resolvePointerPosition(pointerInfo);
    const snapResult = resolvedPointer.snapResult;
    const nextPointerInfo: PointerInfo = {
      ...pointerInfo,
      snapResult,
    };

    if (currentTool === "point" && pointCreationMode === "free") {
      latestPointToolResolvedResultRef.current = resolvedPointer;
    } else if (currentTool !== "point") {
      latestPointToolResolvedResultRef.current = null;
    }

    const directionPreview =
      currentTool === "perpendicular" && perpendicularDirectionPick
        ? perpendicularDirectionPick.kind === "line"
          ? getLineDirectionPreviewForState(
              perpendicularDirectionPick,
              nextPointerInfo,
            ) ??
            (perpendicularDirectionPreviewRef.current?.kind === "line"
              ? perpendicularDirectionPreviewRef.current.preview
              : null)
          : getPlaneDirectionPreviewForState(
              perpendicularDirectionPick,
              resolvedPointer.finalPosition,
            )
        : null;

    if (currentTool === "perpendicular" && perpendicularDirectionPick) {
      perpendicularDirectionPreviewRef.current = directionPreview
        ? {
            kind: perpendicularDirectionPick.kind,
            preview: directionPreview,
          } as PerpendicularDirectionPreview
        : null;
      setPerpendicularDirectionPreviewEnd(
        directionPreview?.directionPoint ?? null,
      );
    } else if (perpendicularDirectionPreviewEnd) {
      perpendicularDirectionPreviewRef.current = null;
      setPerpendicularDirectionPreviewEnd(null);
    } else {
      perpendicularDirectionPreviewRef.current = null;
    }

    const displayPointerInfo =
      currentTool === "perpendicular" &&
      perpendicularDirectionPick?.kind === "line"
        ? {
            ...nextPointerInfo,
            snapResult:
              directionPreview && "source" in directionPreview
                ? directionPreview.snapResult
                : null,
          }
        : nextPointerInfo;

    setLastPointerInfo(displayPointerInfo);
    setLastSnapResult(displayPointerInfo.snapResult);
    setCurrentPreselection(getPointerPreselection(displayPointerInfo));
  };

  const handleCanvasPointerDown = (pointerInfo: PointerInfo) => {
    const resolvedPointer = resolvePointerPosition(pointerInfo);
    const pointToolResolvedPointer =
      currentTool === "point" && pointCreationMode === "free"
        ? latestPointToolResolvedResultRef.current ?? resolvedPointer
        : resolvedPointer;
    const snapResult = pointToolResolvedPointer.snapResult;
    const nextPointerInfo: PointerInfo = {
      ...pointerInfo,
      worldPosition:
        pointToolResolvedPointer.rawPosition ?? pointerInfo.worldPosition,
      snapResult,
    };
    const clickPreselection =
      getPointerPreselection(nextPointerInfo) ?? preselectionRef.current;

    setLastPointerInfo(nextPointerInfo);
    setLastSnapResult(snapResult);
    setCurrentPreselection(null);

    if (currentTool === "select") {
      if (
        clickPreselection &&
        commandManager.getDocument().entities[clickPreselection.entityId]
      ) {
        if (nextPointerInfo.ctrlKey) {
          toggleSelection(clickPreselection.entityId);
        } else {
          selectEntity(clickPreselection.entityId);
        }

        return;
      }

      selectToolRef.current.onPointerDown(nextPointerInfo, createToolContext());
      return;
    }

    if (currentTool === "point") {
      if (pointCreationMode !== "free") {
        return;
      }

      latestPointToolResolvedResultRef.current = pointToolResolvedPointer;
      pointToolRef.current.onPointerDown(nextPointerInfo, createToolContext());
      return;
    }

    if (currentTool === "segment") {
      const pointInput = resolvePointInputFromPointer(
        nextPointerInfo,
        clickPreselection,
        resolvedPointer,
      );

      if (!pointInput) {
        return;
      }

      if (!segmentFirstPointId) {
        if (pointInput.created) {
          executeCommand(new AddPointCommand(pointInput.point));
        }

        segmentToolRef.current.cancel();
        setSegmentFirstPointId(pointInput.pointId);
        return;
      }

      const firstPosition = getPointWorldPosition(
        commandManager.getDocument(),
        segmentFirstPointId,
      );

      if (
        segmentFirstPointId === pointInput.pointId ||
        !firstPosition ||
        distanceBetweenVec3(firstPosition, pointInput.position) <
          CONSTRUCTION_EPSILON
      ) {
        showToast("\u7ebf\u6bb5\u7aef\u70b9\u4e0d\u80fd\u91cd\u5408");
        return;
      }

      const segment = createSegmentEntity(
        createEntityId("segment"),
        getSegmentName(segmentFirstPointId, pointInput.pointId),
        segmentFirstPointId,
        pointInput.pointId,
        "#111827",
      );
      const command = pointInput.created
        ? new CompositeCommand("Add Point and Segment", [
            new AddPointCommand(pointInput.point),
            new AddSegmentCommand(segment),
          ])
        : new AddSegmentCommand(segment);

      executeCommand(command);
      segmentToolRef.current.cancel();
      setSegmentFirstPointId(null);
      return;
    }

    if (currentTool === "midpoint") {
      const selectedPointId =
        clickPreselection?.entityType === "point"
          ? clickPreselection.entityId
          : null;
      const selectedSegmentId =
        clickPreselection?.entityType === "segment"
          ? clickPreselection.entityId
          : null;

      if (midpointFirstPointId) {
        if (selectedPointId) {
          addMidpoint(midpointFirstPointId, selectedPointId);
        } else {
          setMidpointStatusMessage("\u8bf7\u9009\u62e9\u7b2c\u4e8c\u4e2a\u70b9");
        }

        return;
      }

      if (selectedSegmentId) {
        const segment = commandManager.getDocument().entities[selectedSegmentId];

        if (segment?.kind === "segment") {
          addMidpoint(segment.pointIds[0], segment.pointIds[1]);
        }

        return;
      }

      if (selectedPointId) {
        setMidpointFirstPointId(selectedPointId);
        setMidpointStatusMessage(null);
        return;
      }

      setMidpointStatusMessage(
        "\u8bf7\u9009\u62e9\u7b2c\u4e00\u4e2a\u70b9\uff0c\u6216\u76f4\u63a5\u70b9\u51fb\u4e00\u6761\u7ebf\u6bb5",
      );
      return;
    }

    if (currentTool === "perpendicular") {
      if (perpendicularDirectionPick) {
        confirmPerpendicularDirection(nextPointerInfo, resolvedPointer);
        return;
      }

      const selectedPointId =
        clickPreselection?.entityType === "point"
          ? clickPreselection.entityId
          : null;
      const selectedSegmentId =
        clickPreselection?.entityType === "segment"
          ? clickPreselection.entityId
          : null;
      const selectedPlaneId =
        clickPreselection?.entityType === "plane"
          ? clickPreselection.entityId
          : null;

      if (perpendicularMode === "linePlane") {
        if (perpendicularPointId) {
          if (selectedPlaneId) {
            addLinePlanePerpendicular(perpendicularPointId, selectedPlaneId);
          } else {
            setPerpendicularStatusMessage(
              "\u8bf7\u9009\u62e9\u76ee\u6807\u5e73\u9762",
            );
          }

          return;
        }

        if (perpendicularPlaneId) {
          if (selectedPointId) {
            addLinePlanePerpendicular(selectedPointId, perpendicularPlaneId);
          } else {
            setPerpendicularStatusMessage(
              "\u8bf7\u9009\u62e9\u8fc7\u5782\u7ebf\u7684\u70b9",
            );
          }

          return;
        }

        if (selectedPointId) {
          setPerpendicularPointId(selectedPointId);
          setPerpendicularStatusMessage(null);
          return;
        }

        if (selectedPlaneId) {
          setPerpendicularPlaneId(selectedPlaneId);
          setPerpendicularStatusMessage(null);
          return;
        }

        setPerpendicularStatusMessage(
          "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u6216\u4e00\u4e2a\u5e73\u9762",
        );
        return;
      }

      if (perpendicularPointId) {
        if (selectedSegmentId) {
          addPerpendicularLine(perpendicularPointId, selectedSegmentId);
        } else {
          setPerpendicularStatusMessage("\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5");
        }

        return;
      }

      if (perpendicularSegmentId) {
        if (selectedPointId) {
          addPerpendicularLine(selectedPointId, perpendicularSegmentId);
        } else {
          setPerpendicularStatusMessage(
            "\u8bf7\u9009\u62e9\u8fc7\u5782\u7ebf\u7684\u70b9",
          );
        }

        return;
      }

      if (selectedPointId) {
        setPerpendicularPointId(selectedPointId);
        setPerpendicularStatusMessage(null);
        return;
      }

      if (selectedSegmentId) {
        setPerpendicularSegmentId(selectedSegmentId);
        setPerpendicularStatusMessage(null);
        return;
      }

      setPerpendicularStatusMessage(
        "\u8bf7\u9009\u62e9\u4e00\u4e2a\u70b9\u6216\u4e00\u6761\u7ebf\u6bb5",
      );
      return;
    }

    if (currentTool === "extend") {
      const selectedSegmentId =
        clickPreselection?.entityType === "segment"
          ? clickPreselection.entityId
          : null;
      const selectedPlaneId =
        clickPreselection?.entityType === "plane"
          ? clickPreselection.entityId
          : null;

      if (extendMode === "segmentToBoundary") {
        if (selectedSegmentId) {
          addExtension(selectedSegmentId, "segment");
        } else {
          setExtendStatusMessage(
            "\u8bf7\u9009\u62e9\u8981\u5ef6\u957f\u5230\u8fb9\u754c\u7684\u7ebf\u6bb5",
          );
        }

        return;
      }

      if (extendMode === "planeToBoundary") {
        if (selectedPlaneId) {
          addExtension(selectedPlaneId, "plane");
        } else {
          setExtendStatusMessage(
            "\u8bf7\u9009\u62e9\u8981\u5ef6\u5c55\u5230\u8fb9\u754c\u7684\u5e73\u9762",
          );
        }

        return;
      }

      if (selectedSegmentId) {
        addExtension(selectedSegmentId, "segment");
        return;
      }

      if (selectedPlaneId) {
        addExtension(selectedPlaneId, "plane");
        return;
      }

      setExtendStatusMessage(
        "\u8bf7\u9009\u62e9\u8981\u5ef6\u957f\u7684\u7ebf\u6bb5\u6216\u5e73\u9762",
      );
      return;
    }

    if (currentTool === "parallel") {
      if (parallelDraft) {
        confirmParallelDraft(resolvedPointer.finalPosition);
        return;
      }

      const selectedSegmentId =
        clickPreselection?.entityType === "segment"
          ? clickPreselection.entityId
          : null;
      const selectedPlaneId =
        clickPreselection?.entityType === "plane"
          ? clickPreselection.entityId
          : null;

      if (parallelMode === "segment") {
        if (selectedSegmentId) {
          startParallelSegmentPreview(
            selectedSegmentId,
            resolvedPointer.finalPosition,
          );
        } else {
          setParallelStatusMessage("\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5");
        }

        return;
      }

      if (parallelMode === "plane") {
        if (selectedPlaneId) {
          startParallelPlanePreview(
            selectedPlaneId,
            resolvedPointer.finalPosition,
          );
        } else {
          setParallelStatusMessage("\u8bf7\u9009\u62e9\u76ee\u6807\u5e73\u9762");
        }

        return;
      }

      if (selectedSegmentId) {
        startParallelSegmentPreview(
          selectedSegmentId,
          resolvedPointer.finalPosition,
        );
        return;
      }

      if (selectedPlaneId) {
        startParallelPlanePreview(
          selectedPlaneId,
          resolvedPointer.finalPosition,
        );
        return;
      }

      setParallelStatusMessage(
        "\u8bf7\u9009\u62e9\u76ee\u6807\u7ebf\u6bb5\u6216\u5e73\u9762",
      );
      return;
    }

    if (currentTool === "intersection") {
      const selectedTarget =
        clickPreselection?.entityType === "segment" ||
        clickPreselection?.entityType === "plane"
          ? {
              entityId: clickPreselection.entityId,
              entityType: clickPreselection.entityType,
            }
          : null;

      if (!selectedTarget) {
        return;
      }

      if (!intersectionFirstTarget) {
        setIntersectionFirstTarget(selectedTarget);
        setIntersectionStatusMessage(null);
        return;
      }

      createIntersectionForPair(intersectionFirstTarget, selectedTarget);
      setIntersectionFirstTarget(null);
      return;
    }

    if (currentTool === "plane") {
      const pointInput = resolvePointInputFromPointer(
        nextPointerInfo,
        clickPreselection,
        resolvedPointer,
      );

      if (!pointInput) {
        return;
      }

      if (planeSelectedPointIds.includes(pointInput.pointId)) {
        showToast("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
        setPlaneStatusMessage("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
        return;
      }

      if (planeSelectedPointIds.length === 1) {
        const firstPosition = getPointWorldPosition(
          commandManager.getDocument(),
          planeSelectedPointIds[0],
        );

        if (
          !firstPosition ||
          distanceBetweenVec3(firstPosition, pointInput.position) <
            CONSTRUCTION_EPSILON
        ) {
          showToast("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
          setPlaneStatusMessage("\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9");
          return;
        }
      }

      if (planeSelectedPointIds.length < 2) {
        if (pointInput.created) {
          executeCommand(new AddPointCommand(pointInput.point));
        }

        planeToolRef.current.cancel();
        setPlaneSelectedPointIds([...planeSelectedPointIds, pointInput.pointId]);
        setPlaneStatusMessage(null);
        return;
      }

      const currentDocument = commandManager.getDocument();
      const pointAPosition = getPointWorldPosition(
        currentDocument,
        planeSelectedPointIds[0],
      );
      const pointBPosition = getPointWorldPosition(
        currentDocument,
        planeSelectedPointIds[1],
      );

      if (
        !pointAPosition ||
        !pointBPosition ||
        !getPlaneFromThreePoints(
          pointAPosition,
          pointBPosition,
          pointInput.position,
        )
      ) {
        showToast("\u4e09\u70b9\u5171\u7ebf\uff0c\u65e0\u6cd5\u786e\u5b9a\u5e73\u9762");
        setPlaneStatusMessage(
          "\u4e09\u70b9\u5171\u7ebf\uff0c\u65e0\u6cd5\u786e\u5b9a\u5e73\u9762",
        );
        return;
      }

      const [pointAId, pointBId] = planeSelectedPointIds;
      const plane = createPlaneEntity(
        createEntityId("plane"),
        getPlaneName(pointAId, pointBId, pointInput.pointId),
        pointAId,
        pointBId,
        pointInput.pointId,
      );
      const command = pointInput.created
        ? new CompositeCommand("Add Point and Plane", [
            new AddPointCommand(pointInput.point),
            new AddPlaneCommand(plane),
          ])
        : new AddPlaneCommand(plane);

      executeCommand(command);
      planeToolRef.current.cancel();
      setPlaneSelectedPointIds([]);
      setPlaneStatusMessage(
        `Created plane ${getPlaneName(
          pointAId,
          pointBId,
          pointInput.pointId,
        )}`,
      );
      return;
    }

    if (currentTool === "calculation") {
      if (isPlacingCalculation) {
        addCalculation();
        return;
      }

      if (
        nextPointerInfo.hitEntityType === "segment" &&
        nextPointerInfo.hitEntityId
      ) {
        insertBoardCalculationReference({
          kind: "reference",
          targetId: nextPointerInfo.hitEntityId,
          valueKind: "length",
        });
        setCalculationStatusMessage("已插入线段长度引用。");
      } else {
        setCalculationStatusMessage("请选择线段或测量对象插入计算。");
      }

      return;
    }

    if (currentTool === "measureLength") {
      measureLengthToolRef.current.onPointerDown(
        nextPointerInfo,
        createToolContext(),
      );
      setMeasureFirstPointId(measureLengthToolRef.current.getFirstPointId());

      const measureMessage = measureLengthToolRef.current.getLastMessage();

      if (measureMessage === "empty") {
        setMeasureStatusMessage(
          "\u957f\u5ea6\u5de5\u5177\uff1a\u8bf7\u9009\u62e9\u7ebf\u6bb5\u6216\u70b9",
        );
      } else if (measureMessage === "same-point") {
        setMeasureStatusMessage(
          "\u957f\u5ea6\u5de5\u5177\uff1a\u8bf7\u70b9\u51fb\u53e6\u4e00\u4e2a\u70b9",
        );
      } else if (!measureMessage) {
        setMeasureStatusMessage(null);
      }
      return;
    }

    if (currentTool === "measureAngle") {
      if (angleMeasureMode === "lineXYPlane") {
        const segmentId =
          nextPointerInfo.hitEntityType === "segment" &&
          nextPointerInfo.hitEntityId
            ? nextPointerInfo.hitEntityId
            : nextPointerInfo.snapResult?.type === "segment"
              ? nextPointerInfo.snapResult.targetEntityId ?? null
              : null;

        if (
          segmentId &&
          commandManager.getDocument().entities[segmentId]?.kind === "segment"
        ) {
          addLinePlaneAngleMeasurement([segmentId]);
        } else {
          setAngleStatusMessage("Select a segment to measure its angle with the X-Y plane");
        }

        return;
      }

      if (angleMeasureMode === "linePlane") {
        if (!linePlaneAngleSegmentId) {
          const segmentId =
            nextPointerInfo.hitEntityType === "segment" &&
            nextPointerInfo.hitEntityId
              ? nextPointerInfo.hitEntityId
              : nextPointerInfo.snapResult?.type === "segment"
                ? nextPointerInfo.snapResult.targetEntityId ?? null
                : null;

          if (
            segmentId &&
            commandManager.getDocument().entities[segmentId]?.kind === "segment"
          ) {
            setLinePlaneAngleSegmentId(segmentId);
            setAngleStatusMessage("Select a plane");
          } else {
            setAngleStatusMessage("Select a segment");
          }

          return;
        }

        if (
          nextPointerInfo.hitEntityId &&
          nextPointerInfo.hitEntityType === "plane" &&
          commandManager.getDocument().entities[nextPointerInfo.hitEntityId]
            ?.kind === "plane"
        ) {
          addSegmentPlaneAngleMeasurement(
            linePlaneAngleSegmentId,
            nextPointerInfo.hitEntityId,
          );
          setLinePlaneAngleSegmentId(null);
        } else {
          setAngleStatusMessage("Select a plane");
        }

        return;
      }

      if (angleMeasureMode === "planeXYPlane") {
        const planeId =
          nextPointerInfo.hitEntityType === "plane" &&
          nextPointerInfo.hitEntityId
            ? nextPointerInfo.hitEntityId
            : null;

        if (
          planeId &&
          commandManager.getDocument().entities[planeId]?.kind === "plane"
        ) {
          addPlaneXYPlaneAngleMeasurement(planeId);
        } else {
          setAngleStatusMessage("Select a plane to measure its angle with the X-Y plane");
        }

        return;
      }

      if (angleMeasureMode === "planePlane") {
        const planeId =
          nextPointerInfo.hitEntityType === "plane" &&
          nextPointerInfo.hitEntityId
            ? nextPointerInfo.hitEntityId
            : null;

        if (
          !planeId ||
          commandManager.getDocument().entities[planeId]?.kind !== "plane"
        ) {
          setAngleStatusMessage(
            planePlaneAngleFirstPlaneId
              ? "Select the second plane"
              : "Select the first plane",
          );
          return;
        }

        if (!planePlaneAngleFirstPlaneId) {
          setPlanePlaneAngleFirstPlaneId(planeId);
          setAngleStatusMessage("Select the second plane");
          return;
        }

        if (planeId === planePlaneAngleFirstPlaneId) {
          setAngleStatusMessage("Select a different plane");
          return;
        }

        addPlanePlaneAngleMeasurement(planePlaneAngleFirstPlaneId, planeId);
        setPlanePlaneAngleFirstPlaneId(null);
        return;
      }

      measureAngleToolRef.current.onPointerDown(
        nextPointerInfo,
        createToolContext(),
      );
      setAngleSelectedPointIds(
        measureAngleToolRef.current.getSelectedPointIds(),
      );

      const angleMessage = measureAngleToolRef.current.getLastMessage();

      if (angleMessage === "empty") {
        setAngleStatusMessage("\u91cf\u89d2\u5668\uff1a\u8bf7\u9009\u62e9\u5df2\u6709\u70b9");
      } else if (angleMessage === "duplicate-point") {
        setAngleStatusMessage(
          "\u91cf\u89d2\u5668\uff1a\u8bf7\u9009\u62e9\u4e0d\u540c\u7684\u70b9",
        );
      } else if (!angleMessage) {
        setAngleStatusMessage(null);
      }
    }
  };

  const handleOverlayEntityPointerDown = (
    entityId: EntityId,
    additive: boolean,
  ) => {
    if (currentTool === "calculation") {
      const entity = commandManager.getDocument().entities[entityId];

      if (entity?.kind === "measurement") {
        insertBoardCalculationReference({
          kind: "reference",
          targetId: entityId,
          valueKind: "measurement",
        });
        setCalculationStatusMessage("已插入测量引用。");
        return;
      }

      if (entity?.kind === "calculation") {
        selectEntity(entityId);
        return;
      }
    }

    if (additive) {
      toggleSelection(entityId);
      return;
    }

    selectEntity(entityId);
  };

  const handleOverlayEntityPointerEnter = (entityId: EntityId) => {
    if (currentTool !== "select" || pointDragStateRef.current) {
      return;
    }

    const entity = commandManager.getDocument().entities[entityId];

    if (
      (entity?.kind === "measurement" || entity?.kind === "calculation") &&
      entity.visible
    ) {
      setCurrentPreselection({ entityId, entityType: entity.kind });
    }
  };

  const handleOverlayEntityPointerLeave = (entityId: EntityId) => {
    if (preselectionRef.current?.entityId === entityId) {
      setCurrentPreselection(null);
    }
  };

  const changeTool = (nextTool: ToolName) => {
    setCurrentPreselection(null);

    if (nextTool !== "point") {
      latestPointToolResolvedResultRef.current = null;
      setShowPointToolPanel(false);
      setShowCoordinatePointModal(false);
    }

    if (nextTool !== "perpendicular") {
      setShowPerpendicularToolPanel(false);
    }

    if (nextTool !== "extend") {
      setShowExtendToolPanel(false);
      setExtendStatusMessage(null);
    }

    if (nextTool !== "parallel") {
      setShowParallelToolPanel(false);
      setParallelDraft(null);
      setParallelStatusMessage(null);
    }

    if (nextTool !== "intersection") {
      setIntersectionFirstTarget(null);
      setIntersectionStatusMessage(null);
    }

    if (nextTool !== "measureAngle") {
      setShowAngleToolPanel(false);
      setShowLinePlaneAnglePanel(false);
      setShowPlanePlaneAnglePanel(false);
    }

    if (nextTool !== "calculation") {
      setCalculationExpression(null);
      setCalculationPendingOp(null);
      setIsPlacingCalculation(false);
      setCalculationPointPicker(null);
      setCalculationStatusMessage(null);
    }

    if (nextTool !== "functionSurface") {
      setFunctionSurfaceDialog(null);
    }

    if (currentTool === "segment" && nextTool !== "segment") {
      segmentToolRef.current.cancel();
      setSegmentFirstPointId(null);
    }

    if (currentTool === "plane" && nextTool !== "plane") {
      planeToolRef.current.cancel();
      setPlaneSelectedPointIds([]);
      setPlaneStatusMessage(null);
    }

    if (currentTool === "perpendicular" && nextTool !== "perpendicular") {
      setPerpendicularPointId(null);
      setPerpendicularSegmentId(null);
      setPerpendicularPlaneId(null);
      clearPerpendicularDirectionPick();
      setPerpendicularStatusMessage(null);
    }

    if (currentTool === "midpoint" && nextTool !== "midpoint") {
      setMidpointFirstPointId(null);
      setMidpointStatusMessage(null);
    }

    if (currentTool === "extend" && nextTool !== "extend") {
      setExtendStatusMessage(null);
    }

    if (currentTool === "parallel" && nextTool !== "parallel") {
      setParallelDraft(null);
      setParallelStatusMessage(null);
    }

    if (currentTool === "intersection" && nextTool !== "intersection") {
      setIntersectionFirstTarget(null);
      setIntersectionStatusMessage(null);
    }

    if (currentTool === "measureLength" && nextTool !== "measureLength") {
      measureLengthToolRef.current.cancel();
      setMeasureFirstPointId(null);
      setMeasureStatusMessage(null);
    }

    if (currentTool === "measureAngle" && nextTool !== "measureAngle") {
      measureAngleToolRef.current.cancel();
      setAngleSelectedPointIds([]);
      setLinePlaneAngleSegmentId(null);
      setPlanePlaneAngleFirstPlaneId(null);
      setAngleStatusMessage(null);
    }

    if (currentTool === "calculation" && nextTool !== "calculation") {
      setCalculationExpression(null);
      setCalculationPendingOp(null);
      setIsPlacingCalculation(false);
      setCalculationPointPicker(null);
      setCalculationStatusMessage(null);
    }

    setCurrentTool(nextTool);

    if (nextTool === "functionSurface") {
      setFunctionSurfaceDialog({
        expression: "sin(x) * cos(y)",
        xMin: "-5",
        xMax: "5",
        yMin: "-5",
        yMax: "5",
        resolutionX: "80",
        resolutionY: "80",
        opacity: "0.6",
        wireframe: false,
        error: null,
      });
    }
  };

  useEffect(() => {
    const isEditingText = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrimaryShortcut = event.ctrlKey || event.metaKey;

      if (isPrimaryShortcut && !isEditingText(event.target)) {
        const key = event.key.toLowerCase();

        if (key === "o") {
          event.preventDefault();
          void openProject();
          return;
        }

        if (key === "s") {
          event.preventDefault();
          if (event.shiftKey) {
            void saveProjectAs();
          } else {
            void saveProject();
          }
          return;
        }

        if (
          (workspaceMode === "geometry3d" || workspaceMode === "plane2d") &&
          key === "z"
        ) {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }

        if (
          (workspaceMode === "geometry3d" || workspaceMode === "plane2d") &&
          key === "y"
        ) {
          event.preventDefault();
          redo();
          return;
        }
      }

      if (
        workspaceMode === "geometry3d" &&
        currentTool === "parallel" &&
        parallelDraft &&
        event.ctrlKey &&
        event.key.toLowerCase() === "j" &&
        !isEditingText(event.target)
      ) {
        event.preventDefault();
        switchParallelFollowTarget();
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !isEditingText(event.target)
      ) {
        if (
          workspaceMode === "plane2d" &&
          planeCanvasDocument?.selectedEntityIds.length
        ) {
          event.preventDefault();
          deleteSelectedPlane2DEntities();
          return;
        }

        if (
          workspaceMode === "geometry3d" &&
          commandManager.getDocument().selectedEntityIds.length > 0
        ) {
          event.preventDefault();
          deleteSelectedEntities();
        }

        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (workspaceMode === "plane2d") {
        if (plane2DPendingSegmentPointId) {
          setPlane2DPendingSegmentPointId(null);
          setPlane2DStatusMessage(null);
          return;
        }

        if (planeCanvasDocument?.selectedEntityIds.length) {
          updatePlaneCanvasDocument(
            { ...planeCanvasDocument, selectedEntityIds: [] },
            false,
          );
        }

        return;
      }

      setCurrentPreselection(null);

      if (pointDragStateRef.current) {
        cancelPointDrag();
        return;
      }

      if (showCoordinatePointModal) {
        closeCoordinatePointModal();
        return;
      }

      if (
        currentTool === "perpendicular" &&
        (perpendicularPointId ||
          perpendicularSegmentId ||
          perpendicularPlaneId ||
          perpendicularDirectionPick)
      ) {
        setPerpendicularPointId(null);
        setPerpendicularSegmentId(null);
        setPerpendicularPlaneId(null);
        clearPerpendicularDirectionPick();
        setPerpendicularStatusMessage(null);
        setShowPerpendicularToolPanel(false);
        return;
      }

      if (currentTool === "midpoint" && midpointFirstPointId) {
        setMidpointFirstPointId(null);
        setMidpointStatusMessage(null);
        return;
      }

      if (showPointToolPanel) {
        setShowPointToolPanel(false);
        return;
      }

      if (showPerpendicularToolPanel) {
        setShowPerpendicularToolPanel(false);
        return;
      }

      if (showExtendToolPanel) {
        setShowExtendToolPanel(false);
        return;
      }

      if (showParallelToolPanel) {
        setShowParallelToolPanel(false);
        return;
      }

      if (showLinePlaneAnglePanel) {
        setShowLinePlaneAnglePanel(false);
        return;
      }

      if (showPlanePlaneAnglePanel) {
        setShowPlanePlaneAnglePanel(false);
        return;
      }

      if (showAngleToolPanel) {
        setShowAngleToolPanel(false);
        setShowLinePlaneAnglePanel(false);
        setShowPlanePlaneAnglePanel(false);
        return;
      }

      if (currentTool === "measureLength") {
        measureLengthToolRef.current.cancel();
        setMeasureFirstPointId(null);
        setMeasureStatusMessage(null);
        setCurrentTool("select");
        return;
      }

      if (currentTool === "measureAngle") {
        measureAngleToolRef.current.cancel();
        setAngleSelectedPointIds([]);
        setLinePlaneAngleSegmentId(null);
        setPlanePlaneAngleFirstPlaneId(null);
        setAngleStatusMessage(null);
        setAngleMeasureMode("threePoint");
        setCurrentTool("select");
        return;
      }

      if (currentTool === "segment") {
        segmentToolRef.current.cancel();
        setSegmentFirstPointId(null);
        return;
      }

      if (currentTool === "plane") {
        planeToolRef.current.cancel();
        setPlaneSelectedPointIds([]);
        setPlaneStatusMessage(null);
        return;
      }

      if (currentTool === "perpendicular") {
        setPerpendicularPointId(null);
        setPerpendicularSegmentId(null);
        setPerpendicularPlaneId(null);
        clearPerpendicularDirectionPick();
        setPerpendicularStatusMessage(null);
        return;
      }

      if (currentTool === "midpoint") {
        setMidpointFirstPointId(null);
        setMidpointStatusMessage(null);
        return;
      }

      if (currentTool === "extend") {
        setExtendStatusMessage(null);
        setShowExtendToolPanel(false);
        return;
      }

      if (currentTool === "parallel") {
        setParallelDraft(null);
        setParallelStatusMessage(null);
        setShowParallelToolPanel(false);
        return;
      }

      if (currentTool === "intersection") {
        setIntersectionFirstTarget(null);
        setIntersectionStatusMessage(null);
        return;
      }

      if (
        workspaceMode === "geometry3d" &&
        commandManager.getDocument().selectedEntityIds.length > 0
      ) {
        clearSelection();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !showAngleToolPanel &&
        !showLinePlaneAnglePanel &&
        !showPlanePlaneAnglePanel &&
        !showPerpendicularToolPanel &&
        !showExtendToolPanel &&
        !showParallelToolPanel
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (
        target.closest(".point-tool-flyout") ||
        target.closest(".split-tool-button")
      ) {
        return;
      }

      setShowAngleToolPanel(false);
      setShowLinePlaneAnglePanel(false);
      setShowPlanePlaneAnglePanel(false);
      setShowPerpendicularToolPanel(false);
      setShowExtendToolPanel(false);
      setShowParallelToolPanel(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  });

  const plane2DEntities = planeCanvasDocument
    ? Object.values(planeCanvasDocument.entities)
    : [];
  const plane2DPoints = plane2DEntities.filter(
    (entity): entity is Plane2DPointEntity => entity.type === "plane2d-point",
  );
  const plane2DSegments = plane2DEntities.filter(
    (entity): entity is Plane2DSegmentEntity =>
      entity.type === "plane2d-segment",
  );
  const plane2DCircles = plane2DEntities.filter(
    (entity): entity is Plane2DCircleEntity =>
      entity.type === "plane2d-circle",
  );
  const plane2DPolygons = plane2DEntities.filter(
    (entity): entity is Plane2DPolygonEntity =>
      entity.type === "plane2d-polygon",
  );
  const plane2DMeasurements = plane2DEntities.filter(
    (entity): entity is Plane2DMeasurementEntity =>
      entity.type === "plane2d-measurement",
  );
  const plane2DCalculations = plane2DEntities.filter(
    (entity): entity is Plane2DCalculationEntity =>
      entity.type === "plane2d-calculation",
  );
  const plane2DFunctionGraphs = plane2DEntities.filter(
    (entity): entity is Plane2DFunctionGraphEntity =>
      entity.type === "plane2d-function-graph",
  );
  const plane2DExtensions = plane2DEntities.filter(
    (entity): entity is Plane2DExtensionEntity =>
      entity.type === "plane2d-extension",
  );
  const selectedPlane2DEntity =
    planeCanvasDocument?.selectedEntityIds[0]
      ? planeCanvasDocument.entities[planeCanvasDocument.selectedEntityIds[0]]
      : null;
  const selectedPlane2DPointEntities = planeCanvasDocument
    ? planeCanvasDocument.selectedEntityIds
        .map((entityId) => planeCanvasDocument.entities[entityId])
        .filter(
          (entity): entity is Plane2DPointEntity =>
            entity?.type === "plane2d-point",
        )
    : [];
  const hasMultipleSelectedPlane2DPoints =
    planeCanvasDocument !== null &&
    planeCanvasDocument.selectedEntityIds.length > 1 &&
    selectedPlane2DPointEntities.length ===
      planeCanvasDocument.selectedEntityIds.length;
  const plane2DObjectListGroups = useMemo<readonly ObjectListGroup[]>(() => {
    if (!planeCanvasDocument) {
      return [];
    }

    const groupOrder = ["点", "线段", "圆", "多边形", "函数图像", "测量", "计算", "对象"];
    const groups = new Map<string, ObjectListItem[]>();

    Object.values(planeCanvasDocument.entities).forEach((entity) => {
      const groupLabel = getPlane2DObjectGroupLabel(entity);
      const items = groups.get(groupLabel) ?? [];

      items.push(
        getPlane2DObjectListItem(entity, planeCanvasDocument.selectedEntityIds),
      );
      groups.set(groupLabel, items);
    });

    return groupOrder
      .filter((label) => groups.has(label))
      .map((label) => ({
        id: label,
        label,
        items: groups.get(label) ?? [],
      }));
  }, [planeCanvasDocument]);
  const updateSelectedPlane2DName = (name: string) => {
    if (!planeCanvasDocument || !selectedPlane2DEntity) {
      return;
    }

    const trimmedName = normalizePlane2DName(name);

    if (
      trimmedName &&
      findPlane2DNameOwner(planeCanvasDocument, trimmedName, [
        selectedPlane2DEntity.id,
      ])
    ) {
      showToast(`名称“${trimmedName}”已被使用，请换一个名称。`);
      setPlane2DStatusMessage(`名称“${trimmedName}”已被使用`);
      return;
    }

    updatePlaneCanvasDocument({
      ...planeCanvasDocument,
      entities: {
        ...planeCanvasDocument.entities,
        [selectedPlane2DEntity.id]: {
          ...selectedPlane2DEntity,
          name: trimmedName,
          nameSource: trimmedName ? "manual" : "auto",
          showName: Boolean(trimmedName),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };
  const applyPlane2DBatchNames = () => {
    if (!planeCanvasDocument || !hasMultipleSelectedPlane2DPoints) {
      return;
    }

    const names = generateSequentialNames(
      plane2DBatchNameStart,
      selectedPlane2DPointEntities.length,
    );

    if (names.length !== selectedPlane2DPointEntities.length) {
      showToast("请输入起始名称，例如 A 或 P1。");
      return;
    }

    const duplicateNames = findDuplicatePlane2DNames(
      planeCanvasDocument,
      names,
      selectedPlane2DPointEntities.map((point) => point.id),
    );

    if (duplicateNames.length > 0) {
      const duplicateNameText = duplicateNames.join(", ");
      showToast(`名称“${duplicateNameText}”已被使用，请换一个起始名称。`);
      setPlane2DStatusMessage(`名称“${duplicateNameText}”已被使用`);
      return;
    }

    const now = new Date().toISOString();
    const entities = { ...planeCanvasDocument.entities };

    selectedPlane2DPointEntities.forEach((point, index) => {
      entities[point.id] = {
        ...point,
        name: names[index],
        nameSource: "manual",
        showName: true,
        updatedAt: now,
      };
    });

    updatePlaneCanvasDocument({
      ...planeCanvasDocument,
      entities,
    });
    setPlane2DStatusMessage(`已连续命名 ${selectedPlane2DPointEntities.length} 个点。`);
  };

  const getPlane2DExtensionForSegment = (segmentId: string) =>
    plane2DExtensions.find((extension) => extension.targetSegmentId === segmentId);

  const createPlane2DExtensionForSegment = (segmentId: string) => {
    if (!planeCanvasDocument) {
      return;
    }

    const segment = planeCanvasDocument.entities[segmentId];

    if (segment?.type !== "plane2d-segment" || segment.segmentKind === "extension") {
      return;
    }

    const extensionId = plane2DExtensionId(segmentId);
    const existing = planeCanvasDocument.entities[extensionId];
    const nextExtension =
      existing?.type === "plane2d-extension"
        ? {
            ...existing,
            visible: true,
            snapEnabled: true,
            updatedAt: new Date().toISOString(),
          }
        : createPlane2DExtension(extensionId, segmentId);

    updatePlaneCanvasDocument({
      ...planeCanvasDocument,
      entities: {
        ...planeCanvasDocument.entities,
        [nextExtension.id]: nextExtension,
      },
      selectedEntityIds: [nextExtension.id],
    });
    setPlane2DStatusMessage("已创建延长部分。");
  };

  const setPlane2DExtensionVisibility = (
    extensionId: string,
    visible: boolean,
  ) => {
    if (!planeCanvasDocument) {
      return;
    }

    const extension = planeCanvasDocument.entities[extensionId];

    if (extension?.type !== "plane2d-extension" || extension.visible === visible) {
      return;
    }

    updatePlaneCanvasDocument({
      ...planeCanvasDocument,
      entities: {
        ...planeCanvasDocument.entities,
        [extension.id]: {
          ...extension,
          visible,
          snapEnabled: visible,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    setPlane2DStatusMessage(visible ? "已显示延长部分。" : "已隐藏延长部分。");
  };

  const updatePlane2DFunctionGraph = (
    graphId: string,
    patch: Partial<
      Pick<
        Plane2DFunctionGraphEntity,
        "expression" | "xMin" | "xMax" | "sampleCount"
      >
    >,
  ) => {
    if (!planeCanvasDocument) {
      return;
    }

    const graph = planeCanvasDocument.entities[graphId];

    if (graph?.type !== "plane2d-function-graph") {
      return;
    }

    const nextGraph: Plane2DFunctionGraphEntity = {
      ...graph,
      ...patch,
      sampleCount:
        patch.sampleCount === undefined
          ? graph.sampleCount
          : normalizeFunctionSampleCount2D(patch.sampleCount),
      updatedAt: new Date().toISOString(),
    };
    const sample = sampleFunction2D(
      nextGraph.expression,
      { min: nextGraph.xMin, max: nextGraph.xMax },
      nextGraph.sampleCount,
    );

    if (!sample.ok || sample.polylines.length === 0) {
      showToast("表达式错误，无法绘制函数。");
      setPlane2DStatusMessage("表达式错误，无法绘制函数。");
      return;
    }

    updatePlaneCanvasDocument(
      {
        ...planeCanvasDocument,
        entities: {
          ...planeCanvasDocument.entities,
          [graph.id]: nextGraph,
        },
      },
      true,
      { label: "修改函数图像" },
    );
  };

  return (
    <main className={`app-shell workspace-${workspaceMode}`}>
      <TopMenuBar
        activeDrawingPlane={displayDocument.settings.activeDrawingPlane}
        canDelete={
          workspaceMode === "geometry3d"
            ? commandManager.getDocument().selectedEntityIds.length > 0
            : workspaceMode === "plane2d"
              ? Boolean(planeCanvasDocument?.selectedEntityIds.length)
              : false
        }
        canRedo={
          workspaceMode === "geometry3d"
            ? commandManager.canRedo()
            : workspaceMode === "plane2d"
              ? plane2DHistory.redoStack.length > 0
              : false
        }
        canSave={
          workspaceMode === "geometry3d" ||
          (workspaceMode === "plane2d" && Boolean(planeCanvasDocument))
        }
        canUndo={
          workspaceMode === "geometry3d"
            ? commandManager.canUndo()
            : workspaceMode === "plane2d"
              ? plane2DHistory.undoStack.length > 0
              : false
        }
        canUse3dCommands={workspaceMode === "geometry3d"}
        hasWorkspace={workspaceMode !== "none"}
        onAbout={() =>
          showToast("Solid Geometry Studio - construction workspace")
        }
        onCloseWorkspace={closeWorkspace}
        onDelete={
          workspaceMode === "plane2d"
            ? deleteSelectedPlane2DEntities
            : deleteSelectedEntities
        }
        onNew3d={newProject}
        onNewPlane={newPlaneCanvas}
        onOpen={() => void openProject()}
        onRedo={redo}
        onResetView={focusCurrentDrawingPlane}
        onSave={() => void saveProject()}
        onSaveAs={() => void saveProjectAs()}
        onSetDrawingPlane={setDrawingPlane}
        onToggleBoundaryCube={() => toggleSetting("showBoundaryCube")}
        onUndo={undo}
      />
      {tabs.length > 0 ? (
        <WorkspaceTabBar
          activeTabId={activeTabId}
          onActivate={activateWorkspaceTab}
          onClose={closeWorkspaceTab}
          onReorder={(tabIds) =>
            setTabs((currentTabs) =>
              tabIds
                .map((tabId) => currentTabs.find((tab) => tab.id === tabId))
                .filter((tab): tab is WorkspaceTab => Boolean(tab)),
            )
          }
          tabs={workspaceTabItems}
        />
      ) : null}
      {workspaceMode === "geometry3d" ? (
        <>
      <aside className="toolbar" aria-label="Geometry tools">
        <div className="toolbar-brand">
          <Grid3X3 size={22} aria-hidden="true" />
          <span>Geometry</span>
        </div>
        <nav className="tool-groups">
          <section className="tool-group" aria-label="Construct tools">
            <h2>{"\u6784\u9020"}</h2>
            {constructTools.map(({ label, icon: Icon, name, disabled }) =>
              name === "point" ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && pointCreationMode === "free"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    disabled={disabled}
                    onClick={activatePointFreeMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showPointToolPanel ? "收回点工具方式" : "展开点工具方式"
                    }
                    className={
                      showPointToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openPointToolPanel();
                    }}
                    ref={pointToolToggleRef}
                    title="点工具方式"
                    type="button"
                  >
                    <span>{showPointToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : false ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && planeCreationMode === "threePoint"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    disabled={disabled}
                    onClick={activateThreePointPlaneMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showPlaneToolPanel ? "收回平面工具方式" : "展开平面工具方式"
                    }
                    className={
                      showPlaneToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openPlaneToolPanel();
                    }}
                    title="平面工具方式"
                    type="button"
                  >
                    <span>{showPlaneToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : name === "perpendicular" ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && perpendicularMode === "pointLine"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    disabled={disabled}
                    onClick={activatePointLinePerpendicularMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showPerpendicularToolPanel
                        ? "\u6536\u56de\u5782\u7ebf\u5de5\u5177\u65b9\u5f0f"
                        : "\u5c55\u5f00\u5782\u7ebf\u5de5\u5177\u65b9\u5f0f"
                    }
                    className={
                      showPerpendicularToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openPerpendicularToolPanel();
                    }}
                    ref={perpendicularToolToggleRef}
                    title="\u5782\u7ebf\u5de5\u5177\u65b9\u5f0f"
                    type="button"
                  >
                    <span>{showPerpendicularToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : name === "extend" ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && extendMode === "auto"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    disabled={disabled}
                    onClick={activateExtendAutoMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showExtendToolPanel
                        ? "\u6536\u56de\u5ef6\u957f\u5de5\u5177\u65b9\u5f0f"
                        : "\u5c55\u5f00\u5ef6\u957f\u5de5\u5177\u65b9\u5f0f"
                    }
                    className={
                      showExtendToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openExtendToolPanel();
                    }}
                    ref={extendToolToggleRef}
                    title="\u5ef6\u957f\u5de5\u5177\u65b9\u5f0f"
                    type="button"
                  >
                    <span>{showExtendToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : name === "parallel" ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && parallelMode === "auto"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    disabled={disabled}
                    onClick={activateParallelAutoMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showParallelToolPanel
                        ? "\u6536\u56de\u5e73\u884c\u5de5\u5177\u65b9\u5f0f"
                        : "\u5c55\u5f00\u5e73\u884c\u5de5\u5177\u65b9\u5f0f"
                    }
                    className={
                      showParallelToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openParallelToolPanel();
                    }}
                    ref={parallelToolToggleRef}
                    title="\u5e73\u884c\u5de5\u5177\u65b9\u5f0f"
                    type="button"
                  >
                    <span>{showParallelToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : (
                <button
                  className={
                    currentTool === name ? "tool-button active" : "tool-button"
                  }
                  disabled={disabled}
                  key={name}
                  onClick={() =>
                    name === "plane" ? activateThreePointPlaneMode() : changeTool(name)
                  }
                  title={label}
                  aria-label={label}
                  type="button"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ),
            )}
          </section>

          <section className="tool-group" aria-label="Measurement tools">
            <h2>{"\u6d4b\u91cf"}</h2>
            {measureTools.map(({ label, icon: Icon, name }) =>
              name === "measureAngle" ? (
                <div className="split-tool-button" key={name}>
                  <button
                    className={
                      currentTool === name && angleMeasureMode === "threePoint"
                        ? "tool-button active"
                        : "tool-button"
                    }
                    onClick={activateThreePointAngleMode}
                    title={label}
                    aria-label={label}
                    type="button"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                  <button
                    aria-label={
                      showAngleToolPanel ? "收回角度工具方式" : "展开角度工具方式"
                    }
                    className={
                      showAngleToolPanel
                        ? "tool-button split-toggle active"
                        : "tool-button split-toggle"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openAngleToolPanel();
                    }}
                    ref={angleToolToggleRef}
                    title="角度工具方式"
                    type="button"
                  >
                    <span>{showAngleToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : (
                <button
                  className={
                    currentTool === name ? "tool-button active" : "tool-button"
                  }
                  key={name}
                  onClick={() => changeTool(name)}
                  title={label}
                  aria-label={label}
                  type="button"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ),
            )}
          </section>

          {currentTool === "calculation" ? (
            <section className="tool-group calculation-tool-panel">
              <h2>计算</h2>
              <div className="formula-editor-preview">
                {calculationExpression ? (
                  <FormulaView
                    expression={calculationExpression}
                    getReferenceLabel={getBoardCalculationReferenceLabel}
                  />
                ) : (
                  <span>点击线段或测量对象插入引用</span>
                )}
              </div>
              <div className="calculation-button-grid">
                {([
                  ["add", "+"],
                  ["sub", "-"],
                  ["mul", "×"],
                  ["div", "÷"],
                ] as const).map(([op, label]) => (
                  <button
                    disabled={!calculationExpression}
                    key={op}
                    onClick={() => {
                      setCalculationPendingOp(op);
                      setIsPlacingCalculation(false);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
                {(["sin", "cos", "tan"] as const).map((op) => (
                  <button
                    disabled={!calculationExpression}
                    key={op}
                    onClick={() =>
                  setCalculationExpression((current) =>
                    current ? { kind: "unary", op, child: current } : current,
                  )
                }
                type="button"
              >
                {op}
              </button>
            ))}
            <button onClick={() => openBoardCalculationPointPicker("distance")} type="button">
              加入边
            </button>
            <button onClick={() => openBoardCalculationPointPicker("angle")} type="button">
              加入角
            </button>
            <button
              onClick={() => {
                setCalculationExpression(null);
                setCalculationPendingOp(null);
                setIsPlacingCalculation(false);
                setCalculationPointPicker(null);
              }}
              type="button"
            >
              清空
                </button>
                <button
                  disabled={!calculationExpression || Boolean(calculationPendingOp)}
                  onClick={() => {
                    setIsPlacingCalculation(true);
                    setCalculationStatusMessage("请点击画布放置计算结果。");
                  }}
                  type="button"
                >
                  确定
              </button>
            </div>
            {calculationPointPicker ? (
              <div className="calculation-point-picker">
                <h4>
                  {calculationPointPicker.mode === "distance"
                    ? "选择两个点作为边"
                    : "选择三个点作为角"}
                </h4>
                <input
                  className="calculation-point-search"
                  onChange={(event) =>
                    setCalculationPointPicker((current) =>
                      current
                        ? { ...current, searchQuery: event.target.value }
                        : current,
                    )
                  }
                  placeholder="搜索点"
                  type="search"
                  value={calculationPointPicker.searchQuery}
                />
                <div className="calculation-point-order">
                  {calculationPointPicker.selectedPointIds.length > 0
                    ? calculationPointPicker.selectedPointIds
                        .map((pointId, index) =>
                          `${index + 1}. ${getPointNameById(displayDocument, pointId)}`,
                        )
                        .join(" / ")
                    : calculationPointPicker.mode === "distance"
                      ? "请选择第 1 个点"
                      : "请选择第 1 个点，第二个点为顶点"}
                </div>
                <div className="calculation-point-list">
                  {boardCalculationPoints
                    .filter((point) => {
                      const query = calculationPointPicker.searchQuery
                        .trim()
                        .toLowerCase();
                      if (!query) {
                        return true;
                      }
                      return (
                        getPointNameById(displayDocument, point.id)
                          .toLowerCase()
                          .includes(query) ||
                        getBoardCalculationPointTypeLabel(point)
                          .toLowerCase()
                          .includes(query)
                      );
                    })
                    .map((point) => {
                      const selected =
                        calculationPointPicker.selectedPointIds.includes(point.id);

                      return (
                        <button
                          className={selected ? "selected" : undefined}
                          key={point.id}
                          onClick={() => toggleBoardCalculationPoint(point.id)}
                          type="button"
                        >
                          <span>{getPointNameById(displayDocument, point.id)}</span>
                          <small>{getBoardCalculationPointTypeLabel(point)}</small>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : null}
            {calculationPendingOp ? <span>请选择下一个引用。</span> : null}
          </section>
        ) : null}

          <section className="tool-group" aria-label="View tools">
            <h2>{"\u89c6\u56fe"}</h2>
            <div className="tool-button-grid">
              {drawingPlanes.map((drawingPlane) => (
                <button
                  className={
                    displayDocument.settings.activeDrawingPlane === drawingPlane
                      ? "tool-button active"
                      : "tool-button"
                  }
                  key={drawingPlane}
                  onClick={() => setDrawingPlane(drawingPlane)}
                  type="button"
                >
                  <span>{drawingPlane}</span>
                </button>
              ))}
            </div>
            <button
              className="tool-button"
              onClick={focusCurrentDrawingPlane}
              type="button"
            >
              <span>{"\u5bf9\u9f50\u5e73\u9762"}</span>
            </button>
          </section>

          <section className="tool-group" aria-label="Snap tools">
            <h2>{"\u5438\u9644"}</h2>
            <button
              className={displayDocument.settings.snapEnabled ? "tool-button active" : "tool-button"}
              onClick={() => toggleSetting("snapEnabled")}
              type="button"
            >
              <span>启用吸附</span>
            </button>
            <div className="tool-button-grid">
              {[
                ["snapToGrid", "网格"],
                ["snapToPoints", "点"],
                ["snapToAxes", "坐标轴"],
                ["snapToSegments", "线段"],
                ["snapToPlanes", "平面"],
                ["snapToOrigin", "原点"],
              ].map(([settingName, label]) => (
                <button
                  className={
                    displayDocument.settings[
                      settingName as keyof typeof displayDocument.settings
                    ]
                      ? "tool-button active"
                      : "tool-button"
                  }
                  key={settingName}
                  onClick={() =>
                    toggleSetting(
                      settingName as
                        | "snapToGrid"
                        | "snapToPoints"
                        | "snapToAxes"
                        | "snapToSegments"
                        | "snapToPlanes"
                        | "snapToOrigin",
                    )
                  }
                  type="button"
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        </nav>
      </aside>

      {showPointToolPanel ? (
        <FloatingSubmenu
          anchorElement={pointToolToggleRef.current}
          ariaLabel="点工具方式"
          className="point-tool-flyout"
          onClose={() => setShowPointToolPanel(false)}
          open={showPointToolPanel}
        >
          <button
            className={pointCreationMode === "free" ? "active" : ""}
            onClick={activatePointFreeMode}
            type="button"
          >
            自由点
          </button>
          <button
            className={pointCreationMode === "coordinate" ? "active" : ""}
            onClick={activateCoordinatePointMode}
            type="button"
          >
            坐标建点
          </button>
        </FloatingSubmenu>
      ) : null}

      {showPerpendicularToolPanel ? (
        <FloatingSubmenu
          anchorElement={perpendicularToolToggleRef.current}
          className="point-tool-flyout perpendicular-tool-flyout"
          ariaLabel="\u5782\u7ebf\u5de5\u5177\u65b9\u5f0f"
          onClose={() => setShowPerpendicularToolPanel(false)}
          open={showPerpendicularToolPanel}
        >
          <button
            className={perpendicularMode === "pointLine" ? "active" : ""}
            onClick={activatePointLinePerpendicularMode}
            type="button"
          >
            {"\u70b9\u5230\u7ebf\u5782\u7ebf"}
          </button>
          <button
            className={perpendicularMode === "linePlane" ? "active" : ""}
            onClick={activateLinePlanePerpendicularMode}
            type="button"
          >
            {"\u70b9\u5230\u9762\u5782\u7ebf"}
          </button>
        </FloatingSubmenu>
      ) : null}

      {showExtendToolPanel ? (
        <FloatingSubmenu
          anchorElement={extendToolToggleRef.current}
          className="point-tool-flyout extend-tool-flyout"
          ariaLabel="\u5ef6\u957f\u5de5\u5177\u65b9\u5f0f"
          onClose={() => setShowExtendToolPanel(false)}
          open={showExtendToolPanel}
        >
          <button
            className={extendMode === "segmentToBoundary" ? "active" : ""}
            onClick={activateSegmentExtendMode}
            type="button"
          >
            {"\u5ef6\u957f\u7ebf\u6bb5\u5230\u8fb9\u754c"}
          </button>
          <button
            className={extendMode === "planeToBoundary" ? "active" : ""}
            onClick={activatePlaneExtendMode}
            type="button"
          >
            {"\u5ef6\u5c55\u5e73\u9762\u5230\u8fb9\u754c"}
          </button>
        </FloatingSubmenu>
      ) : null}

      {showParallelToolPanel ? (
        <FloatingSubmenu
          anchorElement={parallelToolToggleRef.current}
          className="point-tool-flyout parallel-tool-flyout"
          ariaLabel="\u5e73\u884c\u5de5\u5177\u65b9\u5f0f"
          onClose={() => setShowParallelToolPanel(false)}
          open={showParallelToolPanel}
        >
          <button
            className={parallelMode === "segment" ? "active" : ""}
            onClick={activateParallelSegmentMode}
            type="button"
          >
            {"\u5e73\u884c\u7ebf\u6bb5"}
          </button>
          <button
            className={parallelMode === "plane" ? "active" : ""}
            onClick={activateParallelPlaneMode}
            type="button"
          >
            {"\u5e73\u884c\u5e73\u9762"}
          </button>
        </FloatingSubmenu>
      ) : null}

      {false ? (
        <div
          className="point-tool-flyout plane-tool-flyout"
          role="menu"
          aria-label="平面工具方式"
        >
          <button
            className={planeCreationMode === "threePoint" ? "active" : ""}
            onClick={activateThreePointPlaneMode}
            type="button"
          >
            三点确定平面
          </button>
        </div>
      ) : null}

      {false ? (
        <div
          className="point-tool-flyout angle-tool-flyout"
          role="menu"
          aria-label="角度工具方式"
        >
          <button
            className={angleMeasureMode === "threePoint" ? "active" : ""}
            onClick={activateThreePointAngleMode}
            type="button"
          >
            三点角度
          </button>
          <button
            className={angleMeasureMode === "lineXYPlane" ? "active" : ""}
            onClick={activateLineXYPlaneAngleMode}
            type="button"
          >
            与 X-Y 面夹角
          </button>
          <button
            className={angleMeasureMode === "linePlane" ? "active" : ""}
            onClick={activateLinePlaneAngleMode}
            type="button"
          >
            与已有平面夹角
          </button>
        </div>
      ) : null}

      {showAngleToolPanel ? (
        <FloatingSubmenu
          anchorElement={angleToolToggleRef.current}
          className="point-tool-flyout angle-tool-flyout"
          ariaLabel="角度工具方式"
          onClose={() => {
            setShowAngleToolPanel(false);
            setShowLinePlaneAnglePanel(false);
            setShowPlanePlaneAnglePanel(false);
          }}
          open={showAngleToolPanel}
        >
          <button
            className={angleMeasureMode === "threePoint" ? "active" : ""}
            onClick={activateThreePointAngleMode}
            type="button"
          >
            三点角度
          </button>
          <div className="angle-subtool-row">
            <button
              className={
                angleMeasureMode === "lineXYPlane" ||
                angleMeasureMode === "linePlane"
                  ? "active"
                  : ""
              }
              onClick={toggleLinePlaneAnglePanel}
              type="button"
            >
              线面角
            </button>
            <button
              aria-label={
                showLinePlaneAnglePanel ? "收回线面角方式" : "展开线面角方式"
              }
              className={showLinePlaneAnglePanel ? "active" : ""}
              ref={linePlaneAngleToggleRef}
              onClick={toggleLinePlaneAnglePanel}
              type="button"
            >
              {showLinePlaneAnglePanel ? "<" : ">"}
            </button>
          </div>
          <div className="angle-subtool-row">
            <button
              className={
                angleMeasureMode === "planeXYPlane" ||
                angleMeasureMode === "planePlane"
                  ? "active"
                  : ""
              }
              onClick={togglePlanePlaneAnglePanel}
              type="button"
            >
              面面角
            </button>
            <button
              aria-label={
                showPlanePlaneAnglePanel ? "收回面面角方式" : "展开面面角方式"
              }
              className={showPlanePlaneAnglePanel ? "active" : ""}
              ref={planePlaneAngleToggleRef}
              onClick={togglePlanePlaneAnglePanel}
              type="button"
            >
              {showPlanePlaneAnglePanel ? "<" : ">"}
            </button>
          </div>
        </FloatingSubmenu>
      ) : null}

      {showAngleToolPanel && showLinePlaneAnglePanel ? (
        <FloatingSubmenu
          anchorElement={linePlaneAngleToggleRef.current}
          className="point-tool-flyout angle-line-plane-flyout"
          ariaLabel="线面角方式"
          onClose={() => setShowLinePlaneAnglePanel(false)}
          open={showAngleToolPanel && showLinePlaneAnglePanel}
        >
          <button
            className={angleMeasureMode === "lineXYPlane" ? "active" : ""}
            onClick={activateLineXYPlaneAngleMode}
            type="button"
          >
            与 XY 平面夹角
          </button>
          <button
            className={angleMeasureMode === "linePlane" ? "active" : ""}
            onClick={activateLinePlaneAngleMode}
            type="button"
          >
            与已有平面夹角
          </button>
        </FloatingSubmenu>
      ) : null}

      {showAngleToolPanel && showPlanePlaneAnglePanel ? (
        <FloatingSubmenu
          anchorElement={planePlaneAngleToggleRef.current}
          className="point-tool-flyout angle-plane-plane-flyout"
          ariaLabel="面面角方式"
          onClose={() => setShowPlanePlaneAnglePanel(false)}
          open={showAngleToolPanel && showPlanePlaneAnglePanel}
        >
          <button
            className={angleMeasureMode === "planeXYPlane" ? "active" : ""}
            onClick={activatePlaneXYPlaneAngleMode}
            type="button"
          >
            与 XY 平面夹角
          </button>
          <button
            className={angleMeasureMode === "planePlane" ? "active" : ""}
            onClick={activatePlanePlaneAngleMode}
            type="button"
          >
            与已有平面夹角
          </button>
        </FloatingSubmenu>
      ) : null}

      <section className="viewport-panel" aria-label="3D viewport">
        <div className="viewport-topbar">
          <div>
            <h1>Solid Geometry Studio</h1>
            <span>
              {toolLabels[currentTool]} / {displayDocument.settings.activeDrawingPlane}
            </span>
          </div>
          <div className="viewport-actions">
            <span className="viewport-file-name">
              {currentFileName}
              {isDirty ? " *" : ""}
            </span>
          </div>
        </div>
        <SceneViewport
          currentTool={currentTool}
          document={displayDocument}
          focusRequestId={focusRequestId}
          highlightedEntityIds={highlightedEntityIds}
          highlightedPointIds={highlightedPointIds}
          isDraggingPoint={draggedPointId !== null}
          preselectedEntityId={preselection?.entityId ?? null}
          previewPosition={previewPosition}
          secondaryPreviewPosition={secondaryPreviewPosition}
          tertiaryPreviewPosition={tertiaryPreviewPosition}
          segmentPreviewStartPosition={segmentPreviewStartPosition}
          planePreviewPoints={parallelPreviewPlane}
          initialViewState={geometry3DViewState}
          onViewStateChange={setGeometry3DViewState}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onSelectPointDragStart={handleSelectPointDragStart}
          onSelectPointDragMove={handleSelectPointDragMove}
          onSelectPointDragEnd={handleSelectPointDragEnd}
          onSelectPointDragCancel={cancelPointDrag}
          onOverlayEntityPointerDown={handleOverlayEntityPointerDown}
          onOverlayEntityPointerEnter={handleOverlayEntityPointerEnter}
          onOverlayEntityPointerLeave={handleOverlayEntityPointerLeave}
        />
      </section>

      <aside className="properties-panel" aria-label="Properties">
        <div className="panel-header">
          <h2>Properties</h2>
          <span>
            {selectedEntityCount === 0
              ? "No selection"
              : `${selectedEntityCount} selected`}
          </span>
        </div>
        <div className="panel-tabs" role="tablist" aria-label="右侧面板">
          <button
            className={propertiesTab === "properties" ? "active" : ""}
            onClick={() => setPropertiesTab("properties")}
            type="button"
          >
            属性
          </button>
          <button
            className={propertiesTab === "objects" ? "active" : ""}
            onClick={() => setPropertiesTab("objects")}
            type="button"
          >
            对象
          </button>
        </div>

        {propertiesTab === "objects" ? (
          <ObjectListPanel
            groups={geometryObjectListGroups}
            onDelete={deleteBoardEntityFromList}
            onSearchQueryChange={setObjectListSearchQuery}
            onSelect={selectEntity}
            onToggleVisible={setBoardEntityVisibility}
            searchQuery={objectListSearchQuery}
          />
        ) : (
          <>
        {selectedEntityCount > 0 ? (
          <section className="property-group selection-actions">
            <h3>Selection</h3>
            {selectedNameableEntity ? (
              <div className="batch-naming name-editor">
                <label>
                  Name
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        commitDraftName();
                      }
                    }}
                  />
                </label>
                {selectedNameableEntity.kind === "plane" ? (
                  <GreekLetterKeyboard
                    compact
                    onInsert={(letter) =>
                      setDraftName((currentDraftName) =>
                        `${currentDraftName}${letter}`,
                      )
                    }
                  />
                ) : null}
                <button onClick={commitDraftName} type="button">
                  {"\u547d\u540d"}
                </button>
              </div>
            ) : null}
            {selectedPointCount > 1 ? (
              <div className="batch-naming">
                <span>Selected points: {selectedPointCount}</span>
                <label>
                  Start name
                  <input
                    value={batchNameStart}
                    onChange={(event) => setBatchNameStart(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        renameSelectedPoints();
                      }
                    }}
                  />
                </label>
                <button onClick={renameSelectedPoints} type="button">
                  Batch rename points
                </button>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "point" ? (
              <div className="batch-naming">
                <span>
                  {singleSelectedEntity.pointKind === "constructed"
                    ? "\u7c7b\u578b\uff1a\u6784\u9020\u70b9"
                    : "\u7c7b\u578b\uff1a\u70b9"}
                </span>
                {singleSelectedEntity.construction?.kind === "footToPlane" ? (
                  <>
                    <span>{"\u6784\u9020\u65b9\u5f0f\uff1a\u70b9\u5230\u5e73\u9762\u7684\u5782\u8db3"}</span>
                    <span>
                      {"\u6e90\u70b9\uff1a"}
                      {getPointNameById(
                        displayDocument,
                        singleSelectedEntity.construction.sourcePointId,
                      )}
                    </span>
                    <span>
                      {"\u76ee\u6807\u5e73\u9762\uff1a"}
                      {displayDocument.entities[
                        singleSelectedEntity.construction.targetPlaneId
                      ]?.kind === "plane"
                        ? getPlaneDisplayName(
                            displayDocument,
                            displayDocument.entities[
                              singleSelectedEntity.construction.targetPlaneId
                            ] as PlaneEntity,
                          )
                        : "invalid"}
                    </span>
                  </>
                ) : singleSelectedEntity.construction?.kind === "footToLine" ? (
                  <>
                    <span>{"\u6784\u9020\u65b9\u5f0f\uff1a\u70b9\u5230\u7ebf\u7684\u5782\u8db3"}</span>
                    <span>
                      {"\u6e90\u70b9\uff1a"}
                      {getPointNameById(
                        displayDocument,
                        singleSelectedEntity.construction.sourcePointId,
                      )}
                    </span>
                    <span>
                      {"\u76ee\u6807\u7ebf\u6bb5\uff1a"}
                      {displayDocument.entities[
                        singleSelectedEntity.construction.targetSegmentId
                      ]?.kind === "segment"
                        ? getSegmentDisplayName(
                            displayDocument,
                            displayDocument.entities[
                              singleSelectedEntity.construction.targetSegmentId
                            ] as SegmentEntity,
                          )
                        : "invalid"}
                    </span>
                  </>
                ) : singleSelectedEntity.construction?.kind === "midpoint" ? (
                  <>
                    <span>{"\u6784\u9020\u65b9\u5f0f\uff1a\u4e2d\u70b9"}</span>
                    <span>
                      {"\u70b9 1\uff1a"}
                      {getPointNameById(
                        displayDocument,
                        singleSelectedEntity.construction.pointAId,
                      )}
                    </span>
                    <span>
                      {"\u70b9 2\uff1a"}
                      {getPointNameById(
                        displayDocument,
                        singleSelectedEntity.construction.pointBId,
                      )}
                    </span>
                  </>
                ) : null}
                <span>
                  {"\u5f53\u524d\u5750\u6807\uff1a"}
                  {formatVec3(
                    getPointWorldPosition(displayDocument, singleSelectedEntity.id),
                  )}
                </span>
              </div>
            ) : null}
            {selectedExtensionControlParts.length > 0 ? (
              <div className="batch-naming">
                <span>{"\u6750\u8d28 / \u5ef6\u957f\u90e8\u5206"}</span>
                {selectedExtensionControlParts.map((part) => (
                  <div className="extension-part-row" key={part.id}>
                    <span>
                      {part.label}
                      {part.canSnap ? " / \u53ef\u5438\u9644" : ""}
                    </span>
                    <button
                      onClick={() => setExtensionPartVisibility(part, !part.visible)}
                      type="button"
                    >
                      {part.visible ? "\u9690\u85cf" : "\u663e\u793a"}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "plane" ? (
              <div className="batch-naming">
                <span>Type: plane</span>
                <span>
                  Name: {getPlaneDisplayName(displayDocument, singleSelectedEntity)}
                </span>
                <span>
                  由三点确定：
                  {singleSelectedEntity.pointIds
                    .map((pointId) => getPointNameById(displayDocument, pointId))
                    .join(", ")}
                </span>
                <span>鐘舵€侊細{getPlaneStatusText(singleSelectedEntity, displayDocument)}</span>
                <span>Visible: {singleSelectedEntity.visible ? "true" : "false"}</span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "perpendicularLine" ? (
              <div className="batch-naming">
                <span>{"\u7c7b\u578b\uff1a\u5782\u7ebf"}</span>
                <span>
                  {"\u8fc7\u70b9\uff1a"}
                  {getPointNameById(
                    displayDocument,
                    singleSelectedEntity.pointId,
                  )}
                </span>
                <span>
                  {"\u5782\u76f4\u4e8e\uff1a"}
                  {displayDocument.entities[singleSelectedEntity.segmentId]
                    ?.kind === "segment"
                    ? getSegmentDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.segmentId
                        ] as SegmentEntity,
                      )
                    : "invalid"}
                </span>
                {singleSelectedEntity.constructionMode === "userDirection" ? (
                  <span>
                    {"\u65b9\u5411\u70b9\uff1a"}
                    {singleSelectedEntity.directionPointId
                      ? getPointNameById(
                          displayDocument,
                          singleSelectedEntity.directionPointId,
                        )
                      : "invalid"}
                  </span>
                ) : (
                  <span>
                    {"\u5782\u8db3\uff1a"}
                    {singleSelectedEntity.footPointId
                      ? getPointNameById(
                          displayDocument,
                          singleSelectedEntity.footPointId,
                        )
                      : "invalid"}
                  </span>
                )}
                <span>
                  {"\u5782\u8db3\u4f4d\u7f6e\uff1a"}
                  {getPerpendicularFootStatusText(
                    singleSelectedEntity,
                    displayDocument,
                  )}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "linePlanePerpendicular" ? (
              <div className="batch-naming">
                <span>{"\u7c7b\u578b\uff1a\u7ebf\u9762\u5782\u76f4"}</span>
                <span>
                  {"\u8fc7\u70b9\uff1a"}
                  {getPointNameById(
                    displayDocument,
                    singleSelectedEntity.pointId,
                  )}
                </span>
                <span>
                  {"\u5782\u76f4\u4e8e\uff1a\u5e73\u9762 "}
                  {displayDocument.entities[singleSelectedEntity.planeId]
                    ?.kind === "plane"
                    ? getPlaneDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.planeId
                        ] as PlaneEntity,
                      )
                    : "invalid"}
                </span>
                <span>
                  {singleSelectedEntity.constructionMode === "userDirection"
                    ? "\u65b9\u5411\u70b9\uff1a"
                    : "\u5782\u8db3\uff1a"}
                  {singleSelectedEntity.constructionMode === "userDirection"
                    ? singleSelectedEntity.directionPointId
                      ? getPointNameById(
                          displayDocument,
                          singleSelectedEntity.directionPointId,
                        )
                      : "invalid"
                    : singleSelectedEntity.footPointId
                      ? getPointNameById(
                          displayDocument,
                          singleSelectedEntity.footPointId,
                        )
                      : "invalid"}
                </span>
                <span>
                  {"\u5782\u8db3\u4f4d\u7f6e\uff1a"}
                  {getLinePlanePerpendicularFootStatusText(
                    singleSelectedEntity,
                    displayDocument,
                  )}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "extension" ? (
              <div className="batch-naming">
                <span>
                  {"\u7c7b\u578b\uff1a"}
                  {singleSelectedEntity.targetType === "segment"
                    ? "\u7ebf\u6bb5\u5ef6\u957f"
                    : "\u5e73\u9762\u5ef6\u5c55"}
                </span>
                <span>
                  {"\u76ee\u6807\u5bf9\u8c61\uff1a"}
                  {displayDocument.entities[singleSelectedEntity.targetId]?.kind ===
                  "segment"
                    ? getSegmentDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.targetId
                        ] as SegmentEntity,
                      )
                    : displayDocument.entities[singleSelectedEntity.targetId]
                          ?.kind === "plane"
                      ? `\u5e73\u9762 ${getPlaneDisplayName(
                          displayDocument,
                          displayDocument.entities[
                            singleSelectedEntity.targetId
                          ] as PlaneEntity,
                        )}`
                      : "invalid"}
                </span>
                <span>
                  {"\u8fb9\u754c\uff1a"}
                  {`[-${displayDocument.settings.coordinateHalfSize}, ${displayDocument.settings.coordinateHalfSize}]`}
                </span>
                <span>
                  {"\u72b6\u6001\uff1a"}
                  {getExtensionStatus(singleSelectedEntity, displayDocument)}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "measurement" &&
            singleSelectedEntity.measurementKind === "linePlaneAngle" ? (
              <div className="batch-naming">
                <span>类型：线面角</span>
                <span>
                  线段：
                  {displayDocument.entities[singleSelectedEntity.targetIds[0]]
                    ?.kind === "segment"
                    ? getSegmentDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.targetIds[0]
                        ] as SegmentEntity,
                      )
                    : singleSelectedEntity.targetIds[0] ?? "invalid"}
                </span>
                <span>
                  平面：
                  {displayDocument.entities[singleSelectedEntity.targetIds[1]]
                    ?.kind === "plane"
                    ? `平面 ${getPlaneDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.targetIds[1]
                        ] as PlaneEntity,
                      )}`
                    : singleSelectedEntity.plane === "XY" ||
                        singleSelectedEntity.plane === undefined
                      ? "X-Y 面"
                      : `${singleSelectedEntity.plane} 面`}
                </span>
                <span>
                  当前值：
                  {calculateMeasurementValue(singleSelectedEntity, displayDocument)
                    ?.formattedText ?? "invalid"}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "measurement" &&
            singleSelectedEntity.measurementKind === "planePlaneAngle" ? (
              <div className="batch-naming">
                <span>类型：面面角</span>
                <span>
                  平面 1：{displayDocument.entities[singleSelectedEntity.targetIds[0]]
                    ?.kind === "plane"
                    ? `平面 ${getPlaneDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.targetIds[0]
                        ] as PlaneEntity,
                      )}`
                    : singleSelectedEntity.targetIds[0] ?? "invalid"}
                </span>
                <span>
                  平面 2：{displayDocument.entities[singleSelectedEntity.targetIds[1]]
                    ?.kind === "plane"
                    ? `平面 ${getPlaneDisplayName(
                        displayDocument,
                        displayDocument.entities[
                          singleSelectedEntity.targetIds[1]
                        ] as PlaneEntity,
                      )}`
                    : singleSelectedEntity.plane === "XY" ||
                        singleSelectedEntity.plane === undefined
                      ? "X-Y 面"
                      : `${singleSelectedEntity.plane} 面`}
                </span>
                <span>
                  当前值：
                  {calculateMeasurementValue(singleSelectedEntity, displayDocument)
                    ?.formattedText ?? "invalid"}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "calculation" ? (
              <div className="batch-naming">
                <span>类型：计算</span>
                <span className="property-formula-preview">
                  <FormulaView
                    expression={singleSelectedEntity.expression}
                    getReferenceLabel={getBoardCalculationReferenceLabel}
                  />
                </span>
                <span>
                  当前值：
                  {(() => {
                    const result = evaluateCalculationExpression(
                      singleSelectedEntity.expression,
                      (targetId) =>
                        resolveBoardCalculationReference(displayDocument, targetId),
                      resolveBoardCalculationGeometry(displayDocument),
                    );

                    return result.ok
                      ? formatCalculationValue(result.value)
                      : result.error;
                  })()}
                </span>
              </div>
            ) : null}
            {singleSelectedEntity?.kind === "functionSurface" ? (
              <div className="batch-naming">
                <span>类型：函数曲面</span>
                <label>
                  表达式 z =
                  <input
                    defaultValue={singleSelectedEntity.expression}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        expression: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  xMin
                  <input
                    type="number"
                    defaultValue={singleSelectedEntity.xMin}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        xMin: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  xMax
                  <input
                    type="number"
                    defaultValue={singleSelectedEntity.xMax}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        xMax: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  yMin
                  <input
                    type="number"
                    defaultValue={singleSelectedEntity.yMin}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        yMin: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  yMax
                  <input
                    type="number"
                    defaultValue={singleSelectedEntity.yMax}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        yMax: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  X 分辨率
                  <input
                    max="160"
                    min="10"
                    type="number"
                    defaultValue={singleSelectedEntity.resolutionX}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        resolutionX: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Y 分辨率
                  <input
                    max="160"
                    min="10"
                    type="number"
                    defaultValue={singleSelectedEntity.resolutionY}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        resolutionY: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  透明度
                  <input
                    max="1"
                    min="0.05"
                    step="0.05"
                    type="number"
                    defaultValue={singleSelectedEntity.opacity ?? 0.6}
                    onBlur={(event) =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        opacity: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <div className="setting-button-grid">
                  <button
                    className={singleSelectedEntity.wireframe ? "active" : ""}
                    onClick={() =>
                      updateFunctionSurface(singleSelectedEntity.id, {
                        wireframe: !singleSelectedEntity.wireframe,
                      })
                    }
                    type="button"
                  >
                    线框模式
                  </button>
                  <button
                    className={singleSelectedEntity.visible ? "active" : ""}
                    onClick={() =>
                      setBoardEntityVisibility(
                        singleSelectedEntity.id,
                        !singleSelectedEntity.visible,
                      )
                    }
                    type="button"
                  >
                    {singleSelectedEntity.visible ? "隐藏" : "显示"}
                  </button>
                </div>
              </div>
            ) : null}
            <button
              className="danger-button"
              onClick={deleteSelectedEntities}
              type="button"
            >
              {selectedEntityCount === 1
                ? "Delete object"
                : `Delete ${selectedEntityCount} objects`}
            </button>
          </section>
        ) : null}

        {selectedEntityCount > 1 ? (
          <section className="property-group object-info">
            <h3>Object Info</h3>
            <div className="batch-naming">
              <span>{`\u5df2\u9009\u62e9 ${selectedEntityCount} \u4e2a\u5bf9\u8c61`}</span>
            </div>
          </section>
        ) : objectInspectorInfo ? (
          <section className="property-group object-info">
            <h3>Object Info</h3>
            <div className="object-info-rows">
              {objectInspectorInfo.rows.map((row) => (
                <div className="object-info-row" key={row.label}>
                  <span className="object-info-label">{row.label}</span>
                  <span className="object-info-value">{row.value}</span>
                </div>
              ))}
            </div>
            {objectInspectorInfo.lists?.map((list) => (
              <div className="object-info-list" key={list.label}>
                <span className="object-info-label">{list.label}</span>
                {list.items.length > 0 ? (
                  <ul>
                    {list.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="object-info-empty">{list.emptyText}</span>
                )}
              </div>
            ))}
          </section>
        ) : null}

        <section className="property-group">
          <h3>Scene</h3>
          <label>
            Grid size
            <input value={`${displayDocument.settings.gridSize} unit`} readOnly />
          </label>
          <label>
            Drawing plane
            <input value={displayDocument.settings.activeDrawingPlane} readOnly />
          </label>
          <label>
            Coordinate half size
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={displayDocument.settings.coordinateHalfSize}
              onChange={(event) => updateCoordinateHalfSize(event.target.value)}
            />
          </label>
          <div className="setting-button-grid">
            <button
              className={displayDocument.settings.showBoundaryCube ? "active" : ""}
              onClick={() => toggleSetting("showBoundaryCube")}
              type="button"
            >
              Boundary Cube
            </button>
          </div>
          <label>
            Snap to grid
            <input value={displayDocument.settings.snapToGrid ? "On" : "Off"} readOnly />
          </label>
          <label>
            Snap enabled
            <input value={displayDocument.settings.snapEnabled ? "On" : "Off"} readOnly />
          </label>
        </section>

        <section className="property-group">
          <h3>Snap</h3>
          <div className="setting-button-grid">
            <button
              className={displayDocument.settings.snapEnabled ? "active" : ""}
              onClick={() => toggleSetting("snapEnabled")}
              type="button"
            >
              Enabled
            </button>
            <button
              className={displayDocument.settings.snapToGrid ? "active" : ""}
              onClick={() => toggleSetting("snapToGrid")}
              type="button"
            >
              Grid
            </button>
            <button
              className={displayDocument.settings.snapToPoints ? "active" : ""}
              onClick={() => toggleSetting("snapToPoints")}
              type="button"
            >
              Points
            </button>
            <button
              className={displayDocument.settings.snapToSegments ? "active" : ""}
              onClick={() => toggleSetting("snapToSegments")}
              type="button"
            >
              Segments
            </button>
            <button
              className={displayDocument.settings.snapToPlanes ? "active" : ""}
              onClick={() => toggleSetting("snapToPlanes")}
              type="button"
            >
              Planes
            </button>
            <button
              className={displayDocument.settings.snapToOrigin ? "active" : ""}
              onClick={() => toggleSetting("snapToOrigin")}
              type="button"
            >
              Origin
            </button>
            <button
              className={displayDocument.settings.snapToAxes ? "active" : ""}
              onClick={() => toggleSetting("snapToAxes")}
              type="button"
            >
              Axes
            </button>
            <button onClick={() => adjustPointSnapPixelRadius(-1)} type="button">
              Point Radius -
            </button>
            <button onClick={() => adjustPointSnapPixelRadius(1)} type="button">
              Point Radius +
            </button>
            <button onClick={() => adjustSegmentSnapPixelRadius(-1)} type="button">
              Line Radius -
            </button>
            <button onClick={() => adjustSegmentSnapPixelRadius(1)} type="button">
              Line Radius +
            </button>
            <button onClick={() => adjustAxisSnapPixelRadius(-1)} type="button">
              Axis Radius -
            </button>
            <button onClick={() => adjustAxisSnapPixelRadius(1)} type="button">
              Axis Radius +
            </button>
          </div>
          <label>
            Point radius
            <input
              value={`${displayDocument.settings.pointSnapPixelRadius}px`}
              readOnly
            />
          </label>
          <label>
            Line radius
            <input
              value={`${displayDocument.settings.segmentSnapPixelRadius}px`}
              readOnly
            />
          </label>
          <label>
            Axis radius
            <input
              value={`${displayDocument.settings.axisSnapPixelRadius}px`}
              readOnly
            />
          </label>
        </section>

        <section className="property-group">
          <h3>Drawing Plane</h3>
          <div className="setting-button-grid">
            <button
              className={displayDocument.settings.showDrawingPlane ? "active" : ""}
              onClick={() => toggleSetting("showDrawingPlane")}
              type="button"
            >
              Visible
            </button>
            <button
              className={displayDocument.settings.drawingPlaneSolid ? "active" : ""}
              onClick={() => toggleSetting("drawingPlaneSolid")}
              type="button"
            >
              Solid
            </button>
            <button onClick={() => adjustDrawingPlaneOpacity(-1)} type="button">
              Fainter
            </button>
            <button onClick={() => adjustDrawingPlaneOpacity(1)} type="button">
              Clearer
            </button>
          </div>
          <label>
            Opacity
            <input
              value={displayDocument.settings.drawingPlaneOpacity.toFixed(2)}
              readOnly
            />
          </label>
        </section>

          </>
        )}
      </aside>

      {showCoordinatePointModal ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-label="按坐标创建点"
            className="coordinate-point-modal"
            role="dialog"
          >
            <header className="modal-header">
              <h2>按坐标创建点</h2>
              <button
                aria-label="关闭"
                onClick={closeCoordinatePointModal}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="coordinate-point-form">
              {(["x", "y", "z"] as const).map((axis) => (
                <label className="form-field" key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    autoFocus={axis === "x"}
                    inputMode="decimal"
                    value={coordinatePointInput[axis]}
                    onChange={(event) =>
                      updateCoordinatePointInput(axis, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        createCoordinatePoint();
                      }
                    }}
                  />
                </label>
              ))}
              <label className="form-field coordinate-point-name">
                <span>Name (optional)</span>
                <input
                  value={coordinatePointInput.name}
                  onChange={(event) =>
                    updateCoordinatePointInput("name", event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      createCoordinatePoint();
                    }
                  }}
                />
              </label>
              {coordinatePointError ? (
                <span className="form-error">{coordinatePointError}</span>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeCoordinatePointModal} type="button">
                  取消
                </button>
                <button onClick={createCoordinatePoint} type="button">
                  创建点
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {functionSurfaceDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-label="绘制函数曲面"
            className="coordinate-point-modal"
            role="dialog"
          >
            <header className="modal-header">
              <h2>绘制函数曲面</h2>
              <button
                aria-label="关闭"
                onClick={() => setFunctionSurfaceDialog(null)}
                type="button"
              >
                ×
              </button>
            </header>
            <p className="plane2d-dialog-hint">z = f(x, y)</p>
            <div className="coordinate-point-form">
              <label className="form-field coordinate-point-name">
                <span>表达式</span>
                <input
                  autoFocus
                  value={functionSurfaceDialog.expression}
                  onChange={(event) =>
                    setFunctionSurfaceDialog({
                      ...functionSurfaceDialog,
                      expression: event.target.value,
                      error: null,
                    })
                  }
                />
              </label>
              {(
                [
                  ["xMin", "x 最小值"],
                  ["xMax", "x 最大值"],
                  ["yMin", "y 最小值"],
                  ["yMax", "y 最大值"],
                  ["resolutionX", "X 分辨率"],
                  ["resolutionY", "Y 分辨率"],
                  ["opacity", "透明度"],
                ] as const
              ).map(([field, label]) => (
                <label className="form-field" key={field}>
                  <span>{label}</span>
                  <input
                    value={functionSurfaceDialog[field]}
                    onChange={(event) =>
                      setFunctionSurfaceDialog({
                        ...functionSurfaceDialog,
                        [field]: event.target.value,
                        error: null,
                      })
                    }
                  />
                </label>
              ))}
              <label className="checkbox-field">
                <input
                  checked={functionSurfaceDialog.wireframe}
                  onChange={(event) =>
                    setFunctionSurfaceDialog({
                      ...functionSurfaceDialog,
                      wireframe: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>线框模式</span>
              </label>
              {functionSurfaceDialog.error ? (
                <span className="form-error">{functionSurfaceDialog.error}</span>
              ) : null}
              <div className="modal-actions">
                <button onClick={() => setFunctionSurfaceDialog(null)} type="button">
                  取消
                </button>
                <button onClick={confirmFunctionSurfaceDialog} type="button">
                  创建曲面
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <footer className="status-bar">
        <span>
          File: {currentFileName}
          {isDirty ? " *" : ""}
        </span>
        {fileStatusMessage ? <span>{fileStatusMessage}</span> : null}
        <span>工具：{toolLabels[currentTool]}</span>
        <span>绘图平面：{displayDocument.settings.activeDrawingPlane}</span>
        <span>Snap: {displayDocument.settings.snapEnabled ? "On" : "Off"}</span>
        <span>Entities: {entities.length}</span>
        {segmentToolStatus ? <span>{segmentToolStatus}</span> : null}
        {planeToolStatus ? <span>{planeToolStatus}</span> : null}
        {perpendicularToolStatus ? <span>{perpendicularToolStatus}</span> : null}
        {midpointToolStatus ? <span>{midpointToolStatus}</span> : null}
        {extendToolStatus ? <span>{extendToolStatus}</span> : null}
        {parallelToolStatus ? <span>{parallelToolStatus}</span> : null}
        {intersectionToolStatus ? <span>{intersectionToolStatus}</span> : null}
        {pointDragStatus ? <span>{pointDragStatus}</span> : null}
        {measureLengthToolStatus ? <span>{measureLengthToolStatus}</span> : null}
        {measureAngleToolStatus ? <span>{measureAngleToolStatus}</span> : null}
        {calculationToolStatus ? <span>{calculationToolStatus}</span> : null}
        {deleteStatusMessage ? <span>{deleteStatusMessage}</span> : null}
        {coordinatePointStatus ? <span>{coordinatePointStatus}</span> : null}
        {preselectionStatus ? <span>Preselect: {preselectionStatus}</span> : null}
        <span>Raw: {formatVec3(lastPointerInfo?.worldPosition)}</span>
        <span>Snap: {formatVec3(lastSnapResult?.position)}</span>
        <span>Target: {getSnapDescription(lastSnapResult)}</span>
        <span>Point Radius: {displayDocument.settings.pointSnapPixelRadius}px</span>
      </footer>
        </>
      ) : workspaceMode === "plane2d" ? (
        <>
          <section className="plane-workspace">
            {planeCanvasDocument ? (
              <PlaneCanvasViewport
                currentTool={plane2DTool}
                document={planeCanvasDocument}
                initialViewport={plane2DViewportState}
                onChange={updatePlaneCanvasDocument}
                onPendingSegmentPointChange={setPlane2DPendingSegmentPointId}
                onStatus={setPlane2DStatusMessage}
                onToolChange={setPlane2DTool}
                onToast={showToast}
                onViewportChange={setPlane2DViewportState}
                pendingSegmentPointId={plane2DPendingSegmentPointId}
                resetSignal={plane2DResetSignal}
              />
            ) : null}
          </section>
          <aside className="properties-panel plane-properties" aria-label="属性">
            <div className="panel-header">
              <h2>属性</h2>
              <span>
                {hasMultipleSelectedPlane2DPoints
                  ? `已选择 ${selectedPlane2DPointEntities.length} 个点`
                  : selectedPlane2DEntity
                  ? selectedPlane2DEntity.type === "plane2d-point"
                    ? "已选择点"
                    : selectedPlane2DEntity.type === "plane2d-segment"
                      ? "已选择线段"
                    : selectedPlane2DEntity.type === "plane2d-circle"
                      ? "已选择圆"
                    : selectedPlane2DEntity.type === "plane2d-polygon"
                      ? "已选择多边形"
                    : selectedPlane2DEntity.type === "plane2d-extension"
                        ? "已选择延长线"
                    : selectedPlane2DEntity.type === "plane2d-function-graph"
                      ? "已选择函数图像"
                    : selectedPlane2DEntity.type === "plane2d-calculation"
                      ? "已选择计算"
                      : "已选择测量"
                  : "平面画布"}
              </span>
            </div>
            <div className="panel-tabs" role="tablist" aria-label="右侧面板">
              <button
                className={propertiesTab === "properties" ? "active" : ""}
                onClick={() => setPropertiesTab("properties")}
                type="button"
              >
                属性
              </button>
              <button
                className={propertiesTab === "objects" ? "active" : ""}
                onClick={() => setPropertiesTab("objects")}
                type="button"
              >
                对象
              </button>
            </div>
            {propertiesTab === "objects" ? (
              <ObjectListPanel
                groups={plane2DObjectListGroups}
                onDelete={deletePlane2DEntityFromList}
                onSearchQueryChange={setObjectListSearchQuery}
                onSelect={selectPlane2DEntityFromList}
                onToggleVisible={setPlane2DEntityVisibility}
                searchQuery={objectListSearchQuery}
              />
            ) : (
              <>
            {hasMultipleSelectedPlane2DPoints ? (
              <section className="property-group batch-naming name-editor">
                <h3>多点命名</h3>
                <p>已选择 {selectedPlane2DPointEntities.length} 个点。</p>
                <label>
                  起始名称
                  <input
                    value={plane2DBatchNameStart}
                    onChange={(event) =>
                      setPlane2DBatchNameStart(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applyPlane2DBatchNames();
                      }
                    }}
                    placeholder="A 或 P1"
                  />
                </label>
                <button onClick={applyPlane2DBatchNames} type="button">
                  连续命名
                </button>
                <p className="property-hint">
                  A 会生成 A、B、C；P1 会生成 P1、P2、P3。
                </p>
              </section>
            ) : selectedPlane2DEntity ? (
              <section className="property-group name-editor">
                <h3>命名</h3>
                <label>
                  名称
                  <input
                    value={
                      selectedPlane2DEntity.nameSource === "manual"
                        ? selectedPlane2DEntity.name ?? ""
                        : ""
                    }
                    onChange={(event) =>
                      updateSelectedPlane2DName(event.target.value)
                    }
                    placeholder="输入名称后显示"
                  />
                </label>
              </section>
            ) : null}
            {!hasMultipleSelectedPlane2DPoints &&
            selectedPlane2DEntity?.type === "plane2d-point" ? (
              <section className="property-group">
                <h3>
                  {selectedPlane2DEntity.construction?.kind === "segmentIntersection"
                    ? "线段交点"
                    : selectedPlane2DEntity.construction?.kind === "midpoint"
                      ? "中点"
                        : selectedPlane2DEntity.construction?.kind === "perpendicularFoot"
                          ? "垂足"
                        : selectedPlane2DEntity.construction?.kind === "perpendicularEndpoint"
                          ? "垂线端点"
                          : selectedPlane2DEntity.construction?.kind === "copiedCircleRadiusPoint"
                            ? "复制圆半径点"
                          : selectedPlane2DEntity.construction?.kind === "regularPolygonVertex" ||
                            selectedPlane2DEntity.construction?.kind === "regularPolygonVertexBySide"
                            ? "正多边形顶点"
                          : "二维点"}
                </h3>
                <label>
                  坐标
                  <input
                    value={`(${selectedPlane2DEntity.position.x.toFixed(2)}, ${selectedPlane2DEntity.position.y.toFixed(2)})`}
                    readOnly
                  />
                </label>
                <label>
                  构造方式
                  <input
                    value={
                      selectedPlane2DEntity.construction?.kind === "segmentIntersection"
                        ? "线段交点"
                        : selectedPlane2DEntity.construction?.kind === "midpoint"
                          ? "中点"
                          : selectedPlane2DEntity.construction?.kind === "perpendicularFoot"
                            ? "点到线段垂足"
                            : selectedPlane2DEntity.construction?.kind === "perpendicularEndpoint"
                              ? "点在线段上作垂线方向点"
                              : selectedPlane2DEntity.construction?.kind === "copiedCircleRadiusPoint"
                                ? "复制圆半径辅助点"
                              : selectedPlane2DEntity.construction?.kind === "regularPolygonVertex" ||
                                selectedPlane2DEntity.construction?.kind === "regularPolygonVertexBySide"
                                ? "正多边形顶点"
                              : "自由点"
                    }
                    readOnly
                  />
                </label>
                {selectedPlane2DEntity.construction?.kind ===
                "segmentIntersection" ? (
                  <label>
                    来源
                    <input
                      value={
                        selectedPlane2DEntity.construction.edgeA &&
                        selectedPlane2DEntity.construction.edgeB
                          ? `${formatPlane2DIntersectionEdgeRef(
                              selectedPlane2DEntity.construction.edgeA,
                            )} / ${formatPlane2DIntersectionEdgeRef(
                              selectedPlane2DEntity.construction.edgeB,
                            )}`
                          : `${selectedPlane2DEntity.construction.segmentAId ?? "未知"} / ${
                              selectedPlane2DEntity.construction.segmentBId ?? "未知"
                            }`
                      }
                      readOnly
                    />
                  </label>
                ) : null}
                {selectedPlane2DEntity.construction?.kind ===
                "copiedCircleRadiusPoint" ? (
                  <label>
                    来源圆 / 圆心
                    <input
                      value={`${selectedPlane2DEntity.construction.sourceCircleId} / ${selectedPlane2DEntity.construction.centerPointId}`}
                      readOnly
                    />
                  </label>
                ) : null}
                {selectedPlane2DEntity.construction?.kind ===
                "regularPolygonVertex" ||
                selectedPlane2DEntity.construction?.kind ===
                "regularPolygonVertexBySide" ? (
                  <label>
                    多边形 / 序号
                    <input
                      value={`${selectedPlane2DEntity.construction.polygonId} / ${selectedPlane2DEntity.construction.vertexIndex + 1}`}
                      readOnly
                    />
                  </label>
                ) : null}
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-segment" ? (
              <section className="property-group">
                <h3>
                  {selectedPlane2DEntity.segmentKind === "extension"
                    ? "延长线段"
                    : "二维线段"}
                </h3>
                {selectedPlane2DEntity.segmentKind === "extension" ? (
                  <label>
                    构造方式
                    <input
                      value={"垂足在线段外，自动延长目标线段"}
                      readOnly
                    />
                  </label>
                ) : null}
                {selectedPlane2DEntity.construction?.kind ===
                "perpendicularTargetExtension" ? (
                  <>
                    <label>
                      依赖点
                      <input
                        value={selectedPlane2DEntity.construction.pointId}
                        readOnly
                      />
                    </label>
                    <label>
                      依赖线段 / 垂足
                      <input
                        value={`${selectedPlane2DEntity.construction.targetSegmentId} / ${selectedPlane2DEntity.construction.footPointId}`}
                        readOnly
                      />
                    </label>
                  </>
                ) : null}
                <label>
                  端点
                  <input
                    value={`${selectedPlane2DEntity.startPointId} / ${selectedPlane2DEntity.endPointId}`}
                    readOnly
                  />
                </label>
                <label>
                  长度
                  <input
                    value={(() => {
                      const start = planeCanvasDocument
                        ? planeCanvasDocument.entities[
                            selectedPlane2DEntity.startPointId
                          ]
                        : null;
                      const end = planeCanvasDocument
                        ? planeCanvasDocument.entities[
                            selectedPlane2DEntity.endPointId
                          ]
                        : null;

                      return start?.type === "plane2d-point" &&
                        end?.type === "plane2d-point"
                        ? distanceBetweenVec2(
                            start.position,
                            end.position,
                          ).toFixed(2)
                        : "无效";
                    })()}
                    readOnly
                  />
                </label>
                {selectedPlane2DEntity.segmentKind !== "extension" ? (
                  <section className="property-subgroup">
                    <h4>延长部分</h4>
                    {(() => {
                      const extension = getPlane2DExtensionForSegment(
                        selectedPlane2DEntity.id,
                      );

                      if (!extension) {
                        return (
                          <button
                            onClick={() =>
                              createPlane2DExtensionForSegment(
                                selectedPlane2DEntity.id,
                              )
                            }
                            type="button"
                          >
                            创建延长
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={() =>
                            setPlane2DExtensionVisibility(
                              extension.id,
                              extension.visible === false,
                            )
                          }
                          type="button"
                        >
                          {extension.visible === false
                            ? "显示延长部分"
                            : "隐藏延长部分"}
                        </button>
                      );
                    })()}
                  </section>
                ) : null}
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-extension" ? (
              <section className="property-group">
                <h3>延长线段</h3>
                <label>
                  来源线段
                  <input value={selectedPlane2DEntity.targetSegmentId} readOnly />
                </label>
                <label>
                  状态
                  <input
                    value={selectedPlane2DEntity.visible === false ? "隐藏" : "显示"}
                    readOnly
                  />
                </label>
                <button
                  onClick={() =>
                    setPlane2DExtensionVisibility(
                      selectedPlane2DEntity.id,
                      selectedPlane2DEntity.visible === false,
                    )
                  }
                  type="button"
                >
                  {selectedPlane2DEntity.visible === false
                    ? "显示延长部分"
                    : "隐藏延长部分"}
                </button>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-circle" ? (
              <section className="property-group">
                <h3>二维圆</h3>
                <label>
                  构造方式
                  <input
                    value={
                      selectedPlane2DEntity.construction?.kind === "copyCircle"
                        ? "复制圆"
                        : "圆心和半径点"
                    }
                    readOnly
                  />
                </label>
                {selectedPlane2DEntity.construction?.kind === "copyCircle" ? (
                  <label>
                    源圆
                    <input
                      value={selectedPlane2DEntity.construction.sourceCircleId}
                      readOnly
                    />
                  </label>
                ) : null}
                <label>
                  圆心 / 半径点
                  <input
                    value={`${selectedPlane2DEntity.centerPointId} / ${selectedPlane2DEntity.radiusPointId}`}
                    readOnly
                  />
                </label>
                <label>
                  半径
                  <input
                    value={(() => {
                      const center = planeCanvasDocument?.entities[selectedPlane2DEntity.centerPointId];
                      const radiusPoint = planeCanvasDocument?.entities[selectedPlane2DEntity.radiusPointId];

                      return center?.type === "plane2d-point" &&
                        radiusPoint?.type === "plane2d-point"
                        ? distanceBetweenVec2(center.position, radiusPoint.position).toFixed(2)
                        : "无效";
                    })()}
                    readOnly
                  />
                </label>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-polygon" ? (
              <section className="property-group">
                <h3>
                  {selectedPlane2DEntity.polygonKind === "regular"
                    ? `正 ${selectedPlane2DEntity.vertexPointIds.length} 边形`
                    : "多边形"}
                </h3>
                <label>
                  边数
                  <input value={selectedPlane2DEntity.vertexPointIds.length} readOnly />
                </label>
                <label>
                  构造方式
                  <input
                    value={
                      selectedPlane2DEntity.polygonKind === "regular"
                        ? "正多边形"
                        : "自由多边形"
                    }
                    readOnly
                  />
                </label>
                {selectedPlane2DEntity.construction?.kind === "regularPolygon" ? (
                  <>
                    <label>
                      中心点 / 半径点
                      <input
                        value={`${selectedPlane2DEntity.construction.centerPointId} / ${selectedPlane2DEntity.construction.radiusPointId}`}
                        readOnly
                      />
                    </label>
                    <label>
                      半径
                      <input
                        value={(() => {
                          const center =
                            planeCanvasDocument?.entities[
                              selectedPlane2DEntity.construction.centerPointId
                            ];
                          const radiusPoint =
                            planeCanvasDocument?.entities[
                              selectedPlane2DEntity.construction.radiusPointId
                            ];

                          return center?.type === "plane2d-point" &&
                            radiusPoint?.type === "plane2d-point"
                            ? distanceBetweenVec2(
                                center.position,
                                radiusPoint.position,
                              ).toFixed(2)
                            : "无效";
                        })()}
                        readOnly
                      />
                    </label>
                  </>
                ) : null}
                {selectedPlane2DEntity.construction?.kind === "regularPolygonBySide" ? (
                  <>
                    <label>
                      首边端点
                      <input
                        value={`${selectedPlane2DEntity.construction.firstPointId} / ${selectedPlane2DEntity.construction.secondPointId}`}
                        readOnly
                      />
                    </label>
                    <label>
                      方向
                      <input
                        value={selectedPlane2DEntity.construction.side === 1 ? "左侧" : "右侧"}
                        readOnly
                      />
                    </label>
                  </>
                ) : null}
                <label>
                  顶点
                  <input value={selectedPlane2DEntity.vertexPointIds.join(" / ")} readOnly />
                </label>
                <label>
                  状态
                  <input
                    value={
                      planeCanvasDocument &&
                      getPlane2DPolygonPoints(
                        planeCanvasDocument,
                        selectedPlane2DEntity,
                      )
                        ? "有效"
                        : "无效"
                    }
                    readOnly
                  />
                </label>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-measurement" ? (
              <section className="property-group">
                <h3>
                  {selectedPlane2DEntity.measurementKind === "length"
                    ? "长度测量"
                    : "角度测量"}
                </h3>
                <label>
                  测量方式
                  <input
                    value={
                      selectedPlane2DEntity.definition.kind === "segmentLength"
                        ? "线段长度"
                        : selectedPlane2DEntity.definition.kind === "pointDistance"
                          ? "两点距离"
                          : selectedPlane2DEntity.definition.kind === "segmentSegmentAngle"
                            ? "两线段夹角"
                            : "三点角"
                    }
                    readOnly
                  />
                </label>
                <label>
                  当前值
                  <input
                    value={(() => {
                      if (!planeCanvasDocument) {
                        return "无效";
                      }

                      return (
                        getPlane2DMeasurementInfo(
                          planeCanvasDocument,
                          selectedPlane2DEntity,
                        )?.label ?? "无效"
                      );
                    })()}
                    readOnly
                  />
                </label>
                <label>
                  依赖对象
                  <input
                    value={(() => {
                      const definition = selectedPlane2DEntity.definition;

                      if (definition.kind === "segmentLength") {
                        return definition.segmentId;
                      }

                      if (definition.kind === "pointDistance") {
                        return `${definition.pointAId} / ${definition.pointBId}`;
                      }

                      if (definition.kind === "segmentSegmentAngle") {
                        return `${definition.segmentAId} / ${definition.segmentBId}`;
                      }

                      return `${definition.pointAId} / ${definition.vertexPointId} / ${definition.pointCId}`;
                    })()}
                    readOnly
                  />
                </label>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-function-graph" ? (
              <section className="property-group">
                <h3>函数图像</h3>
                <label>
                  表达式 y =
                  <input
                    defaultValue={selectedPlane2DEntity.expression}
                    onBlur={(event) =>
                      updatePlane2DFunctionGraph(selectedPlane2DEntity.id, {
                        expression: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  x 最小值
                  <input
                    type="number"
                    defaultValue={selectedPlane2DEntity.xMin}
                    onBlur={(event) =>
                      updatePlane2DFunctionGraph(selectedPlane2DEntity.id, {
                        xMin: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  x 最大值
                  <input
                    type="number"
                    defaultValue={selectedPlane2DEntity.xMax}
                    onBlur={(event) =>
                      updatePlane2DFunctionGraph(selectedPlane2DEntity.id, {
                        xMax: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  采样数
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    defaultValue={selectedPlane2DEntity.sampleCount}
                    onBlur={(event) =>
                      updatePlane2DFunctionGraph(selectedPlane2DEntity.id, {
                        sampleCount: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  状态
                  <input
                    value={
                      selectedPlane2DEntity.visible === false ? "隐藏" : "显示"
                    }
                    readOnly
                  />
                </label>
                <button
                  onClick={() =>
                    setPlane2DEntityVisibility(
                      selectedPlane2DEntity.id,
                      selectedPlane2DEntity.visible === false,
                    )
                  }
                  type="button"
                >
                  {selectedPlane2DEntity.visible === false ? "显示" : "隐藏"}
                </button>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : selectedPlane2DEntity?.type === "plane2d-calculation" ? (
              <section className="property-group">
                <h3>计算</h3>
                <label>
                  公式
                  <span className="property-formula-preview">
                    <FormulaView
                      expression={selectedPlane2DEntity.expression}
                      getReferenceLabel={(targetId) => {
                        const entity = planeCanvasDocument?.entities[targetId];

                        if (!entity) {
                          return "引用失效";
                        }

                        if (entity.type === "plane2d-segment") {
                          return `|${entity.name?.trim() || entity.id}|`;
                        }

                        return entity.name?.trim() || entity.id;
                      }}
                    />
                  </span>
                </label>
                <label>
                  当前值
                  <input
                    value={(() => {
                      if (!planeCanvasDocument) {
                        return "引用失效";
                      }

                      const result = evaluatePlane2DCalculation(
                        planeCanvasDocument,
                        selectedPlane2DEntity.expression,
                      );

                      return result.ok
                        ? formatCalculationValue(result.value)
                        : result.error;
                    })()}
                    readOnly
                  />
                </label>
                <label>
                  标签位置
                  <input
                    value={`(${selectedPlane2DEntity.labelPosition.x.toFixed(2)}, ${selectedPlane2DEntity.labelPosition.y.toFixed(2)})`}
                    readOnly
                  />
                </label>
                <button
                  className="danger-button"
                  onClick={deleteSelectedPlane2DEntities}
                  type="button"
                >
                  删除对象
                </button>
              </section>
            ) : hasMultipleSelectedPlane2DPoints ? null : (
              <section className="property-group">
                <h3>平面画布</h3>
                <label>
                  名称
                  <input
                    value={planeCanvasDocument?.name ?? "未命名平面画布"}
                    readOnly
                  />
                </label>
                <label>
                  类型
                  <input value="平面画布" readOnly />
                </label>
                <label>
                  工具
                  <input value={plane2DTool} readOnly />
                </label>
                <label>
                  对象
                  <input
                    value={`点 ${plane2DPoints.length} / 线段 ${plane2DSegments.length} / 延长 ${plane2DExtensions.length} / 圆 ${plane2DCircles.length} / 多边形 ${plane2DPolygons.length} / 函数 ${plane2DFunctionGraphs.length} / 测量 ${plane2DMeasurements.length} / 计算 ${plane2DCalculations.length}`}
                    readOnly
                  />
                </label>
              </section>
            )}
              </>
            )}
          </aside>
          <footer className="status-bar">
            <span>工作区：平面画布</span>
            {fileStatusMessage ? <span>{fileStatusMessage}</span> : null}
            {plane2DStatusMessage ? <span>{plane2DStatusMessage}</span> : null}
            <span>工具：{plane2DTool}</span>
            <span>点：{plane2DPoints.length}</span>
            <span>线段：{plane2DSegments.length}</span>
            <span>延长：{plane2DExtensions.length}</span>
            <span>多边形：{plane2DPolygons.length}</span>
            <span>函数：{plane2DFunctionGraphs.length}</span>
            <span>测量：{plane2DMeasurements.length}</span>
            <span>计算：{plane2DCalculations.length}</span>
          </footer>
        </>
      ) : (
        <section className="start-screen" aria-label="起始页">
          <div className="start-screen-content">
            <h1>Solid Geometry Studio</h1>
            <p>请选择一个画布开始。</p>
            <div className="start-screen-actions">
              <button onClick={newProject} type="button">
                新建三维画布
              </button>
              <button onClick={newPlaneCanvas} type="button">
                新建平面画布
              </button>
              <button onClick={() => void openProject()} type="button">
                打开文件
              </button>
            </div>
          </div>
        </section>
      )}

      {toastMessage ? (
        <div className="toast-message" role="status">
          {toastMessage.text}
        </div>
      ) : null}
    </main>
  );
}

export default App;


