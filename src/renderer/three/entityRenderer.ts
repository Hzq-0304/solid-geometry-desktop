import * as THREE from "three";
import type { BoardDocument } from "../../core/document/BoardDocument";
import { createEntityObject } from "./entityObjectFactory";

const ENTITY_OBJECT_GROUP_NAME = "board-document-entities";

const getEntityGroup = (scene: THREE.Scene): THREE.Group => {
  const existingGroup = scene.getObjectByName(ENTITY_OBJECT_GROUP_NAME);

  if (existingGroup instanceof THREE.Group) {
    return existingGroup;
  }

  const group = new THREE.Group();
  group.name = ENTITY_OBJECT_GROUP_NAME;
  scene.add(group);

  return group;
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

export const disposeEntityObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Line;

    renderable.geometry?.dispose();

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });
};

export const clearEntityObjects = (scene: THREE.Scene): void => {
  const group = getEntityGroup(scene);

  for (const child of [...group.children]) {
    group.remove(child);
    disposeEntityObject(child);
  }
};

export const syncDocumentEntitiesToScene = (
  scene: THREE.Scene,
  document: BoardDocument,
): void => {
  const group = getEntityGroup(scene);

  for (const child of [...group.children]) {
    group.remove(child);
    disposeEntityObject(child);
  }

  Object.values(document.entities).forEach((entity) => {
    const object = createEntityObject(entity, document);

    if (object) {
      group.add(object);
    }
  });
};
