import * as THREE from "three";
import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "../../core/document/BoardDocument";
import type {
  EntityId,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../../core/document/EntityTypes";
import {
  createVec3,
  snapNumberToGrid,
} from "../../core/geometry/geometryUtils";
import {
  getPlaneFromThreePoints,
  getPlanePoints,
} from "../../core/geometry/planeUtils";
import type { Vec3 } from "../../core/geometry/Vec3";
import type { SnapResult } from "../../core/snap/SnapTypes";
import type { ScreenPosition } from "./screenSpaceUtils";
import {
  distancePointToScreenPoint,
  distanceScreenPointToSegment,
  distanceScreenPointToWorldSegmentProjection,
  worldPositionToScreenPosition,
} from "./screenSpaceUtils";

interface ScreenSpaceSnapContext {
  readonly document: BoardDocument;
  readonly activeDrawingPlane: ActiveDrawingPlane;
  readonly rawWorldPosition: Vec3;
  readonly pointerScreenPosition: ScreenPosition;
  readonly camera: THREE.Camera;
  readonly canvas: HTMLCanvasElement;
  readonly ignoredEntityIds?: readonly EntityId[];
  readonly planeSnapEntityId?: EntityId | null;
}

interface PointCandidate {
  readonly point: PointEntity;
  readonly distance: number;
}

interface SegmentCandidate {
  readonly segment: SegmentEntity;
  readonly distance: number;
  readonly position: Vec3;
}

interface AxisCandidate {
  readonly axisName: "X" | "Y" | "Z";
  readonly distance: number;
  readonly position: Vec3;
}

interface AxisGridPointCandidate extends AxisCandidate {}

const AXIS_SAMPLE_LENGTH = 20;
const SCREEN_DISTANCE_TIE_THRESHOLD = 3;

const SNAP_PRIORITIES = {
  point: 0,
  origin: 1,
  axisGridPoint: 2,
  segment: 3,
  axis: 4,
  entityPlane: 5,
  grid: 6,
  drawingPlane: 7,
} as const;

const MAX_PLANE_SNAP_COORDINATE = 10000;

type ScreenSpaceSnapCandidate = SnapResult & {
  readonly screenDistance: number;
  readonly cameraDistance: number;
  readonly priority: number;
  readonly worldDistance: number;
};

const getPointSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.pointSnapPixelRadius ?? document.settings.snapPixelRadius;

const getSegmentSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.segmentSnapPixelRadius ?? document.settings.snapPixelRadius;

const getAxisSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.axisSnapPixelRadius ?? document.settings.snapPixelRadius;

const getOriginSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.originSnapPixelRadius ?? document.settings.snapPixelRadius;

const getAxisGridPointSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.axisGridPointSnapPixelRadius ??
  document.settings.axisSnapPixelRadius ??
  document.settings.snapPixelRadius;

const getGridSnapPixelRadius = (document: BoardDocument): number =>
  document.settings.gridSnapPixelRadius ?? document.settings.snapPixelRadius;

const getCameraDistance = (
  context: ScreenSpaceSnapContext,
  position: Vec3,
): number =>
  Math.hypot(
    position.x - context.camera.position.x,
    position.y - context.camera.position.y,
    position.z - context.camera.position.z,
  );

const getWorldDistance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const getScreenDistanceToPosition = (
  context: ScreenSpaceSnapContext,
  position: Vec3,
): number => {
  const screenPosition = worldPositionToScreenPosition(
    position,
    context.camera,
    context.canvas,
  );

  return screenPosition
    ? distancePointToScreenPoint(context.pointerScreenPosition, screenPosition)
    : Number.POSITIVE_INFINITY;
};

const createCandidate = (
  context: ScreenSpaceSnapContext,
  candidate: SnapResult & {
    readonly screenDistance: number;
    readonly priority: number;
  },
): ScreenSpaceSnapCandidate => {
  const cameraDistance = getCameraDistance(context, candidate.position);
  const worldDistance = getWorldDistance(
    context.rawWorldPosition,
    candidate.position,
  );

  return {
    ...candidate,
    distance: candidate.screenDistance,
    screenDistance: candidate.screenDistance,
    cameraDistance,
    priority: candidate.priority,
    worldDistance,
  };
};

const compareCandidates = (
  a: ScreenSpaceSnapCandidate,
  b: ScreenSpaceSnapCandidate,
): number => {
  const priorityDifference = a.priority - b.priority;

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (Math.abs(a.screenDistance - b.screenDistance) <= SCREEN_DISTANCE_TIE_THRESHOLD) {
    return (
      a.cameraDistance - b.cameraDistance ||
      a.screenDistance - b.screenDistance
    );
  }

  return (
    a.screenDistance - b.screenDistance ||
    a.cameraDistance - b.cameraDistance
  );
};

const getBestCandidate = (
  candidates: readonly ScreenSpaceSnapCandidate[],
): ScreenSpaceSnapCandidate | null => {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(compareCandidates)[0];
};

const projectToDrawingPlane = (
  position: Vec3,
  activeDrawingPlane: ActiveDrawingPlane,
): Vec3 => {
  switch (activeDrawingPlane) {
    case "XY":
      return createVec3(position.x, position.y, 0);
    case "XZ":
      return createVec3(position.x, 0, position.z);
    case "YZ":
      return createVec3(0, position.y, position.z);
  }
};

const getGridSnapPosition = (
  position: Vec3,
  gridSize: number,
  activeDrawingPlane: ActiveDrawingPlane,
): Vec3 => {
  switch (activeDrawingPlane) {
    case "XY":
      return createVec3(
        snapNumberToGrid(position.x, gridSize),
        snapNumberToGrid(position.y, gridSize),
        0,
      );
    case "XZ":
      return createVec3(
        snapNumberToGrid(position.x, gridSize),
        0,
        snapNumberToGrid(position.z, gridSize),
      );
    case "YZ":
      return createVec3(
        0,
        snapNumberToGrid(position.y, gridSize),
        snapNumberToGrid(position.z, gridSize),
      );
  }
};

const toThreeVector = (position: Vec3): THREE.Vector3 =>
  new THREE.Vector3(position.x, position.y, position.z);

const fromThreeVector = (position: THREE.Vector3): Vec3 =>
  createVec3(position.x, position.y, position.z);

const getPointerRay = (context: ScreenSpaceSnapContext): THREE.Ray => {
  const ndc = new THREE.Vector2(
    (context.pointerScreenPosition.x / context.canvas.clientWidth) * 2 - 1,
    -(context.pointerScreenPosition.y / context.canvas.clientHeight) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, context.camera);

  return raycaster.ray;
};

const getPointEntity = (
  document: BoardDocument,
  entityId: EntityId,
): PointEntity | null => {
  const entity = document.entities[entityId];

  return entity?.kind === "point" ? entity : null;
};

const isOnDrawingPlane = (
  position: Vec3,
  activeDrawingPlane: ActiveDrawingPlane,
  epsilon = 1e-6,
): boolean => {
  switch (activeDrawingPlane) {
    case "XY":
      return Math.abs(position.z) <= epsilon;
    case "XZ":
      return Math.abs(position.y) <= epsilon;
    case "YZ":
      return Math.abs(position.x) <= epsilon;
  }
};

const getPointName = (point: PointEntity): string => point.name ?? point.id;

const getSegmentName = (segment: SegmentEntity): string =>
  segment.name ?? segment.id;

const getPlaneName = (plane: PlaneEntity, document: BoardDocument): string => {
  if (plane.nameSource === "manual" && plane.name?.trim()) {
    return plane.name.trim();
  }

  const points = getPlanePoints(document, plane.pointIds);

  return points
    ? points.map((point) => point.name ?? point.id).join("")
    : plane.name?.trim() || plane.id;
};

const isFiniteSnapPosition = (position: Vec3): boolean =>
  Number.isFinite(position.x) &&
  Number.isFinite(position.y) &&
  Number.isFinite(position.z) &&
  Math.abs(position.x) <= MAX_PLANE_SNAP_COORDINATE &&
  Math.abs(position.y) <= MAX_PLANE_SNAP_COORDINATE &&
  Math.abs(position.z) <= MAX_PLANE_SNAP_COORDINATE;

const getNearestPointSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  let nearestCandidate: PointCandidate | null = null;

  for (const entity of Object.values(context.document.entities)) {
    if (entity.kind !== "point") {
      continue;
    }

    if (context.ignoredEntityIds?.includes(entity.id)) {
      continue;
    }

    const screenPosition = worldPositionToScreenPosition(
      entity.position,
      context.camera,
      context.canvas,
    );

    if (!screenPosition) {
      continue;
    }

    const distance = distancePointToScreenPoint(
      context.pointerScreenPosition,
      screenPosition,
    );

    if (distance > getPointSnapPixelRadius(context.document)) {
      continue;
    }

    if (!nearestCandidate || distance < nearestCandidate.distance) {
      nearestCandidate = {
        point: entity,
        distance,
      };
    }
  }

  if (!nearestCandidate) {
    return null;
  }

  return createCandidate(context, {
    position: nearestCandidate.point.position,
    type: "point",
    targetEntityId: nearestCandidate.point.id,
    description: `point ${getPointName(nearestCandidate.point)}`,
    screenDistance: nearestCandidate.distance,
    priority: SNAP_PRIORITIES.point,
  });
};

const getNearestSegmentSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  let nearestCandidate: SegmentCandidate | null = null;

  for (const entity of Object.values(context.document.entities)) {
    if (entity.kind !== "segment") {
      continue;
    }

    const [startPointId, endPointId] = entity.pointIds;
    const startPoint = getPointEntity(context.document, startPointId);
    const endPoint = getPointEntity(context.document, endPointId);

    if (!startPoint || !endPoint) {
      continue;
    }

    const startScreen = worldPositionToScreenPosition(
      startPoint.position,
      context.camera,
      context.canvas,
    );
    const endScreen = worldPositionToScreenPosition(
      endPoint.position,
      context.camera,
      context.canvas,
    );

    if (!startScreen || !endScreen) {
      continue;
    }

    const projection = distanceScreenPointToWorldSegmentProjection(
      context.pointerScreenPosition,
      startScreen,
      endScreen,
      startPoint.position,
      endPoint.position,
    );

    if (projection.distance > getSegmentSnapPixelRadius(context.document)) {
      continue;
    }

    const position = projection.worldPosition;

    if (!isOnDrawingPlane(position, context.activeDrawingPlane)) {
      continue;
    }

    if (!nearestCandidate || projection.distance < nearestCandidate.distance) {
      nearestCandidate = {
        segment: entity,
        distance: projection.distance,
        position,
      };
    }
  }

  if (!nearestCandidate) {
    return null;
  }

  return createCandidate(context, {
    position: nearestCandidate.position,
    type: "segment",
    targetEntityId: nearestCandidate.segment.id,
    description: `segment ${getSegmentName(nearestCandidate.segment)}`,
    screenDistance: nearestCandidate.distance,
    priority: SNAP_PRIORITIES.segment,
  });
};

const getGlobalAxisDefinitions = (): ReadonlyArray<{
  readonly axisName: "X" | "Y" | "Z";
  readonly direction: Vec3;
  readonly start: Vec3;
  readonly end: Vec3;
}> => {
  const halfLength = AXIS_SAMPLE_LENGTH / 2;

  return [
    {
      axisName: "X",
      direction: createVec3(1, 0, 0),
      start: createVec3(-halfLength, 0, 0),
      end: createVec3(halfLength, 0, 0),
    },
    {
      axisName: "Y",
      direction: createVec3(0, 1, 0),
      start: createVec3(0, -halfLength, 0),
      end: createVec3(0, halfLength, 0),
    },
    {
      axisName: "Z",
      direction: createVec3(0, 0, 1),
      start: createVec3(0, 0, -halfLength),
      end: createVec3(0, 0, halfLength),
    },
  ];
};

const createAxisGridPoint = (
  axisName: "X" | "Y" | "Z",
  value: number,
): Vec3 => {
  switch (axisName) {
    case "X":
      return createVec3(value, 0, 0);
    case "Y":
      return createVec3(0, value, 0);
    case "Z":
      return createVec3(0, 0, value);
  }
};

const getDrawingPlaneAxisNames = (
  activeDrawingPlane: ActiveDrawingPlane,
): ReadonlyArray<"X" | "Y" | "Z"> => {
  switch (activeDrawingPlane) {
    case "XY":
      return ["X", "Y"];
    case "XZ":
      return ["X", "Z"];
    case "YZ":
      return ["Y", "Z"];
  }
};

const getAxisGridPointSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  const gridSize = Math.max(context.document.settings.gridSize, 0.01);
  const halfLength = AXIS_SAMPLE_LENGTH / 2;
  const minIndex = Math.ceil(-halfLength / gridSize);
  const maxIndex = Math.floor(halfLength / gridSize);
  let nearestCandidate: AxisGridPointCandidate | null = null;

  for (const axisName of getDrawingPlaneAxisNames(context.activeDrawingPlane)) {
    for (let index = minIndex; index <= maxIndex; index += 1) {
      const value = index * gridSize;

      if (Math.abs(value) <= 1e-9) {
        continue;
      }

      const position = createAxisGridPoint(axisName, value);
      const screenPosition = worldPositionToScreenPosition(
        position,
        context.camera,
        context.canvas,
      );

      if (!screenPosition) {
        continue;
      }

      const distance = distancePointToScreenPoint(
        context.pointerScreenPosition,
        screenPosition,
      );

      if (distance > getAxisGridPointSnapPixelRadius(context.document)) {
        continue;
      }

      if (!nearestCandidate || distance < nearestCandidate.distance) {
        nearestCandidate = {
          axisName,
          distance,
          position,
        };
      }
    }
  }

  if (!nearestCandidate) {
    return null;
  }

  return createCandidate(context, {
    position: nearestCandidate.position,
    type: "axisGridPoint",
    description: `${nearestCandidate.axisName} axis grid point`,
    screenDistance: nearestCandidate.distance,
    priority: SNAP_PRIORITIES.axisGridPoint,
  });
};

const getAxisSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  let nearestCandidate: AxisCandidate | null = null;
  const pointerRay = getPointerRay(context);
  const pointOnRay = new THREE.Vector3();
  const pointOnAxis = new THREE.Vector3();

  for (const axis of getGlobalAxisDefinitions()) {
    const startScreen = worldPositionToScreenPosition(
      axis.start,
      context.camera,
      context.canvas,
    );
    const endScreen = worldPositionToScreenPosition(
      axis.end,
      context.camera,
      context.canvas,
    );

    if (!startScreen || !endScreen) {
      continue;
    }

    const projection = distanceScreenPointToSegment(
      context.pointerScreenPosition,
      startScreen,
      endScreen,
    );

    if (projection.distance > getAxisSnapPixelRadius(context.document)) {
      continue;
    }

    pointerRay.distanceSqToSegment(
      toThreeVector(axis.start),
      toThreeVector(axis.end),
      pointOnRay,
      pointOnAxis,
    );
    const position = fromThreeVector(pointOnAxis);

    if (!nearestCandidate || projection.distance < nearestCandidate.distance) {
      nearestCandidate = {
        axisName: axis.axisName,
        distance: projection.distance,
        position,
      };
    }
  }

  if (!nearestCandidate) {
    return null;
  }

  return createCandidate(context, {
    position: nearestCandidate.position,
    type: "axis",
    description: `${nearestCandidate.axisName} axis`,
    screenDistance: nearestCandidate.distance,
    priority: SNAP_PRIORITIES.axis,
  });
};

const getOriginSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  const origin = createVec3(0, 0, 0);
  const screenPosition = worldPositionToScreenPosition(
    origin,
    context.camera,
    context.canvas,
  );

  if (!screenPosition) {
    return null;
  }

  const distance = distancePointToScreenPoint(
    context.pointerScreenPosition,
    screenPosition,
  );

  if (distance > getOriginSnapPixelRadius(context.document)) {
    return null;
  }

  return createCandidate(context, {
    position: origin,
    type: "origin",
    description: "origin",
    screenDistance: distance,
    priority: SNAP_PRIORITIES.origin,
  });
};

const getGridSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  const position = getGridSnapPosition(
    context.rawWorldPosition,
    context.document.settings.gridSize,
    context.activeDrawingPlane,
  );
  const screenDistance = getScreenDistanceToPosition(context, position);

  if (
    !context.document.settings.forceGridSnap &&
    screenDistance > getGridSnapPixelRadius(context.document)
  ) {
    return null;
  }

  return createCandidate(context, {
    position,
    type: "grid",
    description: "grid",
    screenDistance,
    priority: SNAP_PRIORITIES.grid,
  });
};

const getPlaneSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate =>
  createCandidate(context, {
    position: context.rawWorldPosition,
    type: "plane",
    description: "plane raw position",
    screenDistance: 0,
    priority: SNAP_PRIORITIES.drawingPlane,
  });

const getEntityPlaneSnap = (
  context: ScreenSpaceSnapContext,
): ScreenSpaceSnapCandidate | null => {
  if (
    !context.document.settings.snapToPlanes ||
    !context.planeSnapEntityId ||
    context.ignoredEntityIds?.includes(context.planeSnapEntityId)
  ) {
    return null;
  }

  const entity = context.document.entities[context.planeSnapEntityId];

  if (entity?.kind !== "plane" || !entity.visible) {
    return null;
  }

  if (
    entity.pointIds.some((pointId) => context.ignoredEntityIds?.includes(pointId))
  ) {
    return null;
  }

  const points = getPlanePoints(context.document, entity.pointIds);

  if (!points) {
    return null;
  }

  const planeEquation = getPlaneFromThreePoints(
    points[0].position,
    points[1].position,
    points[2].position,
  );

  if (!planeEquation) {
    return null;
  }

  const intersection = new THREE.Vector3();
  const hasIntersection = getPointerRay(context).intersectPlane(
    new THREE.Plane(
      new THREE.Vector3(
        planeEquation.normal.x,
        planeEquation.normal.y,
        planeEquation.normal.z,
      ),
      planeEquation.d,
    ),
    intersection,
  );

  if (!hasIntersection) {
    return null;
  }

  const position = fromThreeVector(intersection);

  if (!isFiniteSnapPosition(position)) {
    return null;
  }

  return createCandidate(context, {
    position,
    type: "plane",
    targetEntityId: entity.id,
    targetEntityType: "plane",
    description: `plane ${getPlaneName(entity, context.document)}`,
    screenDistance: 0,
    priority: SNAP_PRIORITIES.entityPlane,
  });
};

export const getScreenSpaceSnapResult = (
  context: ScreenSpaceSnapContext,
): SnapResult => {
  const planePosition = projectToDrawingPlane(
    context.rawWorldPosition,
    context.activeDrawingPlane,
  );
  const planeContext = {
    ...context,
    rawWorldPosition: planePosition,
  };
  const candidates: ScreenSpaceSnapCandidate[] = [];

  if (!context.document.settings.snapEnabled) {
    return getPlaneSnap(planeContext);
  }

  if (context.document.settings.snapToPoints) {
    const pointSnap = getNearestPointSnap(planeContext);

    if (pointSnap) {
      candidates.push(pointSnap);
    }
  }

  if (context.document.settings.snapToOrigin) {
    const originSnap = getOriginSnap(planeContext);

    if (originSnap) {
      candidates.push(originSnap);
    }
  }

  if (
    context.document.settings.snapToAxes &&
    context.document.settings.snapToGrid
  ) {
    const axisGridPointSnap = getAxisGridPointSnap(planeContext);

    if (axisGridPointSnap) {
      candidates.push(axisGridPointSnap);
    }
  }

  if (context.document.settings.snapToSegments) {
    const segmentSnap = getNearestSegmentSnap(planeContext);

    if (segmentSnap) {
      candidates.push(segmentSnap);
    }
  }

  if (context.document.settings.snapToAxes) {
    const axisSnap = getAxisSnap(planeContext);

    if (axisSnap) {
      candidates.push(axisSnap);
    }
  }

  const entityPlaneSnap = getEntityPlaneSnap(context);

  if (entityPlaneSnap) {
    candidates.push(entityPlaneSnap);
  }

  if (context.document.settings.snapToGrid) {
    const gridSnap = getGridSnap(planeContext);

    if (gridSnap) {
      candidates.push(gridSnap);
    }
  }

  return getBestCandidate(candidates) ?? getPlaneSnap(planeContext);
};
