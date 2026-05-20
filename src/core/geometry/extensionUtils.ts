import type { BoardDocument } from "../document/BoardDocument";
import type {
  ExtensionEntity,
  PlaneEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";
import type { Aabb } from "./coordinateBounds";
import { getCoordinateBounds } from "./coordinateBounds";
import {
  addVec3,
  crossVec3,
  distanceBetweenVec3,
  dotVec3,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
} from "./geometryUtils";
import { getPlaneFromThreePoints } from "./planeUtils";
import {
  getPlaneWorldPositions,
  getSegmentWorldPositions,
} from "./pointPositionUtils";

const EPSILON = 1e-8;

export interface SegmentBoundaryExtension {
  readonly startExtension?: readonly [Vec3, Vec3];
  readonly endExtension?: readonly [Vec3, Vec3];
  readonly status: "valid" | "degenerate" | "no-intersection" | "target-missing";
}

export interface PlaneBoundaryExtension {
  readonly vertices: readonly Vec3[];
  readonly triangles: readonly [Vec3, Vec3, Vec3][];
  readonly status: "valid" | "invalid-plane" | "no-intersection" | "target-missing";
}

export const getAabbCorners = (bounds: Aabb): readonly Vec3[] => [
  { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
];

export const getAabbEdges = (bounds: Aabb): readonly (readonly [Vec3, Vec3])[] => {
  const corners = getAabbCorners(bounds);
  const edgeIndices: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  return edgeIndices.map(([startIndex, endIndex]) => [
    corners[startIndex],
    corners[endIndex],
  ]);
};

const isFiniteVec3 = (position: Vec3): boolean =>
  Number.isFinite(position.x) &&
  Number.isFinite(position.y) &&
  Number.isFinite(position.z);

const pointAtLineParameter = (start: Vec3, direction: Vec3, t: number): Vec3 =>
  addVec3(start, scaleVec3(direction, t));

export const intersectLineWithAabb = (
  start: Vec3,
  end: Vec3,
  bounds: Aabb,
): { readonly tMin: number; readonly tMax: number } | null => {
  const direction = subtractVec3(end, start);
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;
  const axes: readonly (keyof Vec3)[] = ["x", "y", "z"];

  for (const axis of axes) {
    const axisDirection = direction[axis];

    if (Math.abs(axisDirection) <= EPSILON) {
      if (start[axis] < bounds.min[axis] || start[axis] > bounds.max[axis]) {
        return null;
      }

      continue;
    }

    const first = (bounds.min[axis] - start[axis]) / axisDirection;
    const second = (bounds.max[axis] - start[axis]) / axisDirection;
    const axisMin = Math.min(first, second);
    const axisMax = Math.max(first, second);

    tMin = Math.max(tMin, axisMin);
    tMax = Math.min(tMax, axisMax);

    if (tMin > tMax) {
      return null;
    }
  }

  return Number.isFinite(tMin) && Number.isFinite(tMax) ? { tMin, tMax } : null;
};

export const calculateSegmentBoundaryExtension = (
  segment: SegmentEntity,
  document: BoardDocument,
): SegmentBoundaryExtension => {
  const positions = getSegmentWorldPositions(document, segment.id);

  if (!positions) {
    return { status: "target-missing" };
  }

  const [start, end] = positions;

  if (distanceBetweenVec3(start, end) <= EPSILON) {
    return { status: "degenerate" };
  }

  const bounds = getCoordinateBounds(document);
  const intersection = intersectLineWithAabb(start, end, bounds);

  if (!intersection) {
    return { status: "no-intersection" };
  }

  const direction = subtractVec3(end, start);
  const startExtension =
    intersection.tMin < -EPSILON
      ? ([pointAtLineParameter(start, direction, intersection.tMin), start] as const)
      : undefined;
  const endExtension =
    intersection.tMax > 1 + EPSILON
      ? ([end, pointAtLineParameter(start, direction, intersection.tMax)] as const)
      : undefined;

  return {
    startExtension,
    endExtension,
    status: "valid",
  };
};

const addUniquePoint = (points: Vec3[], point: Vec3): void => {
  if (
    !isFiniteVec3(point) ||
    points.some((candidate) => distanceBetweenVec3(candidate, point) <= 1e-5)
  ) {
    return;
  }

  points.push(point);
};

export const calculatePlaneBoundaryExtension = (
  plane: PlaneEntity,
  document: BoardDocument,
): PlaneBoundaryExtension => {
  const points = getPlaneWorldPositions(document, plane.pointIds);

  if (!points) {
    return { vertices: [], triangles: [], status: "target-missing" };
  }

  const planeEquation = getPlaneFromThreePoints(points[0], points[1], points[2]);

  if (!planeEquation) {
    return { vertices: [], triangles: [], status: "invalid-plane" };
  }

  const bounds = getCoordinateBounds(document);
  const intersections: Vec3[] = [];

  getAabbEdges(bounds).forEach(([start, end]) => {
    const startDistance = dotVec3(planeEquation.normal, start) + planeEquation.d;
    const endDistance = dotVec3(planeEquation.normal, end) + planeEquation.d;

    if (Math.abs(startDistance) <= EPSILON) {
      addUniquePoint(intersections, start);
    }

    if (Math.abs(endDistance) <= EPSILON) {
      addUniquePoint(intersections, end);
    }

    if (startDistance * endDistance < -EPSILON) {
      const t = startDistance / (startDistance - endDistance);
      addUniquePoint(
        intersections,
        addVec3(start, scaleVec3(subtractVec3(end, start), t)),
      );
    }
  });

  if (intersections.length < 3) {
    return { vertices: intersections, triangles: [], status: "no-intersection" };
  }

  const centroid = scaleVec3(
    intersections.reduce(
      (sum, point) => addVec3(sum, point),
      { x: 0, y: 0, z: 0 },
    ),
    1 / intersections.length,
  );
  const referenceAxis =
    Math.abs(planeEquation.normal.x) < 0.9
      ? { x: 1, y: 0, z: 0 }
      : { x: 0, y: 1, z: 0 };
  const u =
    normalizeVec3(crossVec3(planeEquation.normal, referenceAxis)) ??
    { x: 1, y: 0, z: 0 };
  const v =
    normalizeVec3(crossVec3(planeEquation.normal, u)) ??
    { x: 0, y: 1, z: 0 };
  const sortedVertices = [...intersections].sort((first, second) => {
    const firstRelative = subtractVec3(first, centroid);
    const secondRelative = subtractVec3(second, centroid);
    const firstAngle = Math.atan2(dotVec3(firstRelative, v), dotVec3(firstRelative, u));
    const secondAngle = Math.atan2(
      dotVec3(secondRelative, v),
      dotVec3(secondRelative, u),
    );

    return firstAngle - secondAngle;
  });
  const triangles: [Vec3, Vec3, Vec3][] = [];

  for (let index = 1; index < sortedVertices.length - 1; index += 1) {
    triangles.push([sortedVertices[0], sortedVertices[index], sortedVertices[index + 1]]);
  }

  return {
    vertices: sortedVertices,
    triangles,
    status: "valid",
  };
};

export const getExtensionStatus = (
  extension: ExtensionEntity,
  document: BoardDocument,
): string => {
  const target = document.entities[extension.targetId];

  if (extension.targetType === "segment") {
    if (target?.kind !== "segment") {
      return "目标缺失";
    }

    const result = calculateSegmentBoundaryExtension(target, document);

    if (result.status === "degenerate") {
      return "目标退化";
    }

    if (result.status === "no-intersection") {
      return "无法与边界相交";
    }

    return result.status === "valid" ? "有效" : "目标缺失";
  }

  if (target?.kind !== "plane") {
    return "目标缺失";
  }

  const result = calculatePlaneBoundaryExtension(target, document);

  if (result.status === "invalid-plane") {
    return "平面无效";
  }

  if (result.status === "no-intersection") {
    return "无法与边界相交";
  }

  return result.status === "valid" ? "有效" : "目标缺失";
};
