import type { Vec3 } from "../geometry/Vec3";
import {
  addVec3,
  dotVec3,
  scaleVec3,
  subtractVec3,
} from "../geometry/geometryUtils";
import type { Vec2 } from "../plane2d/PlaneCanvasTypes";
import type { SectionPlane3D } from "./SectionTypes";

export const projectPointToSection2D = (
  plane: SectionPlane3D,
  point: Vec3,
): Vec2 => {
  const offset = subtractVec3(point, plane.origin);

  return {
    x: dotVec3(offset, plane.u),
    y: dotVec3(offset, plane.v),
  };
};

export const projectDirectionToSection2D = (
  plane: SectionPlane3D,
  direction: Vec3,
): Vec2 => ({
  x: dotVec3(direction, plane.u),
  y: dotVec3(direction, plane.v),
});

export const unprojectSection2DToPoint3D = (
  plane: SectionPlane3D,
  point: Vec2,
): Vec3 =>
  addVec3(
    addVec3(plane.origin, scaleVec3(plane.u, point.x)),
    scaleVec3(plane.v, point.y),
  );
