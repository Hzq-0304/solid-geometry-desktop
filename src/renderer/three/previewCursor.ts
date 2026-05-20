import * as THREE from "three";
import type { Vec3 } from "../../core/geometry/Vec3";

const PREVIEW_CURSOR_NAME = "preview-cursor";
const PREVIEW_POINT_PIXEL_SIZE = 10;
const PREVIEW_CURSOR_RENDER_ORDER = 52;

const isFiniteVec3 = (position: Vec3): boolean =>
  Number.isFinite(position.x) &&
  Number.isFinite(position.y) &&
  Number.isFinite(position.z);

const createPreviewPointTexture = (): THREE.CanvasTexture => {
  const canvas = globalThis.document.createElement("canvas");
  const context = canvas.getContext("2d");
  const size = 64;
  const center = size / 2;

  canvas.width = size;
  canvas.height = size;

  if (context) {
    context.clearRect(0, 0, size, size);
    context.beginPath();
    context.arc(center, center, 23, 0, Math.PI * 2);
    context.fillStyle = "rgba(245, 158, 11, 0.72)";
    context.fill();
    context.beginPath();
    context.arc(center, center, 28, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = "rgba(146, 64, 14, 0.82)";
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
};

const createPreviewCursor = (): THREE.Points => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0], 3),
  );

  const material = new THREE.PointsMaterial({
    map: createPreviewPointTexture(),
    size: PREVIEW_POINT_PIXEL_SIZE,
    sizeAttenuation: false,
    transparent: true,
    alphaTest: 0.2,
    depthTest: false,
    depthWrite: false,
    color: 0xffffff,
  });
  const cursor = new THREE.Points(geometry, material);

  cursor.name = PREVIEW_CURSOR_NAME;
  cursor.userData.ignorePicking = true;
  cursor.renderOrder = PREVIEW_CURSOR_RENDER_ORDER;
  cursor.frustumCulled = false;
  cursor.visible = false;

  return cursor;
};

const resetPreviewCursorStyle = (cursor: THREE.Points): void => {
  cursor.renderOrder = PREVIEW_CURSOR_RENDER_ORDER;
  cursor.frustumCulled = false;

  const materials = Array.isArray(cursor.material)
    ? cursor.material
    : [cursor.material];

  materials.forEach((material) => {
    if (material instanceof THREE.PointsMaterial) {
      material.size = PREVIEW_POINT_PIXEL_SIZE;
      material.opacity = 1;
      material.transparent = true;
      material.alphaTest = 0.2;
      material.depthTest = false;
      material.depthWrite = false;
      material.needsUpdate = true;
    }
  });
};

const getPreviewCursor = (scene: THREE.Scene): THREE.Points => {
  const existing = scene.getObjectByName(PREVIEW_CURSOR_NAME);

  if (existing instanceof THREE.Points) {
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
  const shouldShow = visible && position !== null && isFiniteVec3(position);
  cursor.visible = shouldShow;

  if (!shouldShow || position === null) {
    return;
  }

  resetPreviewCursorStyle(cursor);

  const positionAttribute = cursor.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  positionAttribute.setXYZ(0, position.x, position.y, position.z);
  positionAttribute.needsUpdate = true;
  cursor.geometry.computeBoundingSphere();
};

export const disposePreviewCursor = (scene: THREE.Scene): void => {
  const cursor = scene.getObjectByName(PREVIEW_CURSOR_NAME) as
    | THREE.Points
    | undefined;

  if (!cursor) {
    return;
  }

  cursor.geometry.dispose();

  const material = cursor.material;
  const materials = Array.isArray(material) ? material : [material];

  materials.forEach((item) => {
    if (item instanceof THREE.PointsMaterial) {
      item.map?.dispose();
    }

    item.dispose();
  });

  scene.remove(cursor);
};
