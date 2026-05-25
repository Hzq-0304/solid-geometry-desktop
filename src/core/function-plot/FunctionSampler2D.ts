import { parseFunctionExpression } from "./FunctionExpression";
import type {
  FunctionPlotPolyline2D,
  FunctionPlotRange,
} from "./FunctionPlotTypes";

export interface FunctionSampler2DResult {
  readonly ok: true;
  readonly polylines: readonly FunctionPlotPolyline2D[];
  readonly invalidPointCount: number;
}

export interface FunctionSampler2DError {
  readonly ok: false;
  readonly error: string;
}

export type SampleFunction2DResult =
  | FunctionSampler2DResult
  | FunctionSampler2DError;

export const MIN_FUNCTION_SAMPLE_COUNT_2D = 50;
export const MAX_FUNCTION_SAMPLE_COUNT_2D = 5000;
export const DEFAULT_FUNCTION_SAMPLE_COUNT_2D = 800;

const MAX_ABS_COORDINATE = 1_000_000;

const clampInteger = (value: number, min: number, max: number): number =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : min;

const isRenderableValue = (value: number): boolean =>
  Number.isFinite(value) && Math.abs(value) <= MAX_ABS_COORDINATE;

const shouldBreakPolyline = (previousY: number, nextY: number): boolean =>
  Math.sign(previousY) !== Math.sign(nextY) &&
  Math.abs(previousY - nextY) > 50;

export const normalizeFunctionSampleCount2D = (sampleCount: number): number =>
  clampInteger(
    sampleCount,
    MIN_FUNCTION_SAMPLE_COUNT_2D,
    MAX_FUNCTION_SAMPLE_COUNT_2D,
  );

export const sampleFunction2D = (
  expression: string,
  xRange: FunctionPlotRange,
  sampleCount = DEFAULT_FUNCTION_SAMPLE_COUNT_2D,
): SampleFunction2DResult => {
  if (
    !Number.isFinite(xRange.min) ||
    !Number.isFinite(xRange.max) ||
    xRange.min >= xRange.max
  ) {
    return { ok: false, error: "函数范围无效。" };
  }

  const compiled = parseFunctionExpression(expression, ["x"]);

  if (!compiled.ok) {
    return { ok: false, error: compiled.error };
  }

  const normalizedSampleCount = normalizeFunctionSampleCount2D(sampleCount);
  const step = (xRange.max - xRange.min) / (normalizedSampleCount - 1);
  const polylines: FunctionPlotPolyline2D[] = [];
  let currentPoints: FunctionPlotPolyline2D["points"] = [];
  let invalidPointCount = 0;

  for (let index = 0; index < normalizedSampleCount; index += 1) {
    const x =
      index === normalizedSampleCount - 1
        ? xRange.max
        : xRange.min + step * index;
    let y = Number.NaN;

    try {
      y = compiled.evaluate({ x, y: 0 });
    } catch {
      y = Number.NaN;
    }

    if (!isRenderableValue(y)) {
      invalidPointCount += 1;

      if (currentPoints.length >= 2) {
        polylines.push({ points: currentPoints });
      }
      currentPoints = [];
      continue;
    }

    const previousPoint = currentPoints[currentPoints.length - 1];

    if (previousPoint && shouldBreakPolyline(previousPoint.y, y)) {
      if (currentPoints.length >= 2) {
        polylines.push({ points: currentPoints });
      }
      currentPoints = [];
    }

    currentPoints = [...currentPoints, { x, y }];
  }

  if (currentPoints.length >= 2) {
    polylines.push({ points: currentPoints });
  }

  return {
    ok: true,
    polylines,
    invalidPointCount,
  };
};
