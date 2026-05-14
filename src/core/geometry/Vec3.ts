export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO_VEC3: Vec3 = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});
