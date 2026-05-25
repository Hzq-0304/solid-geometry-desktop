import type { BoardDocument } from "../document/BoardDocument";
import type { PlaneEntity, PolygonEntity } from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import {
  crossVec3,
  dotVec3,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
} from "../geometry/geometryUtils";
import { getPointWorldPosition } from "../geometry/pointPositionUtils";
import type { SectionPlane3D } from "./SectionTypes";

const SECTION_EPSILON = 1e-8;

const chooseFallbackVector = (normal: Vec3): Vec3 =>
  Math.abs(normal.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

export const normalizeSectionPlane = (args: {
  readonly origin: Vec3;
  readonly normal: Vec3;
  readonly preferredU?: Vec3;
}): SectionPlane3D | null => {
  const normal = normalizeVec3(args.normal, SECTION_EPSILON);

  if (!normal) {
    return null;
  }

  const rawU = args.preferredU ?? chooseFallbackVector(normal);
  const projectedU = subtractVec3(rawU, scaleVec3(normal, dotVec3(rawU, normal)));
  const u =
    normalizeVec3(projectedU, SECTION_EPSILON) ??
    normalizeVec3(
      crossVec3(chooseFallbackVector(normal), normal),
      SECTION_EPSILON,
    );
  const v = u ? normalizeVec3(crossVec3(normal, u), SECTION_EPSILON) : null;

  return u && v
    ? {
        origin: args.origin,
        normal,
        u,
        v,
      }
    : null;
};

export const createSectionPlaneFromPoints = (
  a: Vec3,
  b: Vec3,
  c: Vec3,
): SectionPlane3D | null =>
  normalizeSectionPlane({
    origin: a,
    normal: crossVec3(subtractVec3(b, a), subtractVec3(c, a)),
    preferredU: subtractVec3(b, a),
  });

export const createSectionPlaneFromPlaneEntity = (
  document: BoardDocument,
  plane: PlaneEntity,
): SectionPlane3D | null => {
  const points = plane.pointIds.map((pointId) =>
    getPointWorldPosition(document, pointId),
  );

  return points[0] && points[1] && points[2]
    ? createSectionPlaneFromPoints(points[0], points[1], points[2])
    : null;
};

export const createSectionPlaneFromPolygonEntity = (
  document: BoardDocument,
  polygon: PolygonEntity,
): SectionPlane3D | null => {
  const points = polygon.pointIds.slice(0, 3).map((pointId) =>
    getPointWorldPosition(document, pointId),
  );

  return points[0] && points[1] && points[2]
    ? createSectionPlaneFromPoints(points[0], points[1], points[2])
    : null;
};
