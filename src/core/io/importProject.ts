import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  PlaneEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import {
  createDefaultBoardSettings,
  createDefaultCameraState,
} from "../document/createEmptyDocument";
import { DEFAULT_PLANE_STYLE } from "../geometry/planeUtils";
import { PROJECT_FILE_VERSION, type ProjectFile } from "./projectFile";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertBoardDocument = (value: unknown): BoardDocument => {
  if (!isObject(value)) {
    throw new Error("Project document is missing or invalid.");
  }

  if (!isObject(value.entities)) {
    throw new Error("Project document is missing entities.");
  }

  return value as unknown as BoardDocument;
};

const getImportedPlaneNameSource = (
  plane: PlaneEntity,
  entities: BoardDocument["entities"],
): "auto" | "manual" => {
  if (plane.nameSource) {
    return plane.nameSource;
  }

  const pointNames = plane.pointIds.map((pointId) => {
    const point = entities[pointId];

    return point?.kind === "point" ? point.name ?? point.id : null;
  });

  return plane.name?.trim() &&
    pointNames.every(Boolean) &&
    plane.name.trim() !== pointNames.join("")
    ? "manual"
    : "auto";
};

const getImportedSegmentNameSource = (
  segment: SegmentEntity,
  entities: BoardDocument["entities"],
): "auto" | "manual" => {
  if (segment.nameSource) {
    return segment.nameSource;
  }

  const pointNames = segment.pointIds.map((pointId) => {
    const point = entities[pointId];

    return point?.kind === "point" ? point.name ?? point.id : null;
  });

  return segment.name?.trim() &&
    pointNames.every(Boolean) &&
    segment.name.trim() !== pointNames.join("")
    ? "manual"
    : "auto";
};

const normalizeEntity = (
  entity: BoardEntity,
  entities: BoardDocument["entities"],
): BoardEntity => {
  const rawEntity = entity as unknown as Record<string, unknown>;
  const kind = rawEntity.kind ?? rawEntity.type;

  if (
    kind === "measurement" &&
    (rawEntity.measurementKind === "linePlaneAngle" ||
      rawEntity.measurementKind === "planePlaneAngle") &&
    Array.isArray(rawEntity.targetIds) &&
    rawEntity.targetIds.length === 1 &&
    rawEntity.plane === undefined
  ) {
    return {
      ...entity,
      plane: "XY",
    } as BoardEntity;
  }

  if (kind === "segment") {
    const segment = rawEntity as unknown as SegmentEntity;

    return {
      ...segment,
      kind: "segment",
      visible: segment.visible ?? true,
      locked: segment.locked ?? false,
      nameSource: getImportedSegmentNameSource(segment, entities),
    };
  }

  if (kind !== "plane") {
    return entity;
  }

  const plane = rawEntity as unknown as PlaneEntity;

  return {
    ...plane,
    kind: "plane",
    type: "plane",
    visible: plane.visible ?? true,
    locked: plane.locked ?? false,
    nameSource: getImportedPlaneNameSource(plane, entities),
    style: {
      ...DEFAULT_PLANE_STYLE,
      ...plane.style,
    },
  };
};

const normalizeEntities = (
  entities: BoardDocument["entities"],
): BoardDocument["entities"] =>
  Object.fromEntries(
    Object.entries(entities).map(([entityId, entity]) => [
      entityId,
      normalizeEntity(entity, entities),
    ]),
  );

export const importProject = (jsonText: string): BoardDocument => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  if (!isObject(parsed)) {
    throw new Error("The selected file is not a Solid Geometry project.");
  }

  const projectFile = parsed as Partial<ProjectFile>;

  if (projectFile.fileVersion !== PROJECT_FILE_VERSION) {
    throw new Error(
      `Unsupported project file version: ${String(projectFile.fileVersion)}`,
    );
  }

  const document = assertBoardDocument(projectFile.document);
  const timestamp = new Date().toISOString();

  return {
    ...document,
    settings: {
      ...createDefaultBoardSettings(),
      ...(isObject(document.settings) ? document.settings : {}),
    },
    cameraState: {
      ...createDefaultCameraState(),
      ...(isObject(document.cameraState) ? document.cameraState : {}),
    },
    selectedEntityIds: [],
    entities: normalizeEntities(document.entities),
    updatedAt: timestamp,
  };
};
