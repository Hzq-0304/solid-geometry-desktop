import { DeleteEntityCommand } from "../command/DeleteEntityCommand";
import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import { createEntityId } from "../document/idGenerator";
import type {
  Plane2DEntity,
  Plane2DPointEntity,
  Plane2DSectionObjectRef,
  Plane2DSegmentEntity,
  PlaneCanvasDocument,
} from "../plane2d/PlaneCanvasTypes";
import { createPlane2DSectionDocument } from "./SectionDocument";
import { unprojectSection2DToPoint3D } from "./SectionProjection";
import { solveSection } from "./SectionSolver";

export const refreshSection2DFrom3D = (args: {
  readonly sectionDocument: PlaneCanvasDocument;
  readonly sourceDocument: BoardDocument;
  readonly sectionTabId: string;
  readonly source3DTabId: string;
  readonly sourceGeometryRevision: number;
}): PlaneCanvasDocument => {
  const section = args.sectionDocument.section;

  if (section?.kind !== "section-from-3d") {
    return args.sectionDocument;
  }

  const sectionPlane = section.sectionPlane;
  const results = solveSection(args.sourceDocument, {
    sectionPlane,
    sourceDocumentId: section.source3DDocumentId ?? args.sourceDocument.id,
    sourceTabId: args.source3DTabId,
  });

  const refreshedDocument = createPlane2DSectionDocument(
    {
      title: args.sectionDocument.name,
      source3DTabId: args.source3DTabId,
      source3DDocumentId: section.source3DDocumentId,
      sourceSectionEntityId: section.sourceSectionEntityId,
      sectionPlane,
      sourceGeometryRevision: args.sourceGeometryRevision,
      lastSyncedAt: new Date().toISOString(),
      needsSync: false,
    },
    results,
    args.sectionDocument,
  );

  return {
    ...refreshedDocument,
    id: args.sectionDocument.id,
    name: args.sectionDocument.name,
    createdAt: args.sectionDocument.createdAt,
    selectedEntityIds: [],
    settings: args.sectionDocument.settings,
  };
};

export interface ApplySection2DChangesTo3DResult {
  readonly ok: boolean;
  readonly sectionDocument: PlaneCanvasDocument;
  readonly sourceDocument: BoardDocument;
  readonly createdEntityIds: readonly string[];
  readonly updatedEntityIds: readonly string[];
  readonly deletedEntityIds: readonly string[];
  readonly skipped: readonly { readonly id: string; readonly reason: string }[];
  readonly error?: string;
}

const SECTION_SYNC_POINT_COLOR = "#0f766e";
const SECTION_SYNC_SEGMENT_COLOR = "#0f766e";

const touchSourceDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

const createSyncedPointEntity = (
  pointId: EntityId,
  name: string,
  position: PointEntity["position"],
): PointEntity => {
  const now = new Date().toISOString();

  return {
    id: pointId,
    kind: "point",
    name,
    style: { color: SECTION_SYNC_POINT_COLOR },
    visible: true,
    locked: false,
    position,
    nameSource: "auto",
    pointKind: "free",
    createdAt: now,
    updatedAt: now,
  };
};

const createSyncedSegmentEntity = (
  segmentId: EntityId,
  name: string,
  startPointId: EntityId,
  endPointId: EntityId,
): SegmentEntity => {
  const now = new Date().toISOString();

  return {
    id: segmentId,
    kind: "segment",
    name,
    style: { color: SECTION_SYNC_SEGMENT_COLOR },
    visible: true,
    locked: false,
    pointIds: [startPointId, endPointId],
    nameSource: "auto",
    createdAt: now,
    updatedAt: now,
  };
};

const makeSectionLocalRef = (args: {
  readonly sectionDocument: PlaneCanvasDocument;
  readonly source3DTabId: string;
  readonly sourceEntityId: string;
  readonly sourceEntityType: string;
  readonly sourceKey: string;
  readonly sectionResultId: string;
  readonly relation: "section-local-point" | "section-local-segment";
  readonly syncBackMode: "update-3d-point" | "update-3d-segment";
}): Plane2DSectionObjectRef => ({
  kind: "section-object",
  sectionResultId: args.sectionResultId,
  sourceKey: args.sourceKey,
  source3DTabId: args.source3DTabId,
  source3DEntityId: args.sourceEntityId,
  source3DEntityType: args.sourceEntityType,
  syncDirection: "bidirectional",
  syncBackMode: args.syncBackMode,
  createdBySection2DSync: true,
  sourceRef: {
    sourceDocumentId: args.sectionDocument.section?.source3DDocumentId,
    sourceTabId: args.source3DTabId,
    sourceEntityId: args.sourceEntityId,
    sourceEntityType: args.sourceEntityType,
    sourceName: args.sourceEntityId,
    relation: args.relation,
  },
});

const isReverseSyncPoint = (
  entity: Plane2DEntity,
): entity is Plane2DPointEntity =>
  entity.type === "plane2d-point" &&
  entity.sectionRef?.createdBySection2DSync === true &&
  (entity.sectionRef.syncBackMode === "update-3d-point" ||
    entity.sectionRef.syncBackMode === "create-3d-point");

const isReverseSyncSegment = (
  entity: Plane2DEntity,
): entity is Plane2DSegmentEntity =>
  entity.type === "plane2d-segment" &&
  entity.sectionRef?.createdBySection2DSync === true &&
  (entity.sectionRef.syncBackMode === "update-3d-segment" ||
    entity.sectionRef.syncBackMode === "create-3d-segment");

const isLocalPointSyncCandidate = (entity: Plane2DEntity): entity is Plane2DPointEntity =>
  entity.type === "plane2d-point" &&
  !entity.sectionRef &&
  entity.pointKind !== "constructed" &&
  !entity.construction;

const isLocalSegmentSyncCandidate = (
  entity: Plane2DEntity,
): entity is Plane2DSegmentEntity =>
  entity.type === "plane2d-segment" &&
  !entity.sectionRef;

export const applySection2DChangesTo3D = (args: {
  readonly sectionDocument: PlaneCanvasDocument;
  readonly sourceDocument: BoardDocument;
  readonly source3DTabId: string;
}): ApplySection2DChangesTo3DResult => {
  const section = args.sectionDocument.section;

  if (section?.kind !== "section-from-3d") {
    return {
      ok: false,
      sectionDocument: args.sectionDocument,
      sourceDocument: args.sourceDocument,
      createdEntityIds: [],
      updatedEntityIds: [],
      deletedEntityIds: [],
      skipped: [],
      error: "section metadata is incomplete",
    };
  }

  let sourceDocument = args.sourceDocument;
  let sourceEntities: Record<EntityId, BoardEntity> = {
    ...args.sourceDocument.entities,
  };
  let sectionEntities: Record<string, Plane2DEntity> = {
    ...args.sectionDocument.entities,
  };
  const createdEntityIds: string[] = [];
  const updatedEntityIds: string[] = [];
  const deletedEntityIds: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const pointIdMap = new Map<string, EntityId>();

  const ensurePointSynced = (
    pointId: string,
    options: { readonly allowConstructed?: boolean } = {},
  ): EntityId | null => {
    const mappedPointId = pointIdMap.get(pointId);

    if (mappedPointId) {
      return mappedPointId;
    }

    const entity = sectionEntities[pointId];

    if (!entity || entity.type !== "plane2d-point") {
      skipped.push({ id: pointId, reason: "endpoint is not a 2D point" });
      return null;
    }

    const canSyncConstructedPoint =
      options.allowConstructed === true &&
      entity.pointKind === "constructed" &&
      !entity.sectionRef;

    if (entity.sectionRef && !isReverseSyncPoint(entity)) {
      skipped.push({
        id: pointId,
        reason: "readonly section object cannot sync back to 3D",
      });
      return null;
    }

    if (
      !isReverseSyncPoint(entity) &&
      !isLocalPointSyncCandidate(entity) &&
      !canSyncConstructedPoint
    ) {
      skipped.push({
        id: pointId,
        reason: "constructed or unsupported 2D point cannot sync back to 3D",
      });
      return null;
    }

    const position3D = unprojectSection2DToPoint3D(
      section.sectionPlane,
      entity.position,
    );
    const existing3DPointId = entity.sectionRef?.source3DEntityId;

    if (existing3DPointId) {
      const sourcePoint = sourceEntities[existing3DPointId];

      if (sourcePoint?.kind === "point") {
        sourceEntities[existing3DPointId] = {
          ...sourcePoint,
          position: position3D,
          updatedAt: new Date().toISOString(),
        };
        updatedEntityIds.push(existing3DPointId);
        pointIdMap.set(entity.id, existing3DPointId);
        return existing3DPointId;
      }
    }

    const sourcePointId = createEntityId("section-point");
    const sourcePoint = createSyncedPointEntity(
      sourcePointId,
      entity.name?.trim() || `Section point ${sourcePointId.slice(-4)}`,
      position3D,
    );
    const sourceKey = entity.sectionRef?.sourceKey ?? `section-local-point:${entity.id}`;
    const sectionRef = makeSectionLocalRef({
      sectionDocument: args.sectionDocument,
      source3DTabId: args.source3DTabId,
      sourceEntityId: sourcePointId,
      sourceEntityType: "3D point",
      sourceKey,
      sectionResultId: entity.sectionRef?.sectionResultId ?? entity.id,
      relation: "section-local-point",
      syncBackMode: "update-3d-point",
    });

    sourceEntities[sourcePointId] = sourcePoint;
    sectionEntities[entity.id] = {
      ...entity,
      locked: false,
      draggable: true,
      sectionRef,
      updatedAt: new Date().toISOString(),
    };
    createdEntityIds.push(sourcePointId);
    pointIdMap.set(entity.id, sourcePointId);
    return sourcePointId;
  };

  (section.pendingSyncTo3DDeletes ?? []).forEach((deleteRequest) => {
    if (!sourceEntities[deleteRequest.source3DEntityId]) {
      return;
    }

    const command = new DeleteEntityCommand(deleteRequest.source3DEntityId);
    sourceDocument = command.execute({
      ...sourceDocument,
      entities: sourceEntities,
    });
    sourceEntities = { ...sourceDocument.entities };
    deletedEntityIds.push(deleteRequest.source3DEntityId);
  });

  Object.values(sectionEntities).forEach((entity) => {
    if (entity.type !== "plane2d-point") {
      return;
    }

    if (!isReverseSyncPoint(entity) && !isLocalPointSyncCandidate(entity)) {
      return;
    }

    ensurePointSynced(entity.id);
  });

  Object.values(sectionEntities).forEach((entity) => {
    if (entity.type !== "plane2d-segment") {
      return;
    }

    if (!isReverseSyncSegment(entity) && !isLocalSegmentSyncCandidate(entity)) {
      return;
    }

    const startPointId = ensurePointSynced(entity.startPointId, {
      allowConstructed: true,
    });
    const endPointId = ensurePointSynced(entity.endPointId, {
      allowConstructed: true,
    });

    if (!startPointId || !endPointId || startPointId === endPointId) {
      skipped.push({ id: entity.id, reason: "segment endpoints cannot sync to 3D" });
      return;
    }

    const existingSegmentId = entity.sectionRef?.source3DEntityId;

    if (existingSegmentId && sourceEntities[existingSegmentId]?.kind === "segment") {
      sourceEntities[existingSegmentId] = {
        ...(sourceEntities[existingSegmentId] as SegmentEntity),
        pointIds: [startPointId, endPointId],
        updatedAt: new Date().toISOString(),
      };
      updatedEntityIds.push(existingSegmentId);
      return;
    }

    const sourceSegmentId = createEntityId("section-segment");
    const sourceSegment = createSyncedSegmentEntity(
      sourceSegmentId,
      entity.name?.trim() || `Section segment ${sourceSegmentId.slice(-4)}`,
      startPointId,
      endPointId,
    );
    const sourceKey =
      entity.sectionRef?.sourceKey ?? `section-local-segment:${entity.id}`;
    const sectionRef = makeSectionLocalRef({
      sectionDocument: args.sectionDocument,
      source3DTabId: args.source3DTabId,
      sourceEntityId: sourceSegmentId,
      sourceEntityType: "3D segment",
      sourceKey,
      sectionResultId: entity.sectionRef?.sectionResultId ?? entity.id,
      relation: "section-local-segment",
      syncBackMode: "update-3d-segment",
    });

    sourceEntities[sourceSegmentId] = sourceSegment;
    sectionEntities[entity.id] = {
      ...entity,
      locked: false,
      draggable: true,
      sectionRef,
      updatedAt: new Date().toISOString(),
    };
    createdEntityIds.push(sourceSegmentId);
  });

  const changed =
    createdEntityIds.length > 0 ||
    updatedEntityIds.length > 0 ||
    deletedEntityIds.length > 0;
  const now = new Date().toISOString();
  const nextSectionDocument: PlaneCanvasDocument = {
    ...args.sectionDocument,
    entities: sectionEntities,
    updatedAt: now,
    section: {
      ...section,
      needsSyncTo3D: changed ? false : section.needsSyncTo3D,
      lastSyncedTo3DAt: changed ? now : section.lastSyncedTo3DAt,
      lastSyncedTo3DLocalRevision: changed
        ? section.localEditRevision ?? 0
        : section.lastSyncedTo3DLocalRevision,
      pendingSyncTo3DDeletes: changed
        ? []
        : section.pendingSyncTo3DDeletes ?? [],
      syncBackEnabled: true,
    },
  };
  const nextSourceDocument = changed
    ? touchSourceDocument({
        ...sourceDocument,
        entities: sourceEntities,
      })
    : args.sourceDocument;

  return {
    ok: true,
    sectionDocument: nextSectionDocument,
    sourceDocument: nextSourceDocument,
    createdEntityIds,
    updatedEntityIds,
    deletedEntityIds,
    skipped,
  };
};
