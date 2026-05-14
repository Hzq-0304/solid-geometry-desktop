import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { Vec3 } from "../../core/geometry/Vec3";
import { createPreviewSegmentMaterial } from "./materials";

const SEGMENT_PREVIEW_NAME = "segment-preview";

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

const createSegmentPreview = (start: Vec3, end: Vec3): Line2 => {
  const geometry = new LineGeometry();
  geometry.setPositions([start.x, start.y, start.z, end.x, end.y, end.z]);
  const material = createPreviewSegmentMaterial();
  const line = new Line2(geometry, material);
  line.name = SEGMENT_PREVIEW_NAME;
  line.userData.ignorePicking = true;
  line.renderOrder = 22;
  line.computeLineDistances();

  return line;
};

const getSegmentPreview = (scene: THREE.Scene): Line2 => {
  const existing = scene.getObjectByName(SEGMENT_PREVIEW_NAME);

  if (existing instanceof Line2) {
    return existing;
  }

  const preview = createSegmentPreview(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  );
  preview.visible = false;
  scene.add(preview);

  return preview;
};

const setSegmentPreviewPoints = (
  line: Line2,
  start: Vec3,
  end: Vec3,
): void => {
  line.geometry.setPositions([start.x, start.y, start.z, end.x, end.y, end.z]);
  line.computeLineDistances();
};

export const syncSegmentPreview = (
  scene: THREE.Scene,
  start: Vec3 | null,
  end: Vec3 | null,
  visible: boolean,
): void => {
  const preview = getSegmentPreview(scene);
  preview.visible = visible && start !== null && end !== null;

  if (!preview.visible || !start || !end) {
    return;
  }

  setSegmentPreviewPoints(preview, start, end);
};

export const disposeSegmentPreview = (scene: THREE.Scene): void => {
  const existing = scene.getObjectByName(SEGMENT_PREVIEW_NAME);

  if (!existing) {
    return;
  }

  existing.traverse((child) => {
    const renderable = child as Line2;
    renderable.geometry?.dispose();

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });
  scene.remove(existing);
};
