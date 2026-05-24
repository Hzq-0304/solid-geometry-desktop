import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Plane2DCircleEntity,
  Plane2DPointEntity,
  Plane2DSegmentEntity,
  Plane2DToolName,
  PlaneCanvasDocument,
  Vec2,
} from "../core/plane2d/PlaneCanvasTypes";
import {
  createPlane2DCircle,
  createPlane2DPoint,
  createPlane2DSegment,
  distanceBetweenVec2,
  getClosestPointOnSegment2D,
  getPerpendicularEndpointOnLine2D,
  getPerpendicularFootOnLine2D,
  getPlane2DCircleGeometry,
  getPlane2DPointPosition,
  getPlane2DSegmentPositions,
  getSignedPerpendicularSide2D,
  midpointVec2,
  plane2DMidpointId,
  plane2DPerpendicularEndpointId,
  plane2DPerpendicularFootId,
  syncPlane2DConstructions,
} from "../core/plane2d/planeCanvasUtils";

interface PlaneCanvasViewportProps {
  readonly document: PlaneCanvasDocument;
  readonly currentTool: Plane2DToolName;
  readonly pendingSegmentPointId: string | null;
  readonly onChange: (document: PlaneCanvasDocument, dirty?: boolean) => void;
  readonly onToolChange: (tool: Plane2DToolName) => void;
  readonly onPendingSegmentPointChange: (pointId: string | null) => void;
  readonly onStatus: (message: string | null) => void;
  readonly onToast?: (message: string) => void;
}

type Plane2DSnapResult =
  | { readonly type: "point"; readonly position: Vec2; readonly entityId: string }
  | { readonly type: "segment"; readonly position: Vec2; readonly entityId: string }
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
  | { readonly kind: "circle"; readonly circleId: string; readonly distancePx: number };

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

const POINT_EPSILON = 1e-5;
const WORLD_UNIT_TO_CSS_PX = 37.7952755906;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const PAN_THRESHOLD_PX = 4;
const CIRCLE_HIT_RADIUS_PX = 8;
const DEFAULT_PERPENDICULAR_LENGTH = 2;

const makePlane2DId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const planeToolLabels: Record<Plane2DToolName, string> = {
  select: "选择",
  point: "点",
  segment: "线段",
  circle: "圆",
  midpoint: "中点",
  perpendicular: "垂直",
};

const getBaseToolHint = (tool: Plane2DToolName): string => {
  switch (tool) {
    case "point":
      return "单击创建点，或按 Ctrl+K 输入坐标建点。";
    case "segment":
      return "请选择线段端点，也可按 Ctrl+K 输入坐标建点。";
    case "circle":
      return "请选择圆心或半径点，也可按 Ctrl+K 输入坐标建点。";
    case "midpoint":
      return "请选择两个点，也可按 Ctrl+K 输入坐标建点。";
    case "perpendicular":
      return "请选择点和线段，也可按 Ctrl+K 输入坐标建点。";
    default:
      return "选择对象，拖动空白处可平移画布。";
  }
};
const getEntityDisplayName = (
  entity:
    | Plane2DPointEntity
    | Plane2DSegmentEntity
    | Plane2DCircleEntity
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
  onChange,
  onToolChange,
  onPendingSegmentPointChange,
  onStatus,
  onToast,
}: PlaneCanvasViewportProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const latestPointerLocalRef = useRef<Vec2 | null>(null);
  const lastHintRef = useRef<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Vec2 | null>(null);
  const [hoverTarget, setHoverTarget] = useState<Plane2DPickResult | null>(null);
  const [interaction, setInteraction] = useState<Plane2DInteractionState>({
    kind: "idle",
  });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState<Plane2DViewportState>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });
  const [circleCenterPointId, setCircleCenterPointId] = useState<string | null>(null);
  const [midpointFirstPointId, setMidpointFirstPointId] = useState<string | null>(null);
  const [perpendicularFirstTarget, setPerpendicularFirstTarget] =
    useState<PerpendicularFirstTarget | null>(null);
  const [perpendicularDirectionPick, setPerpendicularDirectionPick] =
    useState<PerpendicularDirectionPickState | null>(null);
  const [coordinateDialog, setCoordinateDialog] =
    useState<CoordinateDialogState | null>(null);

  const selectedEntityId = document.selectedEntityIds[0] ?? null;
  const selectedEntityIdSet = new Set(document.selectedEntityIds);
  const selectedEntity = selectedEntityId
    ? document.entities[selectedEntityId]
    : null;

  const points = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DPointEntity =>
          entity.type === "plane2d-point",
      ),
    [document.entities],
  );
  const segments = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DSegmentEntity =>
          entity.type === "plane2d-segment",
      ),
    [document.entities],
  );
  const circles = useMemo(
    () =>
      Object.values(document.entities).filter(
        (entity): entity is Plane2DCircleEntity =>
          entity.type === "plane2d-circle",
      ),
    [document.entities],
  );

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

  const setDocument = (nextDocument: PlaneCanvasDocument, dirty = true) => {
    onChange(syncPlane2DConstructions(nextDocument), dirty);
  };

  const selectEntity = (entityId: string | null) => {
    onChange({ ...document, selectedEntityIds: entityId ? [entityId] : [] }, false);
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

    return circleCandidate ?? null;
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

  const applyPointInput = (snap: Plane2DSnapResult) => {
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
    }
  };

  const commitClickAction = (snap: Plane2DSnapResult, ctrlKey = false) => {
    if (
      currentTool === "point" ||
      currentTool === "segment" ||
      currentTool === "circle" ||
      currentTool === "midpoint" ||
      currentTool === "perpendicular"
    ) {
      applyPointInput(snap);
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

    if (snap.type === "segment" || snap.type === "circle") {
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

      setDocument({
        ...document,
        entities: {
          ...document.entities,
          [interaction.pointId]: {
            ...point,
            position: snap.position,
            updatedAt: new Date().toISOString(),
          },
        },
      });
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

    if (currentTool !== "select") {
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
        applyPointInput({ type: "segment", position: pick.closestWorld, entityId: pick.segmentId });
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

    if (pick?.kind === "circle") {
      if (event.ctrlKey) {
        onStatus("连续命名仅支持点。");
        return;
      }

      selectEntity(pick.circleId);
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
    setMidpointFirstPointId(null);
    setPerpendicularFirstTarget(null);
    setPerpendicularDirectionPick(null);
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

    if (currentTool === "midpoint" && midpointFirstPointId) {
      return "请选择第二个点，也可按 Ctrl+K 输入坐标建点。";
    }

    if (currentTool === "perpendicular" && perpendicularFirstTarget?.kind === "point") {
      return "请选择线段。";
    }

    if (currentTool === "perpendicular" && perpendicularFirstTarget?.kind === "segment") {
      return "请选择点，也可按 Ctrl+K 输入坐标建点。";
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
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCoordinateDialog();
        return;
      }

      if (event.key === "Escape") {
        if (coordinateDialog) {
          setCoordinateDialog(null);
          return;
        }

        cancelPendingToolState();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const pendingPosition = pendingSegmentPointId
    ? getPlane2DPointPosition(document, pendingSegmentPointId)
    : null;
  const circleCenterPosition = circleCenterPointId
    ? getPlane2DPointPosition(document, circleCenterPointId)
    : null;
  const midpointFirstPosition = midpointFirstPointId
    ? getPlane2DPointPosition(document, midpointFirstPointId)
    : null;
  const circlePreviewRadius =
    circleCenterPosition && previewPosition
      ? distanceBetweenVec2(circleCenterPosition, previewPosition)
      : null;
  const perpendicularPreview = getPerpendicularLivePreview(previewPosition);
  const formatVec2 = (position: Vec2) => `${position.x.toFixed(2)}, ${position.y.toFixed(2)}`;
  const svgModeClass =
    interaction.kind === "pan"
      ? "panning"
      : hoverTarget?.kind === "point"
        ? "hover-point"
        : hoverTarget?.kind === "segment" || hoverTarget?.kind === "circle"
          ? "hover-segment"
          : "can-pan";

  return (
    <section className="plane-canvas-viewport" aria-label="平面画布">
      <aside className="plane2d-toolbar" aria-label="平面画布工具栏">
        <div className="plane2d-toolbar-title">平面工具</div>
        {(["select", "point", "segment", "circle", "midpoint", "perpendicular"] as const).map((tool) => (
          <button
            className={currentTool === tool ? "tool-button active" : "tool-button"}
            key={tool}
            onClick={() => {
              onToolChange(tool);
              onPendingSegmentPointChange(null);
              setCircleCenterPointId(null);
              setMidpointFirstPointId(null);
              setPerpendicularFirstTarget(null);
              setPerpendicularDirectionPick(null);
              setInteraction({ kind: "idle" });
            }}
            title={planeToolLabels[tool]}
            type="button"
          >
            {planeToolLabels[tool]}
          </button>
        ))}
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
      <div className="plane2d-readout">
        工具：{planeToolLabels[currentTool]}
        {previewPosition ? ` / 坐标 (${formatVec2(previewPosition)})` : ""}
        {circlePreviewRadius ? ` / 半径 ${circlePreviewRadius.toFixed(2)}` : ""}
        {perpendicularPreview?.kind === "direction" ? ` / 垂线长度 ${perpendicularPreview.length.toFixed(2)}` : ""}
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
    </section>
  );
}

