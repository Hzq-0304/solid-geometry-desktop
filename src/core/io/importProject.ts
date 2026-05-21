import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  LinePlanePerpendicularEntity,
  PerpendicularLineEntity,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
  ExtensionEntity,
} from "../document/EntityTypes";
import {
  createDefaultBoardSettings,
  createDefaultCameraState,
} from "../document/createEmptyDocument";
import { projectPointToLine } from "../geometry/geometryUtils";
import { DEFAULT_PLANE_STYLE } from "../geometry/planeUtils";
import { calculateLinePlanePerpendicular } from "../geometry/linePlanePerpendicularUtils";
import { getPointWorldPosition } from "../geometry/pointPositionUtils";
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

  if (kind === "point") {
    const point = rawEntity as unknown as PointEntity;

    return {
      ...point,
      kind: "point",
      visible: point.visible ?? true,
      locked: point.locked ?? false,
      nameSource: point.nameSource ?? "auto",
      pointKind: point.pointKind ?? "free",
    };
  }

  if (kind === "perpendicularLine") {
    const perpendicularLine = rawEntity as unknown as PerpendicularLineEntity;

    return {
      ...perpendicularLine,
      kind: "perpendicularLine",
      type: "perpendicularLine",
      visible: perpendicularLine.visible ?? true,
      locked: perpendicularLine.locked ?? false,
      nameSource: perpendicularLine.nameSource ?? "auto",
      constructionMode:
        perpendicularLine.constructionMode ??
        (perpendicularLine.directionPointId ? "userDirection" : "foot"),
      style: {
        lineColor: "#111827",
        lineWidth: 3,
        extensionColor: "#64748b",
        extensionLineWidth: 1,
        extensionDash: true,
        showExtensionHelper: true,
        ...perpendicularLine.style,
      },
    };
  }

  if (kind === "linePlanePerpendicular") {
    const linePlanePerpendicular =
      rawEntity as unknown as LinePlanePerpendicularEntity;

    return {
      ...linePlanePerpendicular,
      kind: "linePlanePerpendicular",
      type: "linePlanePerpendicular",
      visible: linePlanePerpendicular.visible ?? true,
      locked: linePlanePerpendicular.locked ?? false,
      nameSource: linePlanePerpendicular.nameSource ?? "auto",
      constructionMode:
        linePlanePerpendicular.constructionMode ??
        (linePlanePerpendicular.directionPointId ? "userDirection" : "foot"),
      style: {
        lineColor: "#111827",
        lineWidth: 3,
        extensionFillColor: "#93c5fd",
        extensionFillOpacity: 0.14,
        helperLineColor: "#64748b",
        helperLineDash: true,
        showExtensionHelper: true,
        ...linePlanePerpendicular.style,
      },
    };
  }

  if (kind === "extension") {
    const extension = rawEntity as unknown as ExtensionEntity;

    return {
      ...extension,
      kind: "extension",
      type: "extension",
      mode: extension.mode ?? "toBoundaryCube",
      visible: extension.visible ?? true,
      snapEnabled: extension.snapEnabled ?? extension.visible ?? true,
      locked: extension.locked ?? false,
      nameSource: extension.nameSource ?? "auto",
      style: {
        lineExtensionColor: "#6b7280",
        lineExtensionWidth: 1,
        lineExtensionDash: true,
        planeExtensionColor: "#93c5fd",
        planeExtensionOpacity: 0.14,
        boundaryLineColor: "#60a5fa",
        ...extension.style,
      },
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
): BoardDocument["entities"] => {
  const normalizedEntities: Record<string, BoardEntity> = Object.fromEntries(
    Object.entries(entities).map(([entityId, entity]) => [
      entityId,
      normalizeEntity(entity, entities),
    ]),
  );

  for (const entity of Object.values(normalizedEntities)) {
    if (
      entity.kind === "perpendicularLine" &&
      entity.constructionMode !== "userDirection" &&
      !entity.footPointId &&
      !normalizedEntities[`${entity.id}-foot`]
    ) {
      const sourcePoint = normalizedEntities[entity.pointId];
      const targetSegment = normalizedEntities[entity.segmentId];

      if (sourcePoint?.kind === "point" && targetSegment?.kind === "segment") {
        const documentLike = { entities: normalizedEntities } as BoardDocument;
        const sourcePosition = getPointWorldPosition(
          documentLike,
          entity.pointId,
        );
        const startPosition = getPointWorldPosition(
          documentLike,
          targetSegment.pointIds[0],
        );
        const endPosition = getPointWorldPosition(
          documentLike,
          targetSegment.pointIds[1],
        );
        const projection =
          sourcePosition && startPosition && endPosition
            ? projectPointToLine(sourcePosition, startPosition, endPosition)
            : null;

        if (projection) {
          const footPointId = `${entity.id}-foot`;
          const timestamp = new Date().toISOString();

          normalizedEntities[footPointId] = {
            id: footPointId,
            kind: "point",
            name: "H",
            style: { color: "#111111" },
            visible: true,
            locked: false,
            position: projection.foot,
            nameSource: "auto",
            pointKind: "constructed",
            construction: {
              kind: "footToLine",
              sourcePointId: entity.pointId,
              targetSegmentId: entity.segmentId,
            },
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          normalizedEntities[entity.id] = {
            ...entity,
            footPointId,
          };
        }
      }
    }

    if (
      entity.kind === "linePlanePerpendicular" &&
      entity.constructionMode !== "userDirection" &&
      !entity.footPointId &&
      !normalizedEntities[`${entity.id}-foot`]
    ) {
      const point = normalizedEntities[entity.pointId];
      const plane = normalizedEntities[entity.planeId];

      if (point?.kind === "point" && plane?.kind === "plane") {
        const projection = calculateLinePlanePerpendicular(
          point,
          plane,
          { entities: normalizedEntities } as BoardDocument,
        );

        if (projection) {
          const footPointId = `${entity.id}-foot`;
          const timestamp = new Date().toISOString();

          normalizedEntities[footPointId] = {
            id: footPointId,
            kind: "point",
            name: "H",
            style: { color: "#111111" },
            visible: true,
            locked: false,
            position: projection.foot,
            nameSource: "auto",
            pointKind: "constructed",
            construction: {
              kind: "footToPlane",
              sourcePointId: entity.pointId,
              targetPlaneId: entity.planeId,
            },
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          normalizedEntities[entity.id] = {
            ...entity,
            footPointId,
          };
        }
      }
    }
  }

  return normalizedEntities as BoardDocument["entities"];
};

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
  const importedSettings: Record<string, unknown> = isObject(document.settings)
    ? document.settings
    : {};
  const importedCoordinateHalfSize =
    typeof importedSettings.coordinateHalfSize === "number" &&
    Number.isFinite(importedSettings.coordinateHalfSize) &&
    importedSettings.coordinateHalfSize > 0
      ? importedSettings.coordinateHalfSize
      : createDefaultBoardSettings().coordinateHalfSize;

  return {
    ...document,
    settings: {
      ...createDefaultBoardSettings(),
      ...importedSettings,
      coordinateHalfSize: importedCoordinateHalfSize,
      showBoundaryCube:
        typeof importedSettings.showBoundaryCube === "boolean"
          ? importedSettings.showBoundaryCube
          : createDefaultBoardSettings().showBoundaryCube,
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
