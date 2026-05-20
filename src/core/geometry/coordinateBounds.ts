import type { BoardDocument } from "../document/BoardDocument";
import type { Vec3 } from "./Vec3";

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

export const DEFAULT_COORDINATE_HALF_SIZE = 10;

export const getCoordinateHalfSize = (document: BoardDocument): number => {
  const configuredHalfSize = document.settings.coordinateHalfSize;

  return Number.isFinite(configuredHalfSize) && configuredHalfSize > 0
    ? configuredHalfSize
    : DEFAULT_COORDINATE_HALF_SIZE;
};

export const getCoordinateBounds = (document: BoardDocument): Aabb => {
  const halfSize = getCoordinateHalfSize(document);

  return {
    min: { x: -halfSize, y: -halfSize, z: -halfSize },
    max: { x: halfSize, y: halfSize, z: halfSize },
  };
};
