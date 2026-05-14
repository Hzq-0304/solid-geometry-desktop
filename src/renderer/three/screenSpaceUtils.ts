import * as THREE from "three";
import type { Vec3 } from "../../core/geometry/Vec3";

export interface ScreenPosition {
  readonly x: number;
  readonly y: number;
}

export interface ScreenSegmentProjection {
  readonly distance: number;
  readonly t: number;
  readonly screenPosition: ScreenPosition;
}

export interface WorldSegmentScreenProjection extends ScreenSegmentProjection {
  readonly worldPosition: Vec3;
}

export const getPointerScreenPosition = (
  event: PointerEvent,
  canvas: HTMLCanvasElement,
): ScreenPosition => {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
};

export const worldPositionToScreenPosition = (
  position: Vec3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): ScreenPosition | null => {
  const projected = new THREE.Vector3(position.x, position.y, position.z).project(
    camera,
  );

  if (projected.z < -1 || projected.z > 1) {
    return null;
  }

  return {
    x: ((projected.x + 1) / 2) * canvas.clientWidth,
    y: ((1 - projected.y) / 2) * canvas.clientHeight,
  };
};

export const distancePointToScreenPoint = (
  a: ScreenPosition,
  b: ScreenPosition,
): number => Math.hypot(a.x - b.x, a.y - b.y);

export const distanceScreenPointToSegment = (
  point: ScreenPosition,
  start: ScreenPosition,
  end: ScreenPosition,
): ScreenSegmentProjection => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= Number.EPSILON) {
    return {
      distance: distancePointToScreenPoint(point, start),
      t: 0,
      screenPosition: start,
    };
  }

  const rawT =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
    lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  const screenPosition = {
    x: start.x + segmentX * t,
    y: start.y + segmentY * t,
  };

  return {
    distance: distancePointToScreenPoint(point, screenPosition),
    t,
    screenPosition,
  };
};

export const interpolateVec3 = (start: Vec3, end: Vec3, t: number): Vec3 => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
  z: start.z + (end.z - start.z) * t,
});

export const distanceScreenPointToWorldSegmentProjection = (
  point: ScreenPosition,
  screenStart: ScreenPosition,
  screenEnd: ScreenPosition,
  worldStart: Vec3,
  worldEnd: Vec3,
): WorldSegmentScreenProjection => {
  const projection = distanceScreenPointToSegment(
    point,
    screenStart,
    screenEnd,
  );

  return {
    ...projection,
    worldPosition: interpolateVec3(worldStart, worldEnd, projection.t),
  };
};
