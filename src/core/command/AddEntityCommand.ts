import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddEntityCommand<TEntity extends BoardEntity = BoardEntity>
  implements Command
{
  readonly name: string;

  constructor(private readonly entity: TEntity, name = "Add Entity") {
    this.name = name;
  }

  execute(document: BoardDocument): BoardDocument {
    if (document.entities[this.entity.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.entity.id]: this.entity,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.entity.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.entity.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => entityId !== this.entity.id,
      ),
    });
  }
}
