import type { BoardDocument } from "../document/BoardDocument";
import type {
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";

export const createVec3 = (x = 0, y = 0, z = 0): Vec3 => ({
  x,
  y,
  z,
});

export const cloneVec3 = (value: Vec3): Vec3 => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

export const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const subtractVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const dotVec3 = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

export const crossVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const scaleVec3 = (value: Vec3, scale: number): Vec3 => ({
  x: value.x * scale,
  y: value.y * scale,
  z: value.z * scale,
});

export const vec3Length = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

export const normalizeVec3 = (value: Vec3, epsilon = 1e-9): Vec3 | null => {
  const length = vec3Length(value);

  return length <= epsilon ? null : scaleVec3(value, 1 / length);
};

export const distanceBetweenVec3 = (a: Vec3, b: Vec3): number =>
  vec3Length(subtractVec3(a, b));

export const areVec3Equal = (a: Vec3, b: Vec3, epsilon = 1e-9): boolean =>
  Math.abs(a.x - b.x) <= epsilon &&
  Math.abs(a.y - b.y) <= epsilon &&
  Math.abs(a.z - b.z) <= epsilon;

export const snapNumberToGrid = (value: number, gridSize: number): number => {
  const safeGridSize = Math.abs(gridSize) > Number.EPSILON ? gridSize : 1;

  return Math.round(value / safeGridSize) * safeGridSize;
};

export const snapVec3ToGrid = (value: Vec3, gridSize: number): Vec3 => ({
  x: snapNumberToGrid(value.x, gridSize),
  y: snapNumberToGrid(value.y, gridSize),
  z: snapNumberToGrid(value.z, gridSize),
});

export interface PointLineProjection {
  readonly foot: Vec3;
  readonly t: number;
  readonly distance: number;
}

export interface PerpendicularProjection {
  readonly point: Vec3;
  readonly lineA: Vec3;
  readonly lineB: Vec3;
  readonly foot: Vec3;
  readonly t: number;
  readonly isFootOnSegment: boolean;
  readonly extensionStart?: Vec3;
  readonly extensionEnd?: Vec3;
}

export const projectPointToLine = (
  point: Vec3,
  lineA: Vec3,
  lineB: Vec3,
  epsilon = 1e-9,
): PointLineProjection | null => {
  const lineVector = subtractVec3(lineB, lineA);
  const denominator = dotVec3(lineVector, lineVector);

  if (denominator <= epsilon) {
    return null;
  }

  const t = dotVec3(subtractVec3(point, lineA), lineVector) / denominator;
  const foot = addVec3(lineA, scaleVec3(lineVector, t));

  return {
    foot,
    t,
    distance: distanceBetweenVec3(point, foot),
  };
};

const getPointEntity = (
  document: BoardDocument,
  pointId: string,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

export const calculatePerpendicularFromPointToSegment = (
  point: PointEntity,
  segment: SegmentEntity,
  document: BoardDocument,
): PerpendicularProjection | null => {
  const startPoint = getPointEntity(document, segment.pointIds[0]);
  const endPoint = getPointEntity(document, segment.pointIds[1]);

  if (!startPoint || !endPoint) {
    return null;
  }

  const projection = projectPointToLine(
    point.position,
    startPoint.position,
    endPoint.position,
  );

  if (!projection) {
    return null;
  }

  if (projection.t < 0) {
    return {
      point: point.position,
      lineA: startPoint.position,
      lineB: endPoint.position,
      foot: projection.foot,
      t: projection.t,
      isFootOnSegment: false,
      extensionStart: startPoint.position,
      extensionEnd: projection.foot,
    };
  }

  if (projection.t > 1) {
    return {
      point: point.position,
      lineA: startPoint.position,
      lineB: endPoint.position,
      foot: projection.foot,
      t: projection.t,
      isFootOnSegment: false,
      extensionStart: endPoint.position,
      extensionEnd: projection.foot,
    };
  }

  return {
    point: point.position,
    lineA: startPoint.position,
    lineB: endPoint.position,
    foot: projection.foot,
    t: projection.t,
    isFootOnSegment: true,
  };
};
