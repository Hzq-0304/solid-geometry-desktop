import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId, PointEntity } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddPointCommand implements Command {
  readonly name = "Add Point";

  constructor(private readonly point: PointEntity) {}

  execute(document: BoardDocument): BoardDocument {
    if (document.entities[this.point.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.point.id]: this.point,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.point.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.point.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => entityId !== this.point.id,
      ),
    });
  }
}
