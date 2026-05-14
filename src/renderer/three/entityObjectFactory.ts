import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { BoardDocument } from "../../core/document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  MeasurementEntity,
  PointEntity,
  SegmentEntity,
} from "../../core/document/EntityTypes";
import { calculateMeasurementValue } from "../../core/geometry/measurementUtils";
import {
  createPointMaterial,
  createSegmentMaterial,
  POINT_VISUAL_RADIUS,
} from "./materials";

const findPointEntity = (
  document: BoardDocument,
  pointId: EntityId,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

const applyEntityUserData = (
  object: THREE.Object3D,
  entity: BoardEntity,
): void => {
  object.userData.entityId = entity.id;
  object.userData.entityType = entity.kind;
};

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

const getMidpoint = (firstPoint: PointEntity, secondPoint: PointEntity) => ({
  x: (firstPoint.position.x + secondPoint.position.x) / 2,
  y: (firstPoint.position.y + secondPoint.position.y) / 2,
  z: (firstPoint.position.z + secondPoint.position.z) / 2,
});

const normalize = (value: { x: number; y: number; z: number }) => {
  const length = Math.hypot(value.x, value.y, value.z);

  return length <= Number.EPSILON
    ? null
    : {
        x: value.x / length,
        y: value.y / length,
        z: value.z / length,
      };
};

const getMeasurementLabelPosition = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): { x: number; y: number; z: number } | null => {
  const targetIds = getMeasurementTargetIds(measurement);

  if (measurement.measurementKind === "length") {
    if (targetIds.length === 1) {
      const segment = document.entities[targetIds[0]];

      if (segment?.kind !== "segment") {
        return null;
      }

      const [startPointId, endPointId] = segment.pointIds;
      const startPoint = findPointEntity(document, startPointId);
      const endPoint = findPointEntity(document, endPointId);

      if (!startPoint || !endPoint) {
        return null;
      }

      const midpoint = getMidpoint(startPoint, endPoint);
      return { ...midpoint, z: midpoint.z + 0.16 };
    }

    if (targetIds.length === 2) {
      const firstPoint = findPointEntity(document, targetIds[0]);
      const secondPoint = findPointEntity(document, targetIds[1]);

      if (!firstPoint || !secondPoint) {
        return null;
      }

      const midpoint = getMidpoint(firstPoint, secondPoint);
      return { ...midpoint, z: midpoint.z + 0.16 };
    }
  }

  if (measurement.measurementKind === "angle" && targetIds.length === 3) {
    const pointA = findPointEntity(document, targetIds[0]);
    const vertexB = findPointEntity(document, targetIds[1]);
    const pointC = findPointEntity(document, targetIds[2]);

    if (!pointA || !vertexB || !pointC) {
      return null;
    }

    const ba = normalize({
      x: pointA.position.x - vertexB.position.x,
      y: pointA.position.y - vertexB.position.y,
      z: pointA.position.z - vertexB.position.z,
    });
    const bc = normalize({
      x: pointC.position.x - vertexB.position.x,
      y: pointC.position.y - vertexB.position.y,
      z: pointC.position.z - vertexB.position.z,
    });
    const bisector =
      ba && bc
        ? normalize({
            x: ba.x + bc.x,
            y: ba.y + bc.y,
            z: ba.z + bc.z,
          })
        : null;
    const direction = bisector ?? { x: 0.55, y: 0.25, z: 0.25 };

    return {
      x: vertexB.position.x + direction.x * 0.42,
      y: vertexB.position.y + direction.y * 0.42,
      z: vertexB.position.z + direction.z * 0.42 + 0.12,
    };
  }

  return null;
};

const createMeasurementLabelTexture = (
  text: string,
  selected: boolean,
): THREE.CanvasTexture => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 26;
  const paddingX = 18;
  const paddingY = 10;

  if (!context) {
    canvas.width = 1;
    canvas.height = 1;
    return new THREE.CanvasTexture(canvas);
  }

  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  const textMetrics = context.measureText(text);
  canvas.width = Math.ceil(textMetrics.width + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;

  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "middle";
  context.clearRect(0, 0, canvas.width, canvas.height);

  const radius = 10;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(
    canvas.width,
    canvas.height,
    canvas.width - radius,
    canvas.height,
  );
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fillStyle = selected ? "rgba(37, 99, 235, 0.94)" : "rgba(255, 255, 255, 0.92)";
  context.fill();
  context.lineWidth = selected ? 3 : 2;
  context.strokeStyle = selected ? "rgba(147, 197, 253, 1)" : "rgba(99, 102, 241, 0.65)";
  context.stroke();
  context.fillStyle = selected ? "#ffffff" : "#1f2937";
  context.fillText(text, paddingX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
};

export const createMeasurementObject = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): THREE.Sprite | null => {
  const calculation = calculateMeasurementValue(measurement, document);
  const position = getMeasurementLabelPosition(measurement, document);

  if (!calculation || !position) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(measurement.id);
  const texture = createMeasurementLabelTexture(calculation.formattedText, selected);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = texture.image.width / texture.image.height;

  sprite.position.set(position.x, position.y, position.z);
  sprite.scale.set(aspect * 0.34, 0.34, 1);
  sprite.renderOrder = 35;
  applyEntityUserData(sprite, measurement);

  return sprite;
};

export const createPointObject = (point: PointEntity): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(POINT_VISUAL_RADIUS, 18, 12);
  const material = createPointMaterial(point.style?.color);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(point.position.x, point.position.y, point.position.z);
  applyEntityUserData(mesh, point);

  return mesh;
};

export const createSegmentObject = (
  segment: SegmentEntity,
  document: BoardDocument,
): Line2 | null => {
  const [startPointId, endPointId] = segment.pointIds;
  const startPoint = findPointEntity(document, startPointId);
  const endPoint = findPointEntity(document, endPointId);

  if (!startPoint || !endPoint) {
    return null;
  }

  const geometry = new LineGeometry();
  geometry.setPositions([
    startPoint.position.x,
    startPoint.position.y,
    startPoint.position.z,
    endPoint.position.x,
    endPoint.position.y,
    endPoint.position.z,
  ]);
  const material = createSegmentMaterial(segment.style?.color);
  const line = new Line2(geometry, material);
  line.computeLineDistances();

  applyEntityUserData(line, segment);

  return line;
};

export const createEntityObject = (
  entity: BoardEntity,
  document: BoardDocument,
): THREE.Object3D | null => {
  if (!entity.visible) {
    return null;
  }

  switch (entity.kind) {
    case "point":
      return createPointObject(entity);
    case "segment":
      return createSegmentObject(entity, document);
    case "measurement":
      return createMeasurementObject(entity, document);
    default:
      return null;
  }
};
