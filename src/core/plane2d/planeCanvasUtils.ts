import type {
  Plane2DCircleEntity,
  Plane2DEntity,
  Plane2DExtensionEntity,
  Plane2DMeasurementEntity,
  Plane2DPointEntity,
  Plane2DPolygonEntity,
  Plane2DSegmentEntity,
  PlaneCanvasDocument,
  Vec2,
} from "./PlaneCanvasTypes";

const EPSILON = 1e-6;
const ENDPOINT_EPSILON = 1e-4;
const EXTENSION_INTERSECTION_SPAN = 10000;

export const createPlaneCanvasDocument = (): PlaneCanvasDocument => {
  const now = new Date().toISOString();

  return {
    id: `plane-canvas-${Date.now()}`,
    type: "plane2d",
    name: "Untitled Plane Canvas",
    version: "1.0",
    createdAt: now,
    updatedAt: now,
    entities: {},
    selectedEntityIds: [],
    settings: {
      showGrid: false,
      snapToPoints: true,
      snapToSegments: true,
      snapDistancePx: 10,
      pointSizePx: 8,
      lineWidthPx: 2,
    },
  };
};

export const createPlane2DPoint = (
  id: string,
  position: Vec2,
  options: Partial<Plane2DPointEntity> = {},
): Plane2DPointEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-point",
    position,
    pointKind: "free",
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const createPlane2DSegment = (
  id: string,
  startPointId: string,
  endPointId: string,
  options: Partial<Plane2DSegmentEntity> = {},
): Plane2DSegmentEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-segment",
    startPointId,
    endPointId,
    segmentKind: "free",
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const createPlane2DCircle = (
  id: string,
  centerPointId: string,
  radiusPointId: string,
  options: Partial<Plane2DCircleEntity> = {},
): Plane2DCircleEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-circle",
    centerPointId,
    radiusPointId,
    circleKind: "free",
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const createPlane2DMeasurement = (
  id: string,
  options: Omit<
    Plane2DMeasurementEntity,
    "id" | "type" | "nameSource" | "showName" | "createdAt" | "updatedAt"
  > &
    Partial<
      Pick<
        Plane2DMeasurementEntity,
        "name" | "nameSource" | "showName" | "createdAt" | "updatedAt"
      >
    >,
): Plane2DMeasurementEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-measurement",
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const createPlane2DPolygon = (
  id: string,
  vertexPointIds: readonly string[],
  options: Partial<Plane2DPolygonEntity> = {},
): Plane2DPolygonEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-polygon",
    vertexPointIds,
    polygonKind: "free",
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const createPlane2DExtension = (
  id: string,
  targetSegmentId: string,
  options: Partial<Plane2DExtensionEntity> = {},
): Plane2DExtensionEntity => {
  const now = new Date().toISOString();

  return {
    id,
    type: "plane2d-extension",
    targetSegmentId,
    extensionKind: "segmentExtension",
    visible: true,
    snapEnabled: true,
    nameSource: "auto",
    showName: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
};

export const normalizePlaneCanvasDocument = (
  document: PlaneCanvasDocument,
): PlaneCanvasDocument => {
  const defaults = createPlaneCanvasDocument();

  return {
    ...defaults,
    ...document,
    selectedEntityIds: document.selectedEntityIds ?? [],
    settings: {
      ...defaults.settings,
      ...document.settings,
      showGrid: false,
    },
  };
};

export const addVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

export const subtractVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const scaleVec2 = (v: Vec2, scale: number): Vec2 => ({
  x: v.x * scale,
  y: v.y * scale,
});

export const midpointVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const distanceBetweenVec2 = (a: Vec2, b: Vec2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const dotVec2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

const lengthSquaredVec2 = (v: Vec2): number => v.x * v.x + v.y * v.y;

export const normalizeVec2 = (v: Vec2): Vec2 | null => {
  const length = Math.hypot(v.x, v.y);

  return length < EPSILON ? null : { x: v.x / length, y: v.y / length };
};

export const getPerpendicularFootOnLine2D = (
  point: Vec2,
  lineA: Vec2,
  lineB: Vec2,
): Vec2 | null => {
  const direction = subtractVec2(lineB, lineA);
  const lengthSquared = lengthSquaredVec2(direction);

  if (lengthSquared < EPSILON) {
    return null;
  }

  const t = dotVec2(subtractVec2(point, lineA), direction) / lengthSquared;

  return addVec2(lineA, scaleVec2(direction, t));
};

export const getPerpendicularFootParameterOnLine2D = (
  point: Vec2,
  lineA: Vec2,
  lineB: Vec2,
): { readonly foot: Vec2; readonly t: number } | null => {
  const direction = subtractVec2(lineB, lineA);
  const lengthSquared = lengthSquaredVec2(direction);

  if (lengthSquared < EPSILON) {
    return null;
  }

  const t = dotVec2(subtractVec2(point, lineA), direction) / lengthSquared;

  return { foot: addVec2(lineA, scaleVec2(direction, t)), t };
};

export const getPerpendicularEndpointOnLine2D = (
  point: Vec2,
  lineA: Vec2,
  lineB: Vec2,
  side: 1 | -1,
  length: number,
): Vec2 | null => {
  const direction = normalizeVec2(subtractVec2(lineB, lineA));

  if (!direction || length < EPSILON) {
    return null;
  }

  const normal =
    side === 1
      ? { x: -direction.y, y: direction.x }
      : { x: direction.y, y: -direction.x };

  return addVec2(point, scaleVec2(normal, length));
};

export const getSignedPerpendicularSide2D = (
  point: Vec2,
  lineA: Vec2,
  lineB: Vec2,
  target: Vec2,
): { readonly side: 1 | -1; readonly length: number } | null => {
  const direction = normalizeVec2(subtractVec2(lineB, lineA));

  if (!direction) {
    return null;
  }

  const vector = subtractVec2(target, point);
  const signedDistance = direction.x * vector.y - direction.y * vector.x;
  const side: 1 | -1 = signedDistance >= 0 ? 1 : -1;

  return { side, length: Math.abs(signedDistance) };
};

export const getPlane2DPointPosition = (
  document: PlaneCanvasDocument,
  pointId: string,
): Vec2 | null => {
  const point = document.entities[pointId];

  return point?.type === "plane2d-point" ? point.position : null;
};

export const getPlane2DSegmentPositions = (
  document: PlaneCanvasDocument,
  segment: Plane2DSegmentEntity,
): readonly [Vec2, Vec2] | null => {
  const start = getPlane2DPointPosition(document, segment.startPointId);
  const end = getPlane2DPointPosition(document, segment.endPointId);

  return start && end ? [start, end] : null;
};

export const getPlane2DCircleGeometry = (
  document: PlaneCanvasDocument,
  circle: Plane2DCircleEntity,
): { readonly center: Vec2; readonly radiusPoint: Vec2; readonly radius: number } | null => {
  const center = getPlane2DPointPosition(document, circle.centerPointId);
  const radiusPoint = getPlane2DPointPosition(document, circle.radiusPointId);

  if (!center || !radiusPoint) {
    return null;
  }

  return {
    center,
    radiusPoint,
    radius: distanceBetweenVec2(center, radiusPoint),
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const angleBetweenVec2 = (a: Vec2, b: Vec2): number | null => {
  const lengthA = Math.hypot(a.x, a.y);
  const lengthB = Math.hypot(b.x, b.y);

  if (lengthA < EPSILON || lengthB < EPSILON) {
    return null;
  }

  const cosine = clamp(dotVec2(a, b) / (lengthA * lengthB), -1, 1);

  return (Math.acos(cosine) * 180) / Math.PI;
};

export const getPlane2DMeasurementInfo = (
  document: PlaneCanvasDocument,
  measurement: Plane2DMeasurementEntity,
): { readonly value: number; readonly label: string; readonly position: Vec2 } | null => {
  if (measurement.measurementKind === "length") {
    if (measurement.definition.kind === "segmentLength") {
      const segment = document.entities[measurement.definition.segmentId];
      const positions =
        segment?.type === "plane2d-segment"
          ? getPlane2DSegmentPositions(document, segment)
          : null;

      if (!positions) {
        return null;
      }

      const value = distanceBetweenVec2(positions[0], positions[1]);

      return {
        value,
        label: `长度：${value.toFixed(2)}`,
        position: measurement.labelPosition ?? midpointVec2(positions[0], positions[1]),
      };
    }

    if (measurement.definition.kind !== "pointDistance") {
      return null;
    }

    const pointA = getPlane2DPointPosition(document, measurement.definition.pointAId);
    const pointB = getPlane2DPointPosition(document, measurement.definition.pointBId);

    if (!pointA || !pointB) {
      return null;
    }

    const value = distanceBetweenVec2(pointA, pointB);

    return {
      value,
      label: `长度：${value.toFixed(2)}`,
      position: measurement.labelPosition ?? midpointVec2(pointA, pointB),
    };
  }

  if (measurement.definition.kind === "segmentSegmentAngle") {
    const segmentA = document.entities[measurement.definition.segmentAId];
    const segmentB = document.entities[measurement.definition.segmentBId];
    const positionsA =
      segmentA?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(document, segmentA)
        : null;
    const positionsB =
      segmentB?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(document, segmentB)
        : null;

    if (!positionsA || !positionsB) {
      return null;
    }

    const value = angleBetweenVec2(
      subtractVec2(positionsA[1], positionsA[0]),
      subtractVec2(positionsB[1], positionsB[0]),
    );

    if (value === null) {
      return null;
    }

    const shared = positionsA.find((pointA) =>
      positionsB.some((pointB) => distanceBetweenVec2(pointA, pointB) < ENDPOINT_EPSILON),
    );
    const midA = midpointVec2(positionsA[0], positionsA[1]);
    const midB = midpointVec2(positionsB[0], positionsB[1]);

    return {
      value,
      label: `角度：${value.toFixed(2)}°`,
      position: measurement.labelPosition ?? shared ?? midpointVec2(midA, midB),
    };
  }

  if (measurement.definition.kind !== "threePointAngle") {
    return null;
  }

  const pointA = getPlane2DPointPosition(document, measurement.definition.pointAId);
  const vertex = getPlane2DPointPosition(
    document,
    measurement.definition.vertexPointId,
  );
  const pointC = getPlane2DPointPosition(document, measurement.definition.pointCId);

  if (!pointA || !vertex || !pointC) {
    return null;
  }

  const value = angleBetweenVec2(
    subtractVec2(pointA, vertex),
    subtractVec2(pointC, vertex),
  );

  if (value === null) {
    return null;
  }

  return {
    value,
    label: `角度：${value.toFixed(2)}°`,
    position: measurement.labelPosition ?? vertex,
  };
};

export const getClosestPointOnSegment2D = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
): { readonly point: Vec2; readonly t: number; readonly distance: number } => {
  const segment = subtractVec2(end, start);
  const lengthSquared = segment.x * segment.x + segment.y * segment.y;

  if (lengthSquared < EPSILON) {
    return { point: start, t: 0, distance: distanceBetweenVec2(point, start) };
  }

  const rawT =
    ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) /
    lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  const closest = addVec2(start, scaleVec2(segment, t));

  return { point: closest, t, distance: distanceBetweenVec2(point, closest) };
};

export type SegmentIntersection2D =
  | {
      readonly kind: "point";
      readonly position: Vec2;
      readonly t: number;
      readonly u: number;
    }
  | { readonly kind: "parallel" }
  | { readonly kind: "collinearOverlap" }
  | { readonly kind: "none" };

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const computeSegmentIntersection2D = (
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
): SegmentIntersection2D => {
  const r = subtractVec2(b, a);
  const s = subtractVec2(d, c);
  const denominator = cross(r, s);
  const cMinusA = subtractVec2(c, a);

  if (Math.abs(denominator) < EPSILON) {
    return Math.abs(cross(cMinusA, r)) < EPSILON
      ? { kind: "collinearOverlap" }
      : { kind: "parallel" };
  }

  const t = cross(cMinusA, s) / denominator;
  const u = cross(cMinusA, r) / denominator;

  if (
    t < -EPSILON ||
    t > 1 + EPSILON ||
    u < -EPSILON ||
    u > 1 + EPSILON
  ) {
    return { kind: "none" };
  }

  return {
    kind: "point",
    position: addVec2(a, scaleVec2(r, t)),
    t,
    u,
  };
};

export const plane2DIntersectionPointId = (
  segmentAId: string,
  segmentBId: string,
): string => {
  const [first, second] = [segmentAId, segmentBId].sort();

  return `plane2d-intersection-${first}-${second}`;
};

export const plane2DMidpointId = (pointAId: string, pointBId: string): string => {
  const [first, second] = [pointAId, pointBId].sort();

  return `plane2d-midpoint-${first}-${second}`;
};

export const plane2DPerpendicularFootId = (
  pointId: string,
  segmentId: string,
): string => `plane2d-perpendicular-foot-${pointId}-${segmentId}`;

export const plane2DPerpendicularEndpointId = (
  pointId: string,
  segmentId: string,
): string => `plane2d-perpendicular-endpoint-${pointId}-${segmentId}`;

export const plane2DPerpendicularTargetExtensionId = (
  pointId: string,
  segmentId: string,
): string => `plane2d-perpendicular-target-extension-${pointId}-${segmentId}`;

export const plane2DExtensionId = (segmentId: string): string =>
  `plane2d-extension-${segmentId}`;

export type Plane2DExtensionPart = {
  readonly id: string;
  readonly extensionId: string;
  readonly part: "start" | "end";
  readonly start: Vec2;
  readonly end: Vec2;
};

export const getRegularPolygonVertexPosition = (
  center: Vec2,
  radiusPoint: Vec2,
  sides: number,
  vertexIndex: number,
  rotationOffset = 0,
): Vec2 | null => {
  if (!Number.isInteger(sides) || sides < 3) {
    return null;
  }

  const radius = distanceBetweenVec2(center, radiusPoint);

  if (radius < EPSILON) {
    return null;
  }

  const baseAngle =
    Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x) +
    rotationOffset;
  const angle = baseAngle + (vertexIndex * 2 * Math.PI) / sides;

  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
};

export const getRegularPolygonVertices = (
  center: Vec2,
  radiusPoint: Vec2,
  sides: number,
  rotationOffset = 0,
): readonly Vec2[] | null => {
  if (!Number.isInteger(sides) || sides < 3) {
    return null;
  }

  const vertices: Vec2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const vertex = getRegularPolygonVertexPosition(
      center,
      radiusPoint,
      sides,
      index,
      rotationOffset,
    );

    if (!vertex) {
      return null;
    }

    vertices.push(vertex);
  }

  return vertices;
};

export const getPlane2DPolygonPoints = (
  document: PlaneCanvasDocument,
  polygon: Plane2DPolygonEntity,
): readonly Vec2[] | null => {
  const points = polygon.vertexPointIds.map((pointId) =>
    getPlane2DPointPosition(document, pointId),
  );

  return points.every((point): point is Vec2 => Boolean(point)) ? points : null;
};

export const getPlane2DExtensionParts = (
  document: PlaneCanvasDocument,
  extension: Plane2DExtensionEntity,
  span = EXTENSION_INTERSECTION_SPAN,
): readonly Plane2DExtensionPart[] => {
  if (extension.visible === false || extension.snapEnabled === false) {
    return [];
  }

  const target = document.entities[extension.targetSegmentId];
  const positions =
    target?.type === "plane2d-segment"
      ? getPlane2DSegmentPositions(document, target)
      : null;

  if (!positions) {
    return [];
  }

  const [start, end] = positions;
  const direction = normalizeVec2(subtractVec2(end, start));

  if (!direction) {
    return [];
  }

  return [
    {
      id: `${extension.id}:start`,
      extensionId: extension.id,
      part: "start",
      start: addVec2(start, scaleVec2(direction, -span)),
      end: start,
    },
    {
      id: `${extension.id}:end`,
      extensionId: extension.id,
      part: "end",
      start: end,
      end: addVec2(end, scaleVec2(direction, span)),
    },
  ];
};

const isEndpointIntersection = (t: number, u: number): boolean =>
  t <= ENDPOINT_EPSILON ||
  t >= 1 - ENDPOINT_EPSILON ||
  u <= ENDPOINT_EPSILON ||
  u >= 1 - ENDPOINT_EPSILON;

const preservePointMetadata = (
  previous: Plane2DEntity | undefined,
): Pick<Plane2DPointEntity, "name" | "nameSource" | "showName" | "createdAt"> => ({
  name: previous?.type === "plane2d-point" ? previous.name : undefined,
  nameSource:
    previous?.type === "plane2d-point" ? previous.nameSource : "auto",
  showName: previous?.type === "plane2d-point" ? previous.showName : false,
  createdAt:
    previous?.type === "plane2d-point" ? previous.createdAt : undefined,
});

const preserveSegmentMetadata = (
  previous: Plane2DEntity | undefined,
): Pick<Plane2DSegmentEntity, "name" | "nameSource" | "showName" | "createdAt"> => ({
  name: previous?.type === "plane2d-segment" ? previous.name : undefined,
  nameSource:
    previous?.type === "plane2d-segment" ? previous.nameSource : "auto",
  showName:
    previous?.type === "plane2d-segment" ? previous.showName : false,
  createdAt:
    previous?.type === "plane2d-segment" ? previous.createdAt : undefined,
});

export const syncPlane2DConstructions = (
  document: PlaneCanvasDocument,
): PlaneCanvasDocument => {
  const baseEntities: Record<string, Plane2DEntity> = {};
  const midpointRequests: Plane2DPointEntity[] = [];
  const perpendicularFootRequests: Plane2DPointEntity[] = [];
  const perpendicularEndpointRequests: Plane2DPointEntity[] = [];
  const copiedCircleRadiusPointRequests: Plane2DPointEntity[] = [];
  const regularPolygonVertexRequests: Plane2DPointEntity[] = [];

  Object.values(document.entities).forEach((entity) => {
    if (
      entity.type === "plane2d-point" &&
      entity.pointKind === "constructed"
    ) {
      if (entity.construction?.kind === "segmentIntersection") {
        return;
      }

      if (entity.construction?.kind === "midpoint") {
        midpointRequests.push(entity);
        return;
      }

      if (entity.construction?.kind === "perpendicularFoot") {
        perpendicularFootRequests.push(entity);
        return;
      }

      if (entity.construction?.kind === "perpendicularEndpoint") {
        perpendicularEndpointRequests.push(entity);
        return;
      }

      if (entity.construction?.kind === "copiedCircleRadiusPoint") {
        copiedCircleRadiusPointRequests.push(entity);
        return;
      }

      if (entity.construction?.kind === "regularPolygonVertex") {
        regularPolygonVertexRequests.push(entity);
        return;
      }
    }

    if (
      entity.type === "plane2d-segment" &&
      entity.construction?.kind === "perpendicularTargetExtension"
    ) {
      return;
    }

    if (
      entity.type === "plane2d-extension" &&
      document.entities[entity.targetSegmentId]?.type !== "plane2d-segment"
    ) {
      return;
    }

    baseEntities[entity.id] = entity;
  });

  const nextEntities: Record<string, Plane2DEntity> = { ...baseEntities };

  midpointRequests.forEach((point) => {
    if (point.construction?.kind !== "midpoint") {
      return;
    }

    const pointA = getPlane2DPointPosition(
      { ...document, entities: baseEntities },
      point.construction.pointAId,
    );
    const pointB = getPlane2DPointPosition(
      { ...document, entities: baseEntities },
      point.construction.pointBId,
    );

    if (!pointA || !pointB) {
      return;
    }

    nextEntities[point.id] = createPlane2DPoint(
      point.id,
      midpointVec2(pointA, pointB),
      {
        ...preservePointMetadata(point),
        pointKind: "constructed",
        construction: point.construction,
      },
    );
  });

  perpendicularFootRequests.forEach((point) => {
    if (point.construction?.kind !== "perpendicularFoot") {
      return;
    }

    const sourcePoint = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.pointId,
    );
    const segment = nextEntities[point.construction.segmentId];
    const segmentPositions =
      segment?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(
            { ...document, entities: nextEntities },
            segment,
          )
        : null;

    if (!sourcePoint || !segmentPositions) {
      return;
    }

    const footInfo = getPerpendicularFootParameterOnLine2D(
      sourcePoint,
      segmentPositions[0],
      segmentPositions[1],
    );

    if (!footInfo) {
      return;
    }

    nextEntities[point.id] = createPlane2DPoint(point.id, footInfo.foot, {
      ...preservePointMetadata(point),
      pointKind: "constructed",
      construction: point.construction,
    });
  });

  perpendicularFootRequests.forEach((point) => {
    if (point.construction?.kind !== "perpendicularFoot") {
      return;
    }

    const sourcePoint = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.pointId,
    );
    const segment = nextEntities[point.construction.segmentId];
    const segmentPositions =
      segment?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(
            { ...document, entities: nextEntities },
            segment,
          )
        : null;

    if (!sourcePoint || !segmentPositions || segment?.type !== "plane2d-segment") {
      return;
    }

    const footInfo = getPerpendicularFootParameterOnLine2D(
      sourcePoint,
      segmentPositions[0],
      segmentPositions[1],
    );

    if (!footInfo) {
      return;
    }

    const endpointRole =
      footInfo.t < -EPSILON
        ? "start"
        : footInfo.t > 1 + EPSILON
          ? "end"
          : null;

    if (!endpointRole) {
      return;
    }

    const id = plane2DPerpendicularTargetExtensionId(
      point.construction.pointId,
      point.construction.segmentId,
    );
    const previous = document.entities[id];

    nextEntities[id] = createPlane2DSegment(
      id,
      endpointRole === "start" ? segment.startPointId : segment.endPointId,
      point.id,
      {
        ...preserveSegmentMetadata(previous),
        segmentKind: "extension",
        construction: {
          kind: "perpendicularTargetExtension",
          pointId: point.construction.pointId,
          targetSegmentId: point.construction.segmentId,
          footPointId: point.id,
          endpointRole,
        },
      },
    );
  });

  perpendicularEndpointRequests.forEach((point) => {
    if (point.construction?.kind !== "perpendicularEndpoint") {
      return;
    }

    const sourcePoint = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.pointId,
    );
    const segment = nextEntities[point.construction.segmentId];
    const segmentPositions =
      segment?.type === "plane2d-segment"
        ? getPlane2DSegmentPositions(
            { ...document, entities: nextEntities },
            segment,
          )
        : null;

    if (!sourcePoint || !segmentPositions) {
      return;
    }

    const endpoint = getPerpendicularEndpointOnLine2D(
      sourcePoint,
      segmentPositions[0],
      segmentPositions[1],
      point.construction.side,
      point.construction.length,
    );

    if (!endpoint) {
      return;
    }

    nextEntities[point.id] = createPlane2DPoint(point.id, endpoint, {
      ...preservePointMetadata(point),
      pointKind: "constructed",
      construction: point.construction,
    });
  });

  type IntersectionSegmentCandidate = {
    readonly id: string;
    readonly start: Vec2;
    readonly end: Vec2;
  };

  const segmentCandidates: IntersectionSegmentCandidate[] = [];

  Object.values(nextEntities).forEach((entity) => {
    if (entity.type === "plane2d-segment") {
      const positions = getPlane2DSegmentPositions(
        { ...document, entities: nextEntities },
        entity,
      );

      if (positions) {
        segmentCandidates.push({
          id: entity.id,
          start: positions[0],
          end: positions[1],
        });
      }
    }

    if (entity.type === "plane2d-extension") {
      getPlane2DExtensionParts(
        { ...document, entities: nextEntities },
        entity,
      ).forEach((part) => {
        segmentCandidates.push({
          id: part.id,
          start: part.start,
          end: part.end,
        });
      });
    }
  });

  copiedCircleRadiusPointRequests.forEach((point) => {
    if (point.construction?.kind !== "copiedCircleRadiusPoint") {
      return;
    }

    const sourceCircle = nextEntities[point.construction.sourceCircleId];
    const sourceGeometry =
      sourceCircle?.type === "plane2d-circle"
        ? getPlane2DCircleGeometry({ ...document, entities: nextEntities }, sourceCircle)
        : null;
    const center = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.centerPointId,
    );

    if (!sourceGeometry || !center) {
      return;
    }

    nextEntities[point.id] = createPlane2DPoint(
      point.id,
      { x: center.x + sourceGeometry.radius, y: center.y },
      {
        ...preservePointMetadata(point),
        pointKind: "constructed",
        construction: point.construction,
      },
    );
  });

  regularPolygonVertexRequests.forEach((point) => {
    if (point.construction?.kind !== "regularPolygonVertex") {
      return;
    }

    const center = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.centerPointId,
    );
    const radiusPoint = getPlane2DPointPosition(
      { ...document, entities: nextEntities },
      point.construction.radiusPointId,
    );

    if (!center || !radiusPoint) {
      return;
    }

    const vertex = getRegularPolygonVertexPosition(
      center,
      radiusPoint,
      point.construction.sides,
      point.construction.vertexIndex,
      point.construction.rotationOffset,
    );

    if (!vertex) {
      return;
    }

    nextEntities[point.id] = createPlane2DPoint(point.id, vertex, {
      ...preservePointMetadata(point),
      pointKind: "constructed",
      construction: point.construction,
    });
  });

  for (let i = 0; i < segmentCandidates.length; i += 1) {
    for (let j = i + 1; j < segmentCandidates.length; j += 1) {
      const segmentA = segmentCandidates[i];
      const segmentB = segmentCandidates[j];
      const intersection = computeSegmentIntersection2D(
        segmentA.start,
        segmentA.end,
        segmentB.start,
        segmentB.end,
      );

      if (
        intersection.kind !== "point" ||
        isEndpointIntersection(intersection.t, intersection.u)
      ) {
        continue;
      }

      const id = plane2DIntersectionPointId(segmentA.id, segmentB.id);
      const [segmentAId, segmentBId] = [segmentA.id, segmentB.id].sort();
      const previous = document.entities[id];

      nextEntities[id] = createPlane2DPoint(id, intersection.position, {
        ...preservePointMetadata(previous),
        pointKind: "constructed",
        construction: {
          kind: "segmentIntersection",
          segmentAId,
          segmentBId,
        },
      });
    }
  }

  Object.values(nextEntities).forEach((entity) => {
    if (
      entity.type === "plane2d-polygon" &&
      !getPlane2DPolygonPoints({ ...document, entities: nextEntities }, entity)
    ) {
      delete nextEntities[entity.id];
    }

    if (
      entity.type === "plane2d-measurement" &&
      !getPlane2DMeasurementInfo({ ...document, entities: nextEntities }, entity)
    ) {
      delete nextEntities[entity.id];
    }
  });

  const selectedEntityIds = document.selectedEntityIds.filter((entityId) =>
    Boolean(nextEntities[entityId]),
  );

  return {
    ...document,
    entities: nextEntities,
    selectedEntityIds,
    updatedAt: new Date().toISOString(),
  };
};

export const syncPlane2DIntersections = syncPlane2DConstructions;

export const deletePlane2DEntities = (
  document: PlaneCanvasDocument,
  entityIds: readonly string[],
): PlaneCanvasDocument => {
  const toDelete = new Set(entityIds);
  const deletesOnlyTargetExtensions =
    entityIds.length > 0 &&
    entityIds.every((entityId) => {
      const entity = document.entities[entityId];

      return (
        entity?.type === "plane2d-segment" &&
        entity.construction?.kind === "perpendicularTargetExtension"
      );
    });

  let changed = true;
  while (changed) {
    changed = false;
    Object.values(document.entities).forEach((entity) => {
      if (
        entity.type === "plane2d-segment" &&
        (toDelete.has(entity.startPointId) || toDelete.has(entity.endPointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-circle" &&
        (toDelete.has(entity.centerPointId) || toDelete.has(entity.radiusPointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-extension" &&
        toDelete.has(entity.targetSegmentId) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-polygon" &&
        entity.vertexPointIds.some((pointId) => toDelete.has(pointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-polygon" &&
        entity.construction?.kind === "regularPolygon" &&
        (toDelete.has(entity.construction.centerPointId) ||
          toDelete.has(entity.construction.radiusPointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "regularPolygonVertex" &&
        toDelete.has(entity.construction.polygonId) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (entity.type === "plane2d-measurement" && !toDelete.has(entity.id)) {
        const definition = entity.definition;
        const dependsOnDeleted =
          (definition.kind === "segmentLength" &&
            toDelete.has(definition.segmentId)) ||
          (definition.kind === "pointDistance" &&
            (toDelete.has(definition.pointAId) ||
              toDelete.has(definition.pointBId))) ||
          (definition.kind === "segmentSegmentAngle" &&
            (toDelete.has(definition.segmentAId) ||
              toDelete.has(definition.segmentBId))) ||
          (definition.kind === "threePointAngle" &&
            (toDelete.has(definition.pointAId) ||
              toDelete.has(definition.vertexPointId) ||
              toDelete.has(definition.pointCId)));

        if (dependsOnDeleted) {
          toDelete.add(entity.id);
          changed = true;
        }
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "midpoint" &&
        (toDelete.has(entity.construction.pointAId) ||
          toDelete.has(entity.construction.pointBId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "perpendicularFoot" &&
        (toDelete.has(entity.construction.pointId) ||
          toDelete.has(entity.construction.segmentId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "perpendicularEndpoint" &&
        (toDelete.has(entity.construction.pointId) ||
          toDelete.has(entity.construction.segmentId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "copiedCircleRadiusPoint" &&
        (toDelete.has(entity.construction.sourceCircleId) ||
          toDelete.has(entity.construction.centerPointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "regularPolygonVertex" &&
        (toDelete.has(entity.construction.centerPointId) ||
          toDelete.has(entity.construction.radiusPointId)) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }

      if (
        entity.type === "plane2d-circle" &&
        entity.construction?.kind === "copyCircle" &&
        toDelete.has(entity.construction.sourceCircleId) &&
        !toDelete.has(entity.id)
      ) {
        toDelete.add(entity.id);
        changed = true;
      }
    });
  }

  const entities: Record<string, Plane2DEntity> = {};
  Object.values(document.entities).forEach((entity) => {
    if (!toDelete.has(entity.id)) {
      entities[entity.id] = entity;
    }
  });

  if (deletesOnlyTargetExtensions) {
    return {
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => !toDelete.has(entityId),
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  return syncPlane2DConstructions({
    ...document,
    entities,
    selectedEntityIds: document.selectedEntityIds.filter(
      (entityId) => !toDelete.has(entityId),
    ),
  });
};
