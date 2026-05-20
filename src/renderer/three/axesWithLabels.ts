import * as THREE from "three";
import type { BoardSettings } from "../../core/document/BoardDocument";

const AXES_WITH_LABELS_NAME = "axes-with-labels";
const DEFAULT_AXIS_LENGTH = 10;

const createAxisLine = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 1,
  });
  const line = new THREE.Line(geometry, material);
  line.userData.ignorePicking = true;

  return line;
};

const createLabelTexture = (text: string, color: string): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "700 76px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 10;
    context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
};

const createAxisLabel = (
  text: string,
  color: string,
  position: THREE.Vector3,
): THREE.Sprite => {
  const material = new THREE.SpriteMaterial({
    map: createLabelTexture(text, color),
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(0.55, 0.55, 0.55);
  sprite.renderOrder = 30;
  sprite.userData.ignorePicking = true;

  return sprite;
};

export const createAxesWithLabels = (axisLength = DEFAULT_AXIS_LENGTH): THREE.Group => {
  const safeAxisLength =
    Number.isFinite(axisLength) && axisLength > 0
      ? axisLength
      : DEFAULT_AXIS_LENGTH;
  const group = new THREE.Group();
  group.name = AXES_WITH_LABELS_NAME;
  group.userData.ignorePicking = true;

  group.add(
    createAxisLine(
      new THREE.Vector3(-safeAxisLength, 0, 0),
      new THREE.Vector3(safeAxisLength, 0, 0),
      0xdc2626,
    ),
  );
  group.add(
    createAxisLine(
      new THREE.Vector3(0, -safeAxisLength, 0),
      new THREE.Vector3(0, safeAxisLength, 0),
      0x16a34a,
    ),
  );
  group.add(
    createAxisLine(
      new THREE.Vector3(0, 0, -safeAxisLength),
      new THREE.Vector3(0, 0, safeAxisLength),
      0x2563eb,
    ),
  );

  group.add(
    createAxisLabel("X", "#dc2626", new THREE.Vector3(safeAxisLength + 0.35, 0, 0)),
  );
  group.add(
    createAxisLabel("Y", "#16a34a", new THREE.Vector3(0, safeAxisLength + 0.35, 0)),
  );
  group.add(
    createAxisLabel("Z", "#2563eb", new THREE.Vector3(0, 0, safeAxisLength + 0.35)),
  );

  return group;
};

export const syncAxesWithLabels = (
  scene: THREE.Scene,
  settings: BoardSettings,
): void => {
  const existing = scene.getObjectByName(AXES_WITH_LABELS_NAME);

  if (existing) {
    disposeAxesWithLabels(existing);
    scene.remove(existing);
  }

  if (!settings.showAxes) {
    return;
  }

  scene.add(createAxesWithLabels(settings.coordinateHalfSize));
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  if (material instanceof THREE.SpriteMaterial) {
    material.map?.dispose();
  }

  material.dispose();
};

export const disposeAxesWithLabels = (axes: THREE.Object3D): void => {
  axes.traverse((child) => {
    const renderable = child as THREE.Line | THREE.Sprite;
    renderable.geometry?.dispose();

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });
};
