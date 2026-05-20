import type { BoardDocument } from "../document/BoardDocument";
import type { EntityId, PointEntity, SegmentEntity } from "../document/EntityTypes";
import type { Vec3 } from "./Vec3";
import {
  addVec3,
  dotVec3,
  normalizeVec3,
  projectPointToLine,
  scaleVec3,
  subtractVec3,
} from "./geometryUtils";
import { getPlaneFromThreePoints } from "./planeUtils";

const isFiniteVec3 = (position: Vec3): boolean =>
  Number.isFinite(position.x) &&
  Number.isFinite(position.y) &&
  Number.isFinite(position.z);

const getPointEntity = (
  document: BoardDocument,
  pointId: EntityId,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

const getSegmentEntity = (
  document: BoardDocument,
  segmentId: EntityId,
): SegmentEntity | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? entity : null;
};

export const resolvePointPosition = (
  point: PointEntity,
  document: BoardDocument,
  visitedPointIds: ReadonlySet<EntityId> = new Set(),
): Vec3 | null => {
  if (visitedPointIds.has(point.id)) {
    return null;
  }

  const nextVisitedPointIds = new Set(visitedPointIds);
  nextVisitedPointIds.add(point.id);

  if (point.pointKind !== "constructed" || !point.construction) {
    return isFiniteVec3(point.position) ? point.position : null;
  }

  if (point.construction.kind === "midpoint") {
    const startPosition = getPointWorldPosition(
      document,
      point.construction.pointAId,
      nextVisitedPointIds,
    );
    const endPosition = getPointWorldPosition(
      document,
      point.construction.pointBId,
      nextVisitedPointIds,
    );

    if (!startPosition || !endPosition) {
      return null;
    }

    const midpoint = scaleVec3(
      {
        x: startPosition.x + endPosition.x,
        y: startPosition.y + endPosition.y,
        z: startPosition.z + endPosition.z,
      },
      0.5,
    );

    return isFiniteVec3(midpoint) ? midpoint : null;
  }

  if (point.construction.kind === "parallelSegmentEndpoint") {
    const anchorPosition = getPointWorldPosition(
      document,
      point.construction.anchorPointId,
      nextVisitedPointIds,
    );
    const segment = getSegmentEntity(
      document,
      point.construction.sourceSegmentId,
    );

    if (!anchorPosition || !segment) {
      return null;
    }

    const startPosition = getPointWorldPosition(
      document,
      segment.pointIds[0],
      nextVisitedPointIds,
    );
    const endPosition = getPointWorldPosition(
      document,
      segment.pointIds[1],
      nextVisitedPointIds,
    );

    if (!startPosition || !endPosition) {
      return null;
    }

    const offset =
      point.construction.sourceAnchorEndpoint === "start"
        ? subtractVec3(endPosition, startPosition)
        : subtractVec3(startPosition, endPosition);
    const endpoint = addVec3(anchorPosition, offset);

    return isFiniteVec3(endpoint) ? endpoint : null;
  }

  if (point.construction.kind === "parallelPlaneVertex") {
    const anchorPosition = getPointWorldPosition(
      document,
      point.construction.anchorPointId,
      nextVisitedPointIds,
    );
    const plane = document.entities[point.construction.sourcePlaneId];

    if (!anchorPosition || plane?.kind !== "plane") {
      return null;
    }

    const sourcePositions = plane.pointIds.map((pointId) =>
      getPointWorldPosition(document, pointId, nextVisitedPointIds),
    );
    const sourceAnchorPosition =
      sourcePositions[point.construction.sourceAnchorVertexIndex];
    const sourceVertexPosition =
      sourcePositions[point.construction.sourceVertexIndex];

    if (!sourceAnchorPosition || !sourceVertexPosition) {
      return null;
    }

    const vertex = addVec3(
      anchorPosition,
      subtractVec3(sourceVertexPosition, sourceAnchorPosition),
    );

    return isFiniteVec3(vertex) ? vertex : null;
  }

  const sourcePoint = getPointEntity(
    document,
    point.construction.sourcePointId,
  );
  const sourcePosition = sourcePoint
    ? resolvePointPosition(sourcePoint, document, nextVisitedPointIds)
    : null;

  if (!sourcePosition) {
    return null;
  }

  if (point.construction.kind === "footToLine") {
    const segment = getSegmentEntity(
      document,
      point.construction.targetSegmentId,
    );

    if (!segment) {
      return null;
    }

    const startPosition = getPointWorldPosition(
      document,
      segment.pointIds[0],
      nextVisitedPointIds,
    );
    const endPosition = getPointWorldPosition(
      document,
      segment.pointIds[1],
      nextVisitedPointIds,
    );

    if (!startPosition || !endPosition) {
      return null;
    }

    const projection = projectPointToLine(
      sourcePosition,
      startPosition,
      endPosition,
    );

    return projection && isFiniteVec3(projection.foot)
      ? projection.foot
      : null;
  }

  if (point.construction.kind === "perpendicularDirectionToLine") {
    const segment = getSegmentEntity(
      document,
      point.construction.targetSegmentId,
    );

    if (!segment) {
      return null;
    }

    const startPosition = getPointWorldPosition(
      document,
      segment.pointIds[0],
      nextVisitedPointIds,
    );
    const endPosition = getPointWorldPosition(
      document,
      segment.pointIds[1],
      nextVisitedPointIds,
    );

    if (!startPosition || !endPosition) {
      return null;
    }

    const direction = normalizeVec3(subtractVec3(endPosition, startPosition));

    if (!direction) {
      return null;
    }

    const guideVector = subtractVec3(
      point.construction.guidePosition,
      sourcePosition,
    );
    const perpendicularVector = subtractVec3(
      guideVector,
      scaleVec3(direction, dotVec3(guideVector, direction)),
    );
    const fallback = isFiniteVec3(point.position) ? point.position : null;

    return isFiniteVec3(perpendicularVector) &&
      Math.hypot(
        perpendicularVector.x,
        perpendicularVector.y,
        perpendicularVector.z,
      ) > 1e-9
      ? addVec3(sourcePosition, perpendicularVector)
      : fallback;
  }

  if (point.construction.kind === "perpendicularDirectionToPlane") {
    const plane = document.entities[point.construction.targetPlaneId];

    if (plane?.kind !== "plane") {
      return null;
    }

    const [pointAId, pointBId, pointCId] = plane.pointIds;
    const pointA = getPointWorldPosition(document, pointAId, nextVisitedPointIds);
    const pointB = getPointWorldPosition(document, pointBId, nextVisitedPointIds);
    const pointC = getPointWorldPosition(document, pointCId, nextVisitedPointIds);

    if (!pointA || !pointB || !pointC) {
      return null;
    }

    const planeEquation = getPlaneFromThreePoints(pointA, pointB, pointC);

    if (!planeEquation) {
      return null;
    }

    const length = Math.max(0, point.construction.length);
    const direction = scaleVec3(
      planeEquation.normal,
      point.construction.sign * length,
    );
    const directionPoint = addVec3(sourcePosition, direction);

    return isFiniteVec3(directionPoint) ? directionPoint : null;
  }

  const plane = document.entities[point.construction.targetPlaneId];

  if (plane?.kind !== "plane") {
    return null;
  }

  const [pointAId, pointBId, pointCId] = plane.pointIds;
  const pointA = getPointWorldPosition(document, pointAId, nextVisitedPointIds);
  const pointB = getPointWorldPosition(document, pointBId, nextVisitedPointIds);
  const pointC = getPointWorldPosition(document, pointCId, nextVisitedPointIds);

  if (!pointA || !pointB || !pointC) {
    return null;
  }

  const planeEquation = getPlaneFromThreePoints(pointA, pointB, pointC);

  if (!planeEquation) {
    return null;
  }

  const signedDistance = dotVec3(
    subtractVec3(sourcePosition, pointA),
    planeEquation.normal,
  );
  const foot = subtractVec3(
    sourcePosition,
    scaleVec3(planeEquation.normal, signedDistance),
  );

  return isFiniteVec3(foot)
    ? foot
    : null;
};

export const getPointWorldPosition = (
  document: BoardDocument,
  pointId: EntityId,
  visitedPointIds: ReadonlySet<EntityId> = new Set(),
): Vec3 | null => {
  const point = getPointEntity(document, pointId);

  return point ? resolvePointPosition(point, document, visitedPointIds) : null;
};

export const getSegmentWorldPositions = (
  document: BoardDocument,
  segmentId: EntityId,
): readonly [Vec3, Vec3] | null => {
  const segment = getSegmentEntity(document, segmentId);

  if (!segment) {
    return null;
  }

  const startPosition = getPointWorldPosition(document, segment.pointIds[0]);
  const endPosition = getPointWorldPosition(document, segment.pointIds[1]);

  return startPosition && endPosition ? [startPosition, endPosition] : null;
};

export const getPlaneWorldPositions = (
  document: BoardDocument,
  pointIds: readonly [EntityId, EntityId, EntityId],
): readonly [Vec3, Vec3, Vec3] | null => {
  const pointA = getPointWorldPosition(document, pointIds[0]);
  const pointB = getPointWorldPosition(document, pointIds[1]);
  const pointC = getPointWorldPosition(document, pointIds[2]);

  return pointA && pointB && pointC ? [pointA, pointB, pointC] : null;
};
