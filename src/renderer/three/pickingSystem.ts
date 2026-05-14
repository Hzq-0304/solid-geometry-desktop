import * as THREE from "three";
import type {
  ActiveDrawingPlane,
  BoardDocument,
} from "../../core/document/BoardDocument";
import type {
  EntityId,
  EntityKind,
  PointEntity,
} from "../../core/document/EntityTypes";
import type { Vec3 } from "../../core/geometry/Vec3";
import type { PointerInfo } from "../../core/tool/ToolTypes";
import {
  distancePointToScreenPoint,
  getPointerScreenPosition,
  worldPositionToScreenPosition,
  type ScreenPosition,
} from "./screenSpaceUtils";

const DEFAULT_POINT_PICK_PIXEL_RADIUS = 12;

const PICKABLE_ENTITY_TYPES = new Set<EntityKind>([
  "point",
  "segment",
  "polygon",
  "solid",
  "measurement",
]);

export const getPointerNdc = (
  event: PointerEvent,
  element: HTMLElement,
): THREE.Vector2 => {
  const bounds = element.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

  return new THREE.Vector2(x, y);
};

const createDrawingPlane = (drawingPlane: ActiveDrawingPlane): THREE.Plane => {
  switch (drawingPlane) {
    case "XY":
      return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    case "XZ":
      return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    case "YZ":
      return new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  }
};

const toVec3 = (value: THREE.Vector3): Vec3 => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

export const getDrawingPlaneIntersection = (
  raycaster: THREE.Raycaster,
  drawingPlane: ActiveDrawingPlane,
): Vec3 | null => {
  const intersection = new THREE.Vector3();
  const plane = createDrawingPlane(drawingPlane);
  const hasIntersection = raycaster.ray.intersectPlane(plane, intersection);

  return hasIntersection ? toVec3(intersection) : null;
};

const findEntityObject = (object: THREE.Object3D): THREE.Object3D | null => {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (current.userData.ignorePicking === true) {
      return null;
    }

    if (typeof current.userData.entityId === "string") {
      return current;
    }

    current = current.parent;
  }

  return null;
};

const getEntityHit = (
  intersections: THREE.Intersection[],
): Pick<PointerInfo, "hitEntityId" | "hitEntityType"> => {
  for (const intersection of intersections) {
    const entityObject = findEntityObject(intersection.object);
    const entityType = entityObject?.userData.entityType as EntityKind | undefined;

    if (
      entityObject &&
      entityType &&
      entityType !== "point" &&
      PICKABLE_ENTITY_TYPES.has(entityType)
    ) {
      return {
        hitEntityId: entityObject.userData.entityId,
        hitEntityType: entityType,
      };
    }
  }

  return {
    hitEntityId: null,
    hitEntityType: null,
  };
};

export interface ScreenPointPickResult {
  readonly entityId: EntityId;
  readonly entityType: "point";
  readonly screenDistance: number;
  readonly worldPosition: Vec3;
}

export const findNearestPointByScreenDistance = (
  pointerScreenPosition: ScreenPosition,
  document: BoardDocument,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  options: {
    readonly pointPickPixelRadius?: number;
    readonly ignoredEntityIds?: readonly EntityId[];
  } = {},
): ScreenPointPickResult | null => {
  const pointPickPixelRadius =
    options.pointPickPixelRadius ?? DEFAULT_POINT_PICK_PIXEL_RADIUS;
  let nearestPoint: PointEntity | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entity of Object.values(document.entities)) {
    if (
      entity.kind !== "point" ||
      !entity.visible ||
      options.ignoredEntityIds?.includes(entity.id)
    ) {
      continue;
    }

    const screenPosition = worldPositionToScreenPosition(
      entity.position,
      camera,
      canvas,
    );

    if (!screenPosition) {
      continue;
    }

    const distance = distancePointToScreenPoint(
      pointerScreenPosition,
      screenPosition,
    );

    if (distance > pointPickPixelRadius || distance >= nearestDistance) {
      continue;
    }

    nearestPoint = entity;
    nearestDistance = distance;
  }

  return nearestPoint
    ? {
        entityId: nearestPoint.id,
        entityType: "point",
        screenDistance: nearestDistance,
        worldPosition: nearestPoint.position,
      }
    : null;
};

export const getPointerInfoFromEvent = (
  event: PointerEvent,
  element: HTMLCanvasElement,
  camera: THREE.Camera,
  scene: THREE.Scene,
  document: BoardDocument,
  drawingPlane: ActiveDrawingPlane,
): PointerInfo => {
  const ndc = getPointerNdc(event, element);
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = {
    ...raycaster.params.Line,
    threshold: 0.08,
  };
  raycaster.setFromCamera(ndc, camera);

  const pointHit = findNearestPointByScreenDistance(
    getPointerScreenPosition(event, element),
    document,
    camera,
    element,
  );
  const intersections = raycaster.intersectObjects(scene.children, true);
  const entityHit = getEntityHit(intersections);

  return {
    hitEntityId: pointHit?.entityId ?? entityHit.hitEntityId,
    hitEntityType: pointHit?.entityType ?? entityHit.hitEntityType,
    worldPosition: getDrawingPlaneIntersection(raycaster, drawingPlane),
    drawingPlane,
    snapResult: null,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
  };
};
