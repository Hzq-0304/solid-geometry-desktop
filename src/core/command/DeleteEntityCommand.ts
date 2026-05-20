import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class DeleteEntityCommand implements Command {
  readonly name = "Delete Entity";

  private deletedEntities: Record<EntityId, BoardEntity> | null = null;
  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(private readonly entityId: EntityId) {}

  execute(document: BoardDocument): BoardDocument {
    const entity = document.entities[this.entityId];

    if (!entity) {
      return document;
    }

    const entityIdsToDelete = new Set<EntityId>([this.entityId]);

    if (entity.kind === "perpendicularLine" && entity.footPointId) {
      const footPointId = entity.footPointId;
      const footPoint = document.entities[footPointId];

      if (
        footPoint?.kind === "point" &&
        !Object.values(document.entities).some(
          (candidate) =>
            candidate.id !== entity.id &&
            candidate.id !== footPointId &&
            referencesEntity(candidate, footPointId),
        )
      ) {
        entityIdsToDelete.add(footPointId);
      }
    }

    if (entity.kind === "perpendicularLine" && entity.directionPointId) {
      const directionPointId = entity.directionPointId;
      const directionPoint = document.entities[directionPointId];

      if (
        directionPoint?.kind === "point" &&
        !Object.values(document.entities).some(
          (candidate) =>
            candidate.id !== entity.id &&
            candidate.id !== directionPointId &&
            referencesEntity(candidate, directionPointId),
        )
      ) {
        entityIdsToDelete.add(directionPointId);
      }
    }

    if (entity.kind === "linePlanePerpendicular") {
      const footPointId = entity.footPointId;
      const footPoint = footPointId ? document.entities[footPointId] : null;

      if (
        footPointId &&
        footPoint?.kind === "point" &&
        !Object.values(document.entities).some(
          (candidate) =>
            candidate.id !== entity.id &&
            candidate.id !== footPointId &&
            referencesEntity(candidate, footPointId),
        )
      ) {
        entityIdsToDelete.add(footPointId);
      }

      const directionPointId = entity.directionPointId;
      const directionPoint = directionPointId
        ? document.entities[directionPointId]
        : null;

      if (
        directionPointId &&
        directionPoint?.kind === "point" &&
        !Object.values(document.entities).some(
          (candidate) =>
            candidate.id !== entity.id &&
            candidate.id !== directionPointId &&
            referencesEntity(candidate, directionPointId),
        )
      ) {
        entityIdsToDelete.add(directionPointId);
      }
    }

    if (entity.kind === "point" && entity.pointKind === "constructed") {
      Object.values(document.entities).forEach((candidate) => {
        if (
          candidate.kind === "linePlanePerpendicular" &&
          (candidate.footPointId === entity.id ||
            candidate.directionPointId === entity.id)
        ) {
          entityIdsToDelete.add(candidate.id);
        }

        if (
          candidate.kind === "perpendicularLine" &&
          (candidate.footPointId === entity.id ||
            candidate.directionPointId === entity.id)
        ) {
          entityIdsToDelete.add(candidate.id);
        }
      });
    }

    this.deletedEntities = Object.fromEntries(
      [...entityIdsToDelete]
        .map((entityId) => [entityId, document.entities[entityId]] as const)
        .filter((entry): entry is readonly [EntityId, BoardEntity] =>
          Boolean(entry[1]),
        ),
    );
    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    Object.keys(this.deletedEntities).forEach((entityId) => {
      delete entities[entityId];
    });

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (selectedEntityId) => !this.deletedEntities?.[selectedEntityId],
      ),
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!this.deletedEntities) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      ...this.deletedEntities,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}

const referencesEntity = (entity: BoardEntity, targetEntityId: EntityId): boolean => {
  switch (entity.kind) {
    case "point":
      if (entity.construction?.kind === "midpoint") {
        return (
          entity.construction.pointAId === targetEntityId ||
          entity.construction.pointBId === targetEntityId
        );
      }

      if (
        entity.construction?.kind === "footToLine" ||
        entity.construction?.kind === "perpendicularDirectionToLine"
      ) {
        return (
          entity.construction.sourcePointId === targetEntityId ||
          entity.construction.targetSegmentId === targetEntityId
        );
      }

      if (
        entity.construction?.kind === "footToPlane" ||
        entity.construction?.kind === "perpendicularDirectionToPlane"
      ) {
        return (
          entity.construction.sourcePointId === targetEntityId ||
          entity.construction.targetPlaneId === targetEntityId
        );
      }

      if (entity.construction?.kind === "parallelSegmentEndpoint") {
        return (
          entity.construction.anchorPointId === targetEntityId ||
          entity.construction.sourceSegmentId === targetEntityId
        );
      }

      if (entity.construction?.kind === "parallelPlaneVertex") {
        return (
          entity.construction.anchorPointId === targetEntityId ||
          entity.construction.sourcePlaneId === targetEntityId
        );
      }

      return false;
    case "segment":
      return entity.pointIds.includes(targetEntityId);
    case "perpendicularLine":
      return (
        entity.pointId === targetEntityId ||
        entity.segmentId === targetEntityId ||
        entity.footPointId === targetEntityId ||
        entity.directionPointId === targetEntityId
      );
    case "linePlanePerpendicular":
      return (
        entity.pointId === targetEntityId ||
        entity.planeId === targetEntityId ||
        entity.footPointId === targetEntityId ||
        entity.directionPointId === targetEntityId
      );
    case "extension":
      return entity.targetId === targetEntityId;
    case "plane":
    case "polygon":
      return entity.pointIds.includes(targetEntityId);
    case "solid":
      return (
        entity.pointIds.includes(targetEntityId) ||
        entity.edgeIds.includes(targetEntityId) ||
        entity.faceIds.includes(targetEntityId)
      );
    case "label":
      return (
        entity.anchorPointId === targetEntityId ||
        entity.targetEntityId === targetEntityId
      );
    case "measurement":
      return (
        entity.targetIds.includes(targetEntityId) ||
        entity.pointIds.includes(targetEntityId) ||
        entity.targetEntityIds.includes(targetEntityId)
      );
    default:
      return false;
  }
};
