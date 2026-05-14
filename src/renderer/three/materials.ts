import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export const DEFAULT_POINT_COLOR = "#2563eb";
export const DEFAULT_SEGMENT_COLOR = "#111827";
export const POINT_VISUAL_RADIUS = 0.04;
export const SEGMENT_LINE_WIDTH = 3;
export const PREVIEW_SEGMENT_LINE_WIDTH = 2;

export const createPointMaterial = (
  color: THREE.ColorRepresentation = DEFAULT_POINT_COLOR,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    wireframe: false,
    roughness: 0.42,
    metalness: 0.05,
  });

export const createSegmentMaterial = (
  color: THREE.ColorRepresentation = DEFAULT_SEGMENT_COLOR,
): LineMaterial =>
  new LineMaterial({
    color,
    linewidth: SEGMENT_LINE_WIDTH,
    worldUnits: false,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
  });

export const createPreviewSegmentMaterial = (): LineMaterial =>
  new LineMaterial({
    color: 0xf59e0b,
    linewidth: PREVIEW_SEGMENT_LINE_WIDTH,
    worldUnits: false,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
  });

export const updateLineMaterialResolution = (
  object: THREE.Object3D,
  width: number,
  height: number,
): void => {
  object.traverse((child) => {
    const renderable = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];

    materials.forEach((material) => {
      if (material instanceof LineMaterial) {
        material.resolution.set(width, height);
      }
    });
  });
};
