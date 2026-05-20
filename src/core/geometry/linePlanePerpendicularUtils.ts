import type { BoardDocument } from "../document/BoardDocument";
import type { PlaneEntity, PointEntity } from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";
import {
  addVec3,
  dotVec3,
  scaleVec3,
  subtractVec3,
} from "./geometryUtils";
import {
  getPlaneFromThreePoints,
} from "./planeUtils";
import { getPlaneWorldPositions, getPointWorldPosition } from "./pointPositionUtils";

const TRIANGLE_EPSILON = 1e-7;

export interface LinePlanePerpendicularProjection {
  readonly point: Vec3;
  readonly planeA: Vec3;
  readonly planeB: Vec3;
  readonly planeC: Vec3;
  readonly foot: Vec3;
  readonly isFootInTriangle: boolean;
  readonly extensionTriangles: readonly (readonly [Vec3, Vec3, Vec3])[];
  readonly helperSegments: readonly (readonly [Vec3, Vec3])[];
}

const getBarycentricCoordinates = (
  point: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): { readonly u: number; readonly v: number; readonly w: number } | null => {
  const v0 = subtractVec3(b, a);
  const v1 = subtractVec3(c, a);
  const v2 = subtractVec3(point, a);
  const d00 = dotVec3(v0, v0);
  const d01 = dotVec3(v0, v1);
  const d11 = dotVec3(v1, v1);
  const d20 = dotVec3(v2, v0);
  const d21 = dotVec3(v2, v1);
  const denominator = d00 * d11 - d01 * d01;

  if (Math.abs(denominator) <= TRIANGLE_EPSILON) {
    return null;
  }

  const v = (d11 * d20 - d01 * d21) / denominator;
  const w = (d00 * d21 - d01 * d20) / denominator;

  return {
    u: 1 - v - w,
    v,
    w,
  };
};

export const isPointInTriangleOnPlane = (
  point: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  epsilon = TRIANGLE_EPSILON,
): boolean => {
  const barycentric = getBarycentricCoordinates(point, a, b, c);

  return Boolean(
    barycentric &&
      barycentric.u >= -epsilon &&
      barycentric.v >= -epsilon &&
      barycentric.w >= -epsilon &&
      barycentric.u <= 1 + epsilon &&
      barycentric.v <= 1 + epsilon &&
      barycentric.w <= 1 + epsilon,
  );
};

const getTriangleCentroid = (
  first: Vec3,
  second: Vec3,
  third: Vec3,
): Vec3 => scaleVec3(addVec3(addVec3(first, second), third), 1 / 3);

export const projectPointToPlane = (
  point: Vec3,
  planePoint: Vec3,
  normal: Vec3,
): Vec3 => {
  const signedDistance = dotVec3(subtractVec3(point, planePoint), normal);

  return subtractVec3(point, scaleVec3(normal, signedDistance));
};

export const calculateLinePlanePerpendicular = (
  point: PointEntity,
  plane: PlaneEntity,
  document: BoardDocument,
): LinePlanePerpendicularProjection | null => {
  const planePoints = getPlaneWorldPositions(document, plane.pointIds);
  const pointPosition = getPointWorldPosition(document, point.id);

  if (!planePoints || !pointPosition) {
    return null;
  }

  const [pointA, pointB, pointC] = planePoints;
  const planeEquation = getPlaneFromThreePoints(
    pointA,
    pointB,
    pointC,
  );

  if (!planeEquation) {
    return null;
  }

  const foot = projectPointToPlane(
    pointPosition,
    pointA,
    planeEquation.normal,
  );
  const isFootInTriangle = isPointInTriangleOnPlane(
    foot,
    pointA,
    pointB,
    pointC,
  );
  const candidates: readonly (readonly [Vec3, Vec3, Vec3])[] = [
    [pointA, pointB, foot],
    [pointB, pointC, foot],
    [pointC, pointA, foot],
  ];
  const extensionTriangles = isFootInTriangle
    ? []
    : candidates.filter((triangle) => {
        const centroid = getTriangleCentroid(
          triangle[0],
          triangle[1],
          triangle[2],
        );

        return !isPointInTriangleOnPlane(
          centroid,
          pointA,
          pointB,
          pointC,
        );
      });

  return {
    point: pointPosition,
    planeA: pointA,
    planeB: pointB,
    planeC: pointC,
    foot,
    isFootInTriangle,
    extensionTriangles,
    helperSegments: isFootInTriangle
      ? []
      : [
          [pointA, foot],
          [pointB, foot],
          [pointC, foot],
        ],
  };
};
