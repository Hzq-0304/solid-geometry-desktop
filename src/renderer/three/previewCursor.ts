import * as THREE from "three";
import type { Vec3 } from "../../core/geometry/Vec3";

const PREVIEW_CURSOR_NAME = "preview-cursor";
const PREVIEW_CURSOR_RADIUS = 0.075;

const createPreviewCursor = (): THREE.Group => {
  const group = new THREE.Group();
  group.name = PREVIEW_CURSOR_NAME;
  group.userData.ignorePicking = true;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(PREVIEW_CURSOR_RADIUS, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    }),
  );
  sphere.userData.ignorePicking = true;
  sphere.renderOrder = 20;
  group.add(sphere);

  const ring = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.SphereGeometry(PREVIEW_CURSOR_RADIUS * 1.75, 16, 8),
    ),
    new THREE.LineBasicMaterial({
      color: 0x92400e,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    }),
  );
  ring.userData.ignorePicking = true;
  ring.renderOrder = 21;
  group.add(ring);

  group.visible = false;

  return group;
};

const getPreviewCursor = (scene: THREE.Scene): THREE.Group => {
  const existing = scene.getObjectByName(PREVIEW_CURSOR_NAME);

  if (existing instanceof THREE.Group) {
    return existing;
  }

  const cursor = createPreviewCursor();
  scene.add(cursor);

  return cursor;
};

export const syncPreviewCursor = (
  scene: THREE.Scene,
  position: Vec3 | null,
  visible: boolean,
): void => {
  const cursor = getPreviewCursor(scene);
  cursor.visible = visible && position !== null;

  if (!cursor.visible || !position) {
    return;
  }

  cursor.position.set(position.x, position.y, position.z);
};

export const disposePreviewCursor = (scene: THREE.Scene): void => {
  const cursor = scene.getObjectByName(PREVIEW_CURSOR_NAME);

  if (!cursor) {
    return;
  }

  cursor.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.LineSegments;
    renderable.geometry?.dispose();

    if (Array.isArray(renderable.material)) {
      renderable.material.forEach((material) => material.dispose());
    } else {
      renderable.material?.dispose();
    }
  });

  scene.remove(cursor);
};
