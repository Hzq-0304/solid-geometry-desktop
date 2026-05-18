import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { BoardDocument } from "../../core/document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  MeasurementEntity,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../../core/document/EntityTypes";
import {
  formatMeasurementText,
  type MeasurementTextFormat,
} from "../../core/geometry/measurementUtils";
import {
  getPlaneExtensionPatch,
  getPlaneFromThreePoints,
  getPlanePoints,
  getPlaneStyle,
  type PlaneExtensionPatch,
} from "../../core/geometry/planeUtils";
import {
  createPlaneBoundaryMaterial,
  createSegmentMaterial,
  DEFAULT_POINT_COLOR,
  SELECTED_ENTITY_COLOR,
} from "./materials";

const POINT_PIXEL_SIZE = 8;
const HOVERED_POINT_PIXEL_SIZE = 12;
const HIGHLIGHTED_POINT_PIXEL_SIZE = 12;
const PLANE_EXTENSION_RENDER_ORDER = 1;
const PLANE_TRIANGLE_RENDER_ORDER = 2;
const SEGMENT_RENDER_ORDER = 4;

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
  textFormat: MeasurementTextFormat,
  selected: boolean,
): THREE.CanvasTexture => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 18;
  const paddingX = 5;
  const paddingY = 4;

  if (!context) {
    canvas.width = 1;
    canvas.height = 1;
    return new THREE.CanvasTexture(canvas);
  }

  const fullText = `${textFormat.prefix} = ${textFormat.valueText}${textFormat.unitText}`;

  context.font = `500 ${fontSize}px Arial, Helvetica, sans-serif`;
  const textMetrics = context.measureText(fullText);
  canvas.width = Math.ceil(textMetrics.width + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;

  context.font = `500 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.textBaseline = "middle";
  context.clearRect(0, 0, canvas.width, canvas.height);

  const baseline = canvas.height / 2;

  context.lineJoin = "round";
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 255, 255, 0.88)";
  context.strokeText(fullText, paddingX, baseline);
  context.fillStyle = selected ? "#2563eb" : "#111827";
  context.fillText(fullText, paddingX, baseline);

  if (textFormat.overlinePrefix) {
    const prefixWidth = context.measureText(textFormat.prefix).width;
    const overlineY = baseline - fontSize * 0.46;

    context.beginPath();
    context.lineWidth = 1.4;
    context.strokeStyle = selected ? "#2563eb" : "#111827";
    context.moveTo(paddingX, overlineY);
    context.lineTo(paddingX + prefixWidth, overlineY);
    context.stroke();
  }

  if (selected) {
    context.beginPath();
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    context.strokeStyle = "#2563eb";
    context.moveTo(paddingX, canvas.height - 3);
    context.lineTo(canvas.width - paddingX, canvas.height - 3);
    context.stroke();
    context.setLineDash([]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
};

const shouldShowPointLabel = (point: PointEntity): boolean =>
  point.nameSource === "manual" && Boolean(point.name?.trim());

const createPointLabelTexture = (
  text: string,
  selected: boolean,
): THREE.CanvasTexture => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 12;
  const paddingX = 3;
  const paddingY = 2;

  if (!context) {
    canvas.width = 1;
    canvas.height = 1;
    return new THREE.CanvasTexture(canvas);
  }

  context.font = `400 ${fontSize}px Arial, Helvetica, sans-serif`;
  const textMetrics = context.measureText(text);
  canvas.width = Math.ceil(textMetrics.width + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;

  context.font = `400 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.textBaseline = "middle";
  context.clearRect(0, 0, canvas.width, canvas.height);

  const baseline = canvas.height / 2;
  context.lineJoin = "round";
  context.lineWidth = 1.5;
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.strokeText(text, paddingX, baseline);
  context.fillStyle = selected ? "#1d4ed8" : "#1f2937";
  context.fillText(text, paddingX, baseline);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
};

const createPointLabelObject = (
  point: PointEntity,
  selected: boolean,
): THREE.Sprite | null => {
  if (!shouldShowPointLabel(point)) {
    return null;
  }

  const texture = createPointLabelTexture(point.name?.trim() ?? "", selected);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = texture.image.width / texture.image.height;

  sprite.position.set(0.16, 0.16, 0.12);
  sprite.center.set(0, 0);
  sprite.scale.set(aspect * 0.045, 0.045, 1);
  sprite.renderOrder = 40;
  sprite.userData.ignorePicking = true;

  return sprite;
};

export const createMeasurementObject = (
  measurement: MeasurementEntity,
  document: BoardDocument,
): THREE.Sprite | null => {
  const textFormat = formatMeasurementText(measurement, document);

  if (!textFormat) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(measurement.id);
  const texture = createMeasurementLabelTexture(textFormat, selected);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = texture.image.width / texture.image.height;
  const measurementIndex = Object.values(document.entities)
    .filter((entity) => entity.kind === "measurement")
    .findIndex((entity) => entity.id === measurement.id);
  const displayPosition =
    measurement.displayPosition ??
    ({
      mode: "screen",
      x: 24,
      y: 20 + Math.max(0, measurementIndex) * 20,
    } as const);

  if (displayPosition.mode === "screen") {
    sprite.userData.screenAnchor = {
      x: displayPosition.x,
      y: displayPosition.y,
    };
    sprite.center.set(0, 1);
  } else {
    sprite.position.set(
      displayPosition.x,
      displayPosition.y,
      displayPosition.z ?? 0,
    );
  }

  sprite.scale.set(aspect * 0.09, 0.09, 1);
  sprite.renderOrder = 35;
  applyEntityUserData(sprite, measurement);

  return sprite;
};

export const createPointObject = (
  point: PointEntity,
  highlighted: boolean,
  preselected: boolean,
): THREE.Points => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const size = 64;
  const center = size / 2;
  const fillColor = new THREE.Color(
    highlighted ? SELECTED_ENTITY_COLOR : DEFAULT_POINT_COLOR,
  ).getStyle();

  canvas.width = size;
  canvas.height = size;

  if (context) {
    context.clearRect(0, 0, size, size);
    context.beginPath();
    context.arc(
      center,
      center,
      highlighted || preselected ? 22 : 23,
      0,
      Math.PI * 2,
    );
    context.fillStyle = fillColor;
    context.fill();

    if (highlighted) {
      context.beginPath();
      context.arc(center, center, 26, 0, Math.PI * 2);
      context.lineWidth = 3;
      context.strokeStyle = "rgba(245, 158, 11, 0.85)";
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.PointsMaterial({
    map: texture,
    size: highlighted
      ? HIGHLIGHTED_POINT_PIXEL_SIZE
      : preselected
        ? HOVERED_POINT_PIXEL_SIZE
        : POINT_PIXEL_SIZE,
    sizeAttenuation: false,
    transparent: true,
    alphaTest: 0.45,
    depthTest: false,
    depthWrite: false,
    color: 0xffffff,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [point.position.x, point.position.y, point.position.z],
      3,
    ),
  );
  const points = new THREE.Points(geometry, material);

  points.renderOrder = highlighted ? 50 : 48;
  applyEntityUserData(points, point);

  return points;
};

export const createSegmentObject = (
  segment: SegmentEntity,
  document: BoardDocument,
  preselected = false,
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
  const material = createSegmentMaterial(
    segment.style?.color,
    document.selectedEntityIds.includes(segment.id),
    preselected,
  );
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.renderOrder = SEGMENT_RENDER_ORDER;

  applyEntityUserData(line, segment);

  return line;
};

const createPlaneTriangleGeometry = (
  positions: readonly [PointEntity, PointEntity, PointEntity],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions.flatMap((point) => [
        point.position.x,
        point.position.y,
        point.position.z,
      ]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();

  return geometry;
};

const createPlaneExtensionGeometry = (
  positions: PlaneExtensionPatch["vertices"],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions.flatMap((position) => [position.x, position.y, position.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();

  return geometry;
};

const createPlaneBoundaryObject = (
  plane: PlaneEntity,
  points: readonly [PointEntity, PointEntity, PointEntity],
  selected: boolean,
  preselected: boolean,
  color: string,
): Line2 => {
  const geometry = new LineGeometry();
  geometry.setPositions([
    points[0].position.x,
    points[0].position.y,
    points[0].position.z,
    points[1].position.x,
    points[1].position.y,
    points[1].position.z,
    points[2].position.x,
    points[2].position.y,
    points[2].position.z,
    points[0].position.x,
    points[0].position.y,
    points[0].position.z,
  ]);
  const boundary = new Line2(
    geometry,
    createPlaneBoundaryMaterial(color, selected, preselected),
  );
  boundary.computeLineDistances();
  boundary.renderOrder = SEGMENT_RENDER_ORDER + 1;
  applyEntityUserData(boundary, plane);

  return boundary;
};

export const createPlaneObject = (
  plane: PlaneEntity,
  document: BoardDocument,
  preselected = false,
): THREE.Group | null => {
  const points = getPlanePoints(document, plane.pointIds);

  if (!points) {
    return null;
  }

  if (
    !getPlaneFromThreePoints(
      points[0].position,
      points[1].position,
      points[2].position,
    )
  ) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(plane.id);
  const style = getPlaneStyle(plane);
  const group = new THREE.Group();
  const showExtension =
    style.showExtensionWhenSelected !== false && (selected || preselected);
  const extensionPatch = showExtension
    ? getPlaneExtensionPatch(
        points[0].position,
        points[1].position,
        points[2].position,
      )
    : null;

  if (extensionPatch) {
    const extensionMaterial = new THREE.MeshBasicMaterial({
      color: style.extensionColor,
      opacity: style.extensionOpacity,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    const extensionMesh = new THREE.Mesh(
      createPlaneExtensionGeometry(extensionPatch.vertices),
      extensionMaterial,
    );

    extensionMesh.renderOrder = PLANE_EXTENSION_RENDER_ORDER;
    extensionMesh.userData.ignorePicking = true;
    group.add(extensionMesh);
  }

  const triangleOpacity = Math.min(1, Math.max(0.02, style.triangleOpacity));
  const triangleMaterial = new THREE.MeshBasicMaterial({
    color: selected || preselected ? SELECTED_ENTITY_COLOR : style.triangleColor,
    opacity: selected || preselected ? Math.max(triangleOpacity, 0.92) : triangleOpacity,
    transparent: triangleOpacity < 1 || selected || preselected,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
  });
  const triangleMesh = new THREE.Mesh(
    createPlaneTriangleGeometry(points),
    triangleMaterial,
  );

  triangleMesh.renderOrder = PLANE_TRIANGLE_RENDER_ORDER;
  applyEntityUserData(triangleMesh, plane);
  group.add(triangleMesh);
  group.add(
    createPlaneBoundaryObject(
      plane,
      points,
      selected,
      preselected,
      selected || preselected ? SELECTED_ENTITY_COLOR : style.triangleColor,
    ),
  );
  applyEntityUserData(group, plane);

  return group;
};

export const createEntityObject = (
  entity: BoardEntity,
  document: BoardDocument,
  highlightedPointIds: readonly EntityId[] = [],
  preselectedEntityId: EntityId | null = null,
): THREE.Object3D | null => {
  if (!entity.visible) {
    return null;
  }

  switch (entity.kind) {
    case "point":
      return createPointObject(
        entity,
        highlightedPointIds.includes(entity.id),
        preselectedEntityId === entity.id &&
          !highlightedPointIds.includes(entity.id),
      );
    case "segment":
      return createSegmentObject(
        entity,
        document,
        preselectedEntityId === entity.id &&
          !document.selectedEntityIds.includes(entity.id),
      );
    case "plane":
      return createPlaneObject(
        entity,
        document,
        preselectedEntityId === entity.id &&
          !document.selectedEntityIds.includes(entity.id),
      );
    case "measurement":
      return null;
    default:
      return null;
  }
};
