export type FunctionVariableName = "x" | "y";

export interface FunctionPlotRange {
  readonly min: number;
  readonly max: number;
}

export interface FunctionPlotPoint2D {
  readonly x: number;
  readonly y: number;
}

export interface FunctionPlotPolyline2D {
  readonly points: readonly FunctionPlotPoint2D[];
}

export interface FunctionSurfaceSample3D {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly invalidPointCount: number;
}
