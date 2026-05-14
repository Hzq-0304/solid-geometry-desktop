import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId } from "../document/EntityTypes";
import type { Command } from "./Command";

export type EntityUpdate<TEntity extends BoardEntity = BoardEntity> =
  TEntity extends BoardEntity
    ? Partial<Omit<TEntity, "id" | "kind" | "createdAt" | "updatedAt">>
    : never;

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class UpdateEntityCommand<TEntity extends BoardEntity = BoardEntity>
  implements Command
{
  readonly name = "Update Entity";

  private previousEntity: BoardEntity | null = null;

  constructor(
    private readonly entityId: EntityId,
    private readonly update: EntityUpdate<TEntity>,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    const entity = document.entities[this.entityId];

    if (!entity) {
      return document;
    }

    this.previousEntity = entity;

    const updatedEntity = {
      ...entity,
      ...this.update,
      id: entity.id,
      kind: entity.kind,
      createdAt: entity.createdAt,
      updatedAt: new Date().toISOString(),
    } as BoardEntity;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [entity.id]: updatedEntity,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!this.previousEntity) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.previousEntity.id]: this.previousEntity,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }
}
