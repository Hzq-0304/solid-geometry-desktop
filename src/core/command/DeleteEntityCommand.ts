import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class DeleteEntityCommand implements Command {
  readonly name = "Delete Entity";

  private deletedEntity: BoardEntity | null = null;
  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(private readonly entityId: EntityId) {}

  execute(document: BoardDocument): BoardDocument {
    const entity = document.entities[this.entityId];

    if (!entity) {
      return document;
    }

    this.deletedEntity = entity;
    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.entityId];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (selectedEntityId) => selectedEntityId !== this.entityId,
      ),
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!this.deletedEntity) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.deletedEntity.id]: this.deletedEntity,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
