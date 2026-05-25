import { parseFunctionExpression } from "./FunctionExpression";
import type {
  FunctionPlotRange,
  FunctionSurfaceSample3D,
} from "./FunctionPlotTypes";

export type SampleFunctionSurface3DResult =
  | {
      readonly ok: true;
      readonly sample: FunctionSurfaceSample3D;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export const MIN_FUNCTION_SURFACE_RESOLUTION = 10;
export const MAX_FUNCTION_SURFACE_RESOLUTION = 160;
export const DEFAULT_FUNCTION_SURFACE_RESOLUTION = 80;

const MAX_ABS_COORDINATE = 1_000_000;

const clampInteger = (value: number, min: number, max: number): number =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : min;

const isRenderableValue = (value: number): boolean =>
  Number.isFinite(value) && Math.abs(value) <= MAX_ABS_COORDINATE;

export const normalizeFunctionSurfaceResolution = (resolution: number): number =>
  clampInteger(
    resolution,
    MIN_FUNCTION_SURFACE_RESOLUTION,
    MAX_FUNCTION_SURFACE_RESOLUTION,
  );

export const sampleFunctionSurface3D = (
  expression: string,
  xRange: FunctionPlotRange,
  yRange: FunctionPlotRange,
  resolutionX = DEFAULT_FUNCTION_SURFACE_RESOLUTION,
  resolutionY = DEFAULT_FUNCTION_SURFACE_RESOLUTION,
): SampleFunctionSurface3DResult => {
  if (
    !Number.isFinite(xRange.min) ||
    !Number.isFinite(xRange.max) ||
    !Number.isFinite(yRange.min) ||
    !Number.isFinite(yRange.max) ||
    xRange.min >= xRange.max ||
    yRange.min >= yRange.max
  ) {
    return { ok: false, error: "曲面范围无效。" };
  }

  const compiled = parseFunctionExpression(expression, ["x", "y"]);

  if (!compiled.ok) {
    return { ok: false, error: compiled.error };
  }

  const width = normalizeFunctionSurfaceResolution(resolutionX);
  const height = normalizeFunctionSurfaceResolution(resolutionY);
  const vertices = new Float32Array(width * height * 3);
  const valid = new Array<boolean>(width * height).fill(false);
  const indices: number[] = [];
  let invalidPointCount = 0;

  for (let yIndex = 0; yIndex < height; yIndex += 1) {
    const y =
      yIndex === height - 1
        ? yRange.max
        : yRange.min + ((yRange.max - yRange.min) * yIndex) / (height - 1);

    for (let xIndex = 0; xIndex < width; xIndex += 1) {
      const x =
        xIndex === width - 1
          ? xRange.max
          : xRange.min + ((xRange.max - xRange.min) * xIndex) / (width - 1);
      const vertexIndex = yIndex * width + xIndex;
      let z = Number.NaN;

      try {
        z = compiled.evaluate({ x, y });
      } catch {
        z = Number.NaN;
      }

      if (!isRenderableValue(z)) {
        invalidPointCount += 1;
        z = 0;
      } else {
        valid[vertexIndex] = true;
      }

      const offset = vertexIndex * 3;

      vertices[offset] = x;
      vertices[offset + 1] = z;
      vertices[offset + 2] = y;
    }
  }

  for (let yIndex = 0; yIndex < height - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < width - 1; xIndex += 1) {
      const a = yIndex * width + xIndex;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;

      if (valid[a] && valid[b] && valid[c]) {
        indices.push(a, c, b);
      }

      if (valid[b] && valid[c] && valid[d]) {
        indices.push(b, c, d);
      }
    }
  }

  return {
    ok: true,
    sample: {
      vertices,
      indices: new Uint32Array(indices),
      invalidPointCount,
    },
  };
};
