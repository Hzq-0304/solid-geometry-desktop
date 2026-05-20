import * as THREE from "three";
import type { Vec3 } from "../../core/geometry/Vec3";

const PLANE_PREVIEW_NAME = "plane-preview";
const PLANE_PREVIEW_EDGE_NAME = "plane-preview-edge";

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

const createPlanePreviewGroup = (): THREE.Group => {
  const group = new THREE.Group();
  group.name = PLANE_PREVIEW_NAME;
  group.userData.ignorePicking = true;
  group.renderOrder = 21;

  const meshGeometry = new THREE.BufferGeometry();
  const meshMaterial = new THREE.MeshBasicMaterial({
    color: 0x93c5fd,
    opacity: 0.2,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
  mesh.name = PLANE_PREVIEW_NAME;
  mesh.userData.ignorePicking = true;
  mesh.renderOrder = 21;
  group.add(mesh);

  const edgeGeometry = new THREE.BufferGeometry();
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x2563eb,
    transparent: true,
    opacity: 0.65,
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.name = PLANE_PREVIEW_EDGE_NAME;
  edges.userData.ignorePicking = true;
  edges.renderOrder = 22;
  group.add(edges);

  group.visible = false;

  return group;
};

const getPlanePreviewGroup = (scene: THREE.Scene): THREE.Group => {
  const existing = scene.getObjectByName(PLANE_PREVIEW_NAME);

  if (existing instanceof THREE.Group) {
    return existing;
  }

  const group = createPlanePreviewGroup();
  scene.add(group);

  return group;
};

const setPlanePreviewPoints = (
  group: THREE.Group,
  points: readonly [Vec3, Vec3, Vec3],
): void => {
  const mesh = group.children[0] as THREE.Mesh<THREE.BufferGeometry>;
  const edges = group.children[1] as THREE.LineSegments<THREE.BufferGeometry>;
  const [a, b, c] = points;

  mesh.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z],
      3,
    ),
  );
  mesh.geometry.setIndex([0, 1, 2]);
  mesh.geometry.computeVertexNormals();

  edges.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
        b.x,
        b.y,
        b.z,
        c.x,
        c.y,
        c.z,
        c.x,
        c.y,
        c.z,
        a.x,
        a.y,
        a.z,
      ],
      3,
    ),
  );
};

export const syncPlanePreview = (
  scene: THREE.Scene,
  points: readonly [Vec3, Vec3, Vec3] | null,
  visible: boolean,
): void => {
  const group = getPlanePreviewGroup(scene);
  group.visible = visible && points !== null;

  if (!group.visible || !points) {
    return;
  }

  setPlanePreviewPoints(group, points);
};

export const disposePlanePreview = (scene: THREE.Scene): void => {
  const existing = scene.getObjectByName(PLANE_PREVIEW_NAME);

  if (!existing) {
    return;
  }

  existing.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.LineSegments;
    renderable.geometry?.dispose();

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });
  scene.remove(existing);
};
