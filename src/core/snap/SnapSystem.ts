import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "../document/BoardDocument";
import type {
  EntityId,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import {
  createVec3,
  distanceBetweenVec3,
  snapNumberToGrid,
} from "../geometry/geometryUtils";
import { getPointWorldPosition } from "../geometry/pointPositionUtils";
import type { Vec3 } from "../geometry/Vec3";
import type { SnapResult } from "./SnapTypes";

interface AxisSnapCandidate {
  readonly axisName: "X" | "Y" | "Z";
  readonly distance: number;
  readonly position: Vec3;
}

interface AxisGridPointSnapCandidate extends AxisSnapCandidate {}

interface SegmentSnapCandidate {
  readonly segment: SegmentEntity;
  readonly distance: number;
  readonly position: Vec3;
}

const AXIS_SNAP_DISTANCE_LIMIT = 0.1;

const getPointName = (point: PointEntity): string => point.name ?? point.id;

const getSegmentName = (segment: SegmentEntity): string =>
  segment.name ?? segment.id;

const subtract = (a: Vec3, b: Vec3): Vec3 =>
  createVec3(a.x - b.x, a.y - b.y, a.z - b.z);

const add = (a: Vec3, b: Vec3): Vec3 =>
  createVec3(a.x + b.x, a.y + b.y, a.z + b.z);

const scale = (value: Vec3, factor: number): Vec3 =>
  createVec3(value.x * factor, value.y * factor, value.z * factor);

const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const lengthSquared = (value: Vec3): number => dot(value, value);

const getAxisSnapDistance = (snapDistance: number): number =>
  Math.min(snapDistance, AXIS_SNAP_DISTANCE_LIMIT);

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

const getAxisSnapCandidates = (
  position: Vec3,
): readonly AxisSnapCandidate[] => {
  return [
    {
      axisName: "X",
      distance: Math.hypot(position.y, position.z),
      position: createVec3(position.x, 0, 0),
    },
    {
      axisName: "Y",
      distance: Math.hypot(position.x, position.z),
      position: createVec3(0, position.y, 0),
    },
    {
      axisName: "Z",
      distance: Math.hypot(position.x, position.y),
      position: createVec3(0, 0, position.z),
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

const getNearestAxisGridPointSnap = (
  rawPosition: Vec3,
  document: BoardDocument,
  activeDrawingPlane: ActiveDrawingPlane,
): SnapResult | null => {
  const gridSize = Math.max(document.settings.gridSize, 0.01);
  const scanLength = 10;
  const minIndex = Math.ceil(-scanLength / gridSize);
  const maxIndex = Math.floor(scanLength / gridSize);
  let nearestCandidate: AxisGridPointSnapCandidate | null = null;

  for (const axisName of getDrawingPlaneAxisNames(activeDrawingPlane)) {
    for (let index = minIndex; index <= maxIndex; index += 1) {
      const value = index * gridSize;

      if (Math.abs(value) <= 1e-9) {
        continue;
      }

      const position = createAxisGridPoint(axisName, value);
      const distance = distanceBetweenVec3(rawPosition, position);

      if (distance > document.settings.snapDistance) {
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

  return {
    position: nearestCandidate.position,
    type: "axisGridPoint",
    description: `${nearestCandidate.axisName} axis grid point`,
    distance: nearestCandidate.distance,
  };
};

const getNearestPointSnap = (
  rawPosition: Vec3,
  document: BoardDocument,
): SnapResult | null => {
  let nearestPoint: PointEntity | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entity of Object.values(document.entities)) {
    if (entity.kind !== "point") {
      continue;
    }

    const position = getPointWorldPosition(document, entity.id);

    if (!position) {
      continue;
    }

    const distance = distanceBetweenVec3(rawPosition, position);

    if (distance < nearestDistance) {
      nearestPoint = entity;
      nearestDistance = distance;
    }
  }

  if (!nearestPoint || nearestDistance > document.settings.snapDistance) {
    return null;
  }

  return {
    position: getPointWorldPosition(document, nearestPoint.id) ?? nearestPoint.position,
    type: "point",
    targetEntityId: nearestPoint.id,
    description: `point ${getPointName(nearestPoint)}`,
    distance: nearestDistance,
  };
};

const getSegmentProjection = (
  rawPosition: Vec3,
  startPoint: Vec3,
  endPoint: Vec3,
): Vec3 | null => {
  const segmentVector = subtract(endPoint, startPoint);
  const segmentLengthSquared = lengthSquared(segmentVector);

  if (segmentLengthSquared <= Number.EPSILON) {
    return null;
  }

  const t =
    dot(subtract(rawPosition, startPoint), segmentVector) /
    segmentLengthSquared;

  if (t < 0 || t > 1) {
    return null;
  }

  return add(startPoint, scale(segmentVector, t));
};

const getNearestSegmentSnap = (
  rawPosition: Vec3,
  document: BoardDocument,
  activeDrawingPlane: ActiveDrawingPlane,
): SnapResult | null => {
  let nearestCandidate: SegmentSnapCandidate | null = null;

  for (const entity of Object.values(document.entities)) {
    if (entity.kind !== "segment") {
      continue;
    }

    const [startPointId, endPointId] = entity.pointIds;
    const startPoint = getPointWorldPosition(document, startPointId);
    const endPoint = getPointWorldPosition(document, endPointId);

    if (!startPoint || !endPoint) {
      continue;
    }

    const projectedPosition = getSegmentProjection(
      rawPosition,
      startPoint,
      endPoint,
    );

    if (!projectedPosition) {
      continue;
    }

    const distance = distanceBetweenVec3(rawPosition, projectedPosition);

    if (distance > document.settings.snapDistance) {
      continue;
    }

    if (!nearestCandidate || distance < nearestCandidate.distance) {
      nearestCandidate = {
        segment: entity,
        distance,
        position: projectedPosition,
      };
    }
  }

  if (!nearestCandidate) {
    return null;
  }

  return {
    position: nearestCandidate.position,
    type: "segment",
    targetEntityId: nearestCandidate.segment.id,
    description: `segment ${getSegmentName(nearestCandidate.segment)}`,
    distance: nearestCandidate.distance,
  };
};

const getOriginSnap = (
  rawPosition: Vec3,
  document: BoardDocument,
): SnapResult | null => {
  const origin = createVec3(0, 0, 0);
  const distance = distanceBetweenVec3(rawPosition, origin);

  if (distance > document.settings.snapDistance) {
    return null;
  }

  return {
    position: origin,
    type: "origin",
    description: "origin",
    distance,
  };
};

const getAxisSnap = (
  rawPosition: Vec3,
  document: BoardDocument,
): SnapResult | null => {
  const nearestCandidate = getAxisSnapCandidates(
    rawPosition,
  ).reduce<AxisSnapCandidate | null>((best, candidate) => {
    if (!best || candidate.distance < best.distance) {
      return candidate;
    }

    return best;
  }, null);

  if (
    !nearestCandidate ||
    nearestCandidate.distance > getAxisSnapDistance(document.settings.snapDistance)
  ) {
    return null;
  }

  return {
    position: nearestCandidate.position,
    type: "axis",
    description: `${nearestCandidate.axisName} axis`,
    distance: nearestCandidate.distance,
  };
};

export const getSnapResult = (
  rawPosition: Vec3,
  document: BoardDocument,
  activeDrawingPlane: ActiveDrawingPlane,
): SnapResult => {
  const planePosition = projectToDrawingPlane(rawPosition, activeDrawingPlane);

  if (!document.settings.snapEnabled) {
    return {
      position: planePosition,
      type: "plane",
      description: "plane raw position",
    };
  }

  if (document.settings.snapToPoints) {
    const pointSnap = getNearestPointSnap(planePosition, document);

    if (pointSnap) {
      return pointSnap;
    }
  }

  if (document.settings.snapToOrigin) {
    const originSnap = getOriginSnap(planePosition, document);

    if (originSnap) {
      return originSnap;
    }
  }

  if (document.settings.snapToAxes && document.settings.snapToGrid) {
    const axisGridPointSnap = getNearestAxisGridPointSnap(
      planePosition,
      document,
      activeDrawingPlane,
    );

    if (axisGridPointSnap) {
      return axisGridPointSnap;
    }
  }

  if (document.settings.snapToSegments) {
    const segmentSnap = getNearestSegmentSnap(
      planePosition,
      document,
      activeDrawingPlane,
    );

    if (segmentSnap) {
      return segmentSnap;
    }
  }

  if (document.settings.snapToAxes) {
    const axisSnap = getAxisSnap(planePosition, document);

    if (axisSnap) {
      return axisSnap;
    }
  }

  if (document.settings.snapToGrid && document.settings.forceGridSnap) {
    return {
      position: getGridSnapPosition(
        planePosition,
        document.settings.gridSize,
        activeDrawingPlane,
      ),
      type: "grid",
      description: "grid",
    };
  }

  return {
    position: planePosition,
    type: "plane",
    description: "plane raw position",
  };
};
