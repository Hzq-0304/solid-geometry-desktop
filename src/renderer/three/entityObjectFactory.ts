import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { BoardDocument } from "../../core/document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  ExtensionEntity,
  LinePlanePerpendicularEntity,
  MeasurementEntity,
  PerpendicularLineEntity,
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
  getPlaneStyle,
  type PlaneExtensionPatch,
} from "../../core/geometry/planeUtils";
import {
  projectPointToLine,
} from "../../core/geometry/geometryUtils";
import {
  calculatePlaneBoundaryExtension,
  calculateSegmentBoundaryExtension,
} from "../../core/geometry/extensionUtils";
import {
  calculateLinePlanePerpendicular,
} from "../../core/geometry/linePlanePerpendicularUtils";
import {
  getPlaneWorldPositions,
  getPointWorldPosition,
  getSegmentWorldPositions,
} from "../../core/geometry/pointPositionUtils";
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
const PERPENDICULAR_RENDER_ORDER = 5;
const LINE_PLANE_EXTENSION_RENDER_ORDER = 3;
const LINE_PLANE_HELPER_RENDER_ORDER = 4;
const LINE_PLANE_PERPENDICULAR_RENDER_ORDER = 6;
const FOOT_MARKER_RENDER_ORDER = 10;
const EXTENSION_PLANE_RENDER_ORDER = 3;
const EXTENSION_LINE_RENDER_ORDER = 3;

const findPointEntity = (
  document: BoardDocument,
  pointId: EntityId,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

const findSegmentEntity = (
  document: BoardDocument,
  segmentId: EntityId,
): SegmentEntity | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? entity : null;
};

const findPlaneEntity = (
  document: BoardDocument,
  planeId: EntityId,
): PlaneEntity | null => {
  const entity = document.entities[planeId];

  return entity?.kind === "plane" ? entity : null;
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

const getMidpoint = (
  firstPoint: { readonly x: number; readonly y: number; readonly z: number },
  secondPoint: { readonly x: number; readonly y: number; readonly z: number },
) => ({
  x: (firstPoint.x + secondPoint.x) / 2,
  y: (firstPoint.y + secondPoint.y) / 2,
  z: (firstPoint.z + secondPoint.z) / 2,
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
      const startPoint = getPointWorldPosition(document, startPointId);
      const endPoint = getPointWorldPosition(document, endPointId);

      if (!startPoint || !endPoint) {
        return null;
      }

      const midpoint = getMidpoint(startPoint, endPoint);
      return { ...midpoint, z: midpoint.z + 0.16 };
    }

    if (targetIds.length === 2) {
      const firstPoint = getPointWorldPosition(document, targetIds[0]);
      const secondPoint = getPointWorldPosition(document, targetIds[1]);

      if (!firstPoint || !secondPoint) {
        return null;
      }

      const midpoint = getMidpoint(firstPoint, secondPoint);
      return { ...midpoint, z: midpoint.z + 0.16 };
    }
  }

  if (measurement.measurementKind === "angle" && targetIds.length === 3) {
    const pointA = getPointWorldPosition(document, targetIds[0]);
    const vertexB = getPointWorldPosition(document, targetIds[1]);
    const pointC = getPointWorldPosition(document, targetIds[2]);

    if (!pointA || !vertexB || !pointC) {
      return null;
    }

    const ba = normalize({
      x: pointA.x - vertexB.x,
      y: pointA.y - vertexB.y,
      z: pointA.z - vertexB.z,
    });
    const bc = normalize({
      x: pointC.x - vertexB.x,
      y: pointC.y - vertexB.y,
      z: pointC.z - vertexB.z,
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
      x: vertexB.x + direction.x * 0.42,
      y: vertexB.y + direction.y * 0.42,
      z: vertexB.z + direction.z * 0.42 + 0.12,
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
  document: BoardDocument,
  highlighted: boolean,
  preselected: boolean,
): THREE.Points | null => {
  const position = getPointWorldPosition(document, point.id);

  if (!position) {
    return null;
  }

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
      [position.x, position.y, position.z],
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
  highlighted = false,
): Line2 | null => {
  const [startPointId, endPointId] = segment.pointIds;
  const startPoint = getPointWorldPosition(document, startPointId);
  const endPoint = getPointWorldPosition(document, endPointId);

  if (!startPoint || !endPoint) {
    return null;
  }

  const geometry = new LineGeometry();
  geometry.setPositions([
    startPoint.x,
    startPoint.y,
    startPoint.z,
    endPoint.x,
    endPoint.y,
    endPoint.z,
  ]);
  const material = createSegmentMaterial(
    segment.style?.color,
    highlighted || document.selectedEntityIds.includes(segment.id),
    preselected,
  );
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.renderOrder = SEGMENT_RENDER_ORDER;

  applyEntityUserData(line, segment);

  return line;
};

const createLineGeometryFromVec3 = (
  start: { readonly x: number; readonly y: number; readonly z: number },
  end: { readonly x: number; readonly y: number; readonly z: number },
): LineGeometry => {
  const geometry = new LineGeometry();
  geometry.setPositions([start.x, start.y, start.z, end.x, end.y, end.z]);

  return geometry;
};

export const createPerpendicularLineObject = (
  perpendicularLine: PerpendicularLineEntity,
  document: BoardDocument,
  preselected = false,
): THREE.Group | null => {
  const point = findPointEntity(document, perpendicularLine.pointId);
  const segment = findSegmentEntity(document, perpendicularLine.segmentId);

  if (!point || !segment) {
    return null;
  }

  const pointPosition = getPointWorldPosition(document, point.id);
  const segmentPositions = getSegmentWorldPositions(document, segment.id);
  const footPosition = perpendicularLine.footPointId
    ? getPointWorldPosition(document, perpendicularLine.footPointId)
    : null;
  const directionPosition = perpendicularLine.directionPointId
    ? getPointWorldPosition(document, perpendicularLine.directionPointId)
    : null;

  if (!pointPosition || !segmentPositions) {
    return null;
  }

  const projection = projectPointToLine(
    pointPosition,
    segmentPositions[0],
    segmentPositions[1],
  );

  if (!projection) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(perpendicularLine.id);
  const style = perpendicularLine.style ?? {};
  const color = style.lineColor ?? "#111827";
  const group = new THREE.Group();
  const perpendicularSegment = new Line2(
    createLineGeometryFromVec3(
      pointPosition,
      perpendicularLine.constructionMode === "userDirection" && directionPosition
        ? directionPosition
        : footPosition ?? projection.foot,
    ),
    createSegmentMaterial(color, selected, preselected),
  );

  perpendicularSegment.computeLineDistances();
  perpendicularSegment.renderOrder = PERPENDICULAR_RENDER_ORDER;
  applyEntityUserData(perpendicularSegment, perpendicularLine);
  group.add(perpendicularSegment);

  const extensionStart =
        projection.t < 0
      ? segmentPositions[0]
      : projection.t > 1
        ? segmentPositions[1]
        : null;

  if (extensionStart && perpendicularLine.constructionMode !== "userDirection") {
    const extensionGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        extensionStart.x,
        extensionStart.y,
        extensionStart.z,
      ),
      new THREE.Vector3(
        (footPosition ?? projection.foot).x,
        (footPosition ?? projection.foot).y,
        (footPosition ?? projection.foot).z,
      ),
    ]);
    const extensionMaterial = new THREE.LineDashedMaterial({
      color: style.extensionColor ?? "#64748b",
      dashSize: 0.14,
      gapSize: 0.08,
      linewidth: style.extensionLineWidth ?? 1,
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false,
    });
    const extensionLine = new THREE.Line(extensionGeometry, extensionMaterial);

    extensionLine.computeLineDistances();
    extensionLine.renderOrder = PERPENDICULAR_RENDER_ORDER - 1;
    extensionLine.userData.ignorePicking = true;
    group.add(extensionLine);
  }

  applyEntityUserData(group, perpendicularLine);

  return group;
};

const createVec3TriangleGeometry = (
  positions: readonly [
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
  ],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions.flatMap((position) => [position.x, position.y, position.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();

  return geometry;
};

const createDashedHelperLine = (
  start: { readonly x: number; readonly y: number; readonly z: number },
  end: { readonly x: number; readonly y: number; readonly z: number },
  color: THREE.ColorRepresentation,
): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(start.x, start.y, start.z),
    new THREE.Vector3(end.x, end.y, end.z),
  ]);
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.12,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);

  line.computeLineDistances();
  line.renderOrder = LINE_PLANE_HELPER_RENDER_ORDER;
  line.userData.ignorePicking = true;

  return line;
};

const createTextSprite = (
  text: string,
  color = "#111111",
): THREE.Sprite => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 32;
  const padding = 8;

  if (!context) {
    canvas.width = 1;
    canvas.height = 1;
  } else {
    context.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    const metrics = context.measureText(text);
    canvas.width = Math.ceil(metrics.width + padding * 2);
    canvas.height = fontSize + padding * 2;
    context.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    context.textBaseline = "middle";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.fillText(text, padding, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
    }),
  );
  const aspect = texture.image.width / texture.image.height;

  sprite.scale.set(aspect * 0.06, 0.06, 1);
  sprite.userData.ignorePicking = true;

  return sprite;
};

export const createLinePlanePerpendicularObject = (
  linePlanePerpendicular: LinePlanePerpendicularEntity,
  document: BoardDocument,
  preselected = false,
): THREE.Group | null => {
  const point = findPointEntity(document, linePlanePerpendicular.pointId);
  const plane = findPlaneEntity(document, linePlanePerpendicular.planeId);

  if (!point || !plane) {
    return null;
  }

  const projection = calculateLinePlanePerpendicular(point, plane, document);

  if (!projection) {
    return null;
  }

  const sourcePosition = getPointWorldPosition(
    document,
    linePlanePerpendicular.pointId,
  );
  const footPosition = getPointWorldPosition(
    document,
    linePlanePerpendicular.footPointId ?? "",
  );
  const directionPosition = linePlanePerpendicular.directionPointId
    ? getPointWorldPosition(document, linePlanePerpendicular.directionPointId)
    : null;

  const endPosition =
    linePlanePerpendicular.constructionMode === "userDirection"
      ? directionPosition
      : footPosition;

  if (!sourcePosition || !endPosition) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(
    linePlanePerpendicular.id,
  );
  const style = linePlanePerpendicular.style ?? {};
  const lineColor = style.lineColor ?? "#111827";
  const helperLineColor = style.helperLineColor ?? "#64748b";
  const fillColor = style.extensionFillColor ?? "#93c5fd";
  const fillOpacity = style.extensionFillOpacity ?? 0.14;
  const group = new THREE.Group();

  const showFootHelpers =
    linePlanePerpendicular.constructionMode !== "userDirection";

  if (showFootHelpers) {
    projection.extensionTriangles.forEach((triangle) => {
    const mesh = new THREE.Mesh(
      createVec3TriangleGeometry(triangle),
      new THREE.MeshBasicMaterial({
        color: fillColor,
        opacity: fillOpacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
      }),
    );

    mesh.renderOrder = LINE_PLANE_EXTENSION_RENDER_ORDER;
    mesh.userData.ignorePicking = true;
    group.add(mesh);
    });

    projection.helperSegments.forEach(([start, end]) => {
      group.add(createDashedHelperLine(start, end, helperLineColor));
    });
  }

  const perpendicularSegment = new Line2(
    createLineGeometryFromVec3(sourcePosition, endPosition),
    createSegmentMaterial(lineColor, selected, preselected),
  );

  perpendicularSegment.computeLineDistances();
  perpendicularSegment.renderOrder = LINE_PLANE_PERPENDICULAR_RENDER_ORDER;
  applyEntityUserData(perpendicularSegment, linePlanePerpendicular);
  group.add(perpendicularSegment);

  applyEntityUserData(group, linePlanePerpendicular);

  return group;
};

const createPlaneTriangleGeometry = (
  positions: readonly [
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
  ],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions.flatMap((point) => [
        point.x,
        point.y,
        point.z,
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
  points: readonly [
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
    { readonly x: number; readonly y: number; readonly z: number },
  ],
  selected: boolean,
  preselected: boolean,
  color: string,
): Line2 => {
  const geometry = new LineGeometry();
  geometry.setPositions([
    points[0].x,
    points[0].y,
    points[0].z,
    points[1].x,
    points[1].y,
    points[1].z,
    points[2].x,
    points[2].y,
    points[2].z,
    points[0].x,
    points[0].y,
    points[0].z,
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
  highlighted = false,
): THREE.Group | null => {
  const points = getPlaneWorldPositions(document, plane.pointIds);

  if (!points) {
    return null;
  }

  if (
    !getPlaneFromThreePoints(
      points[0],
      points[1],
      points[2],
    )
  ) {
    return null;
  }

  const selected = document.selectedEntityIds.includes(plane.id) || highlighted;
  const style = getPlaneStyle(plane);
  const group = new THREE.Group();
  const showExtension =
    style.showExtensionWhenSelected !== false && (selected || preselected);
  const extensionPatch = showExtension
    ? getPlaneExtensionPatch(
        points[0],
        points[1],
        points[2],
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

const createDashedLineObject = (
  start: { readonly x: number; readonly y: number; readonly z: number },
  end: { readonly x: number; readonly y: number; readonly z: number },
  color: THREE.ColorRepresentation,
  selected: boolean,
  preselected: boolean,
): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(start.x, start.y, start.z),
    new THREE.Vector3(end.x, end.y, end.z),
  ]);
  const material = new THREE.LineDashedMaterial({
    color: selected || preselected ? SELECTED_ENTITY_COLOR : color,
    dashSize: 0.16,
    gapSize: 0.1,
    linewidth: selected || preselected ? 2 : 1,
    transparent: true,
    opacity: selected || preselected ? 0.95 : 0.78,
    depthTest: true,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);

  line.computeLineDistances();
  line.renderOrder = EXTENSION_LINE_RENDER_ORDER;

  return line;
};

const createPolygonGeometry = (
  triangles: readonly [Vec3Like, Vec3Like, Vec3Like][],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  const positions = triangles.flatMap((triangle) =>
    triangle.flatMap((position) => [position.x, position.y, position.z]),
  );

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();

  return geometry;
};

interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const createExtensionObject = (
  extension: ExtensionEntity,
  document: BoardDocument,
  preselected = false,
): THREE.Group | null => {
  const target = document.entities[extension.targetId];
  const selected = document.selectedEntityIds.includes(extension.id);
  const style = extension.style ?? {};
  const group = new THREE.Group();

  if (extension.targetType === "segment") {
    if (target?.kind !== "segment") {
      return null;
    }

    const result = calculateSegmentBoundaryExtension(target, document);

    if (result.status !== "valid") {
      return null;
    }

    const color = style.lineExtensionColor ?? "#6b7280";

    if (result.startExtension) {
      const line = createDashedLineObject(
        result.startExtension[0],
        result.startExtension[1],
        color,
        selected,
        preselected,
      );
      applyEntityUserData(line, extension);
      group.add(line);
    }

    if (result.endExtension) {
      const line = createDashedLineObject(
        result.endExtension[0],
        result.endExtension[1],
        color,
        selected,
        preselected,
      );
      applyEntityUserData(line, extension);
      group.add(line);
    }

    if (group.children.length === 0) {
      return null;
    }

    applyEntityUserData(group, extension);
    return group;
  }

  if (target?.kind !== "plane") {
    return null;
  }

  const result = calculatePlaneBoundaryExtension(target, document);

  if (result.status !== "valid" || result.triangles.length === 0) {
    return null;
  }

  const material = new THREE.MeshBasicMaterial({
    color: selected || preselected
      ? SELECTED_ENTITY_COLOR
      : style.planeExtensionColor ?? "#93c5fd",
    opacity: selected || preselected
      ? Math.max(style.planeExtensionOpacity ?? 0.16, 0.22)
      : style.planeExtensionOpacity ?? 0.14,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(createPolygonGeometry(result.triangles), material);

  mesh.renderOrder = EXTENSION_PLANE_RENDER_ORDER;
  applyEntityUserData(mesh, extension);
  group.add(mesh);

  if (result.vertices.length > 2) {
    const geometry = new LineGeometry();
    const closedVertices = [...result.vertices, result.vertices[0]];
    geometry.setPositions(
      closedVertices.flatMap((position) => [
        position.x,
        position.y,
        position.z,
      ]),
    );
    const boundary = new Line2(
      geometry,
      createPlaneBoundaryMaterial(
        style.boundaryLineColor ?? "#60a5fa",
        selected,
        preselected,
      ),
    );
    boundary.computeLineDistances();
    boundary.renderOrder = EXTENSION_LINE_RENDER_ORDER;
    applyEntityUserData(boundary, extension);
    group.add(boundary);
  }

  applyEntityUserData(group, extension);
  return group;
};

export const createEntityObject = (
  entity: BoardEntity,
  document: BoardDocument,
  highlightedPointIds: readonly EntityId[] = [],
  highlightedEntityIds: readonly EntityId[] = [],
  preselectedEntityId: EntityId | null = null,
): THREE.Object3D | null => {
  if (!entity.visible) {
    return null;
  }

  switch (entity.kind) {
    case "point":
      return createPointObject(
        entity,
        document,
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
        highlightedEntityIds.includes(entity.id),
      );
    case "perpendicularLine":
      return createPerpendicularLineObject(
        entity,
        document,
        preselectedEntityId === entity.id &&
          !document.selectedEntityIds.includes(entity.id),
      );
    case "linePlanePerpendicular":
      return createLinePlanePerpendicularObject(
        entity,
        document,
        preselectedEntityId === entity.id &&
          !document.selectedEntityIds.includes(entity.id),
      );
    case "extension":
      return createExtensionObject(
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
          !document.selectedEntityIds.includes(entity.id) &&
          !highlightedEntityIds.includes(entity.id),
        highlightedEntityIds.includes(entity.id),
      );
    case "measurement":
      return null;
    default:
      return null;
  }
};
