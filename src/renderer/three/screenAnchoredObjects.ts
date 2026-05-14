import * as THREE from "three";

interface ScreenAnchor {
  readonly x: number;
  readonly y: number;
}

const isScreenAnchor = (value: unknown): value is ScreenAnchor =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ScreenAnchor).x === "number" &&
  typeof (value as ScreenAnchor).y === "number";

export const syncScreenAnchoredObjects = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): void => {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  scene.traverse((object) => {
    const screenAnchor = object.userData.screenAnchor;

    if (!isScreenAnchor(screenAnchor)) {
      return;
    }

    const ndcX = (screenAnchor.x / width) * 2 - 1;
    const ndcY = 1 - (screenAnchor.y / height) * 2;
    const position = new THREE.Vector3(ndcX, ndcY, 0.1).unproject(camera);

    object.position.copy(position);
  });
};
