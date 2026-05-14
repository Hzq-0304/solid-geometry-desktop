import * as THREE from "three";
import type {
  ActiveDrawingPlane,
  BoardSettings,
} from "../../core/document/BoardDocument";

const DRAWING_PLANE_OVERLAY_NAME = "drawing-plane-overlay";
const DRAWING_PLANE_SIZE = 20;

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.LineSegments;
    renderable.geometry?.dispose();

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });
};

const createPlaneGeometry = (
  activeDrawingPlane: ActiveDrawingPlane,
): THREE.BufferGeometry => {
  const halfSize = DRAWING_PLANE_SIZE / 2;
  const vertices: number[] = [];

  switch (activeDrawingPlane) {
    case "XY":
      vertices.push(
        -halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
      );
      break;
    case "XZ":
      vertices.push(
        -halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
      );
      break;
    case "YZ":
      vertices.push(
        0,
        -halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
      );
      break;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();

  return geometry;
};

const createGridGeometry = (settings: BoardSettings): THREE.BufferGeometry => {
  const halfSize = DRAWING_PLANE_SIZE / 2;
  const gridSize = Math.max(settings.gridSize, 0.01);
  const vertices: number[] = [];

  for (let value = -halfSize; value <= halfSize + 1e-6; value += gridSize) {
    switch (settings.activeDrawingPlane) {
      case "XY":
        vertices.push(-halfSize, value, 0, halfSize, value, 0);
        vertices.push(value, -halfSize, 0, value, halfSize, 0);
        break;
      case "XZ":
        vertices.push(-halfSize, 0, value, halfSize, 0, value);
        vertices.push(value, 0, -halfSize, value, 0, halfSize);
        break;
      case "YZ":
        vertices.push(0, -halfSize, value, 0, halfSize, value);
        vertices.push(0, value, -halfSize, 0, value, halfSize);
        break;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  return geometry;
};

const createBorderGeometry = (
  activeDrawingPlane: ActiveDrawingPlane,
): THREE.BufferGeometry => {
  const halfSize = DRAWING_PLANE_SIZE / 2;
  const vertices: number[] = [];

  switch (activeDrawingPlane) {
    case "XY":
      vertices.push(
        -halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        halfSize,
        0,
        halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        -halfSize,
        0,
      );
      break;
    case "XZ":
      vertices.push(
        -halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        halfSize,
        halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        -halfSize,
      );
      break;
    case "YZ":
      vertices.push(
        0,
        -halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        halfSize,
        0,
        halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
        -halfSize,
        -halfSize,
      );
      break;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  return geometry;
};

const createOverlayGroup = (settings: BoardSettings): THREE.Group => {
  const group = new THREE.Group();
  group.name = DRAWING_PLANE_OVERLAY_NAME;
  group.userData.ignorePicking = true;

  const effectiveOpacity = settings.drawingPlaneSolid
    ? settings.drawingPlaneOpacity
    : settings.drawingPlaneOpacity * 0.55;

  const mesh = new THREE.Mesh(
    createPlaneGeometry(settings.activeDrawingPlane),
    new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: effectiveOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.name = "drawing-plane-fill";
  mesh.userData.ignorePicking = true;
  mesh.renderOrder = -2;
  group.add(mesh);

  const border = new THREE.LineSegments(
    createBorderGeometry(settings.activeDrawingPlane),
    new THREE.LineBasicMaterial({
      color: 0x1d4ed8,
      transparent: true,
      opacity: settings.drawingPlaneSolid ? 0.8 : 0.45,
      depthWrite: false,
    }),
  );
  border.name = "drawing-plane-border";
  border.userData.ignorePicking = true;
  border.renderOrder = -1;
  group.add(border);

  if (settings.showGrid) {
    const grid = new THREE.LineSegments(
      createGridGeometry(settings),
      new THREE.LineBasicMaterial({
        color: 0x2563eb,
        transparent: true,
        opacity: settings.drawingPlaneSolid ? 0.26 : 0.16,
        depthWrite: false,
      }),
    );
    grid.name = "drawing-plane-grid";
    grid.userData.ignorePicking = true;
    grid.renderOrder = -1;
    group.add(grid);
  }

  return group;
};

export const syncDrawingPlaneOverlay = (
  scene: THREE.Scene,
  settings: BoardSettings,
): void => {
  const existing = scene.getObjectByName(DRAWING_PLANE_OVERLAY_NAME);

  if (existing) {
    disposeObject(existing);
    scene.remove(existing);
  }

  if (!settings.showDrawingPlane) {
    return;
  }

  scene.add(createOverlayGroup(settings));
};

export const disposeDrawingPlaneOverlay = (scene: THREE.Scene): void => {
  const existing = scene.getObjectByName(DRAWING_PLANE_OVERLAY_NAME);

  if (!existing) {
    return;
  }

  disposeObject(existing);
  scene.remove(existing);
};
