import type { BoardDocument } from "../document/BoardDocument";
import type {
  EntityId,
  MeasurementEntity,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import { dotVec3, normalizeVec3, subtractVec3 } from "./geometryUtils";
import { getPlaneFromThreePoints, getPlanePoints } from "./planeUtils";
import { getPlaneWorldPositions, getPointWorldPosition } from "./pointPositionUtils";

export const getDistanceBetweenPoints = (
  firstPoint: PointEntity,
  secondPoint: PointEntity,
  document?: BoardDocument,
): number => {
  const firstPosition = document
    ? getPointWorldPosition(document, firstPoint.id) ?? firstPoint.position
    : firstPoint.position;
  const secondPosition = document
    ? getPointWorldPosition(document, secondPoint.id) ?? secondPoint.position
    : secondPoint.position;
  const dx = secondPosition.x - firstPosition.x;
  const dy = secondPosition.y - firstPosition.y;
  const dz = secondPosition.z - firstPosition.z;

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

  return getDistanceBetweenPoints(startPoint, endPoint, document);
};

export const getSegmentLengthById = (
  document: BoardDocument,
  segmentId: EntityId,
): number | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? getSegmentLength(entity, document) : null;
};

const getSegmentFromDocument = (
  document: BoardDocument,
  segmentId: EntityId,
): SegmentEntity | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? entity : null;
};

const getPlaneFromDocument = (
  document: BoardDocument,
  planeId: EntityId,
): PlaneEntity | null => {
  const entity = document.entities[planeId];

  return entity?.kind === "plane" ? entity : null;
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

  return getDistanceBetweenPoints(firstPoint, secondPoint, document);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const calculateAngleByThreePoints = (
  pointA: PointEntity,
  vertexB: PointEntity,
  pointC: PointEntity,
  document?: BoardDocument,
): number | null => {
  const positionA = document
    ? getPointWorldPosition(document, pointA.id) ?? pointA.position
    : pointA.position;
  const vertexPosition = document
    ? getPointWorldPosition(document, vertexB.id) ?? vertexB.position
    : vertexB.position;
  const positionC = document
    ? getPointWorldPosition(document, pointC.id) ?? pointC.position
    : pointC.position;
  const bax = positionA.x - vertexPosition.x;
  const bay = positionA.y - vertexPosition.y;
  const baz = positionA.z - vertexPosition.z;
  const bcx = positionC.x - vertexPosition.x;
  const bcy = positionC.y - vertexPosition.y;
  const bcz = positionC.z - vertexPosition.z;
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

  return calculateAngleByThreePoints(pointA, vertexB, pointC, document);
};

export const calculateLinePlaneAngleByPoints = (
  firstPoint: PointEntity,
  secondPoint: PointEntity,
  document?: BoardDocument,
): number | null => {
  const firstPosition = document
    ? getPointWorldPosition(document, firstPoint.id) ?? firstPoint.position
    : firstPoint.position;
  const secondPosition = document
    ? getPointWorldPosition(document, secondPoint.id) ?? secondPoint.position
    : secondPoint.position;
  const dx = secondPosition.x - firstPosition.x;
  const dy = secondPosition.y - firstPosition.y;
  const dz = secondPosition.z - firstPosition.z;
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

  return calculateLinePlaneAngleByPoints(startPoint, endPoint, document);
};

export const getLinePlaneAngleByPointIds = (
  document: BoardDocument,
  firstPointId: EntityId,
  secondPointId: EntityId,
): number | null => {
  const firstPoint = getPointFromDocument(document, firstPointId);
  const secondPoint = getPointFromDocument(document, secondPointId);

  return firstPoint && secondPoint
    ? calculateLinePlaneAngleByPoints(firstPoint, secondPoint, document)
    : null;
};

export const getLinePlaneAngleBySegmentAndPlaneId = (
  document: BoardDocument,
  segmentId: EntityId,
  planeId: EntityId,
): number | null => {
  const segment = getSegmentFromDocument(document, segmentId);
  const plane = getPlaneFromDocument(document, planeId);

  if (!segment || !plane) {
    return null;
  }

  const [startPointId, endPointId] = segment.pointIds;
  const startPoint = getPointFromDocument(document, startPointId);
  const endPoint = getPointFromDocument(document, endPointId);
  const startPosition = getPointWorldPosition(document, startPointId);
  const endPosition = getPointWorldPosition(document, endPointId);
  const planePoints = getPlaneWorldPositions(document, plane.pointIds);

  if (!startPoint || !endPoint || !startPosition || !endPosition || !planePoints) {
    return null;
  }

  const direction = normalizeVec3(
    subtractVec3(endPosition, startPosition),
  );
  const planeEquation = getPlaneFromThreePoints(
    planePoints[0],
    planePoints[1],
    planePoints[2],
  );

  if (!direction || !planeEquation) {
    return null;
  }

  const sine = clamp(Math.abs(dotVec3(direction, planeEquation.normal)), 0, 1);

  return (Math.asin(sine) * 180) / Math.PI;
};

const getPlaneNormalById = (
  document: BoardDocument,
  planeId: EntityId,
) => {
  const plane = getPlaneFromDocument(document, planeId);

  if (!plane) {
    return null;
  }

  const planePoints = getPlaneWorldPositions(document, plane.pointIds);

  if (!planePoints) {
    return null;
  }

  const planeEquation = getPlaneFromThreePoints(
    planePoints[0],
    planePoints[1],
    planePoints[2],
  );

  return planeEquation?.normal ?? null;
};

export const getPlanePlaneAngleByPlaneIds = (
  document: BoardDocument,
  firstPlaneId: EntityId,
  secondPlaneId: EntityId,
): number | null => {
  const firstNormal = getPlaneNormalById(document, firstPlaneId);
  const secondNormal = getPlaneNormalById(document, secondPlaneId);

  if (!firstNormal || !secondNormal) {
    return null;
  }

  const cosine = clamp(Math.abs(dotVec3(firstNormal, secondNormal)), -1, 1);

  return (Math.acos(cosine) * 180) / Math.PI;
};

export const getPlaneXYPlaneAngleByPlaneId = (
  document: BoardDocument,
  planeId: EntityId,
): number | null => {
  const normal = getPlaneNormalById(document, planeId);

  if (!normal) {
    return null;
  }

  const cosine = clamp(Math.abs(normal.z), -1, 1);

  return (Math.acos(cosine) * 180) / Math.PI;
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

    if (target.name?.trim()) {
      return target.name.trim();
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

const getSegmentPrefixById = (
  document: BoardDocument,
  segmentId: EntityId,
): string | null => {
  const segment = getSegmentFromDocument(document, segmentId);

  if (!segment) {
    return null;
  }

  if (segment.name?.trim()) {
    return segment.name.trim();
  }

  const [startPointId, endPointId] = segment.pointIds;
  const startName = getCompactPointName(
    getPointFromDocument(document, startPointId),
  );
  const endName = getCompactPointName(
    getPointFromDocument(document, endPointId),
  );

  return startName && endName ? `${startName}${endName}` : null;
};

const getPlaneDisplayNameById = (
  document: BoardDocument,
  planeId: EntityId,
): string | null => {
  const plane = getPlaneFromDocument(document, planeId);

  if (!plane) {
    return null;
  }

  if (plane.nameSource === "manual" && plane.name?.trim()) {
    return plane.name.trim();
  }

  const points = getPlanePoints(document, plane.pointIds);
  const pointNames = points?.map((point) => getCompactPointName(point));

  return pointNames?.every(Boolean)
    ? pointNames.join("")
    : plane.name?.trim() || plane.id;
};

const getLinePlaneAngleTextParts = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): { readonly segmentText: string; readonly planeText: string } => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (
    targetIds.length === 2 &&
    document.entities[targetIds[0]]?.kind === "segment" &&
    document.entities[targetIds[1]]?.kind === "plane"
  ) {
    return {
      segmentText: getSegmentPrefixById(document, targetIds[0]) ?? "segment",
      planeText: `平面 ${
        getPlaneDisplayNameById(document, targetIds[1]) ?? targetIds[1]
      }`,
    };
  }

  return {
    segmentText: getLinePlaneAnglePrefix(measurement, document) ?? "segment",
    planeText: `${measurement.plane ?? "XY"} 面`,
  };
};

const getPlanePlaneAngleTextParts = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): { readonly firstPlaneText: string; readonly secondPlaneText: string } => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (targetIds.length === 1) {
    return {
      firstPlaneText: `平面 ${
        getPlaneDisplayNameById(document, targetIds[0]) ?? targetIds[0] ?? "?"
      }`,
      secondPlaneText:
        measurement.plane === "XY" || measurement.plane === undefined
          ? "X-Y 面"
          : `${measurement.plane} 面`,
    };
  }

  return {
    firstPlaneText: `平面 ${
      getPlaneDisplayNameById(document, targetIds[0]) ?? targetIds[0] ?? "?"
    }`,
    secondPlaneText: `平面 ${
      getPlaneDisplayNameById(document, targetIds[1]) ?? targetIds[1] ?? "?"
    }`,
  };
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

  if (
    measurement.measurementKind === "linePlaneAngle" &&
    targetIds.length === 2 &&
    document.entities[targetIds[0]]?.kind === "segment" &&
    document.entities[targetIds[1]]?.kind === "plane"
  ) {
    const value = getLinePlaneAngleBySegmentAndPlaneId(
      document,
      targetIds[0],
      targetIds[1],
    );
    const { segmentText, planeText } = getLinePlaneAngleTextParts(
      measurement,
      document,
    );

    return value === null
      ? null
      : {
          value,
          unit: measurement.unit ?? "deg",
          formattedText: `${segmentText} 与 ${planeText} = ${value.toFixed(2)}°`,
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

  if (measurement.measurementKind === "planePlaneAngle") {
    const value =
      targetIds.length === 1 &&
      document.entities[targetIds[0]]?.kind === "plane" &&
      (measurement.plane === "XY" || measurement.plane === undefined)
        ? getPlaneXYPlaneAngleByPlaneId(document, targetIds[0])
        : targetIds.length === 2 &&
            document.entities[targetIds[0]]?.kind === "plane" &&
            document.entities[targetIds[1]]?.kind === "plane"
        ? getPlanePlaneAngleByPlaneIds(document, targetIds[0], targetIds[1])
        : null;
    const { firstPlaneText, secondPlaneText } = getPlanePlaneAngleTextParts(
      measurement,
      document,
    );

    return value === null
      ? null
      : {
          value,
          unit: measurement.unit ?? "deg",
          formattedText: `${firstPlaneText} 与 ${secondPlaneText} = ${value.toFixed(2)}°`,
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

  if (
    measurement.measurementKind === "linePlaneAngle" &&
    getMeasurementTargetIds(measurement).length === 2 &&
    document.entities[getMeasurementTargetIds(measurement)[0]]?.kind ===
      "segment" &&
    document.entities[getMeasurementTargetIds(measurement)[1]]?.kind === "plane"
  ) {
    const { segmentText, planeText } = getLinePlaneAngleTextParts(
      measurement,
      document,
    );
    const unitText = "\u00b0";

    return {
      prefix: `${segmentText} 与 ${planeText}`,
      valueText: calculation.value.toFixed(2),
      unitText,
      formattedText: `${segmentText} 与 ${planeText} = ${calculation.value.toFixed(
        2,
      )}${unitText}`,
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

  if (measurement.measurementKind === "planePlaneAngle") {
    const { firstPlaneText, secondPlaneText } = getPlanePlaneAngleTextParts(
      measurement,
      document,
    );
    const unitText = "\u00b0";

    return {
      prefix: `${firstPlaneText} 与 ${secondPlaneText}`,
      valueText: calculation.value.toFixed(2),
      unitText,
      formattedText: `${firstPlaneText} 与 ${secondPlaneText} = ${calculation.value.toFixed(
        2,
      )}${unitText}`,
      overlinePrefix: false,
    };
  }

  return null;
};
