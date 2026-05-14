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
import SceneViewport from "./components/SceneViewport";
import { AddMeasurementCommand } from "./core/command/AddMeasurementCommand";
import { AddPointCommand } from "./core/command/AddPointCommand";
import { AddSegmentCommand } from "./core/command/AddSegmentCommand";
import type { Command } from "./core/command/Command";
import { CommandManager } from "./core/command/CommandManager";
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
  EntityId,
  EntityStyle,
  MeasurementEntity,
  PointEntity,
  SegmentEntity,
} from "./core/document/EntityTypes";
import { createEntityId } from "./core/document/idGenerator";
import { generatePointNames } from "./core/document/pointNameUtils";
import {
  areVec3Equal,
  cloneVec3,
  createVec3,
} from "./core/geometry/geometryUtils";
import {
  calculateMeasurementValue,
  getLinePlaneAngleByPointIds,
  getLinePlaneAngleBySegmentId,
  getAngleByPointIds,
  getPointDistanceByIds,
  getSegmentLengthById,
} from "./core/geometry/measurementUtils";
import type { Vec3 } from "./core/geometry/Vec3";
import { exportProject } from "./core/io/exportProject";
import { importProject } from "./core/io/importProject";
import { getSnapResult } from "./core/snap/SnapSystem";
import type { SnapResult } from "./core/snap/SnapTypes";
import { MeasureAngleTool } from "./core/tool/MeasureAngleTool";
import { MeasureLengthTool } from "./core/tool/MeasureLengthTool";
import { PointTool } from "./core/tool/PointTool";
import { SegmentTool } from "./core/tool/SegmentTool";
import { SelectTool } from "./core/tool/SelectTool";
import type { ToolContext } from "./core/tool/ToolContext";
import type { PointerInfo, ToolName } from "./core/tool/ToolTypes";
import { isTauriEnvironment } from "./platform/platform";

type PointCreationMode = "free" | "coordinate";
type AngleMeasureMode = "threePoint" | "linePlane";

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

const constructTools: Array<{
  readonly name: ToolName;
  readonly label: string;
  readonly icon: ElementType;
  readonly disabled?: boolean;
}> = [
  { name: "select", label: "\u9009\u62e9", icon: MousePointer2 },
  { name: "point", label: "\u70b9", icon: SolidPointIcon },
  { name: "segment", label: "\u7ebf\u6bb5", icon: Ruler },
];

const measureTools: Array<{
  readonly name: ToolName;
  readonly label: string;
  readonly icon: ElementType;
}> = [
  { name: "measureLength", label: "\u957f\u5ea6", icon: Ruler },
  { name: "measureAngle", label: "\u89d2\u5ea6", icon: Ruler },
];

const toolLabels: Record<ToolName, string> = {
  select: "\u9009\u62e9",
  point: "\u70b9",
  segment: "\u7ebf\u6bb5",
  move: "\u79fb\u52a8",
  measureLength: "\u957f\u5ea6",
  measureAngle: "\u89d2\u5ea6",
};

const drawingPlanes: readonly ActiveDrawingPlane[] = ["XY", "XZ", "YZ"];

const TEST_POINT_A_ID = "debug-point-a";
const TEST_POINT_B_ID = "debug-point-b";
const TEST_SEGMENT_AB_ID = "debug-segment-ab";
const DEFAULT_POINT_COLOR = "#2563eb";
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

interface PointDragState {
  readonly pointId: EntityId;
  readonly oldPosition: Vec3;
  latestPosition: Vec3;
}

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

const getEntityDetail = (entity: BoardEntity, document: BoardDocument): string => {
  switch (entity.kind) {
    case "point":
      return formatVec3(entity.position);
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
  statusMessage: string | null,
  document: BoardDocument,
): string | null => {
  if (currentTool !== "measureAngle") {
    return null;
  }

  if (statusMessage) {
    return statusMessage;
  }

  if (angleMeasureMode === "linePlane") {
    return "请选择一条线段，测量其与 XY 平面的夹角";
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
  const [document, setDocument] = useState(() =>
    createEmptyDocument({ name: "Untitled Board" }),
  );
  const [currentTool, setCurrentTool] = useState<ToolName>("select");
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [lastPointerInfo, setLastPointerInfo] = useState<PointerInfo | null>(
    null,
  );
  const [lastSnapResult, setLastSnapResult] = useState<SnapResult | null>(null);
  const [segmentFirstPointId, setSegmentFirstPointId] =
    useState<EntityId | null>(null);
  const [measureFirstPointId, setMeasureFirstPointId] =
    useState<EntityId | null>(null);
  const [measureStatusMessage, setMeasureStatusMessage] = useState<string | null>(
    null,
  );
  const [angleSelectedPointIds, setAngleSelectedPointIds] = useState<
    readonly EntityId[]
  >([]);
  const [angleStatusMessage, setAngleStatusMessage] = useState<string | null>(
    null,
  );
  const [deleteStatusMessage, setDeleteStatusMessage] = useState<string | null>(
    null,
  );
  const [batchNameStart, setBatchNameStart] = useState("A");
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
  const [showPointToolPanel, setShowPointToolPanel] = useState(false);
  const [showCoordinatePointModal, setShowCoordinatePointModal] =
    useState(false);
  const [angleMeasureMode, setAngleMeasureMode] =
    useState<AngleMeasureMode>("threePoint");
  const [showAngleToolPanel, setShowAngleToolPanel] = useState(false);
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
  const commandManagerRef = useRef<CommandManager | null>(null);
  const pointDragStateRef = useRef<PointDragState | null>(null);
  const pointToolRef = useRef(new PointTool());
  const segmentToolRef = useRef(new SegmentTool());
  const measureLengthToolRef = useRef(new MeasureLengthTool());
  const measureAngleToolRef = useRef(new MeasureAngleTool());
  const selectToolRef = useRef(new SelectTool());

  if (!commandManagerRef.current) {
    commandManagerRef.current = new CommandManager(document);
  }

  const commandManager = commandManagerRef.current;
  const displayDocument = dragPreviewDocument ?? document;
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
  const hasPointA = Boolean(displayDocument.entities[TEST_POINT_A_ID]);
  const hasPointB = Boolean(displayDocument.entities[TEST_POINT_B_ID]);
  const hasSegmentAB = Boolean(displayDocument.entities[TEST_SEGMENT_AB_ID]);
  const currentFileName = currentFilePath
    ? currentFilePath.split(/[\\/]/).pop() ?? currentFilePath
    : "Untitled.sgb";
  const previewPosition =
    (currentTool === "point" && pointCreationMode === "free") ||
    currentTool === "segment"
      ? lastSnapResult?.position ?? null
      : null;
  const segmentPreviewStartPosition =
    currentTool === "segment" &&
    segmentFirstPointId &&
    displayDocument.entities[segmentFirstPointId]?.kind === "point"
      ? displayDocument.entities[segmentFirstPointId].position
      : null;
  const segmentToolStatus = getSegmentToolStatus(
    currentTool,
    segmentFirstPointId,
    entities,
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
    angleStatusMessage,
    displayDocument,
  );
  const pointDragStatus =
    draggedPointId && displayDocument.entities[draggedPointId]?.kind === "point"
      ? `Moving point ${getPointDisplayName(
          displayDocument.entities[draggedPointId],
        )}`
      : null;
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
    angleSelectedPointIds.forEach(addPointId);

    return [...new Set(pointIds)];
  }, [
    angleSelectedPointIds,
    displayDocument.entities,
    displayDocument.selectedEntityIds,
    draggedPointId,
    measureFirstPointId,
    segmentFirstPointId,
  ]);

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
  };

  const resetTransientToolState = () => {
    cancelPointDrag();
    segmentToolRef.current.cancel();
    measureLengthToolRef.current.cancel();
    measureAngleToolRef.current.cancel();
    setSegmentFirstPointId(null);
    setMeasureFirstPointId(null);
    setMeasureStatusMessage(null);
    setAngleSelectedPointIds([]);
    setAngleStatusMessage(null);
    setLastPointerInfo(null);
    setLastSnapResult(null);
  };

  const resetProjectDocument = (
    nextDocument: BoardDocument,
    nextFilePath: string | null,
  ) => {
    const sanitizedDocument = sanitizeSelection({
      ...nextDocument,
      selectedEntityIds: [],
    });

    commandManager.reset(sanitizedDocument);
    setDocument(sanitizedDocument);
    setCurrentFilePath(nextFilePath);
    setIsDirty(false);
    setCurrentTool("select");
    resetTransientToolState();
  };

  const showFileError = async (title: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);

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
    const safeDocumentName = (document.name || "Untitled Board")
      .replace(/[<>:"\/\\|?*]+/g, "-")
      .trim();

    return `${safeDocumentName || "Untitled Board"}.sgb`;
  };

  const ensureProjectFileExtension = (filePath: string) =>
    /\.(sgb|json)$/i.test(filePath) ? filePath : `${filePath}.sgb`;

  const getDownloadFileName = () =>
    ensureProjectFileExtension(currentFileName || getDefaultProjectFileName());

  const downloadProjectInBrowser = (fileName: string) => {
    const projectJson = exportProject(commandManager.getDocument());
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

    await writeTextFile(filePath, exportProject(commandManager.getDocument()));
    setCurrentFilePath(filePath);
    setIsDirty(false);
    setFileStatusMessage("Saved");
  };

  const newProject = () => {
    resetProjectDocument(createEmptyDocument({ name: "Untitled Board" }), null);
    setFileStatusMessage("New project");
  };

  const openProject = async () => {
    try {
      if (!isTauriEnvironment()) {
        const browserFile = await readProjectInBrowser();

        if (!browserFile) {
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

      const jsonText = await readTextFile(selectedFilePath);
      const importedDocument = importProject(jsonText);

      resetProjectDocument(importedDocument, selectedFilePath);
      setFileStatusMessage("Opened");
    } catch (error) {
      setFileStatusMessage("Open failed");
      await showFileError("Open failed", error);
    }
  };

  const saveProjectAs = async () => {
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

  const renamePoint = (point: PointEntity, nextName: string) => {
    const trimmedName = nextName.trim();

    if (!trimmedName) {
      return false;
    }

    if (trimmedName !== point.name || point.nameSource !== "manual") {
      updateEntity(point.id, {
        name: trimmedName,
        nameSource: "manual",
      });
    }

    return true;
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
        )}${getCompactPointNameById(currentDocument, endPointId)} 与 XY 面`;
      }
    }

    if (targetIds.length === 2) {
      return `${getCompactPointNameById(
        currentDocument,
        targetIds[0],
      )}${getCompactPointNameById(currentDocument, targetIds[1])} 与 XY 面`;
    }

    return "线段与 XY 面";
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
      `已测量 ${measurement.name}夹角：${formatAngleValue(value)}`,
    );
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
    const previousDocument = commandManager.getDocument();
    const nextDocument = commandManager.undo();

    syncDocumentState(nextDocument);

    if (nextDocument !== previousDocument) {
      setIsDirty(true);
    }
  };

  const redo = () => {
    const previousDocument = commandManager.getDocument();
    const nextDocument = commandManager.redo();

    syncDocumentState(nextDocument);

    if (nextDocument !== previousDocument) {
      setIsDirty(true);
    }
  };

  const updateDocumentSettings = (
    update: Partial<typeof document.settings>,
  ) => {
    executeCommand(new UpdateDocumentSettingsCommand(update));
  };

  const setDrawingPlane = (activeDrawingPlane: ActiveDrawingPlane) => {
    updateDocumentSettings({ activeDrawingPlane });
  };

  const activatePointFreeMode = () => {
    setPointCreationMode("free");
    setShowPointToolPanel(false);
    setShowAngleToolPanel(false);
    setShowCoordinatePointModal(false);
    setCoordinatePointError(null);
    changeTool("point");
  };

  const openPointToolPanel = () => {
    setShowPointToolPanel((isOpen) => !isOpen);
    setShowAngleToolPanel(false);
    changeTool("point");
  };

  const activateCoordinatePointMode = () => {
    setPointCreationMode("coordinate");
    setShowPointToolPanel(false);
    setShowAngleToolPanel(false);
    setShowCoordinatePointModal(true);
    setCoordinatePointError(null);
    changeTool("point");
  };

  const activateThreePointAngleMode = () => {
    setAngleMeasureMode("threePoint");
    setShowAngleToolPanel(false);
    setShowPointToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
    setAngleStatusMessage(null);
    changeTool("measureAngle");
  };

  const openAngleToolPanel = () => {
    setShowAngleToolPanel((isOpen) => !isOpen);
    setShowPointToolPanel(false);
    setShowCoordinatePointModal(false);
    changeTool("measureAngle");
  };

  const activateLinePlaneAngleMode = () => {
    setAngleMeasureMode("linePlane");
    setShowAngleToolPanel(false);
    setShowPointToolPanel(false);
    measureAngleToolRef.current.cancel();
    setAngleSelectedPointIds([]);
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
      setCoordinatePointError("坐标过大，请输入 -10000 到 10000 之间的值");
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
      `已创建点 ${point.name ?? point.id} (${formatCoordinate(x)}, ${formatCoordinate(
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
      | "snapToOrigin"
      | "snapToAxes"
      | "showDrawingPlane"
      | "drawingPlaneSolid",
  ) => {
    updateDocumentSettings({
      [settingName]: !document.settings[settingName],
    });
  };

  const adjustPointSnapPixelRadius = (direction: -1 | 1) => {
    updateDocumentSettings({
      pointSnapPixelRadius: clamp(
        document.settings.pointSnapPixelRadius +
          direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_POINT_SNAP_PIXEL_RADIUS,
        MAX_POINT_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustSegmentSnapPixelRadius = (direction: -1 | 1) => {
    updateDocumentSettings({
      segmentSnapPixelRadius: clamp(
        document.settings.segmentSnapPixelRadius +
          direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_SEGMENT_SNAP_PIXEL_RADIUS,
        MAX_SEGMENT_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustAxisSnapPixelRadius = (direction: -1 | 1) => {
    updateDocumentSettings({
      axisSnapPixelRadius: clamp(
        document.settings.axisSnapPixelRadius + direction * SNAP_PIXEL_RADIUS_STEP,
        MIN_AXIS_SNAP_PIXEL_RADIUS,
        MAX_AXIS_SNAP_PIXEL_RADIUS,
      ),
    });
  };

  const adjustDrawingPlaneOpacity = (direction: -1 | 1) => {
    updateDocumentSettings({
      drawingPlaneOpacity: clamp(
        document.settings.drawingPlaneOpacity +
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

    pointDragStateRef.current = {
      pointId: entity.id,
      oldPosition: cloneVec3(entity.position),
      latestPosition: cloneVec3(entity.position),
    };
    setDraggedPointId(entity.id);
    selectEntity(entity.id);
  };

  const handleSelectPointDragMove = (pointerInfo: PointerInfo) => {
    const dragState = pointDragStateRef.current;
    const nextPosition = getDragPosition(pointerInfo);

    if (!dragState || !nextPosition) {
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
    setDragPreviewDocument(
      createPointMovePreviewDocument(
        commandManager.getDocument(),
        dragState.pointId,
        nextPosition,
      ),
    );
  };

  const handleSelectPointDragEnd = (pointerInfo: PointerInfo) => {
    const dragState = pointDragStateRef.current;

    if (!dragState) {
      return;
    }

    const finalPosition =
      getDragPosition(pointerInfo) ?? cloneVec3(dragState.latestPosition);
    const { pointId, oldPosition } = dragState;

    cancelPointDrag();

    if (!isDragPositionSafe(finalPosition, dragState.latestPosition)) {
      setSelection([pointId]);
      return;
    }

    if (!areVec3Equal(oldPosition, finalPosition)) {
      executeCommand(new MovePointCommand(pointId, oldPosition, finalPosition));
    }

    setSelection([pointId]);
  };

  const handleCanvasPointerMove = (pointerInfo: PointerInfo) => {
    const snapResult = getPointerSnapResult(pointerInfo);
    const nextPointerInfo: PointerInfo = {
      ...pointerInfo,
      snapResult,
    };

    setLastPointerInfo(nextPointerInfo);
    setLastSnapResult(snapResult);
  };

  const handleCanvasPointerDown = (pointerInfo: PointerInfo) => {
    const snapResult = getPointerSnapResult(pointerInfo);
    const nextPointerInfo: PointerInfo = {
      ...pointerInfo,
      snapResult,
    };

    setLastPointerInfo(nextPointerInfo);
    setLastSnapResult(snapResult);

    if (currentTool === "select") {
      selectToolRef.current.onPointerDown(nextPointerInfo, createToolContext());
      return;
    }

    if (currentTool === "point") {
      if (pointCreationMode !== "free") {
        return;
      }

      pointToolRef.current.onPointerDown(nextPointerInfo, createToolContext());
      return;
    }

    if (currentTool === "segment") {
      segmentToolRef.current.onPointerDown(nextPointerInfo, createToolContext());
      setSegmentFirstPointId(segmentToolRef.current.getFirstPointId());
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
      if (angleMeasureMode === "linePlane") {
        if (
          nextPointerInfo.hitEntityId &&
          nextPointerInfo.hitEntityType === "segment"
        ) {
          addLinePlaneAngleMeasurement([nextPointerInfo.hitEntityId]);
        } else if (
          nextPointerInfo.snapResult?.type === "segment" &&
          nextPointerInfo.snapResult.targetEntityId
        ) {
          addLinePlaneAngleMeasurement([
            nextPointerInfo.snapResult.targetEntityId,
          ]);
        } else {
          setAngleStatusMessage("请选择一条线段，测量其与 XY 平面的夹角");
        }

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
    if (additive) {
      toggleSelection(entityId);
      return;
    }

    selectEntity(entityId);
  };

  const changeTool = (nextTool: ToolName) => {
    if (nextTool !== "point") {
      setShowPointToolPanel(false);
      setShowCoordinatePointModal(false);
    }

    if (nextTool !== "measureAngle") {
      setShowAngleToolPanel(false);
    }

    if (currentTool === "segment" && nextTool !== "segment") {
      segmentToolRef.current.cancel();
      setSegmentFirstPointId(null);
    }

    if (currentTool === "measureLength" && nextTool !== "measureLength") {
      measureLengthToolRef.current.cancel();
      setMeasureFirstPointId(null);
      setMeasureStatusMessage(null);
    }

    if (currentTool === "measureAngle" && nextTool !== "measureAngle") {
      measureAngleToolRef.current.cancel();
      setAngleSelectedPointIds([]);
      setAngleStatusMessage(null);
    }

    setCurrentTool(nextTool);
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
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !isEditingText(event.target)
      ) {
        if (commandManager.getDocument().selectedEntityIds.length > 0) {
          event.preventDefault();
          deleteSelectedEntities();
        }

        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (pointDragStateRef.current) {
        cancelPointDrag();
        return;
      }

      if (showCoordinatePointModal) {
        closeCoordinatePointModal();
        return;
      }

      if (showPointToolPanel) {
        setShowPointToolPanel(false);
        return;
      }

      if (showAngleToolPanel) {
        setShowAngleToolPanel(false);
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

      if (commandManager.getDocument().selectedEntityIds.length > 0) {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <main className="app-shell">
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
                    title="点工具方式"
                    type="button"
                  >
                    <span>{showPointToolPanel ? "<" : ">"}</span>
                  </button>
                </div>
              ) : (
                <button
                  className={
                    currentTool === name ? "tool-button active" : "tool-button"
                  }
                  disabled={disabled}
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
              <span>Snap Enabled</span>
            </button>
            <div className="tool-button-grid">
              {[
                ["snapToGrid", "Grid"],
                ["snapToPoints", "Points"],
                ["snapToAxes", "Axes"],
                ["snapToSegments", "Segments"],
                ["snapToOrigin", "Origin"],
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
        <div className="point-tool-flyout" role="menu" aria-label="点工具方式">
          <button
            className={pointCreationMode === "free" ? "active" : ""}
            onClick={activatePointFreeMode}
            type="button"
          >
            自由画点
          </button>
          <button
            className={pointCreationMode === "coordinate" ? "active" : ""}
            onClick={activateCoordinatePointMode}
            type="button"
          >
            坐标画点
          </button>
        </div>
      ) : null}

      {showAngleToolPanel ? (
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
            className={angleMeasureMode === "linePlane" ? "active" : ""}
            onClick={activateLinePlaneAngleMode}
            type="button"
          >
            线面角
          </button>
        </div>
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
            <div className="debug-actions" aria-label="Project file commands">
              <button onClick={newProject} type="button">
                新建
              </button>
              <button onClick={() => void openProject()} type="button">
                打开
              </button>
              <button onClick={() => void saveProject()} type="button">
                保存
              </button>
              <button onClick={() => void saveProjectAs()} type="button">
                另存为
              </button>
            </div>
            <div className="debug-actions" aria-label="Debug geometry commands">
              <button disabled={hasPointA} onClick={addTestPointA} type="button">
                {"\u6dfb\u52a0\u6d4b\u8bd5\u70b9 A"}
              </button>
              <button disabled={hasPointB} onClick={addTestPointB} type="button">
                {"\u6dfb\u52a0\u6d4b\u8bd5\u70b9 B"}
              </button>
              <button
                disabled={!hasPointA || !hasPointB || hasSegmentAB}
                onClick={addTestSegmentAB}
                type="button"
              >
                {"\u6dfb\u52a0\u6d4b\u8bd5\u7ebf\u6bb5 AB"}
              </button>
              <button
                disabled={!commandManager.canUndo()}
                onClick={undo}
                type="button"
              >
                {"\u64a4\u9500"}
              </button>
              <button
                disabled={!commandManager.canRedo()}
                onClick={redo}
                type="button"
              >
                {"\u91cd\u505a"}
              </button>
            </div>
          </div>
        </div>
        <SceneViewport
          currentTool={currentTool}
          document={displayDocument}
          focusRequestId={focusRequestId}
          highlightedPointIds={highlightedPointIds}
          isDraggingPoint={draggedPointId !== null}
          previewPosition={previewPosition}
          segmentPreviewStartPosition={segmentPreviewStartPosition}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onSelectPointDragStart={handleSelectPointDragStart}
          onSelectPointDragMove={handleSelectPointDragMove}
          onSelectPointDragEnd={handleSelectPointDragEnd}
          onSelectPointDragCancel={cancelPointDrag}
          onOverlayEntityPointerDown={handleOverlayEntityPointerDown}
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

        {selectedEntityCount > 0 ? (
          <section className="property-group selection-actions">
            <h3>Selection</h3>
            {singleSelectedEntity?.kind === "point" ? (
              <label>
                Name
                <input
                  defaultValue={singleSelectedEntity.name ?? ""}
                  key={singleSelectedEntity.id}
                  onBlur={(event) => {
                    if (
                      !renamePoint(
                        singleSelectedEntity,
                        event.currentTarget.value,
                      )
                    ) {
                      event.currentTarget.value = singleSelectedEntity.name ?? "";
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
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

        <section className="property-group">
          <h3>Objects</h3>
          {entities.length > 0 ? (
            <ul className="entity-list">
              {entities.map((entity: BoardEntity) => (
                <li
                  className={
                    displayDocument.selectedEntityIds.includes(entity.id)
                      ? "entity-list-item selected"
                      : "entity-list-item"
                  }
                  key={entity.id}
                  onClick={(event) => {
                    if (event.ctrlKey) {
                      toggleSelection(entity.id);
                      return;
                    }

                    selectEntity(entity.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectEntity(entity.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="entity-list-main">
                    <span className="entity-name">{entity.name ?? entity.id}</span>
                    <span className="entity-detail">
                      {getEntityDetail(entity, displayDocument)}
                    </span>
                  </span>
                  <span className="entity-kind-pill">{entity.kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No geometry entities in the document.</div>
          )}
        </section>
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
                <span>Name，可选</span>
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

      <footer className="status-bar">
        <span>
          File: {currentFileName}
          {isDirty ? " *" : ""}
        </span>
        {fileStatusMessage ? <span>{fileStatusMessage}</span> : null}
        <span>Tool: {toolLabels[currentTool]}</span>
        <span>Plane: {displayDocument.settings.activeDrawingPlane}</span>
        <span>Snap: {displayDocument.settings.snapEnabled ? "On" : "Off"}</span>
        <span>Entities: {entities.length}</span>
        {segmentToolStatus ? <span>{segmentToolStatus}</span> : null}
        {pointDragStatus ? <span>{pointDragStatus}</span> : null}
        {measureLengthToolStatus ? <span>{measureLengthToolStatus}</span> : null}
        {measureAngleToolStatus ? <span>{measureAngleToolStatus}</span> : null}
        {deleteStatusMessage ? <span>{deleteStatusMessage}</span> : null}
        {coordinatePointStatus ? <span>{coordinatePointStatus}</span> : null}
        <span>Raw: {formatVec3(lastPointerInfo?.worldPosition)}</span>
        <span>Snap: {formatVec3(lastSnapResult?.position)}</span>
        <span>Target: {getSnapDescription(lastSnapResult)}</span>
        <span>Point Radius: {displayDocument.settings.pointSnapPixelRadius}px</span>
      </footer>
    </main>
  );
}

export default App;
