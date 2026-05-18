import type { BoardDocument } from "../document/BoardDocument";
import type { EntityId, PlaneEntity, PointEntity } from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";
import {
  addVec3,
  crossVec3,
  distanceBetweenVec3,
  dotVec3,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
  vec3Length,
} from "./geometryUtils";

const PLANE_EPSILON = 1e-8;

export const DEFAULT_PLANE_STYLE = Object.freeze({
  triangleColor: "#cbd5e1",
  triangleOpacity: 1,
  extensionColor: "#60a5fa",
  extensionOpacity: 0.12,
  showExtensionWhenSelected: true,
});

export interface PlaneEquation {
  readonly normal: Vec3;
  readonly point: Vec3;
  readonly d: number;
}

export interface PlaneExtensionPatch {
  readonly vertices: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly center: Vec3;
  readonly size: number;
}

export type PlaneValidationStatus = "valid" | "missing-points" | "collinear";

export const arePointsCollinear = (
  a: Vec3,
  b: Vec3,
  c: Vec3,
  epsilon = PLANE_EPSILON,
): boolean => {
  const ab = subtractVec3(b, a);
  const ac = subtractVec3(c, a);

  return vec3Length(crossVec3(ab, ac)) <= epsilon;
};

export const getPlaneFromThreePoints = (
  a: Vec3,
  b: Vec3,
  c: Vec3,
): PlaneEquation | null => {
  const normal = normalizeVec3(crossVec3(subtractVec3(b, a), subtractVec3(c, a)));

  return normal
    ? {
        normal,
        point: a,
        d: -dotVec3(normal, a),
      }
    : null;
};

export const getPlaneStyle = (plane: PlaneEntity) => ({
  ...DEFAULT_PLANE_STYLE,
  ...plane.style,
});

export const getPlanePoints = (
  document: BoardDocument,
  pointIds: readonly [EntityId, EntityId, EntityId],
): readonly [PointEntity, PointEntity, PointEntity] | null => {
  const points = pointIds.map((pointId) => document.entities[pointId]);

  return points.every((point): point is PointEntity => point?.kind === "point")
    ? [points[0], points[1], points[2]]
    : null;
};

export const getPlaneValidationStatus = (
  plane: PlaneEntity,
  document: BoardDocument,
): PlaneValidationStatus => {
  const points = getPlanePoints(document, plane.pointIds);

  if (!points) {
    return "missing-points";
  }

  return getPlaneFromThreePoints(
    points[0].position,
    points[1].position,
    points[2].position,
  )
    ? "valid"
    : "collinear";
};

const chooseFallbackVector = (normal: Vec3): Vec3 =>
  Math.abs(normal.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

export const getPlaneExtensionPatch = (
  a: Vec3,
  b: Vec3,
  c: Vec3,
): PlaneExtensionPatch | null => {
  const plane = getPlaneFromThreePoints(a, b, c);

  if (!plane) {
    return null;
  }

  const centroid = scaleVec3(addVec3(addVec3(a, b), c), 1 / 3);
  const maxDistance = Math.max(
    distanceBetweenVec3(a, b),
    distanceBetweenVec3(b, c),
    distanceBetweenVec3(c, a),
  );
  const extensionSize = Math.max(maxDistance * 3, 4);
  const u =
    normalizeVec3(subtractVec3(b, a)) ??
    normalizeVec3(crossVec3(chooseFallbackVector(plane.normal), plane.normal));
  const v = u ? normalizeVec3(crossVec3(plane.normal, u)) : null;

  if (!u || !v) {
    return null;
  }

  const scaledU = scaleVec3(u, extensionSize);
  const scaledV = scaleVec3(v, extensionSize);

  return {
    center: centroid,
    size: extensionSize,
    vertices: [
      addVec3(addVec3(centroid, scaledU), scaledV),
      addVec3(addVec3(centroid, scaleVec3(scaledU, -1)), scaledV),
      addVec3(addVec3(centroid, scaleVec3(scaledU, -1)), scaleVec3(scaledV, -1)),
      addVec3(addVec3(centroid, scaledU), scaleVec3(scaledV, -1)),
    ],
  };
};
