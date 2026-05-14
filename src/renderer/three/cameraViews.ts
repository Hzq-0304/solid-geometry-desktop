import * as THREE from "three";
import type { ActiveDrawingPlane } from "../../core/document/BoardDocument";

interface TargetedControls {
  readonly target: THREE.Vector3;
  update(): void;
}

const CAMERA_POSITIONS: Record<ActiveDrawingPlane, THREE.Vector3Tuple> = {
  XY: [6, -8, 6],
  XZ: [6, -6, 8],
  YZ: [8, -6, 6],
};

export const focusCameraOnDrawingPlane = (
  camera: THREE.PerspectiveCamera,
  controls: TargetedControls,
  activeDrawingPlane: ActiveDrawingPlane,
): void => {
  camera.up.set(0, 0, 1);
  camera.position.set(...CAMERA_POSITIONS[activeDrawingPlane]);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
};
