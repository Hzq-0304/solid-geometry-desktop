import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export const DEFAULT_POINT_COLOR = "#111111";
export const DEFAULT_SEGMENT_COLOR = "#111827";
export const SELECTED_ENTITY_COLOR = "#f59e0b";
export const PRESELECTED_ENTITY_COLOR = "#111111";
export const POINT_VISUAL_RADIUS = 0.04;
export const SEGMENT_LINE_WIDTH = 3;
export const SELECTED_SEGMENT_LINE_WIDTH = 4.5;
export const PRESELECTED_SEGMENT_LINE_WIDTH = 5;
export const PREVIEW_SEGMENT_LINE_WIDTH = 2;
export const PLANE_BOUNDARY_LINE_WIDTH = 2.2;
export const SELECTED_PLANE_BOUNDARY_LINE_WIDTH = 4;
export const PRESELECTED_PLANE_BOUNDARY_LINE_WIDTH = 3.4;

export const createPointMaterial = (
  _color: THREE.ColorRepresentation = DEFAULT_POINT_COLOR,
  selected = false,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: selected ? SELECTED_ENTITY_COLOR : DEFAULT_POINT_COLOR,
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
  selected = false,
  preselected = false,
): LineMaterial =>
  new LineMaterial({
    color: selected ? SELECTED_ENTITY_COLOR : color,
    linewidth: selected
      ? SELECTED_SEGMENT_LINE_WIDTH
      : preselected
        ? PRESELECTED_SEGMENT_LINE_WIDTH
        : SEGMENT_LINE_WIDTH,
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

export const createPlaneBoundaryMaterial = (
  color: THREE.ColorRepresentation,
  selected = false,
  preselected = false,
): LineMaterial =>
  new LineMaterial({
    color: selected || preselected ? SELECTED_ENTITY_COLOR : color,
    linewidth: selected
      ? SELECTED_PLANE_BOUNDARY_LINE_WIDTH
      : preselected
        ? PRESELECTED_PLANE_BOUNDARY_LINE_WIDTH
        : PLANE_BOUNDARY_LINE_WIDTH,
    worldUnits: false,
    transparent: true,
    opacity: selected || preselected ? 0.98 : 0.76,
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
