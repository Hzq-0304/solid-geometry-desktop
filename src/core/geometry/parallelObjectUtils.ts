import type { BoardDocument } from "../document/BoardDocument";
import type { EntityId } from "../document/EntityTypes";

export interface ParallelSegmentInfo {
  readonly segmentId: EntityId;
  readonly sourceSegmentId: EntityId;
  readonly anchorPointId: EntityId;
  readonly constructedPointId: EntityId;
  readonly sourceAnchorEndpoint: "start" | "end";
}

export interface ParallelPlaneInfo {
  readonly planeId: EntityId;
  readonly sourcePlaneId: EntityId;
  readonly anchorPointId: EntityId;
  readonly constructedPointIds: readonly [EntityId, EntityId];
  readonly sourceAnchorVertexIndex: 0 | 1 | 2;
}

export const getParallelSegmentInfo = (
  segmentId: EntityId,
  document: BoardDocument,
): ParallelSegmentInfo | null => {
  const segment = document.entities[segmentId];

  if (segment?.kind !== "segment") {
    return null;
  }

  const constructedPoint = segment.pointIds
    .map((pointId) => document.entities[pointId])
    .find(
      (entity) =>
        entity?.kind === "point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "parallelSegmentEndpoint",
    );

  if (
    !constructedPoint ||
    constructedPoint.kind !== "point" ||
    constructedPoint.construction?.kind !== "parallelSegmentEndpoint"
  ) {
    return null;
  }

  const { anchorPointId, sourceSegmentId, sourceAnchorEndpoint } =
    constructedPoint.construction;
  const anchorPoint = document.entities[anchorPointId];
  const sourceSegment = document.entities[sourceSegmentId];

  if (
    anchorPoint?.kind !== "point" ||
    anchorPoint.pointKind === "constructed" ||
    sourceSegment?.kind !== "segment" ||
    !segment.pointIds.includes(anchorPointId)
  ) {
    return null;
  }

  return {
    segmentId,
    sourceSegmentId,
    anchorPointId,
    constructedPointId: constructedPoint.id,
    sourceAnchorEndpoint,
  };
};

export const getParallelPlaneInfo = (
  planeId: EntityId,
  document: BoardDocument,
): ParallelPlaneInfo | null => {
  const plane = document.entities[planeId];

  if (plane?.kind !== "plane") {
    return null;
  }

  const constructedPoints = plane.pointIds
    .map((pointId) => document.entities[pointId])
    .filter(
      (entity) =>
        entity?.kind === "point" &&
        entity.pointKind === "constructed" &&
        entity.construction?.kind === "parallelPlaneVertex",
    );

  if (constructedPoints.length !== 2) {
    return null;
  }

  const [firstPoint, secondPoint] = constructedPoints;

  if (
    firstPoint.kind !== "point" ||
    secondPoint.kind !== "point" ||
    firstPoint.construction?.kind !== "parallelPlaneVertex" ||
    secondPoint.construction?.kind !== "parallelPlaneVertex"
  ) {
    return null;
  }

  const { anchorPointId, sourcePlaneId, sourceAnchorVertexIndex } =
    firstPoint.construction;

  if (
    secondPoint.construction.anchorPointId !== anchorPointId ||
    secondPoint.construction.sourcePlaneId !== sourcePlaneId ||
    secondPoint.construction.sourceAnchorVertexIndex !==
      sourceAnchorVertexIndex
  ) {
    return null;
  }

  const anchorPoint = document.entities[anchorPointId];
  const sourcePlane = document.entities[sourcePlaneId];

  if (
    anchorPoint?.kind !== "point" ||
    anchorPoint.pointKind === "constructed" ||
    sourcePlane?.kind !== "plane" ||
    !plane.pointIds.includes(anchorPointId)
  ) {
    return null;
  }

  return {
    planeId,
    sourcePlaneId,
    anchorPointId,
    constructedPointIds: [firstPoint.id, secondPoint.id],
    sourceAnchorVertexIndex,
  };
};
