import type {
  Plane2DCircleEntity,
  Plane2DEntity,
  Plane2DPointEntity,
  Plane2DSegmentEntity,
  PlaneCanvasDocument,
  Vec2,
} from "./PlaneCanvasTypes";

const EPSILON = 1e-6;
const ENDPOINT_EPSILON = 1e-4;

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
    }

    if (
      entity.type === "plane2d-segment" &&
      entity.construction?.kind === "perpendicularTargetExtension"
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

  const segments = Object.values(nextEntities).filter(
    (entity): entity is Plane2DSegmentEntity =>
      entity.type === "plane2d-segment",
  );

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const segmentA = segments[i];
      const segmentB = segments[j];
      const positionsA = getPlane2DSegmentPositions(
        { ...document, entities: nextEntities },
        segmentA,
      );
      const positionsB = getPlane2DSegmentPositions(
        { ...document, entities: nextEntities },
        segmentB,
      );

      if (!positionsA || !positionsB) {
        continue;
      }

      const intersection = computeSegmentIntersection2D(
        positionsA[0],
        positionsA[1],
        positionsB[0],
        positionsB[1],
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
