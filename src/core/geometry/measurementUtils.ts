import type { BoardDocument } from "../document/BoardDocument";
import type {
  EntityId,
  MeasurementEntity,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";

export const getDistanceBetweenPoints = (
  firstPoint: PointEntity,
  secondPoint: PointEntity,
): number => {
  const dx = secondPoint.position.x - firstPoint.position.x;
  const dy = secondPoint.position.y - firstPoint.position.y;
  const dz = secondPoint.position.z - firstPoint.position.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const getPointFromDocument = (
  document: BoardDocument,
  pointId: EntityId,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

export const getSegmentLength = (
  segment: SegmentEntity,
  document: BoardDocument,
): number | null => {
  const [startPointId, endPointId] = segment.pointIds;
  const startPoint = getPointFromDocument(document, startPointId);
  const endPoint = getPointFromDocument(document, endPointId);

  if (!startPoint || !endPoint) {
    return null;
  }

  return getDistanceBetweenPoints(startPoint, endPoint);
};

export const getSegmentLengthById = (
  document: BoardDocument,
  segmentId: EntityId,
): number | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? getSegmentLength(entity, document) : null;
};

export const getPointDistanceByIds = (
  document: BoardDocument,
  firstPointId: EntityId,
  secondPointId: EntityId,
): number | null => {
  const firstPoint = getPointFromDocument(document, firstPointId);
  const secondPoint = getPointFromDocument(document, secondPointId);

  if (!firstPoint || !secondPoint) {
    return null;
  }

  return getDistanceBetweenPoints(firstPoint, secondPoint);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const calculateAngleByThreePoints = (
  pointA: PointEntity,
  vertexB: PointEntity,
  pointC: PointEntity,
): number | null => {
  const bax = pointA.position.x - vertexB.position.x;
  const bay = pointA.position.y - vertexB.position.y;
  const baz = pointA.position.z - vertexB.position.z;
  const bcx = pointC.position.x - vertexB.position.x;
  const bcy = pointC.position.y - vertexB.position.y;
  const bcz = pointC.position.z - vertexB.position.z;
  const baLength = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const bcLength = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (baLength <= Number.EPSILON || bcLength <= Number.EPSILON) {
    return null;
  }

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const cosTheta = clamp(dot / (baLength * bcLength), -1, 1);

  return (Math.acos(cosTheta) * 180) / Math.PI;
};

export const getAngleByPointIds = (
  document: BoardDocument,
  pointAId: EntityId,
  vertexBId: EntityId,
  pointCId: EntityId,
): number | null => {
  const pointA = getPointFromDocument(document, pointAId);
  const vertexB = getPointFromDocument(document, vertexBId);
  const pointC = getPointFromDocument(document, pointCId);

  if (!pointA || !vertexB || !pointC) {
    return null;
  }

  return calculateAngleByThreePoints(pointA, vertexB, pointC);
};

export interface MeasurementCalculationResult {
  readonly value: number;
  readonly unit: string;
  readonly formattedText: string;
}

const getMeasurementTargetIds = (
  measurement: MeasurementEntity,
): readonly EntityId[] => {
  if (measurement.targetIds.length > 0) {
    return measurement.targetIds;
  }

  if (measurement.targetEntityIds.length > 0) {
    return measurement.targetEntityIds;
  }

  return measurement.pointIds;
};

export const calculateMeasurementValue = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): MeasurementCalculationResult | null => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (measurement.measurementKind === "length") {
    const value =
      targetIds.length === 1
        ? getSegmentLengthById(document, targetIds[0])
        : targetIds.length === 2
          ? getPointDistanceByIds(document, targetIds[0], targetIds[1])
          : null;

    return value === null
      ? null
      : {
          value,
          unit: measurement.unit ?? "unit",
          formattedText: `${measurement.name ?? "Length"} = ${value.toFixed(2)}`,
        };
  }

  if (measurement.measurementKind === "angle") {
    const value =
      targetIds.length === 3
        ? getAngleByPointIds(document, targetIds[0], targetIds[1], targetIds[2])
        : null;

    return value === null
      ? null
      : {
          value,
          unit: measurement.unit ?? "deg",
          formattedText: `${measurement.name ?? "Angle"} = ${value.toFixed(2)}°`,
        };
  }

  return null;
};
