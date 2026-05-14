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

export const calculateLinePlaneAngleByPoints = (
  firstPoint: PointEntity,
  secondPoint: PointEntity,
): number | null => {
  const dx = secondPoint.position.x - firstPoint.position.x;
  const dy = secondPoint.position.y - firstPoint.position.y;
  const dz = secondPoint.position.z - firstPoint.position.z;
  const horizontalLength = Math.sqrt(dx * dx + dy * dy);

  if (
    horizontalLength <= Number.EPSILON &&
    Math.abs(dz) <= Number.EPSILON
  ) {
    return null;
  }

  return (Math.atan2(Math.abs(dz), horizontalLength) * 180) / Math.PI;
};

export const getLinePlaneAngleBySegmentId = (
  document: BoardDocument,
  segmentId: EntityId,
): number | null => {
  const entity = document.entities[segmentId];

  if (entity?.kind !== "segment") {
    return null;
  }

  const [startPointId, endPointId] = entity.pointIds;
  const startPoint = getPointFromDocument(document, startPointId);
  const endPoint = getPointFromDocument(document, endPointId);

  if (!startPoint || !endPoint) {
    return null;
  }

  return calculateLinePlaneAngleByPoints(startPoint, endPoint);
};

export const getLinePlaneAngleByPointIds = (
  document: BoardDocument,
  firstPointId: EntityId,
  secondPointId: EntityId,
): number | null => {
  const firstPoint = getPointFromDocument(document, firstPointId);
  const secondPoint = getPointFromDocument(document, secondPointId);

  return firstPoint && secondPoint
    ? calculateLinePlaneAngleByPoints(firstPoint, secondPoint)
    : null;
};

export interface MeasurementCalculationResult {
  readonly value: number;
  readonly unit: string;
  readonly formattedText: string;
}

export interface MeasurementTextFormat {
  readonly prefix: string;
  readonly valueText: string;
  readonly unitText: string;
  readonly formattedText: string;
  readonly overlinePrefix: boolean;
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

const getCompactPointName = (point: PointEntity | null): string | null => {
  const rawName = point?.name?.trim() || point?.id.trim();

  if (!rawName) {
    return null;
  }

  const match = /([A-Za-z0-9]+)$/.exec(rawName);

  return match?.[1] ?? rawName;
};

const getLengthPrefix = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): string | null => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (targetIds.length === 1) {
    const target = document.entities[targetIds[0]];

    if (target?.kind !== "segment") {
      return null;
    }

    const [startPointId, endPointId] = target.pointIds;
    const startName = getCompactPointName(
      getPointFromDocument(document, startPointId),
    );
    const endName = getCompactPointName(
      getPointFromDocument(document, endPointId),
    );

    return startName && endName ? `${startName}${endName}` : null;
  }

  if (targetIds.length === 2) {
    const startName = getCompactPointName(
      getPointFromDocument(document, targetIds[0]),
    );
    const endName = getCompactPointName(
      getPointFromDocument(document, targetIds[1]),
    );

    return startName && endName ? `${startName}${endName}` : null;
  }

  return null;
};

const getAnglePrefix = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): string | null => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (targetIds.length !== 3) {
    return null;
  }

  const pointNames = targetIds.map((pointId) =>
    getCompactPointName(getPointFromDocument(document, pointId)),
  );

  return pointNames.every(Boolean)
    ? `\u2220${pointNames.join("")}`
    : null;
};

const getLinePlaneAnglePrefix = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): string | null => getLengthPrefix(measurement, document);

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
          formattedText: `${
            getLengthPrefix(measurement, document) ?? "d"
          } = ${value.toFixed(2)}`,
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
          formattedText: `${
            getAnglePrefix(measurement, document) ?? "\u03b8"
          } = ${value.toFixed(2)}\u00b0`,
        };
  }

  if (measurement.measurementKind === "linePlaneAngle") {
    const value =
      targetIds.length === 1
        ? getLinePlaneAngleBySegmentId(document, targetIds[0])
        : targetIds.length === 2
          ? getLinePlaneAngleByPointIds(document, targetIds[0], targetIds[1])
          : null;
    const prefix = getLinePlaneAnglePrefix(measurement, document) ?? "线段";
    const plane = measurement.plane ?? "XY";

    return value === null
      ? null
      : {
          value,
          unit: measurement.unit ?? "deg",
          formattedText: `${prefix} 与 ${plane} 面 = ${value.toFixed(2)}°`,
        };
  }

  return null;
};

export const formatMeasurementText = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): MeasurementTextFormat | null => {
  const calculation = calculateMeasurementValue(measurement, document);

  if (!calculation) {
    return null;
  }

  if (measurement.measurementKind === "length") {
    const prefix = getLengthPrefix(measurement, document) ?? "d";
    const unitText = "";

    return {
      prefix,
      valueText: calculation.value.toFixed(2),
      unitText,
      formattedText: `${prefix} = ${calculation.value.toFixed(2)}${unitText}`,
      overlinePrefix: prefix !== "d",
    };
  }

  if (measurement.measurementKind === "angle") {
    const prefix = getAnglePrefix(measurement, document) ?? "\u03b8";
    const unitText = "\u00b0";

    return {
      prefix,
      valueText: calculation.value.toFixed(2),
      unitText,
      formattedText: `${prefix} = ${calculation.value.toFixed(2)}${unitText}`,
      overlinePrefix: false,
    };
  }

  if (measurement.measurementKind === "linePlaneAngle") {
    const prefix = getLinePlaneAnglePrefix(measurement, document) ?? "线段";
    const plane = measurement.plane ?? "XY";
    const unitText = "\u00b0";

    return {
      prefix: `${prefix} 与 ${plane} 面`,
      valueText: calculation.value.toFixed(2),
      unitText,
      formattedText: `${prefix} 与 ${plane} 面 = ${calculation.value.toFixed(
        2,
      )}${unitText}`,
      overlinePrefix: false,
    };
  }

  return null;
};
