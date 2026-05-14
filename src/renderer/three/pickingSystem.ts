import * as THREE from "three";
import type { ActiveDrawingPlane } from "../../core/document/BoardDocument";
import type { EntityKind } from "../../core/document/EntityTypes";
import type { Vec3 } from "../../core/geometry/Vec3";
import type { PointerInfo } from "../../core/tool/ToolTypes";

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

    if (entityObject && entityType && PICKABLE_ENTITY_TYPES.has(entityType)) {
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

export const getPointerInfoFromEvent = (
  event: PointerEvent,
  element: HTMLElement,
  camera: THREE.Camera,
  scene: THREE.Scene,
  drawingPlane: ActiveDrawingPlane,
): PointerInfo => {
  const ndc = getPointerNdc(event, element);
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = {
    ...raycaster.params.Line,
    threshold: 0.08,
  };
  raycaster.setFromCamera(ndc, camera);

  const intersections = raycaster.intersectObjects(scene.children, true);
  const entityHit = getEntityHit(intersections);

  return {
    ...entityHit,
    worldPosition: getDrawingPlaneIntersection(raycaster, drawingPlane),
    drawingPlane,
    snapResult: null,
  };
};
