import {
  createPlane2DPoint,
  createPlane2DSegment,
  createPlaneCanvasDocument,
} from "../plane2d/planeCanvasUtils";
import type {
  Plane2DEntity,
  Plane2DPointEntity,
  Plane2DSectionObjectRef,
  Plane2DSegmentEntity,
  PlaneCanvasDocument,
  Vec2,
} from "../plane2d/PlaneCanvasTypes";
import type {
  SectionDocumentOptions,
  SectionLineResult,
  SectionResult,
} from "./SectionTypes";

const SECTION_LINE_HALF_LENGTH = 20;

const normalizeVec2 = (value: Vec2): Vec2 | null => {
  const length = Math.hypot(value.x, value.y);

  return length <= 1e-8 ? null : { x: value.x / length, y: value.y / length };
};

type PreservedSectionEntityMetadata = Pick<
  Plane2DPointEntity | Plane2DSegmentEntity,
  "name" | "nameSource" | "showName" | "visible"
>;

const makeSectionSourceKey = (
  result: SectionResult,
  role: "point" | "line-start" | "line-end" | "line-segment",
): string =>
  `${result.sourceRef.relation}:${result.sourceRef.sourceEntityId}:${result.id}:${role}`;

const makeSectionRef = (
  result: SectionResult,
  sourceKey: string,
  overrides: Partial<Plane2DSectionObjectRef> = {},
): Plane2DSectionObjectRef => ({
  kind: "section-object",
  sectionResultId: result.id,
  sourceKey,
  source3DTabId: result.sourceRef.sourceTabId,
  source3DEntityId: result.sourceRef.sourceEntityId,
  source3DEntityType: result.sourceRef.sourceEntityType,
  syncDirection: "from3d",
  syncBackMode: "readonly",
  createdBySection2DSync: false,
  sourceRef: result.sourceRef,
  ...overrides,
});

const collectPreservedSectionMetadata = (
  document: PlaneCanvasDocument | undefined,
): Map<string, PreservedSectionEntityMetadata> => {
  const preserved = new Map<string, PreservedSectionEntityMetadata>();

  if (!document) {
    return preserved;
  }

  Object.values(document.entities).forEach((entity) => {
    if (
      (entity.type === "plane2d-point" || entity.type === "plane2d-segment") &&
      entity.sectionRef
    ) {
      const sourceKey = entity.sectionRef.sourceKey ?? entity.sectionRef.sectionResultId;

      preserved.set(sourceKey, {
        name: entity.name,
        nameSource: entity.nameSource,
        showName: entity.showName,
        visible: entity.visible,
      });
    }
  });

  return preserved;
};

const shouldPreserveLocalSectionEntity = (entity: Plane2DEntity): boolean => {
  const sectionRef =
    entity.type === "plane2d-point" || entity.type === "plane2d-segment"
      ? entity.sectionRef
      : undefined;

  if (!sectionRef) {
    return true;
  }

  return (
    sectionRef.createdBySection2DSync === true ||
    sectionRef.syncDirection === "to3d" ||
    sectionRef.syncDirection === "bidirectional" ||
    sectionRef.syncDirection === "local2d" ||
    sectionRef.syncBackMode === "create-3d-point" ||
    sectionRef.syncBackMode === "create-3d-segment" ||
    sectionRef.syncBackMode === "update-3d-point" ||
    sectionRef.syncBackMode === "update-3d-segment"
  );
};

const collectPreservedLocalSectionEntities = (
  document: PlaneCanvasDocument | undefined,
): Plane2DEntity[] => {
  if (!document) {
    return [];
  }

  return Object.values(document.entities).filter(shouldPreserveLocalSectionEntity);
};

const addSectionPoint = (
  entities: Record<string, Plane2DEntity>,
  id: string,
  position: Vec2,
  sectionRef: Plane2DSectionObjectRef,
  preserved?: PreservedSectionEntityMetadata,
) => {
  entities[id] = createPlane2DPoint(id, position, {
    locked: true,
    draggable: false,
    pointKind: "free",
    sectionRef,
    name: preserved?.name,
    visible: preserved?.visible,
    nameSource: preserved?.nameSource ?? "auto",
    showName: preserved?.showName ?? false,
  });
};

const addSectionLine = (
  entities: Record<string, Plane2DEntity>,
  result: SectionLineResult,
  preserved: Map<string, PreservedSectionEntityMetadata>,
) => {
  const direction =
    result.lineKind === "segment" && result.endPoint2D
      ? normalizeVec2({
          x: result.endPoint2D.x - result.point2D.x,
          y: result.endPoint2D.y - result.point2D.y,
        })
      : normalizeVec2(result.direction2D);

  if (!direction) {
    return;
  }

  const start =
    result.lineKind === "segment"
      ? result.point2D
      : {
          x: result.point2D.x - direction.x * SECTION_LINE_HALF_LENGTH,
          y: result.point2D.y - direction.y * SECTION_LINE_HALF_LENGTH,
        };
  const end =
    result.lineKind === "segment" && result.endPoint2D
      ? result.endPoint2D
      : {
          x: result.point2D.x + direction.x * SECTION_LINE_HALF_LENGTH,
          y: result.point2D.y + direction.y * SECTION_LINE_HALF_LENGTH,
        };
  const segmentSourceKey = makeSectionSourceKey(result, "line-segment");
  const sectionRef = makeSectionRef(result, segmentSourceKey, {
    linePoint3D: result.point3D,
    lineDirection3D: result.direction3D,
    lineKind: result.lineKind,
  });
  const startSourceKey = makeSectionSourceKey(result, "line-start");
  const endSourceKey = makeSectionSourceKey(result, "line-end");
  const startPointId = `${result.id}-start`;
  const endPointId = `${result.id}-end`;
  const segmentId = `${result.id}-segment`;

  addSectionPoint(
    entities,
    startPointId,
    start,
    makeSectionRef(result, startSourceKey, {
      linePoint3D: result.point3D,
      lineDirection3D: result.direction3D,
      lineKind: result.lineKind,
    }),
    preserved.get(startSourceKey),
  );
  addSectionPoint(
    entities,
    endPointId,
    end,
    makeSectionRef(result, endSourceKey, {
      linePoint3D: result.point3D,
      lineDirection3D: result.direction3D,
      lineKind: result.lineKind,
    }),
    preserved.get(endSourceKey),
  );
  entities[segmentId] = createPlane2DSegment(segmentId, startPointId, endPointId, {
    locked: true,
    draggable: false,
    segmentKind: "constructed",
    sectionRef,
    name: preserved.get(segmentSourceKey)?.name,
    visible: preserved.get(segmentSourceKey)?.visible,
    nameSource: preserved.get(segmentSourceKey)?.nameSource ?? "auto",
    showName: preserved.get(segmentSourceKey)?.showName ?? false,
  });
};

export const createPlane2DSectionDocument = (
  options: SectionDocumentOptions,
  results: readonly SectionResult[],
  previousDocument?: PlaneCanvasDocument,
): PlaneCanvasDocument => {
  const now = new Date().toISOString();
  const baseDocument = createPlaneCanvasDocument();
  const entities: Record<string, Plane2DEntity> = {};
  const preserved = collectPreservedSectionMetadata(previousDocument);
  const preservedLocalEntities = collectPreservedLocalSectionEntities(previousDocument);
  const preservedLocalSourceIds = new Set(
    preservedLocalEntities
      .map((entity) =>
        entity.type === "plane2d-point" || entity.type === "plane2d-segment"
          ? entity.sectionRef?.source3DEntityId
          : undefined,
      )
      .filter((sourceEntityId): sourceEntityId is string => Boolean(sourceEntityId)),
  );
  const coincidentPlanes = results
    .filter((result) => result.kind === "coincidentPlane")
    .map((result) => result.sourceRef);

  results.forEach((result) => {
    if (result.kind === "point") {
      const sourceKey = makeSectionSourceKey(result, "point");

      addSectionPoint(
        entities,
        result.id,
        result.position2D,
        makeSectionRef(result, sourceKey, {
          position3D: result.position3D,
          lineKind: "point",
        }),
        preserved.get(sourceKey),
      );
      return;
    }

    if (result.kind === "line") {
      addSectionLine(entities, result, preserved);
    }
  });

  Object.entries(entities).forEach(([entityId, entity]) => {
    if (
      (entity.type === "plane2d-point" || entity.type === "plane2d-segment") &&
      entity.sectionRef?.source3DEntityId &&
      preservedLocalSourceIds.has(entity.sectionRef.source3DEntityId)
    ) {
      delete entities[entityId];
    }
  });

  preservedLocalEntities.forEach((entity) => {
    entities[entity.id] = entity;
  });

  const previousSection = previousDocument?.section;

  return {
    ...baseDocument,
    name: options.title,
    createdAt: now,
    updatedAt: now,
    entities,
    section: {
      kind: "section-from-3d",
      source3DTabId: options.source3DTabId,
      source3DDocumentId: options.source3DDocumentId,
      sourceSectionEntityId: options.sourceSectionEntityId,
      sectionPlane: {
        origin: options.sectionPlane.origin,
        normal: options.sectionPlane.normal,
        u: options.sectionPlane.u,
        v: options.sectionPlane.v,
      },
      sourceGeometryRevision: options.sourceGeometryRevision ?? 0,
      lastSyncedAt: options.lastSyncedAt ?? now,
      needsSync: options.needsSync ?? false,
      needsSyncFrom3D: options.needsSyncFrom3D ?? options.needsSync ?? false,
      needsSyncTo3D:
        options.needsSyncTo3D ?? previousSection?.needsSyncTo3D ?? false,
      lastSyncedTo3DAt:
        options.lastSyncedTo3DAt ?? previousSection?.lastSyncedTo3DAt,
      localEditRevision:
        options.localEditRevision ?? previousSection?.localEditRevision ?? 0,
      lastSyncedTo3DLocalRevision:
        options.lastSyncedTo3DLocalRevision ??
        previousSection?.lastSyncedTo3DLocalRevision ??
        0,
      pendingSyncTo3DDeletes: previousSection?.pendingSyncTo3DDeletes ?? [],
      coincidentPlanes,
      createdAt: now,
      liveUpdateEnabled: false,
      syncBackEnabled:
        options.syncBackEnabled ?? previousSection?.syncBackEnabled ?? true,
    },
  };
};
