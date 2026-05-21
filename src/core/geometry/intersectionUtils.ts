import type { BoardDocument } from "../document/BoardDocument";
import type { PlaneEntity, SegmentEntity } from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";
import { getCoordinateBounds } from "./coordinateBounds";
import { intersectLineWithAabb } from "./extensionUtils";
import {
  addVec3,
  crossVec3,
  distanceBetweenVec3,
  dotVec3,
  scaleVec3,
  subtractVec3,
  vec3Length,
} from "./geometryUtils";
import { getPlaneFromThreePoints, type PlaneEquation } from "./planeUtils";
import {
  getPlaneWorldPositions,
  getSegmentWorldPositions,
} from "./pointPositionUtils";

const EPSILON = 1e-7;

export type IntersectionFailureReason =
  | "degenerate-segment"
  | "parallel-lines"
  | "coincident-lines"
  | "skew-lines"
  | "invalid-plane"
  | "line-plane-parallel"
  | "line-in-plane"
  | "parallel-planes"
  | "coincident-planes"
  | "line-out-of-bounds";

export type IntersectionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: IntersectionFailureReason };

const midpoint = (a: Vec3, b: Vec3): Vec3 =>
  scaleVec3(addVec3(a, b), 0.5);

const pointAt = (start: Vec3, direction: Vec3, t: number): Vec3 =>
  addVec3(start, scaleVec3(direction, t));

export const getLineLineIntersection = (
  first: readonly [Vec3, Vec3],
  second: readonly [Vec3, Vec3],
): IntersectionResult<Vec3> => {
  const [a, b] = first;
  const [c, d] = second;
  const u = subtractVec3(b, a);
  const v = subtractVec3(d, c);
  const w0 = subtractVec3(a, c);
  const uLength = vec3Length(u);
  const vLength = vec3Length(v);

  if (uLength <= EPSILON || vLength <= EPSILON) {
    return { ok: false, reason: "degenerate-segment" };
  }

  const cross = crossVec3(u, v);

  if (vec3Length(cross) <= EPSILON) {
    return vec3Length(crossVec3(subtractVec3(c, a), u)) <= EPSILON
      ? { ok: false, reason: "coincident-lines" }
      : { ok: false, reason: "parallel-lines" };
  }

  const aDot = dotVec3(u, u);
  const bDot = dotVec3(u, v);
  const cDot = dotVec3(v, v);
  const dDot = dotVec3(u, w0);
  const eDot = dotVec3(v, w0);
  const denominator = aDot * cDot - bDot * bDot;

  if (Math.abs(denominator) <= EPSILON) {
    return { ok: false, reason: "parallel-lines" };
  }

  const s = (bDot * eDot - cDot * dDot) / denominator;
  const t = (aDot * eDot - bDot * dDot) / denominator;
  const pointOnFirst = pointAt(a, u, s);
  const pointOnSecond = pointAt(c, v, t);

  return distanceBetweenVec3(pointOnFirst, pointOnSecond) <= EPSILON
    ? { ok: true, value: midpoint(pointOnFirst, pointOnSecond) }
    : { ok: false, reason: "skew-lines" };
};

export const getLinePlaneIntersection = (
  line: readonly [Vec3, Vec3],
  plane: PlaneEquation,
): IntersectionResult<Vec3> => {
  const [a, b] = line;
  const direction = subtractVec3(b, a);
  const directionLength = vec3Length(direction);

  if (directionLength <= EPSILON) {
    return { ok: false, reason: "degenerate-segment" };
  }

  const denominator = dotVec3(plane.normal, direction);

  if (Math.abs(denominator) <= EPSILON) {
    const signedDistance = dotVec3(plane.normal, a) + plane.d;

    return Math.abs(signedDistance) <= EPSILON
      ? { ok: false, reason: "line-in-plane" }
      : { ok: false, reason: "line-plane-parallel" };
  }

  const t =
    dotVec3(plane.normal, subtractVec3(plane.point, a)) / denominator;

  return { ok: true, value: pointAt(a, direction, t) };
};

export const getPlanePlaneIntersectionLine = (
  firstPlane: PlaneEquation,
  secondPlane: PlaneEquation,
  document: BoardDocument,
): IntersectionResult<readonly [Vec3, Vec3]> => {
  const direction = crossVec3(firstPlane.normal, secondPlane.normal);

  if (vec3Length(direction) <= EPSILON) {
    const signedDistance =
      dotVec3(firstPlane.normal, secondPlane.point) + firstPlane.d;

    return Math.abs(signedDistance) <= EPSILON
      ? { ok: false, reason: "coincident-planes" }
      : { ok: false, reason: "parallel-planes" };
  }

  const denominator = dotVec3(direction, direction);
  const point = scaleVec3(
    subtractVec3(
      scaleVec3(
        crossVec3(secondPlane.normal, direction),
        -firstPlane.d,
      ),
      scaleVec3(
        crossVec3(firstPlane.normal, direction),
        -secondPlane.d,
      ),
    ),
    1 / denominator,
  );
  const intersection = intersectLineWithAabb(
    point,
    addVec3(point, direction),
    getCoordinateBounds(document),
  );

  if (!intersection) {
    return { ok: false, reason: "line-out-of-bounds" };
  }

  return {
    ok: true,
    value: [
      pointAt(point, direction, intersection.tMin),
      pointAt(point, direction, intersection.tMax),
    ],
  };
};

export const getSegmentSegmentIntersection = (
  document: BoardDocument,
  firstSegment: SegmentEntity,
  secondSegment: SegmentEntity,
): IntersectionResult<Vec3> => {
  const firstPositions = getSegmentWorldPositions(document, firstSegment.id);
  const secondPositions = getSegmentWorldPositions(document, secondSegment.id);

  return firstPositions && secondPositions
    ? getLineLineIntersection(firstPositions, secondPositions)
    : { ok: false, reason: "degenerate-segment" };
};

export const getSegmentPlaneIntersection = (
  document: BoardDocument,
  segment: SegmentEntity,
  plane: PlaneEntity,
): IntersectionResult<Vec3> => {
  const segmentPositions = getSegmentWorldPositions(document, segment.id);
  const planePositions = getPlaneWorldPositions(document, plane.pointIds);
  const planeEquation = planePositions
    ? getPlaneFromThreePoints(
        planePositions[0],
        planePositions[1],
        planePositions[2],
      )
    : null;

  if (!planeEquation) {
    return { ok: false, reason: "invalid-plane" };
  }

  return segmentPositions
    ? getLinePlaneIntersection(segmentPositions, planeEquation)
    : { ok: false, reason: "degenerate-segment" };
};

export const getPlanePlaneIntersection = (
  document: BoardDocument,
  firstPlane: PlaneEntity,
  secondPlane: PlaneEntity,
): IntersectionResult<readonly [Vec3, Vec3]> => {
  const firstPositions = getPlaneWorldPositions(document, firstPlane.pointIds);
  const secondPositions = getPlaneWorldPositions(document, secondPlane.pointIds);
  const firstEquation = firstPositions
    ? getPlaneFromThreePoints(
        firstPositions[0],
        firstPositions[1],
        firstPositions[2],
      )
    : null;
  const secondEquation = secondPositions
    ? getPlaneFromThreePoints(
        secondPositions[0],
        secondPositions[1],
        secondPositions[2],
      )
    : null;

  if (!firstEquation || !secondEquation) {
    return { ok: false, reason: "invalid-plane" };
  }

  return getPlanePlaneIntersectionLine(firstEquation, secondEquation, document);
};
