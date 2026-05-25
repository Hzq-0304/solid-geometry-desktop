import { useEffect, useMemo, useRef, useState } from "react";
import FloatingSubmenu from "./FloatingSubmenu";
import type {
  Plane2DCircleEntity,
  Plane2DEntity,
  Plane2DExtensionEntity,
  Plane2DMeasurementEntity,
  Plane2DPointEntity,
  Plane2DPolygonEntity,
  Plane2DSegmentEntity,
  Plane2DToolName,
  PlaneCanvasDocument,
  Vec2,
} from "../core/plane2d/PlaneCanvasTypes";
import {
  createPlane2DCalculation,
  createPlane2DCircle,
  createPlane2DExtension,
  createPlane2DMeasurement,
  createPlane2DPoint,
  createPlane2DPolygon,
  createPlane2DSegment,
  computeSegmentIntersection2D,
  distanceBetweenVec2,
  getClosestPointOnSegment2D,
  getPerpendicularEndpointOnLine2D,
  getPerpendicularFootOnLine2D,
  getPlane2DCircleGeometry,
  getPlane2DCalculationInfo,
  getPlane2DMeasurementInfo,
  getPlane2DPointPosition,
  getPlane2DPolygonPoints,
  getPlane2DSegmentPositions,
  getRegularPolygonVerticesBySide,
  getSignedPerpendicularSide2D,
  midpointVec2,
  plane2DMidpointId,
  plane2DPerpendicularEndpointId,
  plane2DPerpendicularFootId,
  plane2DExtensionId,
  syncPlane2DConstructions,
  evaluatePlane2DCalculation,
} from "../core/plane2d/planeCanvasUtils";
import type { Plane2DDocumentChangeOptions } from "../core/plane2d/plane2DHistory";
import FormulaView from "../core/calculation/FormulaView";
import type { CalculationExpression } from "../core/calculation/CalculationTypes";
import { formatCalculationValue } from "../core/calculation/calculationUnits";
import type { Plane2DCalculationEntity } from "../core/plane2d/PlaneCanvasTypes";

interface PlaneCanvasViewportProps {
  readonly document: PlaneCanvasDocument;
  readonly currentTool: Plane2DToolName;
  readonly pendingSegmentPointId: string | null;
  readonly resetSignal: number;
  readonly initialViewport?: Plane2DViewportState;
  readonly onChange: (
    document: PlaneCanvasDocument,
    dirty?: boolean,
    options?: Plane2DDocumentChangeOptions,
  ) => void;
  readonly onViewportChange?: (viewport: Plane2DViewportState) => void;
  readonly onToolChange: (tool: Plane2DToolName) => void;
  readonly onPendingSegmentPointChange: (pointId: string | null) => void;
  readonly onStatus: (message: string | null) => void;
  readonly onToast?: (message: string) => void;
}

type Plane2DSnapResult =
  | { readonly type: "point"; readonly position: Vec2; readonly entityId: string }
  | { readonly type: "segment"; readonly position: Vec2; readonly entityId: string }
  | { readonly type: "extension"; readonly position: Vec2; readonly entityId: string }
  | { readonly type: "circle"; readonly position: Vec2; readonly entityId: string }
  | { readonly type: "none"; readonly position: Vec2 };

type Plane2DPickResult =
  | { readonly kind: "point"; readonly pointId: string; readonly distancePx: number }
  | {
      readonly kind: "segment";
      readonly segmentId: string;
      readonly distancePx: number;
      readonly closestWorld: Vec2;
    }
  | {
      readonly kind: "extension";
      readonly extensionId: string;
      readonly part: "start" | "end";
      readonly distancePx: number;
      readonly closestWorld: Vec2;
    }
  | { readonly kind: "circle"; readonly circleId: string; readonly distancePx: number }
  | { readonly kind: "polygon"; readonly polygonId: string; readonly distancePx: number }
  | {
      readonly kind: "measurement";
      readonly measurementId: string;
      readonly distancePx: number;
    }
  | {
      readonly kind: "calculation";
      readonly calculationId: string;
      readonly distancePx: number;
    };

type Plane2DViewportState = {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
};

type Plane2DInteractionState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "pendingClick";
      readonly pointerId: number;
      readonly startClientX: number;
      readonly startClientY: number;
      readonly startPanX: number;
      readonly startPanY: number;
      readonly ctrlKey: boolean;
    }
  | { readonly kind: "dragPoint"; readonly pointerId: number; readonly pointId: string }
  | {
      readonly kind: "pan";
      readonly pointerId: number;
      readonly startClientX: number;
      readonly startClientY: number;
      readonly startPanX: number;
      readonly startPanY: number;
    };

type CoordinateDialogState = {
  readonly x: string;
  readonly y: string;
  readonly error: string | null;
};

type PerpendicularFirstTarget =
  | { readonly kind: "point"; readonly pointId: string }
  | { readonly kind: "segment"; readonly segmentId: string };

type PerpendicularDirectionPickState = {
  readonly pointId: string;
  readonly segmentId: string;
  readonly side: 1 | -1;
  readonly length: number;
};

type PerpendicularPreview =
  | { readonly kind: "foot"; readonly start: Vec2; readonly end: Vec2 }
  | { readonly kind: "direction"; readonly start: Vec2; readonly end: Vec2; readonly side: 1 | -1; readonly length: number };

type AngleFirstTarget =
  | { readonly kind: "point"; readonly pointId: string }
  | { readonly kind: "segment"; readonly segmentId: string };

type Plane2DPolygonVariant =
  | { readonly kind: "triangle"; readonly sides: 3 }
  | { readonly kind: "quadrilateral"; readonly sides: 4 }
  | { readonly kind: "polygon"; readonly sides: number };

type PolygonSidesDialogState = {
  readonly value: string;
  readonly error: string | null;
};

type CalculationPointPickerState = {
  readonly mode: "distance" | "angle";
  readonly selectedPointIds: readonly string[];
  readonly searchQuery: string;
};

const POINT_EPSILON = 1e-5;
const POLYGON_DISTANCE_EPSILON = 1e-8;
const POLYGON_AREA2_EPSILON = 1e-10;
const WORLD_UNIT_TO_CSS_PX = 37.7952755906;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const PAN_THRESHOLD_PX = 4;
const CIRCLE_HIT_RADIUS_PX = 8;
const MEASUREMENT_HIT_RADIUS_PX = 18;
const DEFAULT_PERPENDICULAR_LENGTH = 2;

const makePlane2DId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const planeToolLabels: Record<Plane2DToolName, string> = {
  select: "选择",
  point: "点",
  segment: "线段",
  circle: "圆",
  copyCircle: "复制圆",
  polygon: "多边形",
  midpoint: "中点",
  perpendicular: "垂直",
  extend: "延长",
  length: "长度",
  angle: "角度",
  calculation: "计算",
};

const planeToolIcons: Record<Plane2DToolName, string> = {
  select: "↖",
  point: "•",
  segment: "╱",
  circle: "○",
  copyCircle: "",
  polygon: "",
  midpoint: "◉",
  perpendicular: "⊥",
  extend: "",
  length: "↔",
  angle: "∠",
  calculation: "ƒ",
};

const Plane2DExtendIcon = () => (
  <svg
    aria-hidden="true"
    className="plane2d-tool-svg-icon"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <line className="plane2d-tool-icon-dash" x1="2" x2="8" y1="12" y2="12" />
    <line className="plane2d-tool-icon-solid" x1="8" x2="16" y1="12" y2="12" />
    <line className="plane2d-tool-icon-dash" x1="16" x2="22" y1="12" y2="12" />
  </svg>
);

const Plane2DCopyCircleIcon = () => (
  <svg
    aria-hidden="true"
    className="plane2d-tool-svg-icon"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <circle className="plane2d-tool-icon-solid" cx="9" cy="14" r="5" />
    <circle className="plane2d-tool-icon-dash" cx="15" cy="9" r="5" />
  </svg>
);

const Plane2DPolygonIcon = () => (
  <svg
    aria-hidden="true"
    className="plane2d-tool-svg-icon"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <polygon
      className="plane2d-tool-icon-solid"
      points="12 3 21 10 18 21 6 21 3 10"
    />
  </svg>
);

const planeToolGroups: ReadonlyArray<{
  readonly title: string;
  readonly tools: readonly Plane2DToolName[];
}> = [
  { title: "基础", tools: ["select"] },
  { title: "构造", tools: ["point", "segment", "circle", "copyCircle", "polygon", "midpoint", "perpendicular", "extend"] },
  { title: "测量", tools: ["length", "angle", "calculation"] },
];

const getBaseToolHint = (tool: Plane2DToolName): string => {
  switch (tool) {
    case "point":
      return "单击创建点，或按 Ctrl+K 输入坐标建点。";
    case "segment":
      return "请选择线段端点，也可按 Ctrl+K 输入坐标建点。";
    case "circle":
      return "请选择圆心或半径点，也可按 Ctrl+K 输入坐标建点。";
    case "copyCircle":
      return "请选择要复制的圆，或点击圆心选择圆。";
    case "polygon":
      return "请选择顶点，或按 Ctrl+K 输入坐标点。按住 Ctrl 可创建正多边形。";
    case "midpoint":
      return "请选择两个点，也可按 Ctrl+K 输入坐标建点。";
    case "perpendicular":
      return "请选择点和线段，也可按 Ctrl+K 输入坐标建点。";
    case "extend":
      return "请选择要延长的线段。";
    case "length":
      return "请选择线段或两个点进行长度测量，也可按 Ctrl+K 输入坐标点。";
    case "angle":
      return "请选择两条线段或三个点进行角度测量，也可按 Ctrl+K 输入坐标点。";
    case "calculation":
      return "请选择线段或测量对象插入计算，确认后点击画布放置结果。";
    default:
      return "选择对象，拖动空白处可平移画布。";
  }
};
const getEntityDisplayName = (
  entity:
    | Plane2DPointEntity
    | Plane2DSegmentEntity
    | Plane2DCircleEntity
    | Plane2DPolygonEntity
    | Plane2DMeasurementEntity
    | Plane2DExtensionEntity
    | Plane2DCalculationEntity
    | undefined,
): string => {
  const manualName =
    entity?.nameSource === "manual" ? entity.name?.trim() : "";

  return manualName || entity?.name?.trim() || entity?.id || "unknown";
};

export default function PlaneCanvasViewport({
  document,
  currentTool,
  pendingSegmentPointId,
  resetSignal,
  initialViewport,
  onChange,
  onViewportChange,
  onToolChange,
  onPendingSegmentPointChange,
  onStatus,
  onToast,
}: PlaneCanvasViewportProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const latestPointerLocalRef = useRef<Vec2 | null>(null);
  const latestDocumentRef = useRef(document);
  const dragStartDocumentRef = useRef<PlaneCanvasDocument | null>(null);
  const lastHintRef = useRef<string | null>(null);
  const polygonMenuToggleRef = useRef<HTMLButtonElement | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Vec2 | null>(null);
  const [hoverTarget, setHoverTarget] = useState<Plane2DPickResult | null>(null);
  const [interaction, setInteraction] = useState<Plane2DInteractionState>({
    kind: "idle",
  });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState<Plane2DViewportState>({
    panX: initialViewport?.panX ?? 0,
    panY: initialViewport?.panY ?? 0,
    zoom: initialViewport?.zoom ?? 1,
  });
  const [circleCenterPointId, setCircleCenterPointId] = useState<string | null>(null);
  const [copyCircleSourceId, setCopyCircleSourceId] = useState<string | null>(null);
  const [polygonVariant, setPolygonVariant] = useState<Plane2DPolygonVariant>({
    kind: "triangle",
    sides: 3,
  });
  const [isPolygonMenuOpen, setIsPolygonMenuOpen] = useState(false);
  const [polygonSidesDialog, setPolygonSidesDialog] =
    useState<PolygonSidesDialogState | null>(null);
  const [polygonVertexPointIds, setPolygonVertexPointIds] = useState<string[]>([]);
  const [regularPolygonSide, setRegularPolygonSide] = useState<1 | -1>(1);
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [midpointFirstPointId, setMidpointFirstPointId] = useState<string | null>(null);
  const [perpendicularFirstTarget, setPerpendicularFirstTarget] =
    useState<PerpendicularFirstTarget | null>(null);
  const [perpendicularDirectionPick, setPerpendicularDirectionPick] =
    useState<PerpendicularDirectionPickState | null>(null);
  const [lengthFirstPointId, setLengthFirstPointId] = useState<string | null>(null);
  const [angleFirstTarget, setAngleFirstTarget] =
    useState<AngleFirstTarget | null>(null);
  const [angleVertexPointId, setAngleVertexPointId] = useState<string | null>(null);
  const [coordinateDialog, setCoordinateDialog] =
    useState<CoordinateDialogState | null>(null);
  const [calculationExpression, setCalculationExpression] =
    useState<CalculationExpression | null>(null);
  const [calculationPendingOp, setCalculationPendingOp] = useState<
    "add" | "sub" | "mul" | "div" | null
  >(null);
  const [isPlacingCalculation, setIsPlacingCalculation] = useState(false);
  const [calculationPointPicker, setCalculationPointPicker] =
    useState<CalculationPointPickerState | null>(null);

  const selectedEntityId = document.selectedEntityIds[0] ?? null;
  const selectedEntityIdSet = new Set(document.selectedEntityIds);
  const selectedEntity = selectedEntityId
    ? document.entities[selectedEntityId]
    : null;

  const points = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DPointEntity =>
          entity.type === "plane2d-point" && entity.visible !== false,
      ),
    [document.entities],
  );
  const segments = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DSegmentEntity =>
          entity.type === "plane2d-segment" && entity.visible !== false,
      ),
    [document.entities],
  );
  const circles = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DCircleEntity =>
          entity.type === "plane2d-circle" && entity.visible !== false,
      ),
    [document.entities],
  );
  const polygons = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DPolygonEntity =>
          entity.type === "plane2d-polygon" && entity.visible !== false,
      ),
    [document.entities],
  );
  const measurements = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DMeasurementEntity =>
          entity.type === "plane2d-measurement" && entity.visible !== false,
      ),
    [document.entities],
  );
  const calculations = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DCalculationEntity =>
          entity.type === "plane2d-calculation" && entity.visible !== false,
      ),
    [document.entities],
  );
  const extensions = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DExtensionEntity =>
          entity.type === "plane2d-extension",
      ),
    [document.entities],
  );

  const getCalculationReferenceLabel = (targetId: string): string => {
    const entity = document.entities[targetId];

    if (!entity) {
      return "引用失效";
    }

    if (entity.type === "plane2d-segment") {
      return `|${getEntityDisplayName(entity)}|`;
    }

    if (entity.type === "plane2d-measurement") {
      return getEntityDisplayName(entity);
    }

    return getEntityDisplayName(entity as Plane2DEntity);
  };

  const getPointTypeLabel = (point: Plane2DPointEntity): string => {
    if (point.pointKind !== "constructed") {
      return "自由点";
    }

    switch (point.construction?.kind) {
      case "segmentIntersection":
        return "交点";
      case "midpoint":
        return "中点";
      case "perpendicularFoot":
        return "垂足";
      case "perpendicularEndpoint":
        return "垂线端点";
      case "copiedCircleRadiusPoint":
        return "复制圆半径点";
      case "regularPolygonVertex":
      case "regularPolygonVertexBySide":
        return "正多边形顶点";
      default:
        return "构造点";
    }
  };

  const openCalculationPointPicker = (mode: "distance" | "angle") => {
    const minimumPointCount = mode === "distance" ? 2 : 3;

    if (points.length < minimumPointCount) {
      onToast?.(
        mode === "distance"
          ? "当前画布中至少需要两个点"
          : "当前画布中至少需要三个点",
      );
      return;
    }

    setCalculationPointPicker({ mode, selectedPointIds: [], searchQuery: "" });
    setIsPlacingCalculation(false);
    onStatus(mode === "distance" ? "请选择两个点作为边。" : "请选择三个点作为角，第二个点为顶点。");
  };

  const insertCalculationPointExpression = (
    expression: CalculationExpression,
    statusMessage: string,
  ) => {
    insertCalculationReference(expression);
    setCalculationPointPicker(null);
    onStatus(statusMessage);
  };

  const toggleCalculationPoint = (pointId: string) => {
    if (!calculationPointPicker) {
      return;
    }

    const selectedPointIds = calculationPointPicker.selectedPointIds.includes(pointId)
      ? calculationPointPicker.selectedPointIds.filter((id) => id !== pointId)
      : [...calculationPointPicker.selectedPointIds, pointId];

    if (calculationPointPicker.mode === "distance" && selectedPointIds.length === 2) {
      const [pointAId, pointBId] = selectedPointIds;

      if (pointAId === pointBId) {
        onToast?.("请选择两个不同的点");
        setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
        return;
      }

      insertCalculationPointExpression(
        { kind: "pointDistance", pointAId, pointBId },
        "已插入两点距离引用。",
      );
      return;
    }

    if (calculationPointPicker.mode === "angle" && selectedPointIds.length === 3) {
      const [pointAId, vertexPointId, pointCId] = selectedPointIds;

      if (pointAId === vertexPointId || pointCId === vertexPointId) {
        onToast?.("角度退化，无法加入角");
        setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
        return;
      }

      insertCalculationPointExpression(
        { kind: "threePointAngle", pointAId, vertexPointId, pointCId },
        "已插入三点角引用。",
      );
      return;
    }

    setCalculationPointPicker({ ...calculationPointPicker, selectedPointIds });
  };

  useEffect(() => {
    latestDocumentRef.current = document;
  }, [document]);

  useEffect(() => {
    if (!initialViewport) {
      return;
    }

    setViewport((current) =>
      current.panX === initialViewport.panX &&
      current.panY === initialViewport.panY &&
      current.zoom === initialViewport.zoom
        ? current
        : initialViewport,
    );
  }, [initialViewport]);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [onViewportChange, viewport]);

  useEffect(() => {
    setCircleCenterPointId(null);
    setCopyCircleSourceId(null);
    setIsPolygonMenuOpen(false);
    setPolygonSidesDialog(null);
    setPolygonVertexPointIds([]);
    setRegularPolygonSide(1);
    setMidpointFirstPointId(null);
    setPerpendicularFirstTarget(null);
    setPerpendicularDirectionPick(null);
    setLengthFirstPointId(null);
    setAngleFirstTarget(null);
    setAngleVertexPointId(null);
    setCalculationPointPicker(null);
    setInteraction({ kind: "idle" });
    setHoverTarget(null);
    dragStartDocumentRef.current = null;
    setIsCtrlDown(false);
    onPendingSegmentPointChange(null);
  }, [onPendingSegmentPointChange, resetSignal]);

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const updateSize = () => {
      const rect = svg.getBoundingClientRect();

      setViewportSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };
    const resizeObserver = new ResizeObserver(updateSize);

    updateSize();
    resizeObserver.observe(svg);

    return () => resizeObserver.disconnect();
  }, []);

  const getLocalPoint = (
    event: React.PointerEvent<SVGSVGElement> | React.WheelEvent<SVGSVGElement>,
  ): Vec2 => {
    const rect = event.currentTarget.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const screenToWorld = (screenPosition: Vec2, nextViewport = viewport): Vec2 => {
    const scale = WORLD_UNIT_TO_CSS_PX * nextViewport.zoom;
    const centerX = viewportSize.width / 2 + nextViewport.panX;
    const centerY = viewportSize.height / 2 + nextViewport.panY;

    return {
      x: (screenPosition.x - centerX) / scale,
      y: (centerY - screenPosition.y) / scale,
    };
  };

  const worldToScreen = (worldPosition: Vec2, nextViewport = viewport): Vec2 => {
    const scale = WORLD_UNIT_TO_CSS_PX * nextViewport.zoom;
    const centerX = viewportSize.width / 2 + nextViewport.panX;
    const centerY = viewportSize.height / 2 + nextViewport.panY;

    return {
      x: centerX + worldPosition.x * scale,
      y: centerY - worldPosition.y * scale,
    };
  };

  const getViewportWorldBounds = () => {
    const topLeft = screenToWorld({ x: 0, y: 0 });
    const bottomRight = screenToWorld({
      x: viewportSize.width,
      y: viewportSize.height,
    });

    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  };

  const getExtensionViewportParts = (
    extension: Plane2DExtensionEntity,
  ): ReadonlyArray<{
    readonly extensionId: string;
    readonly part: "start" | "end";
    readonly start: Vec2;
    readonly end: Vec2;
  }> => {
    if (extension.visible === false || extension.snapEnabled === false) {
      return [];
    }

    const target = document.entities[extension.targetSegmentId];
    const positions =
      target?.type === "plane2d-segment" && target.visible !== false
        ? getPlane2DSegmentPositions(document, target)
        : null;

    if (!positions) {
      return [];
    }

    const [start, end] = positions;
    const direction = { x: end.x - start.x, y: end.y - start.y };
    const length = Math.hypot(direction.x, direction.y);

    if (length < POINT_EPSILON) {
      return [];
    }

    const unit = { x: direction.x / length, y: direction.y / length };
    const bounds = getViewportWorldBounds();
    const tValues: number[] = [];
    const addIfInside = (point: Vec2, t: number) => {
      if (
        point.x >= bounds.minX - POINT_EPSILON &&
        point.x <= bounds.maxX + POINT_EPSILON &&
        point.y >= bounds.minY - POINT_EPSILON &&
        point.y <= bounds.maxY + POINT_EPSILON
      ) {
        tValues.push(t);
      }
    };

    if (Math.abs(unit.x) > POINT_EPSILON) {
      [bounds.minX, bounds.maxX].forEach((x) => {
        const t = (x - start.x) / unit.x;
        addIfInside({ x, y: start.y + unit.y * t }, t);
      });
    }

    if (Math.abs(unit.y) > POINT_EPSILON) {
      [bounds.minY, bounds.maxY].forEach((y) => {
        const t = (y - start.y) / unit.y;
        addIfInside({ x: start.x + unit.x * t, y }, t);
      });
    }

    const uniqueTValues = [...new Set(tValues.map((value) => value.toFixed(8)))]
      .map(Number)
      .sort((a, b) => a - b);

    if (uniqueTValues.length < 2) {
      return [];
    }

    const minT = uniqueTValues[0];
    const maxT = uniqueTValues[uniqueTValues.length - 1];
    const parts: Array<{
      readonly extensionId: string;
      readonly part: "start" | "end";
      readonly start: Vec2;
      readonly end: Vec2;
    }> = [];

    if (minT < -POINT_EPSILON) {
      parts.push({
        extensionId: extension.id,
        part: "start",
        start: { x: start.x + unit.x * minT, y: start.y + unit.y * minT },
        end: start,
      });
    }

    if (maxT > length + POINT_EPSILON) {
      parts.push({
        extensionId: extension.id,
        part: "end",
        start: end,
        end: { x: start.x + unit.x * maxT, y: start.y + unit.y * maxT },
      });
    }

    return parts;
  };

  const extensionViewportParts = extensions.flatMap((extension) =>
    getExtensionViewportParts(extension),
  );

  const setDocument = (
    nextDocument: PlaneCanvasDocument,
    dirty = true,
    options?: Plane2DDocumentChangeOptions,
  ) => {
    const syncedDocument = syncPlane2DConstructions(nextDocument);

    latestDocumentRef.current = syncedDocument;
    onChange(syncedDocument, dirty, options);
  };

  const selectEntity = (entityId: string | null) => {
    onChange({ ...document, selectedEntityIds: entityId ? [entityId] : [] }, false);
  };

  const clearPolygonPendingState = () => {
    setPolygonVertexPointIds([]);
    setRegularPolygonSide(1);
  };

  const togglePointSelection = (pointId: string) => {
    const selectedEntityIds = document.selectedEntityIds.includes(pointId)
      ? document.selectedEntityIds.filter((entityId) => entityId !== pointId)
      : [...document.selectedEntityIds, pointId];

    onChange({ ...document, selectedEntityIds }, false);
  };

  const pickPlane2DTarget = (
    screenPosition: Vec2,
    ignoredPointId?: string | null,
  ): Plane2DPickResult | null => {
    const pointCandidate = points
      .filter((point) => point.id !== ignoredPointId)
      .map((point) => ({
        kind: "point" as const,
        pointId: point.id,
        distancePx: distanceBetweenVec2(worldToScreen(point.position), screenPosition),
      }))
      .filter(({ distancePx }) => distancePx <= document.settings.snapDistancePx)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (pointCandidate) {
      return pointCandidate;
    }

    const segmentCandidate = segments
      .filter(
        (segment) =>
          !ignoredPointId ||
          (segment.startPointId !== ignoredPointId &&
            segment.endPointId !== ignoredPointId),
      )
      .map((segment) => {
        const positions = getPlane2DSegmentPositions(document, segment);

        if (!positions) {
          return null;
        }

        const closest = getClosestPointOnSegment2D(
          screenPosition,
          worldToScreen(positions[0]),
          worldToScreen(positions[1]),
        );

        return {
          kind: "segment" as const,
          segmentId: segment.id,
          distancePx: closest.distance,
          closestWorld: {
            x: positions[0].x + (positions[1].x - positions[0].x) * closest.t,
            y: positions[0].y + (positions[1].y - positions[0].y) * closest.t,
          },
        };
      })
      .filter((candidate): candidate is Extract<Plane2DPickResult, { kind: "segment" }> => candidate !== null)
      .filter((candidate) => candidate.distancePx <= document.settings.snapDistancePx)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (segmentCandidate) {
      return segmentCandidate;
    }

    const extensionCandidate = extensionViewportParts
      .map((part) => {
        const closest = getClosestPointOnSegment2D(
          screenPosition,
          worldToScreen(part.start),
          worldToScreen(part.end),
        );

        return {
          kind: "extension" as const,
          extensionId: part.extensionId,
          part: part.part,
          distancePx: closest.distance,
          closestWorld: {
            x: part.start.x + (part.end.x - part.start.x) * closest.t,
            y: part.start.y + (part.end.y - part.start.y) * closest.t,
          },
        };
      })
      .filter((candidate) => candidate.distancePx <= document.settings.snapDistancePx)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (extensionCandidate) {
      return extensionCandidate;
    }

    const circleCandidate = circles
      .map((circle) => {
        const geometry = getPlane2DCircleGeometry(document, circle);

        if (!geometry || geometry.radius < POINT_EPSILON) {
          return null;
        }

        const centerScreen = worldToScreen(geometry.center);
        const radiusScreen = distanceBetweenVec2(
          centerScreen,
          worldToScreen(geometry.radiusPoint),
        );
        const distanceToCenter = distanceBetweenVec2(screenPosition, centerScreen);
        const distancePx = Math.abs(distanceToCenter - radiusScreen);

        return { kind: "circle" as const, circleId: circle.id, distancePx };
      })
      .filter((candidate): candidate is Extract<Plane2DPickResult, { kind: "circle" }> => candidate !== null)
      .filter((candidate) => candidate.distancePx <= CIRCLE_HIT_RADIUS_PX)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (circleCandidate) {
      return circleCandidate;
    }

    const polygonCandidate = polygons
      .map((polygon) => {
        const polygonPoints = getPlane2DPolygonPoints(document, polygon);

        if (!polygonPoints || polygonPoints.length < 3) {
          return null;
        }

        let bestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < polygonPoints.length; index += 1) {
          const start = worldToScreen(polygonPoints[index]);
          const end = worldToScreen(
            polygonPoints[(index + 1) % polygonPoints.length],
          );
          const closest = getClosestPointOnSegment2D(screenPosition, start, end);

          bestDistance = Math.min(bestDistance, closest.distance);
        }

        return {
          kind: "polygon" as const,
          polygonId: polygon.id,
          distancePx: bestDistance,
        };
      })
      .filter(
        (
          candidate,
        ): candidate is Extract<Plane2DPickResult, { kind: "polygon" }> =>
          candidate !== null,
      )
      .filter((candidate) => candidate.distancePx <= document.settings.snapDistancePx)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (polygonCandidate) {
      return polygonCandidate;
    }

    const measurementCandidate = measurements
      .map((measurement) => {
        const info = getPlane2DMeasurementInfo(document, measurement);

        if (!info) {
          return null;
        }

        const labelScreen = worldToScreen(info.position);
        const distancePx = distanceBetweenVec2(labelScreen, screenPosition);

        return {
          kind: "measurement" as const,
          measurementId: measurement.id,
          distancePx,
        };
      })
      .filter(
        (
          candidate,
        ): candidate is Extract<Plane2DPickResult, { kind: "measurement" }> =>
          candidate !== null,
      )
      .filter((candidate) => candidate.distancePx <= MEASUREMENT_HIT_RADIUS_PX)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    if (measurementCandidate) {
      return measurementCandidate;
    }

    const calculationCandidate = calculations
      .map((calculation) => {
        const info = getPlane2DCalculationInfo(document, calculation);
        const labelScreen = worldToScreen(info.position);
        const distancePx = distanceBetweenVec2(labelScreen, screenPosition);

        return {
          kind: "calculation" as const,
          calculationId: calculation.id,
          distancePx,
        };
      })
      .filter((candidate) => candidate.distancePx <= MEASUREMENT_HIT_RADIUS_PX)
      .sort((a, b) => a.distancePx - b.distancePx)[0];

    return calculationCandidate ?? null;
  };

  const resolveSnap = (
    screenPosition: Vec2,
    rawPosition: Vec2,
    ignoredPointId?: string | null,
  ): Plane2DSnapResult => {
    const pick = pickPlane2DTarget(screenPosition, ignoredPointId);

    if (pick?.kind === "point" && document.settings.snapToPoints) {
      const point = document.entities[pick.pointId];

      if (point?.type === "plane2d-point") {
        return { type: "point", position: point.position, entityId: point.id };
      }
    }

    if (pick?.kind === "segment" && document.settings.snapToSegments) {
      return { type: "segment", position: pick.closestWorld, entityId: pick.segmentId };
    }

    if (pick?.kind === "extension" && document.settings.snapToSegments) {
      return { type: "extension", position: pick.closestWorld, entityId: pick.extensionId };
    }

    if (pick?.kind === "circle") {
      return { type: "circle", position: rawPosition, entityId: pick.circleId };
    }

    return { type: "none", position: rawPosition };
  };

  const createPointEntityAt = (position: Vec2): Plane2DPointEntity =>
    createPlane2DPoint(makePlane2DId("plane2d-point"), position);

  const createPointAt = (position: Vec2): string => {
    const point = createPointEntityAt(position);

    setDocument({
      ...document,
      entities: { ...document.entities, [point.id]: point },
      selectedEntityIds: [point.id],
    });

    return point.id;
  };

  const findPointNearWorld = (position: Vec2): Plane2DPointEntity | null => {
    const screenPosition = worldToScreen(position);

    return (
      points
        .map((point) => ({
          point,
          distance: distanceBetweenVec2(worldToScreen(point.position), screenPosition),
        }))
        .filter(({ distance }) => distance <= document.settings.snapDistancePx)
        .sort((a, b) => a.distance - b.distance)[0]?.point ?? null
    );
  };

  const resolvePointInput = (snap: Plane2DSnapResult): string => {
    if (snap.type === "point") {
      return snap.entityId;
    }

    return createPointAt(snap.position);
  };

  const getPerpendicularPreview = (
    pointId: string,
    segmentId: string,
    referencePosition: Vec2,
  ): PerpendicularPreview | null => {
    const point = getPlane2DPointPosition(document, pointId);
    const segment = document.entities[segmentId];
    const segmentPositions =
      segment?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(document, segment)
        : null;

    if (!point || !segmentPositions) {
      return null;
    }

    const foot = getPerpendicularFootOnLine2D(
      point,
      segmentPositions[0],
      segmentPositions[1],
    );

    if (!foot) {
      return null;
    }

    if (distanceBetweenVec2(point, foot) >= POINT_EPSILON) {
      return { kind: "foot", start: point, end: foot };
    }

    const sideInfo = getSignedPerpendicularSide2D(
      point,
      segmentPositions[0],
      segmentPositions[1],
      referencePosition,
    );

    if (!sideInfo) {
      return null;
    }

    const length = Math.max(sideInfo.length, DEFAULT_PERPENDICULAR_LENGTH);
    const endpoint = getPerpendicularEndpointOnLine2D(
      point,
      segmentPositions[0],
      segmentPositions[1],
      sideInfo.side,
      length,
    );

    return endpoint
      ? { kind: "direction", start: point, end: endpoint, side: sideInfo.side, length }
      : null;
  };

  const createPerpendicularForPair = (
    pointId: string,
    segmentId: string,
    referencePosition: Vec2,
  ) => {
    const preview = getPerpendicularPreview(pointId, segmentId, referencePosition);

    if (!preview) {
      onStatus("线段过短，无法作垂线。");
      onToast?.("线段过短，无法作垂线。");
      return;
    }

    if (preview.kind === "direction") {
      setPerpendicularDirectionPick({
        pointId,
        segmentId,
        side: preview.side,
        length: preview.length,
      });
      onStatus("移动鼠标选择垂线方向，单击确认。");
      onToast?.("移动鼠标选择垂线方向，单击确认。");
      return;
    }

    const footId = plane2DPerpendicularFootId(pointId, segmentId);
    const segmentLineId = `plane2d-perpendicular-segment-${pointId}-${segmentId}`;
    const previousFoot = document.entities[footId];
    const foot = createPlane2DPoint(footId, preview.end, {
      pointKind: "constructed",
      construction: { kind: "perpendicularFoot", pointId, segmentId },
      name: previousFoot?.type === "plane2d-point" ? previousFoot.name : undefined,
      nameSource:
        previousFoot?.type === "plane2d-point" ? previousFoot.nameSource : "auto",
      showName:
        previousFoot?.type === "plane2d-point" ? previousFoot.showName : false,
      createdAt:
        previousFoot?.type === "plane2d-point" ? previousFoot.createdAt : undefined,
    });
    const perpendicularSegment = createPlane2DSegment(
      segmentLineId,
      pointId,
      footId,
      {
        segmentKind: "constructed",
        construction: { kind: "perpendicular", pointId, segmentId },
      },
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        [foot.id]: foot,
        [perpendicularSegment.id]: perpendicularSegment,
      },
      selectedEntityIds: [perpendicularSegment.id],
    });
    setPerpendicularFirstTarget(null);
    onStatus("已创建垂线。");
  };

  const confirmPerpendicularDirection = (referencePosition: Vec2) => {
    if (!perpendicularDirectionPick) {
      return;
    }

    const preview = getPerpendicularPreview(
      perpendicularDirectionPick.pointId,
      perpendicularDirectionPick.segmentId,
      referencePosition,
    );

    if (!preview || preview.kind !== "direction" || preview.length < POINT_EPSILON) {
      onStatus("垂线长度过小，无法创建。");
      onToast?.("垂线长度过小，无法创建。");
      return;
    }

    const endpointId = plane2DPerpendicularEndpointId(
      perpendicularDirectionPick.pointId,
      perpendicularDirectionPick.segmentId,
    );
    const segmentLineId = `plane2d-perpendicular-direction-segment-${perpendicularDirectionPick.pointId}-${perpendicularDirectionPick.segmentId}`;
    const previousEndpoint = document.entities[endpointId];
    const endpoint = createPlane2DPoint(endpointId, preview.end, {
      pointKind: "constructed",
      construction: {
        kind: "perpendicularEndpoint",
        pointId: perpendicularDirectionPick.pointId,
        segmentId: perpendicularDirectionPick.segmentId,
        side: preview.side,
        length: preview.length,
      },
      name:
        previousEndpoint?.type === "plane2d-point" ? previousEndpoint.name : undefined,
      nameSource:
        previousEndpoint?.type === "plane2d-point"
          ? previousEndpoint.nameSource
          : "auto",
      showName:
        previousEndpoint?.type === "plane2d-point"
          ? previousEndpoint.showName
          : false,
      createdAt:
        previousEndpoint?.type === "plane2d-point"
          ? previousEndpoint.createdAt
          : undefined,
    });
    const perpendicularSegment = createPlane2DSegment(
      segmentLineId,
      perpendicularDirectionPick.pointId,
      endpointId,
      {
        segmentKind: "constructed",
        construction: {
          kind: "perpendicular",
          pointId: perpendicularDirectionPick.pointId,
          segmentId: perpendicularDirectionPick.segmentId,
        },
      },
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        [endpoint.id]: endpoint,
        [perpendicularSegment.id]: perpendicularSegment,
      },
      selectedEntityIds: [perpendicularSegment.id],
    });
    setPerpendicularDirectionPick(null);
    setPerpendicularFirstTarget(null);
    onStatus("已创建垂线。");
  };

  const handlePerpendicularTarget = (target: PerpendicularFirstTarget, reference: Vec2) => {
    if (!perpendicularFirstTarget) {
      setPerpendicularFirstTarget(target);
      onStatus(target.kind === "point" ? "请选择线段。" : "请选择点，也可按 Ctrl+K 输入坐标建点。");
      return;
    }

    if (perpendicularFirstTarget.kind === target.kind) {
      setPerpendicularFirstTarget(target);
      onStatus(target.kind === "point" ? "请选择线段。" : "请选择点，也可按 Ctrl+K 输入坐标建点。");
      return;
    }

    const pointId =
      perpendicularFirstTarget.kind === "point"
        ? perpendicularFirstTarget.pointId
        : target.kind === "point"
          ? target.pointId
          : null;
    const segmentId =
      perpendicularFirstTarget.kind === "segment"
        ? perpendicularFirstTarget.segmentId
        : target.kind === "segment"
          ? target.segmentId
          : null;

    if (pointId && segmentId) {
      createPerpendicularForPair(pointId, segmentId, reference);
    }
  };

  const createSegmentWithInput = (firstPointId: string, snap: Plane2DSnapResult) => {
    const firstPosition = getPlane2DPointPosition(document, firstPointId);
    const secondPoint = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const secondPointId = snap.type === "point" ? snap.entityId : secondPoint!.id;
    const secondPosition =
      snap.type === "point"
        ? getPlane2DPointPosition(document, secondPointId)
        : secondPoint!.position;

    if (
      !firstPosition ||
      !secondPosition ||
      firstPointId === secondPointId ||
      distanceBetweenVec2(firstPosition, secondPosition) < POINT_EPSILON
    ) {
      onStatus("线段端点不能重合。");
      return;
    }

    const segment = createPlane2DSegment(
      makePlane2DId("plane2d-segment"),
      firstPointId,
      secondPointId,
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(secondPoint ? { [secondPoint.id]: secondPoint } : {}),
        [segment.id]: segment,
      },
      selectedEntityIds: [segment.id],
    });
    onPendingSegmentPointChange(null);
    onStatus("已创建二维线段。");
  };

  const createCircleWithInput = (centerPointId: string, snap: Plane2DSnapResult) => {
    const center = getPlane2DPointPosition(document, centerPointId);
    const radiusPoint = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const radiusPointId = snap.type === "point" ? snap.entityId : radiusPoint!.id;
    const radiusPosition =
      snap.type === "point"
        ? getPlane2DPointPosition(document, radiusPointId)
        : radiusPoint!.position;

    if (
      !center ||
      !radiusPosition ||
      centerPointId === radiusPointId ||
      distanceBetweenVec2(center, radiusPosition) < POINT_EPSILON
    ) {
      onStatus("半径过小，无法创建圆。");
      return;
    }

    const circle = createPlane2DCircle(
      makePlane2DId("plane2d-circle"),
      centerPointId,
      radiusPointId,
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(radiusPoint ? { [radiusPoint.id]: radiusPoint } : {}),
        [circle.id]: circle,
      },
      selectedEntityIds: [circle.id],
    });
    setCircleCenterPointId(null);
    onStatus("已创建圆。");
  };

  const createCopiedCircleWithCenter = (
    sourceCircleId: string,
    snap: Plane2DSnapResult,
  ) => {
    const sourceCircle = document.entities[sourceCircleId];
    const sourceGeometry =
      sourceCircle?.type === "plane2d-circle"
        ? getPlane2DCircleGeometry(document, sourceCircle)
        : null;

    if (!sourceGeometry || sourceGeometry.radius < POINT_EPSILON) {
      onStatus("源圆半径过小，无法复制。");
      onToast?.("源圆半径过小，无法复制。");
      return;
    }

    const centerPoint = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const centerPointId = snap.type === "point" ? snap.entityId : centerPoint!.id;
    const center =
      snap.type === "point"
        ? getPlane2DPointPosition(document, centerPointId)
        : centerPoint!.position;

    if (!center) {
      return;
    }

    const radiusPointId = makePlane2DId("plane2d-copy-circle-radius");
    const radiusPoint = createPlane2DPoint(
      radiusPointId,
      { x: center.x + sourceGeometry.radius, y: center.y },
      {
        pointKind: "constructed",
        construction: {
          kind: "copiedCircleRadiusPoint",
          sourceCircleId,
          centerPointId,
        },
      },
    );
    const circle = createPlane2DCircle(
      makePlane2DId("plane2d-copy-circle"),
      centerPointId,
      radiusPointId,
      {
        circleKind: "constructed",
        construction: {
          kind: "copyCircle",
          sourceCircleId,
          centerPointId,
        },
      },
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(centerPoint ? { [centerPoint.id]: centerPoint } : {}),
        [radiusPoint.id]: radiusPoint,
        [circle.id]: circle,
      },
      selectedEntityIds: [circle.id],
    });
    setCopyCircleSourceId(null);
    onStatus("已复制圆。");
  };

  const selectCopyCircleSourceFromPoint = (pointId: string) => {
    const sourceCircles = circles.filter((circle) => circle.centerPointId === pointId);

    if (sourceCircles.length === 0) {
      onStatus("请选择圆或圆心。");
      onToast?.("请选择圆或圆心。");
      return;
    }

    if (sourceCircles.length > 1) {
      onStatus("该圆心对应多个圆，请直接选择圆周。");
      onToast?.("该圆心对应多个圆，请直接选择圆周。");
      return;
    }

    setCopyCircleSourceId(sourceCircles[0].id);
    selectEntity(sourceCircles[0].id);
    onStatus("请选择新圆心，或按 Ctrl+K 输入坐标建点。");
  };

  const getPolygonArea = (vertices: readonly Vec2[]): number => {
    let area2 = 0;

    for (let index = 0; index < vertices.length; index += 1) {
      const current = vertices[index];
      const next = vertices[(index + 1) % vertices.length];

      area2 += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area2) / 2;
  };

  const arePolygonEdgesAdjacent = (
    edgeAIndex: number,
    edgeBIndex: number,
    edgeCount: number,
  ): boolean => {
    const difference = Math.abs(edgeAIndex - edgeBIndex);

    return difference === 1 || difference === edgeCount - 1;
  };

  const hasSelfIntersectingPolygonEdges = (vertices: readonly Vec2[]): boolean => {
    for (let i = 0; i < vertices.length; i += 1) {
      const edgeAStart = vertices[i];
      const edgeAEnd = vertices[(i + 1) % vertices.length];

      for (let j = i + 1; j < vertices.length; j += 1) {
        if (arePolygonEdgesAdjacent(i, j, vertices.length)) {
          continue;
        }

        const edgeBStart = vertices[j];
        const edgeBEnd = vertices[(j + 1) % vertices.length];
        const intersection = computeSegmentIntersection2D(
          edgeAStart,
          edgeAEnd,
          edgeBStart,
          edgeBEnd,
        );

        if (intersection.kind === "point" || intersection.kind === "collinearOverlap") {
          return true;
        }
      }
    }

    return false;
  };

  const validatePolygonCandidate = (
    vertexPointIds: readonly string[],
    vertices: readonly Vec2[],
  ): boolean => {
    if (vertexPointIds.length < 3 || vertices.length !== vertexPointIds.length) {
      onStatus("多边形顶点无效，无法创建。");
      onToast?.("多边形顶点无效，无法创建。");
      return false;
    }

    const uniqueVertexIds = [...new Set(vertexPointIds)];

    if (uniqueVertexIds.length !== vertexPointIds.length) {
      onStatus("多边形顶点不能重复。");
      onToast?.("多边形顶点不能重复。");
      return false;
    }

    for (let i = 0; i < vertices.length; i += 1) {
      for (let j = i + 1; j < vertices.length; j += 1) {
        if (distanceBetweenVec2(vertices[i], vertices[j]) <= POLYGON_DISTANCE_EPSILON) {
          onStatus("多边形顶点不能重复。");
          onToast?.("多边形顶点不能重复。");
          return false;
        }
      }
    }

    for (let index = 0; index < vertices.length; index += 1) {
      const current = vertices[index];
      const next = vertices[(index + 1) % vertices.length];

      if (distanceBetweenVec2(current, next) <= POLYGON_DISTANCE_EPSILON) {
        onStatus("多边形退化，无法创建。");
        onToast?.("多边形退化，无法创建。");
        return false;
      }
    }

    if (getPolygonArea(vertices) * 2 <= POLYGON_AREA2_EPSILON) {
      onStatus("多边形退化，无法创建。");
      onToast?.("多边形退化，无法创建。");
      return false;
    }

    if (hasSelfIntersectingPolygonEdges(vertices)) {
      onStatus("多边形存在自交，无法创建。");
      onToast?.("多边形存在自交，无法创建。");
      return false;
    }

    return true;
  };

  const createFreePolygonWithVertices = (
    vertexPointIds: readonly string[],
    vertices: readonly Vec2[],
    newVertexPoint?: Plane2DPointEntity,
  ) => {
    if (!validatePolygonCandidate(vertexPointIds, vertices)) {
      return;
    }

    const polygon = createPlane2DPolygon(
      makePlane2DId("plane2d-polygon"),
      vertexPointIds,
      { polygonKind: "free" },
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(newVertexPoint ? { [newVertexPoint.id]: newVertexPoint } : {}),
        [polygon.id]: polygon,
      },
      selectedEntityIds: [polygon.id],
    });
    clearPolygonPendingState();
    onStatus(`已创建 ${vertexPointIds.length} 边形。`);
  };

  const createRegularPolygonBySideWithSecondPoint = (
    firstPointId: string,
    snap: Plane2DSnapResult,
  ) => {
    const first = getPlane2DPointPosition(document, firstPointId);
    const secondPoint = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const secondPointId = snap.type === "point" ? snap.entityId : secondPoint!.id;
    const second =
      snap.type === "point"
        ? getPlane2DPointPosition(document, secondPointId)
        : secondPoint!.position;

    if (
      !first ||
      !second ||
      firstPointId === secondPointId ||
      distanceBetweenVec2(first, second) < POINT_EPSILON
    ) {
      onStatus("边长过小，无法创建正多边形。");
      onToast?.("边长过小，无法创建正多边形。");
      return;
    }

    const vertices = getRegularPolygonVerticesBySide(
      first,
      second,
      polygonVariant.sides,
      regularPolygonSide,
    );

    if (!vertices) {
      onStatus("边长过小，无法创建正多边形。");
      onToast?.("边长过小，无法创建正多边形。");
      return;
    }

    const polygonId = makePlane2DId("plane2d-regular-polygon");
    const constructedVertices: Plane2DPointEntity[] = [];
    const vertexPointIds = [firstPointId, secondPointId];

    for (let index = 2; index < polygonVariant.sides; index += 1) {
      const vertex = createPlane2DPoint(
        makePlane2DId("plane2d-regular-polygon-vertex"),
        vertices[index],
        {
          pointKind: "constructed",
          construction: {
            kind: "regularPolygonVertexBySide",
            polygonId,
            firstPointId,
            secondPointId,
            vertexIndex: index,
            sides: polygonVariant.sides,
            side: regularPolygonSide,
          },
        },
      );

      constructedVertices.push(vertex);
      vertexPointIds.push(vertex.id);
    }

    const polygon = createPlane2DPolygon(polygonId, vertexPointIds, {
      polygonKind: "regular",
      construction: {
        kind: "regularPolygonBySide",
        firstPointId,
        secondPointId,
        sides: polygonVariant.sides,
        side: regularPolygonSide,
      },
    });

    setDocument(
      {
        ...document,
        entities: {
          ...document.entities,
          ...(secondPoint ? { [secondPoint.id]: secondPoint } : {}),
          ...Object.fromEntries(constructedVertices.map((vertex) => [vertex.id, vertex])),
          [polygon.id]: polygon,
        },
        selectedEntityIds: [polygon.id],
      },
      true,
      {
        label: `创建正 ${polygonVariant.sides} 边形`,
      },
    );
    clearPolygonPendingState();
    onStatus(`已创建正 ${polygonVariant.sides} 边形。`);
  };

  const getPolygonPointCandidate = (
    snap: Plane2DSnapResult,
  ): {
    readonly pointId: string;
    readonly position: Vec2;
    readonly newPoint?: Plane2DPointEntity;
  } | null => {
    if (snap.type === "point") {
      const position = getPlane2DPointPosition(document, snap.entityId);

      return position ? { pointId: snap.entityId, position } : null;
    }

    const point = createPointEntityAt(snap.position);

    return {
      pointId: point.id,
      position: point.position,
      newPoint: point,
    };
  };

  const applyPolygonPointInput = (snap: Plane2DSnapResult, ctrlKey = false) => {
    if (ctrlKey && polygonVertexPointIds.length === 1) {
      createRegularPolygonBySideWithSecondPoint(polygonVertexPointIds[0], snap);
      return;
    }

    const candidate = getPolygonPointCandidate(snap);

    if (!candidate) {
      onStatus("无法解析多边形顶点。");
      onToast?.("无法解析多边形顶点。");
      return;
    }

    const pointId = candidate.pointId;

    if (polygonVertexPointIds.includes(pointId)) {
      onStatus("多边形顶点不能重复。");
      onToast?.("多边形顶点不能重复。");
      return;
    }

    const nextVertexPointIds = [...polygonVertexPointIds, pointId];
    const existingPositions = polygonVertexPointIds
      .map((vertexPointId) => getPlane2DPointPosition(document, vertexPointId))
      .filter((point): point is Vec2 => Boolean(point));
    const nextVertexPositions = [...existingPositions, candidate.position];

    if (nextVertexPointIds.length >= polygonVariant.sides) {
      createFreePolygonWithVertices(
        nextVertexPointIds,
        nextVertexPositions,
        candidate.newPoint,
      );
      return;
    }

    if (candidate.newPoint) {
      setDocument({
        ...document,
        entities: {
          ...document.entities,
          [candidate.newPoint.id]: candidate.newPoint,
        },
        selectedEntityIds: [candidate.newPoint.id],
      });
    }

    setPolygonVertexPointIds(nextVertexPointIds);
    if (snap.type === "point") {
      selectEntity(pointId);
    }
    onStatus(`请选择第 ${nextVertexPointIds.length + 1}/${polygonVariant.sides} 个顶点，或按 Ctrl+K 输入坐标点。`);
  };

  const createMidpointWithInput = (pointAId: string, snap: Plane2DSnapResult) => {
    const secondPoint = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const pointBId = snap.type === "point" ? snap.entityId : secondPoint!.id;
    const pointA = getPlane2DPointPosition(document, pointAId);
    const pointB =
      snap.type === "point"
        ? getPlane2DPointPosition(document, pointBId)
        : secondPoint!.position;

    if (
      !pointA ||
      !pointB ||
      pointAId === pointBId ||
      distanceBetweenVec2(pointA, pointB) < POINT_EPSILON
    ) {
      onStatus("中点的两个点不能重合。");
      return;
    }

    const id = plane2DMidpointId(pointAId, pointBId);
    const existing = document.entities[id];

    if (existing?.type === "plane2d-point") {
      selectEntity(existing.id);
      setMidpointFirstPointId(null);
      onStatus("该中点已存在。");
      return;
    }

    const [sourceAId, sourceBId] = [pointAId, pointBId].sort();
    const midpoint = createPlane2DPoint(id, midpointVec2(pointA, pointB), {
      pointKind: "constructed",
      construction: { kind: "midpoint", pointAId: sourceAId, pointBId: sourceBId },
    });

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(secondPoint ? { [secondPoint.id]: secondPoint } : {}),
        [midpoint.id]: midpoint,
      },
      selectedEntityIds: [midpoint.id],
    });
    setMidpointFirstPointId(null);
    onStatus("已创建中点。");
  };

  const insertCalculationReference = (expression: CalculationExpression) => {
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
  };

  const insertCalculationReferenceForPick = (pick: Plane2DPickResult | null) => {
    if (pick?.kind === "segment") {
      insertCalculationReference({
        kind: "reference",
        targetId: pick.segmentId,
        valueKind: "length",
      });
      onStatus("已插入线段长度引用。");
      return true;
    }

    if (pick?.kind === "measurement") {
      insertCalculationReference({
        kind: "reference",
        targetId: pick.measurementId,
        valueKind: "measurement",
      });
      onStatus("已插入测量引用。");
      return true;
    }

    return false;
  };

  const createCalculationAt = (position: Vec2) => {
    if (!calculationExpression) {
      onStatus("请先插入计算表达式。");
      return;
    }

    const calculation = createPlane2DCalculation(
      makePlane2DId("plane2d-calculation"),
      {
        expression: calculationExpression,
        labelPosition: position,
      },
    );

    setDocument({
      ...document,
      entities: { ...document.entities, [calculation.id]: calculation },
      selectedEntityIds: [calculation.id],
    });
    setIsPlacingCalculation(false);
    setCalculationExpression(null);
    setCalculationPendingOp(null);
    onStatus("已创建计算结果。");
  };

  const createLengthMeasurementForSegment = (segmentId: string) => {
    const segment = document.entities[segmentId];

    if (segment?.type !== "plane2d-segment") {
      return;
    }

    const measurement = createPlane2DMeasurement(
      makePlane2DId("plane2d-length"),
      {
        measurementKind: "length",
        definition: { kind: "segmentLength", segmentId },
      },
    );

    setDocument({
      ...document,
      entities: { ...document.entities, [measurement.id]: measurement },
      selectedEntityIds: [measurement.id],
    });
    setLengthFirstPointId(null);
    onStatus("已创建长度测量。");
  };

  const createOrShowExtensionForSegment = (segmentId: string) => {
    const segment = document.entities[segmentId];

    if (segment?.type !== "plane2d-segment" || segment.segmentKind === "extension") {
      onStatus("请选择可延长的线段。");
      return;
    }

    const extensionId = plane2DExtensionId(segmentId);
    const existing = document.entities[extensionId];

    if (existing?.type === "plane2d-extension") {
      if (existing.visible !== false) {
        onStatus("该线段已显示延长部分。");
        onToast?.("该线段已显示延长部分。");
        selectEntity(existing.id);
        return;
      }

      setDocument({
        ...document,
        entities: {
          ...document.entities,
          [existing.id]: {
            ...existing,
            visible: true,
            snapEnabled: true,
            updatedAt: new Date().toISOString(),
          },
        },
        selectedEntityIds: [existing.id],
      });
      onStatus("已显示延长部分。");
      return;
    }

    const extension = createPlane2DExtension(extensionId, segmentId);

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        [extension.id]: extension,
      },
      selectedEntityIds: [extension.id],
    });
    onStatus("已创建延长部分。");
  };

  const createLengthMeasurementForPoints = (
    pointAId: string,
    snap: Plane2DSnapResult,
  ) => {
    const pointB = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const pointBId = snap.type === "point" ? snap.entityId : pointB!.id;

    if (pointAId === pointBId) {
      onStatus("请选择两个不同的点。");
      onToast?.("请选择两个不同的点。");
      return;
    }

    const measurement = createPlane2DMeasurement(
      makePlane2DId("plane2d-length"),
      {
        measurementKind: "length",
        definition: { kind: "pointDistance", pointAId, pointBId },
      },
    );

    setDocument({
      ...document,
      entities: {
        ...document.entities,
        ...(pointB ? { [pointB.id]: pointB } : {}),
        [measurement.id]: measurement,
      },
      selectedEntityIds: [measurement.id],
    });
    setLengthFirstPointId(null);
    onStatus("已创建长度测量。");
  };

  const createAngleMeasurementForSegments = (
    segmentAId: string,
    segmentBId: string,
  ) => {
    if (segmentAId === segmentBId) {
      onStatus("请选择两条不同的线段。");
      onToast?.("请选择两条不同的线段。");
      return;
    }

    const measurement = createPlane2DMeasurement(makePlane2DId("plane2d-angle"), {
      measurementKind: "angle",
      definition: { kind: "segmentSegmentAngle", segmentAId, segmentBId },
    });

    if (!getPlane2DMeasurementInfo({ ...document, entities: { ...document.entities, [measurement.id]: measurement } }, measurement)) {
      onStatus("线段过短，无法测量角度。");
      onToast?.("线段过短，无法测量角度。");
      return;
    }

    setDocument({
      ...document,
      entities: { ...document.entities, [measurement.id]: measurement },
      selectedEntityIds: [measurement.id],
    });
    setAngleFirstTarget(null);
    onStatus("已创建角度测量。");
  };

  const createAngleMeasurementForPoints = (
    pointAId: string,
    vertexPointId: string,
    snap: Plane2DSnapResult,
  ) => {
    const pointC = snap.type === "point" ? null : createPointEntityAt(snap.position);
    const pointCId = snap.type === "point" ? snap.entityId : pointC!.id;

    if (
      pointAId === vertexPointId ||
      pointCId === vertexPointId ||
      pointAId === pointCId
    ) {
      onStatus("角度退化，无法测量。");
      onToast?.("角度退化，无法测量。");
      return;
    }

    const measurement = createPlane2DMeasurement(makePlane2DId("plane2d-angle"), {
      measurementKind: "angle",
      definition: {
        kind: "threePointAngle",
        pointAId,
        vertexPointId,
        pointCId,
      },
    });

    const entitiesWithPoint = {
      ...document.entities,
      ...(pointC ? { [pointC.id]: pointC } : {}),
      [measurement.id]: measurement,
    };

    if (!getPlane2DMeasurementInfo({ ...document, entities: entitiesWithPoint }, measurement)) {
      onStatus("角度退化，无法测量。");
      onToast?.("角度退化，无法测量。");
      return;
    }

    setDocument({
      ...document,
      entities: entitiesWithPoint,
      selectedEntityIds: [measurement.id],
    });
    setAngleFirstTarget(null);
    setAngleVertexPointId(null);
    onStatus("已创建角度测量。");
  };

  const applyPointInput = (snap: Plane2DSnapResult, ctrlKey = false) => {
    if (currentTool === "point" || currentTool === "select") {
      if (snap.type === "point") {
        selectEntity(snap.entityId);
        return;
      }

      createPointAt(snap.position);
      onStatus("已创建二维点。");
      return;
    }

    if (currentTool === "segment") {
      if (!pendingSegmentPointId) {
        const pointId = resolvePointInput(snap);

        onPendingSegmentPointChange(pointId);
        if (snap.type === "point") {
          selectEntity(pointId);
        }
        onStatus("请选择第二个端点，可按 Ctrl+K 输入坐标点。");
        return;
      }

      createSegmentWithInput(pendingSegmentPointId, snap);
      return;
    }

    if (currentTool === "circle") {
      if (!circleCenterPointId) {
        const pointId = resolvePointInput(snap);

        setCircleCenterPointId(pointId);
        if (snap.type === "point") {
          selectEntity(pointId);
        }
        onStatus("请选择半径点，可按 Ctrl+K 输入坐标点。");
        return;
      }

      createCircleWithInput(circleCenterPointId, snap);
      return;
    }

    if (currentTool === "copyCircle") {
      if (!copyCircleSourceId) {
        onStatus("请先选择要复制的圆。");
        onToast?.("请先选择要复制的圆。");
        return;
      }

      createCopiedCircleWithCenter(copyCircleSourceId, snap);
      return;
    }

    if (currentTool === "polygon") {
      applyPolygonPointInput(snap, ctrlKey);
      return;
    }

    if (currentTool === "midpoint") {
      if (!midpointFirstPointId) {
        const pointId = resolvePointInput(snap);

        setMidpointFirstPointId(pointId);
        if (snap.type === "point") {
          selectEntity(pointId);
        }
        onStatus("请选择第二个点，可按 Ctrl+K 输入坐标点。");
        return;
      }

      createMidpointWithInput(midpointFirstPointId, snap);
      return;
    }

    if (currentTool === "perpendicular") {
      if (perpendicularDirectionPick) {
        confirmPerpendicularDirection(snap.position);
        return;
      }

      const pointId = resolvePointInput(snap);
      handlePerpendicularTarget({ kind: "point", pointId }, snap.position);
      return;
    }

    if (currentTool === "length") {
      if (!lengthFirstPointId) {
        const pointId = resolvePointInput(snap);

        setLengthFirstPointId(pointId);
        if (snap.type === "point") {
          selectEntity(pointId);
        }
        onStatus("请选择第二个点。");
        return;
      }

      createLengthMeasurementForPoints(lengthFirstPointId, snap);
      return;
    }

    if (currentTool === "angle") {
      if (!angleFirstTarget) {
        const pointId = resolvePointInput(snap);

        setAngleFirstTarget({ kind: "point", pointId });
        if (snap.type === "point") {
          selectEntity(pointId);
        }
        onStatus("请选择顶点。");
        return;
      }

      if (angleFirstTarget.kind !== "point") {
        onStatus("请选择第二条线段。");
        return;
      }

      if (!angleVertexPointId) {
        const vertexPointId = resolvePointInput(snap);

        if (vertexPointId === angleFirstTarget.pointId) {
          onStatus("角度退化，无法测量。");
          onToast?.("角度退化，无法测量。");
          return;
        }

        setAngleVertexPointId(vertexPointId);
        if (snap.type === "point") {
          selectEntity(vertexPointId);
        }
        onStatus("请选择第三个点。");
        return;
      }

      createAngleMeasurementForPoints(
        angleFirstTarget.pointId,
        angleVertexPointId,
        snap,
      );
      return;
    }

    if (currentTool === "calculation") {
      if (isPlacingCalculation) {
        createCalculationAt(snap.position);
        return;
      }

      onStatus("请选择线段或测量对象插入计算。");
    }
  };

  const commitClickAction = (snap: Plane2DSnapResult, ctrlKey = false) => {
    if (
      currentTool === "point" ||
      currentTool === "segment" ||
      currentTool === "circle" ||
      currentTool === "copyCircle" ||
      currentTool === "polygon" ||
      currentTool === "midpoint" ||
      currentTool === "perpendicular" ||
      currentTool === "length" ||
      currentTool === "angle" ||
      currentTool === "calculation"
    ) {
      applyPointInput(snap, ctrlKey);
      return;
    }

    if (ctrlKey) {
      if (snap.type === "point") {
        togglePointSelection(snap.entityId);
      }
      return;
    }

    if (snap.type === "point") {
      selectEntity(snap.entityId);
      return;
    }

    if (snap.type === "segment" || snap.type === "circle" || snap.type === "extension") {
      selectEntity(snap.entityId);
      return;
    }

    selectEntity(null);
  };

  const getPerpendicularLivePreview = (referencePosition: Vec2 | null): PerpendicularPreview | null => {
    if (!referencePosition) {
      return null;
    }

    if (perpendicularDirectionPick) {
      return getPerpendicularPreview(
        perpendicularDirectionPick.pointId,
        perpendicularDirectionPick.segmentId,
        referencePosition,
      );
    }

    if (currentTool !== "perpendicular" || !perpendicularFirstTarget) {
      return null;
    }

    if (perpendicularFirstTarget.kind === "point" && hoverTarget?.kind === "segment") {
      return getPerpendicularPreview(
        perpendicularFirstTarget.pointId,
        hoverTarget.segmentId,
        referencePosition,
      );
    }

    if (perpendicularFirstTarget.kind === "segment") {
      return getPerpendicularPreviewFromPoint(
        referencePosition,
        perpendicularFirstTarget.segmentId,
      );
    }

    return null;
  };

  const getPerpendicularPreviewFromPoint = (
    point: Vec2,
    segmentId: string,
  ): PerpendicularPreview | null => {
    const segment = document.entities[segmentId];
    const segmentPositions =
      segment?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(document, segment)
        : null;

    if (!segmentPositions) {
      return null;
    }

    const foot = getPerpendicularFootOnLine2D(point, segmentPositions[0], segmentPositions[1]);

    if (!foot) {
      return null;
    }

    if (distanceBetweenVec2(point, foot) >= POINT_EPSILON) {
      return { kind: "foot", start: point, end: foot };
    }

    const sideInfo = getSignedPerpendicularSide2D(point, segmentPositions[0], segmentPositions[1], point);
    const side = sideInfo?.side ?? 1;
    const endpoint = getPerpendicularEndpointOnLine2D(
      point,
      segmentPositions[0],
      segmentPositions[1],
      side,
      DEFAULT_PERPENDICULAR_LENGTH,
    );

    return endpoint
      ? { kind: "direction", start: point, end: endpoint, side, length: DEFAULT_PERPENDICULAR_LENGTH }
      : null;
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isCtrlDown !== event.ctrlKey) {
      setIsCtrlDown(event.ctrlKey);
    }

    const localPosition = getLocalPoint(event);
    latestPointerLocalRef.current = localPosition;
    const rawPosition = screenToWorld(localPosition);

    if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
      const dx = event.clientX - interaction.startClientX;
      const dy = event.clientY - interaction.startClientY;
      const nextViewport = {
        ...viewport,
        panX: interaction.startPanX + dx,
        panY: interaction.startPanY + dy,
      };
      const nextRawPosition = screenToWorld(localPosition, nextViewport);

      setViewport(nextViewport);
      setPreviewPosition(nextRawPosition);
      setHoverTarget(null);
      return;
    }

    if (interaction.kind === "pendingClick" && interaction.pointerId === event.pointerId) {
      const dx = event.clientX - interaction.startClientX;
      const dy = event.clientY - interaction.startClientY;

      if (Math.hypot(dx, dy) >= PAN_THRESHOLD_PX) {
        const nextViewport = {
          ...viewport,
          panX: interaction.startPanX + dx,
          panY: interaction.startPanY + dy,
        };
        const nextRawPosition = screenToWorld(localPosition, nextViewport);

        setInteraction({
          kind: "pan",
          pointerId: event.pointerId,
          startClientX: interaction.startClientX,
          startClientY: interaction.startClientY,
          startPanX: interaction.startPanX,
          startPanY: interaction.startPanY,
        });
        setViewport(nextViewport);
        setPreviewPosition(nextRawPosition);
        setHoverTarget(null);
        onStatus("正在平移画布。");
        return;
      }
    }

    const ignoredPointId = interaction.kind === "dragPoint" ? interaction.pointId : null;
    const snap = resolveSnap(localPosition, rawPosition, ignoredPointId);
    const nextHover =
      interaction.kind === "idle" || interaction.kind === "pendingClick"
        ? pickPlane2DTarget(localPosition, ignoredPointId)
        : null;

    setPreviewPosition(snap.position);
    setHoverTarget(nextHover);

    if (perpendicularDirectionPick) {
      const preview = getPerpendicularPreview(
        perpendicularDirectionPick.pointId,
        perpendicularDirectionPick.segmentId,
        snap.position,
      );

      if (preview?.kind === "direction") {
        setPerpendicularDirectionPick({
          pointId: perpendicularDirectionPick.pointId,
          segmentId: perpendicularDirectionPick.segmentId,
          side: preview.side,
          length: preview.length,
        });
      }
    }

    if (interaction.kind === "dragPoint" && interaction.pointerId === event.pointerId) {
      const point = document.entities[interaction.pointId];

      if (point?.type !== "plane2d-point" || point.pointKind === "constructed") {
        return;
      }

      setDocument(
        {
          ...document,
          entities: {
            ...document.entities,
            [interaction.pointId]: {
              ...point,
              position: snap.position,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        true,
        { history: "silent" },
      );
    }
  };

  const startPendingPanOrClick = (event: React.PointerEvent<SVGSVGElement>) => {
    setInteraction({
      kind: "pendingClick",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
      ctrlKey: event.ctrlKey,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }

    if (isCtrlDown !== event.ctrlKey) {
      setIsCtrlDown(event.ctrlKey);
    }

    const localPosition = getLocalPoint(event);
    latestPointerLocalRef.current = localPosition;
    const rawPosition = screenToWorld(localPosition);
    const snap = resolveSnap(localPosition, rawPosition);
    const pick = pickPlane2DTarget(localPosition);

    setPreviewPosition(snap.position);
    setHoverTarget(pick);

    if (perpendicularDirectionPick) {
      confirmPerpendicularDirection(snap.position);
      return;
    }

    if (currentTool === "copyCircle" && !copyCircleSourceId) {
      if (pick?.kind === "circle") {
        setCopyCircleSourceId(pick.circleId);
        selectEntity(pick.circleId);
        onStatus("请选择新圆心，或按 Ctrl+K 输入坐标建点。");
        return;
      }

      if (pick?.kind === "point") {
        selectCopyCircleSourceFromPoint(pick.pointId);
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool === "perpendicular") {
      if (pick?.kind === "point") {
        handlePerpendicularTarget({ kind: "point", pointId: pick.pointId }, snap.position);
        return;
      }

      if (pick?.kind === "segment") {
        handlePerpendicularTarget({ kind: "segment", segmentId: pick.segmentId }, snap.position);
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool === "extend") {
      if (pick?.kind === "segment") {
        createOrShowExtensionForSegment(pick.segmentId);
        return;
      }

      if (pick?.kind === "extension") {
        selectEntity(pick.extensionId);
        onStatus("该对象已经是延长部分。");
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool === "calculation") {
      if (isPlacingCalculation) {
        createCalculationAt(snap.position);
        return;
      }

      if (insertCalculationReferenceForPick(pick)) {
        return;
      }

      if (pick?.kind === "calculation") {
        selectEntity(pick.calculationId);
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool === "length") {
      if (pick?.kind === "point") {
        const pickedPoint = document.entities[pick.pointId];

        applyPointInput({
          type: "point",
          position:
            pickedPoint?.type === "plane2d-point" ? pickedPoint.position : snap.position,
          entityId: pick.pointId,
        });
        return;
      }

      if (pick?.kind === "segment") {
        if (lengthFirstPointId) {
          applyPointInput({
            type: "segment",
            position: pick.closestWorld,
            entityId: pick.segmentId,
          });
        } else {
          createLengthMeasurementForSegment(pick.segmentId);
        }
        return;
      }

      if (pick?.kind === "extension") {
        applyPointInput({
          type: "extension",
          position: pick.closestWorld,
          entityId: pick.extensionId,
        });
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool === "angle") {
      if (!angleFirstTarget && pick?.kind === "segment") {
        setAngleFirstTarget({ kind: "segment", segmentId: pick.segmentId });
        selectEntity(pick.segmentId);
        onStatus("请选择第二条线段。");
        return;
      }

      if (angleFirstTarget?.kind === "segment") {
        if (pick?.kind === "segment") {
          createAngleMeasurementForSegments(
            angleFirstTarget.segmentId,
            pick.segmentId,
          );
          return;
        }

        startPendingPanOrClick(event);
        return;
      }

      if (pick?.kind === "point") {
        const pickedPoint = document.entities[pick.pointId];

        applyPointInput({
          type: "point",
          position:
            pickedPoint?.type === "plane2d-point" ? pickedPoint.position : snap.position,
          entityId: pick.pointId,
        });
        return;
      }

      if (pick?.kind === "segment") {
        applyPointInput({
          type: "segment",
          position: pick.closestWorld,
          entityId: pick.segmentId,
        });
        return;
      }

      if (pick?.kind === "extension") {
        applyPointInput({
          type: "extension",
          position: pick.closestWorld,
          entityId: pick.extensionId,
        });
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (currentTool !== "select") {
      if (pick?.kind === "point") {
        const pickedPoint = document.entities[pick.pointId];

        applyPointInput(
          {
            type: "point",
            position:
              pickedPoint?.type === "plane2d-point" ? pickedPoint.position : snap.position,
            entityId: pick.pointId,
          },
          event.ctrlKey,
        );
        return;
      }

      if (pick?.kind === "segment") {
        applyPointInput(
          { type: "segment", position: pick.closestWorld, entityId: pick.segmentId },
          event.ctrlKey,
        );
        return;
      }

      if (pick?.kind === "extension") {
        applyPointInput(
          {
            type: "extension",
            position: pick.closestWorld,
            entityId: pick.extensionId,
          },
          event.ctrlKey,
        );
        return;
      }

      startPendingPanOrClick(event);
      return;
    }

    if (pick?.kind === "point") {
      const point = document.entities[pick.pointId];

      if (event.ctrlKey) {
        if (point?.type === "plane2d-point") {
          togglePointSelection(pick.pointId);
        }
        return;
      }

      selectEntity(pick.pointId);

      if (point?.type === "plane2d-point" && point.pointKind !== "constructed") {
        dragStartDocumentRef.current = document;
        setInteraction({ kind: "dragPoint", pointerId: event.pointerId, pointId: point.id });
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (point?.type === "plane2d-point") {
        onStatus("构造点不能直接拖动。");
      }

      return;
    }

    if (pick?.kind === "segment") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.segmentId);
      return;
    }

    if (pick?.kind === "extension") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.extensionId);
      return;
    }

    if (pick?.kind === "circle") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.circleId);
      return;
    }

    if (pick?.kind === "polygon") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.polygonId);
      return;
    }

    if (pick?.kind === "measurement") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.measurementId);
      return;
    }

    if (pick?.kind === "calculation") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.calculationId);
      return;
    }

    startPendingPanOrClick(event);
  };

  const releasePointerCapture = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isCtrlDown !== event.ctrlKey) {
      setIsCtrlDown(event.ctrlKey);
    }

    const localPosition = getLocalPoint(event);
    latestPointerLocalRef.current = localPosition;
    const rawPosition = screenToWorld(localPosition);
    const snap = resolveSnap(localPosition, rawPosition);

    if (interaction.kind === "pendingClick" && interaction.pointerId === event.pointerId) {
      commitClickAction(snap, interaction.ctrlKey);
      setInteraction({ kind: "idle" });
      releasePointerCapture(event);
      return;
    }

    if (
      (interaction.kind === "pan" || interaction.kind === "dragPoint") &&
      interaction.pointerId === event.pointerId
    ) {
      setInteraction({ kind: "idle" });
      releasePointerCapture(event);
      if (interaction.kind === "pan") {
        onStatus(getBaseToolHint(currentTool));
      } else if (interaction.kind === "dragPoint") {
        const before = dragStartDocumentRef.current;
        const after = latestDocumentRef.current;

        if (before) {
          onChange(after, true, {
            history: "commit",
            label: "移动二维点",
            before,
          });
        }

        dragStartDocumentRef.current = null;
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    const localPosition = getLocalPoint(event);
    latestPointerLocalRef.current = localPosition;
    const worldBefore = screenToWorld(localPosition);
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));
    const nextScale = WORLD_UNIT_TO_CSS_PX * nextZoom;
    const nextViewport = {
      zoom: nextZoom,
      panX: localPosition.x - viewportSize.width / 2 - worldBefore.x * nextScale,
      panY: localPosition.y + worldBefore.y * nextScale - viewportSize.height / 2,
    };
    const rawPosition = screenToWorld(localPosition, nextViewport);

    setViewport(nextViewport);
    setPreviewPosition(resolveSnap(localPosition, rawPosition).position);
    setHoverTarget(pickPlane2DTarget(localPosition));
  };

  const handlePointerLeave = () => {
    if (interaction.kind === "idle") {
      setPreviewPosition(null);
      setHoverTarget(null);
    }
  };

  const cancelPendingToolState = () => {
    onPendingSegmentPointChange(null);
    setCircleCenterPointId(null);
    setCopyCircleSourceId(null);
    clearPolygonPendingState();
    setIsCtrlDown(false);
    setIsPolygonMenuOpen(false);
    setPolygonSidesDialog(null);
    setMidpointFirstPointId(null);
    setPerpendicularFirstTarget(null);
    setPerpendicularDirectionPick(null);
    setLengthFirstPointId(null);
    setAngleFirstTarget(null);
    setAngleVertexPointId(null);
    setCalculationExpression(null);
    setCalculationPendingOp(null);
    setIsPlacingCalculation(false);
    setInteraction({ kind: "idle" });
    onStatus(getBaseToolHint(currentTool));
  };

  const openCoordinateDialog = () => {
    if (
      currentTool === "perpendicular" &&
      perpendicularFirstTarget?.kind === "point" &&
      !perpendicularDirectionPick
    ) {
      onStatus("当前需要选择线段。");
      onToast?.("当前需要选择线段。");
      return;
    }

    if (currentTool === "copyCircle" && !copyCircleSourceId) {
      onStatus("请先选择要复制的圆。");
      onToast?.("请先选择要复制的圆。");
      return;
    }

    const seed = latestPointerLocalRef.current
      ? screenToWorld(latestPointerLocalRef.current)
      : { x: 0, y: 0 };

    setCoordinateDialog({ x: seed.x.toFixed(2), y: seed.y.toFixed(2), error: null });
  };

  const confirmCoordinateDialog = () => {
    if (!coordinateDialog) {
      return;
    }

    const x = Number(coordinateDialog.x);
    const y = Number(coordinateDialog.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setCoordinateDialog({ ...coordinateDialog, error: "请输入有效数字。" });
      return;
    }

    const position = { x, y };
    const existingPoint = findPointNearWorld(position);

    if (perpendicularDirectionPick) {
      confirmPerpendicularDirection(position);
      setCoordinateDialog(null);
      return;
    }

    applyPointInput(
      existingPoint
        ? { type: "point", position: existingPoint.position, entityId: existingPoint.id }
        : { type: "none", position },
    );
    setCoordinateDialog(null);
  };

  const getCurrentHint = (): string => {
    if (perpendicularDirectionPick) {
      return "移动鼠标选择垂线方向，单击确认。";
    }

    if (currentTool === "segment" && pendingSegmentPointId) {
      return "请选择线段第二个端点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "circle" && circleCenterPointId) {
      return "请选择半径点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "copyCircle" && copyCircleSourceId) {
      return "请选择新圆心，或按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "polygon" && polygonVertexPointIds.length === 1 && isCtrlDown) {
      return `正 ${polygonVariant.sides} 边形预览，Ctrl+K 切换方向。`;
    }

    if (currentTool === "polygon" && polygonVertexPointIds.length > 0) {
      return `请选择第 ${polygonVertexPointIds.length + 1}/${polygonVariant.sides} 个顶点，或按 Ctrl+K 输入坐标点。`;
    }

    if (currentTool === "midpoint" && midpointFirstPointId) {
      return "请选择第二个点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "perpendicular" && perpendicularFirstTarget?.kind === "point") {
      return "请选择线段。";
    }

    if (currentTool === "perpendicular" && perpendicularFirstTarget?.kind === "segment") {
      return "请选择点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "length" && lengthFirstPointId) {
      return "请选择第二个点。";
    }

    if (currentTool === "angle" && angleFirstTarget?.kind === "segment") {
      return "请选择第二条线段。";
    }

    if (currentTool === "angle" && angleFirstTarget?.kind === "point" && !angleVertexPointId) {
      return "请选择顶点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "angle" && angleFirstTarget?.kind === "point" && angleVertexPointId) {
      return "请选择第三个点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "calculation" && isPlacingCalculation) {
      return "请在画布中点击放置计算结果。";
    }

    return getBaseToolHint(currentTool);
  };

  const currentHint = getCurrentHint();

  useEffect(() => {
    onStatus(currentHint);

    const shouldToast =
      currentTool !== "select" && !coordinateDialog && lastHintRef.current !== currentHint;

    if (shouldToast) {
      onToast?.(currentHint);
      lastHintRef.current = currentHint;
    }
  }, [coordinateDialog, currentHint, currentTool, onStatus, onToast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        setIsCtrlDown(true);
      }

      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();

        if (currentTool === "polygon" && polygonVertexPointIds.length === 1) {
          setRegularPolygonSide((side) => (side === 1 ? -1 : 1));
          onStatus("已切换正多边形方向。");
          onToast?.("已切换正多边形方向。");
          return;
        }

        openCoordinateDialog();
        return;
      }

      if (event.key === "Escape") {
        if (polygonSidesDialog) {
          setPolygonSidesDialog(null);
          return;
        }

        if (coordinateDialog) {
          setCoordinateDialog(null);
          return;
        }

        cancelPendingToolState();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        setIsCtrlDown(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlDown(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  });

  const pendingPosition = pendingSegmentPointId
    ? getPlane2DPointPosition(document, pendingSegmentPointId)
    : null;
  const circleCenterPosition = circleCenterPointId
    ? getPlane2DPointPosition(document, circleCenterPointId)
    : null;
  const copyCircleSource =
    copyCircleSourceId && document.entities[copyCircleSourceId]?.type === "plane2d-circle"
      ? document.entities[copyCircleSourceId]
      : null;
  const copyCircleSourceGeometry =
    copyCircleSource?.type === "plane2d-circle"
      ? getPlane2DCircleGeometry(document, copyCircleSource)
      : null;
  const midpointFirstPosition = midpointFirstPointId
    ? getPlane2DPointPosition(document, midpointFirstPointId)
    : null;
  const lengthFirstPosition = lengthFirstPointId
    ? getPlane2DPointPosition(document, lengthFirstPointId)
    : null;
  const angleFirstPointPosition =
    angleFirstTarget?.kind === "point"
      ? getPlane2DPointPosition(document, angleFirstTarget.pointId)
      : null;
  const angleVertexPosition = angleVertexPointId
    ? getPlane2DPointPosition(document, angleVertexPointId)
    : null;
  const circlePreviewRadius =
    circleCenterPosition && previewPosition
      ? distanceBetweenVec2(circleCenterPosition, previewPosition)
      : null;
  const copyCirclePreviewRadius =
    copyCircleSourceGeometry && copyCircleSourceGeometry.radius >= POINT_EPSILON
      ? copyCircleSourceGeometry.radius
      : null;
  const polygonVertexPositions = polygonVertexPointIds
    .map((pointId) => getPlane2DPointPosition(document, pointId))
    .filter((point): point is Vec2 => Boolean(point));
  const regularPolygonPreviewVertices =
    currentTool === "polygon" &&
    isCtrlDown &&
    polygonVertexPositions.length === 1 &&
    previewPosition
      ? getRegularPolygonVerticesBySide(
          polygonVertexPositions[0],
          previewPosition,
          polygonVariant.sides,
          regularPolygonSide,
        )
      : null;
  const perpendicularPreview = getPerpendicularLivePreview(previewPosition);
  const anglePreviewValue =
    angleFirstPointPosition && angleVertexPosition && previewPosition
      ? (() => {
          const first = {
            x: angleFirstPointPosition.x - angleVertexPosition.x,
            y: angleFirstPointPosition.y - angleVertexPosition.y,
          };
          const second = {
            x: previewPosition.x - angleVertexPosition.x,
            y: previewPosition.y - angleVertexPosition.y,
          };
          const firstLength = Math.hypot(first.x, first.y);
          const secondLength = Math.hypot(second.x, second.y);

          if (firstLength < POINT_EPSILON || secondLength < POINT_EPSILON) {
            return null;
          }

          const cosine = Math.min(
            1,
            Math.max(-1, (first.x * second.x + first.y * second.y) / (firstLength * secondLength)),
          );

          return (Math.acos(cosine) * 180) / Math.PI;
        })()
      : null;
  const formatVec2 = (position: Vec2) => `${position.x.toFixed(2)}, ${position.y.toFixed(2)}`;
  const svgModeClass =
    interaction.kind === "pan"
      ? "panning"
      : hoverTarget?.kind === "point"
        ? "hover-point"
        : hoverTarget?.kind === "segment" ||
            hoverTarget?.kind === "extension" ||
            hoverTarget?.kind === "circle" ||
            hoverTarget?.kind === "polygon" ||
            hoverTarget?.kind === "measurement" ||
            hoverTarget?.kind === "calculation"
          ? "hover-segment"
          : "can-pan";

  const resetToolPendingState = () => {
    onPendingSegmentPointChange(null);
    setCircleCenterPointId(null);
    setCopyCircleSourceId(null);
    clearPolygonPendingState();
    setIsCtrlDown(false);
    setMidpointFirstPointId(null);
    setPerpendicularFirstTarget(null);
    setPerpendicularDirectionPick(null);
    setLengthFirstPointId(null);
    setAngleFirstTarget(null);
    setAngleVertexPointId(null);
    setCalculationExpression(null);
    setCalculationPendingOp(null);
    setIsPlacingCalculation(false);
    setInteraction({ kind: "idle" });
  };

  const selectPolygonVariant = (variant: Plane2DPolygonVariant) => {
    setPolygonVariant(variant);
    onToolChange("polygon");
    resetToolPendingState();
    setIsPolygonMenuOpen(false);
    onStatus(`请选择 ${variant.sides} 个顶点。按住 Ctrl 可创建正 ${variant.sides} 边形。`);
  };

  const confirmPolygonSidesDialog = () => {
    if (!polygonSidesDialog) {
      return;
    }

    const sides = Number(polygonSidesDialog.value);

    if (!Number.isInteger(sides) || sides < 3 || sides > 50) {
      setPolygonSidesDialog({
        ...polygonSidesDialog,
        error: "请输入不小于 3 且不大于 50 的整数。",
      });
      return;
    }

    setPolygonSidesDialog(null);
    selectPolygonVariant({ kind: "polygon", sides });
  };

  return (
    <section className="plane-canvas-viewport" aria-label="平面画布">
      <aside className="plane2d-toolbar" aria-label="平面画布工具栏">
        <div className="plane2d-toolbar-title">平面工具</div>
        <div className="plane2d-toolbar-groups">
          {planeToolGroups.map((group) => (
            <section className="plane2d-tool-group" key={group.title}>
              <h2>{group.title}</h2>
              <div className="plane2d-tool-list">
                {group.tools.map((tool) =>
                  tool === "polygon" ? (
                    <div className="plane2d-tool-with-menu" key={tool}>
                      <button
                        className={
                          currentTool === tool ? "tool-button active" : "tool-button"
                        }
                        onClick={() => selectPolygonVariant(polygonVariant)}
                        title={planeToolLabels[tool]}
                        type="button"
                      >
                        <Plane2DPolygonIcon />
                        <span>{planeToolLabels[tool]}</span>
                      </button>
                      <button
                        aria-label="展开多边形选项"
                        className="plane2d-tool-menu-toggle"
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsPolygonMenuOpen((isOpen) => !isOpen);
                        }}
                        ref={polygonMenuToggleRef}
                        type="button"
                      >
                        ›
                      </button>
                      {isPolygonMenuOpen ? (
                        <FloatingSubmenu
                          anchorElement={polygonMenuToggleRef.current}
                          ariaLabel="多边形选项"
                          className="plane2d-tool-flyout"
                          onClose={() => setIsPolygonMenuOpen(false)}
                          open={isPolygonMenuOpen}
                        >
                          <button
                            onClick={() =>
                              selectPolygonVariant({ kind: "triangle", sides: 3 })
                            }
                            type="button"
                          >
                            三角形
                          </button>
                          <button
                            onClick={() =>
                              selectPolygonVariant({
                                kind: "quadrilateral",
                                sides: 4,
                              })
                            }
                            type="button"
                          >
                            四边形
                          </button>
                          <button
                            onClick={() => {
                              setIsPolygonMenuOpen(false);
                              setPolygonSidesDialog({
                                value: String(
                                  polygonVariant.kind === "polygon"
                                    ? polygonVariant.sides
                                    : 5,
                                ),
                                error: null,
                              });
                            }}
                            type="button"
                          >
                            多边形
                          </button>
                        </FloatingSubmenu>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      className={
                        currentTool === tool ? "tool-button active" : "tool-button"
                      }
                      key={tool}
                      onClick={() => {
                        onToolChange(tool);
                        resetToolPendingState();
                        setIsPolygonMenuOpen(false);
                      }}
                      title={planeToolLabels[tool]}
                      type="button"
                    >
                      {tool === "extend" ? (
                        <Plane2DExtendIcon />
                      ) : tool === "copyCircle" ? (
                        <Plane2DCopyCircleIcon />
                      ) : (
                        <span className="plane2d-tool-icon" aria-hidden="true">
                          {planeToolIcons[tool]}
                        </span>
                      )}
                      <span>{planeToolLabels[tool]}</span>
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </aside>
      <svg
        className={`plane2d-svg ${svgModeClass}`}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={svgRef}
        viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
      >
        <g>
          {circles.map((circle) => {
            const geometry = getPlane2DCircleGeometry(document, circle);
            if (!geometry || geometry.radius < POINT_EPSILON) return null;
            const centerScreen = worldToScreen(geometry.center);
            const radiusScreen = distanceBetweenVec2(centerScreen, worldToScreen(geometry.radiusPoint));
            const isSelected = selectedEntityIdSet.has(circle.id);
            const isHovered = hoverTarget?.kind === "circle" && hoverTarget.circleId === circle.id;
            return (
              <g key={circle.id}>
                <circle
                  className={["plane2d-circle", isSelected ? "selected" : "", isHovered ? "hovered" : ""].join(" ")}
                  cx={centerScreen.x}
                  cy={centerScreen.y}
                  r={radiusScreen}
                  strokeWidth={isSelected || isHovered ? document.settings.lineWidthPx + 2 : document.settings.lineWidthPx}
                />
                {circle.showName && circle.name?.trim() ? (
                  <text className="plane2d-label" x={centerScreen.x + radiusScreen + 8} y={centerScreen.y - 8}>
                    {circle.name.trim()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {polygons.map((polygon) => {
            const polygonPoints = getPlane2DPolygonPoints(document, polygon);
            if (!polygonPoints || polygonPoints.length < 3) return null;
            const isSelected = selectedEntityIdSet.has(polygon.id);
            const isHovered =
              hoverTarget?.kind === "polygon" && hoverTarget.polygonId === polygon.id;
            const screenPoints = polygonPoints.map((point) => worldToScreen(point));
            const pointsAttribute = screenPoints
              .map((point) => `${point.x},${point.y}`)
              .join(" ");
            const centroid = {
              x:
                screenPoints.reduce((sum, point) => sum + point.x, 0) /
                screenPoints.length,
              y:
                screenPoints.reduce((sum, point) => sum + point.y, 0) /
                screenPoints.length,
            };

            return (
              <g key={polygon.id}>
                <polygon
                  className={[
                    "plane2d-polygon",
                    isSelected ? "selected" : "",
                    isHovered ? "hovered" : "",
                  ].join(" ")}
                  points={pointsAttribute}
                  strokeWidth={
                    isSelected || isHovered
                      ? document.settings.lineWidthPx + 2
                      : document.settings.lineWidthPx
                  }
                />
                {polygon.showName && polygon.name?.trim() ? (
                  <text className="plane2d-label" x={centroid.x + 8} y={centroid.y - 8}>
                    {polygon.name.trim()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {segments.map((segment) => {
            const positions = getPlane2DSegmentPositions(document, segment);
            if (!positions) return null;
            const isSelected = selectedEntityIdSet.has(segment.id);
            const isHovered = hoverTarget?.kind === "segment" && hoverTarget.segmentId === segment.id;
            const startScreen = worldToScreen(positions[0]);
            const endScreen = worldToScreen(positions[1]);
            return (
              <g key={segment.id}>
                <line
                  className={[
                    "plane2d-segment",
                    segment.segmentKind === "extension" ? "extension" : "",
                    isSelected ? "selected" : "",
                    isHovered ? "hovered" : "",
                  ].join(" ")}
                  strokeWidth={isSelected || isHovered ? document.settings.lineWidthPx + 2 : document.settings.lineWidthPx}
                  x1={startScreen.x}
                  x2={endScreen.x}
                  y1={startScreen.y}
                  y2={endScreen.y}
                />
                {segment.showName && segment.name?.trim() ? (
                  <text className="plane2d-label" x={(startScreen.x + endScreen.x) / 2 + 8} y={(startScreen.y + endScreen.y) / 2 - 8}>
                    {segment.name.trim()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {extensionViewportParts.map((part, index) => {
            const extension = document.entities[part.extensionId];

            if (extension?.type !== "plane2d-extension") {
              return null;
            }

            const isSelected = selectedEntityIdSet.has(extension.id);
            const isHovered =
              hoverTarget?.kind === "extension" &&
              hoverTarget.extensionId === extension.id;
            const startScreen = worldToScreen(part.start);
            const endScreen = worldToScreen(part.end);
            const shouldShowLabel =
              index ===
                extensionViewportParts.findIndex(
                  (candidate) => candidate.extensionId === extension.id,
                ) &&
              extension.showName &&
              extension.name?.trim();

            return (
              <g key={`${extension.id}-${part.part}`}>
                <line
                  className={[
                    "plane2d-extension-segment",
                    isSelected ? "selected" : "",
                    isHovered ? "hovered" : "",
                  ].join(" ")}
                  strokeWidth={isSelected || isHovered ? document.settings.lineWidthPx + 2 : document.settings.lineWidthPx}
                  x1={startScreen.x}
                  x2={endScreen.x}
                  y1={startScreen.y}
                  y2={endScreen.y}
                />
                {shouldShowLabel ? (
                  <text className="plane2d-label" x={(startScreen.x + endScreen.x) / 2 + 8} y={(startScreen.y + endScreen.y) / 2 - 8}>
                    {extension.name?.trim()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {measurements.map((measurement) => {
            const info = getPlane2DMeasurementInfo(document, measurement);

            if (!info) {
              return null;
            }

            const position = worldToScreen(info.position);
            const isSelected = selectedEntityIdSet.has(measurement.id);
            const isHovered =
              hoverTarget?.kind === "measurement" &&
              hoverTarget.measurementId === measurement.id;

            return (
              <text
                className={[
                  "plane2d-measurement-label",
                  isSelected ? "selected" : "",
                  isHovered ? "hovered" : "",
                ].join(" ")}
                key={measurement.id}
                x={position.x + 8}
                y={position.y - 8}
              >
                {info.label}
              </text>
            );
          })}
          {calculations.map((calculation) => {
            const info = getPlane2DCalculationInfo(document, calculation);
            const result = evaluatePlane2DCalculation(document, calculation.expression);
            const position = worldToScreen(info.position);
            const isSelected = selectedEntityIdSet.has(calculation.id);
            const isHovered =
              hoverTarget?.kind === "calculation" &&
              hoverTarget.calculationId === calculation.id;

            return (
              <foreignObject
                className={[
                  "plane2d-calculation-label",
                  isSelected ? "selected" : "",
                  isHovered ? "hovered" : "",
                ].join(" ")}
                height={86}
                key={calculation.id}
                width={190}
                x={position.x + 8}
                y={position.y - 8}
              >
                <div className="plane2d-calculation-label-content">
                  <FormulaView
                    expression={calculation.expression}
                    getReferenceLabel={getCalculationReferenceLabel}
                  />
                  <div>
                    ={" "}
                    {result.ok
                      ? formatCalculationValue(result.value)
                      : "引用失效"}
                  </div>
                </div>
              </foreignObject>
            );
          })}
          {pendingPosition && previewPosition ? (
            <line
              className="plane2d-segment preview"
              strokeWidth={document.settings.lineWidthPx}
              x1={worldToScreen(pendingPosition).x}
              x2={worldToScreen(previewPosition).x}
              y1={worldToScreen(pendingPosition).y}
              y2={worldToScreen(previewPosition).y}
            />
          ) : null}
          {midpointFirstPosition && previewPosition ? (
            <g>
              <line
                className="plane2d-segment preview"
                strokeWidth={document.settings.lineWidthPx}
                x1={worldToScreen(midpointFirstPosition).x}
                x2={worldToScreen(previewPosition).x}
                y1={worldToScreen(midpointFirstPosition).y}
                y2={worldToScreen(previewPosition).y}
              />
              <circle
                className="plane2d-point preview"
                cx={worldToScreen(midpointVec2(midpointFirstPosition, previewPosition)).x}
                cy={worldToScreen(midpointVec2(midpointFirstPosition, previewPosition)).y}
                r={document.settings.pointSizePx / 2}
              />
            </g>
          ) : null}
          {lengthFirstPosition && previewPosition ? (
            <line
              className="plane2d-segment preview measurement-preview"
              strokeWidth={document.settings.lineWidthPx}
              x1={worldToScreen(lengthFirstPosition).x}
              x2={worldToScreen(previewPosition).x}
              y1={worldToScreen(lengthFirstPosition).y}
              y2={worldToScreen(previewPosition).y}
            />
          ) : null}
          {angleFirstPointPosition && angleVertexPosition && previewPosition ? (
            <g>
              <line
                className="plane2d-segment preview measurement-preview"
                strokeWidth={document.settings.lineWidthPx}
                x1={worldToScreen(angleVertexPosition).x}
                x2={worldToScreen(angleFirstPointPosition).x}
                y1={worldToScreen(angleVertexPosition).y}
                y2={worldToScreen(angleFirstPointPosition).y}
              />
              <line
                className="plane2d-segment preview measurement-preview"
                strokeWidth={document.settings.lineWidthPx}
                x1={worldToScreen(angleVertexPosition).x}
                x2={worldToScreen(previewPosition).x}
                y1={worldToScreen(angleVertexPosition).y}
                y2={worldToScreen(previewPosition).y}
              />
            </g>
          ) : null}
          {circleCenterPosition && previewPosition && circlePreviewRadius ? (
            <g>
              <circle
                className="plane2d-circle preview"
                cx={worldToScreen(circleCenterPosition).x}
                cy={worldToScreen(circleCenterPosition).y}
                r={distanceBetweenVec2(worldToScreen(circleCenterPosition), worldToScreen(previewPosition))}
                strokeWidth={document.settings.lineWidthPx}
              />
              <line
                className="plane2d-segment preview"
                strokeWidth={document.settings.lineWidthPx}
                x1={worldToScreen(circleCenterPosition).x}
                x2={worldToScreen(previewPosition).x}
                y1={worldToScreen(circleCenterPosition).y}
                y2={worldToScreen(previewPosition).y}
              />
            </g>
          ) : null}
          {copyCircleSourceId && previewPosition && copyCirclePreviewRadius ? (
            <circle
              className="plane2d-circle preview"
              cx={worldToScreen(previewPosition).x}
              cy={worldToScreen(previewPosition).y}
              r={distanceBetweenVec2(
                worldToScreen(previewPosition),
                worldToScreen({
                  x: previewPosition.x + copyCirclePreviewRadius,
                  y: previewPosition.y,
                }),
              )}
              strokeWidth={document.settings.lineWidthPx}
            />
          ) : null}
          {polygonVertexPositions.length > 0 && previewPosition && !regularPolygonPreviewVertices ? (
            <g>
              <polyline
                className="plane2d-polygon preview"
                points={[...polygonVertexPositions, previewPosition]
                  .map((point) => worldToScreen(point))
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                strokeWidth={document.settings.lineWidthPx}
              />
              {polygonVertexPositions.length >= 2 ? (
                <line
                  className="plane2d-polygon preview"
                  strokeWidth={document.settings.lineWidthPx}
                  x1={worldToScreen(previewPosition).x}
                  x2={worldToScreen(polygonVertexPositions[0]).x}
                  y1={worldToScreen(previewPosition).y}
                  y2={worldToScreen(polygonVertexPositions[0]).y}
                />
              ) : null}
            </g>
          ) : null}
          {regularPolygonPreviewVertices && previewPosition ? (
            <g>
              <line
                className="plane2d-segment preview"
                strokeWidth={document.settings.lineWidthPx}
                x1={worldToScreen(regularPolygonPreviewVertices[0]).x}
                x2={worldToScreen(previewPosition).x}
                y1={worldToScreen(regularPolygonPreviewVertices[0]).y}
                y2={worldToScreen(previewPosition).y}
              />
              <polygon
                className="plane2d-polygon preview"
                points={regularPolygonPreviewVertices
                  .map((point) => worldToScreen(point))
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                strokeWidth={document.settings.lineWidthPx}
              />
            </g>
          ) : null}
          {perpendicularPreview ? (
            <line
              className="plane2d-segment preview"
              strokeWidth={document.settings.lineWidthPx + 1}
              x1={worldToScreen(perpendicularPreview.start).x}
              x2={worldToScreen(perpendicularPreview.end).x}
              y1={worldToScreen(perpendicularPreview.start).y}
              y2={worldToScreen(perpendicularPreview.end).y}
            />
          ) : null}
          {points.map((point) => {
            const isSelected = selectedEntityIdSet.has(point.id);
            const isHovered = hoverTarget?.kind === "point" && hoverTarget.pointId === point.id;
            const pointScreen = worldToScreen(point.position);
            return (
              <g key={point.id}>
                <circle
                  className={["plane2d-point", point.pointKind === "constructed" ? "constructed" : "", isSelected ? "selected" : "", isHovered ? "hovered" : ""].join(" ")}
                  cx={pointScreen.x}
                  cy={pointScreen.y}
                  r={isSelected || isHovered ? document.settings.pointSizePx / 2 + 2 : point.pointKind === "constructed" ? document.settings.pointSizePx / 2 - 1 : document.settings.pointSizePx / 2}
                />
                {point.showName && point.name?.trim() ? (
                  <text className="plane2d-label" x={pointScreen.x + 8} y={pointScreen.y - 8}>
                    {point.name.trim()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {previewPosition && currentTool !== "select" && interaction.kind !== "pan" ? (
            <circle
              className="plane2d-point preview"
              cx={worldToScreen(previewPosition).x}
              cy={worldToScreen(previewPosition).y}
              r={document.settings.pointSizePx / 2}
            />
          ) : null}
        </g>
      </svg>
      {currentTool === "calculation" ? (
        <section className="plane2d-calculation-panel" aria-label="计算面板">
          <h3>计算</h3>
          <div className="formula-editor-preview">
            {calculationExpression ? (
              <FormulaView
                expression={calculationExpression}
                getReferenceLabel={getCalculationReferenceLabel}
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
            <button onClick={() => openCalculationPointPicker("distance")} type="button">
              加入边
            </button>
            <button onClick={() => openCalculationPointPicker("angle")} type="button">
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
                onStatus("请在画布中点击放置计算结果。");
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
                      .map((pointId, index) => {
                        const point = document.entities[pointId];
                        const label =
                          point?.type === "plane2d-point"
                            ? getEntityDisplayName(point)
                            : pointId;
                        return `${index + 1}. ${label}`;
                      })
                      .join(" / ")
                  : calculationPointPicker.mode === "distance"
                    ? "请选择第 1 个点"
                    : "请选择第 1 个点，第二个点为顶点"}
              </div>
              <div className="calculation-point-list">
                {points
                  .filter((point) => {
                    const query = calculationPointPicker.searchQuery
                      .trim()
                      .toLowerCase();
                    if (!query) {
                      return true;
                    }
                    return (
                      getEntityDisplayName(point).toLowerCase().includes(query) ||
                      getPointTypeLabel(point).toLowerCase().includes(query)
                    );
                  })
                  .map((point) => {
                    const selected =
                      calculationPointPicker.selectedPointIds.includes(point.id);

                    return (
                      <button
                        className={selected ? "selected" : undefined}
                        key={point.id}
                        onClick={() => toggleCalculationPoint(point.id)}
                        type="button"
                      >
                        <span>{getEntityDisplayName(point)}</span>
                        <small>{getPointTypeLabel(point)}</small>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
          {calculationPendingOp ? <p>请选择下一个引用。</p> : null}
        </section>
      ) : null}
      <div className="plane2d-readout">
        工具：{planeToolLabels[currentTool]}
        {previewPosition ? ` / 坐标 (${formatVec2(previewPosition)})` : ""}
        {circlePreviewRadius ? ` / 半径 ${circlePreviewRadius.toFixed(2)}` : ""}
        {copyCircleSourceId && copyCirclePreviewRadius ? ` / 复制半径 ${copyCirclePreviewRadius.toFixed(2)}` : ""}
        {currentTool === "polygon"
          ? regularPolygonPreviewVertices
            ? ` / 正 ${polygonVariant.sides} 边形预览 / Ctrl+K 切换方向`
            : ` / ${polygonVariant.sides} 边形`
          : ""}
        {polygonVertexPointIds.length > 0 ? ` / 顶点 ${polygonVertexPointIds.length}/${polygonVariant.sides}` : ""}
        {perpendicularPreview?.kind === "direction" ? ` / 垂线长度 ${perpendicularPreview.length.toFixed(2)}` : ""}
        {lengthFirstPosition && previewPosition ? ` / 当前长度 ${distanceBetweenVec2(lengthFirstPosition, previewPosition).toFixed(2)}` : ""}
        {anglePreviewValue !== null ? ` / 当前角度 ${anglePreviewValue.toFixed(2)}°` : ""}
        {currentTool === "calculation" && isPlacingCalculation ? " / 放置计算结果" : ""}
        {` / 缩放 ${Math.round(viewport.zoom * 100)}%`}
        {interaction.kind === "pan" ? " / 正在平移" : ""}
        {hoverTarget ? ` / 悬停 ${hoverTarget.kind}` : " / 悬停 none"}
        {selectedEntity ? ` / 已选 ${getEntityDisplayName(selectedEntity)}` : ""}
      </div>
      {coordinateDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-label="输入点坐标" className="coordinate-point-modal" role="dialog">
            <header className="modal-header">
              <h2>输入点坐标</h2>
              <button aria-label="关闭" onClick={() => setCoordinateDialog(null)} type="button">
                x
              </button>
            </header>
            <p className="plane2d-dialog-hint">
              将在当前平面画布中创建指定坐标的点，并用于当前工具。
            </p>
            <div className="coordinate-point-form">
              {(["x", "y"] as const).map((axis) => (
                <label className="form-field" key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    autoFocus={axis === "x"}
                    value={coordinateDialog[axis]}
                    onChange={(event) => setCoordinateDialog({ ...coordinateDialog, [axis]: event.target.value, error: null })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") confirmCoordinateDialog();
                    }}
                  />
                </label>
              ))}
              {coordinateDialog.error ? <span className="form-error">{coordinateDialog.error}</span> : null}
              <div className="modal-actions">
                <button onClick={() => setCoordinateDialog(null)} type="button">取消</button>
                <button onClick={confirmCoordinateDialog} type="button">确定</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {polygonSidesDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-label="输入多边形边数" className="coordinate-point-modal" role="dialog">
            <header className="modal-header">
              <h2>输入多边形边数</h2>
              <button aria-label="关闭" onClick={() => setPolygonSidesDialog(null)} type="button">
                x
              </button>
            </header>
            <p className="plane2d-dialog-hint">请输入不小于 3 的整数。</p>
            <div className="coordinate-point-form">
              <label className="form-field">
                <span>边数</span>
                <input
                  autoFocus
                  value={polygonSidesDialog.value}
                  onChange={(event) =>
                    setPolygonSidesDialog({
                      value: event.target.value,
                      error: null,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmPolygonSidesDialog();
                  }}
                />
              </label>
              {polygonSidesDialog.error ? (
                <span className="form-error">{polygonSidesDialog.error}</span>
              ) : null}
              <div className="modal-actions">
                <button onClick={() => setPolygonSidesDialog(null)} type="button">取消</button>
                <button onClick={confirmPolygonSidesDialog} type="button">确定</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

