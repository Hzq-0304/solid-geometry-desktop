import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId, ExtensionEntity } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddExtensionCommand implements Command {
  readonly name = "Add Extension";

  constructor(private readonly extension: ExtensionEntity) {}

  execute(document: BoardDocument): BoardDocument {
    const target = document.entities[this.extension.targetId];

    if (
      document.entities[this.extension.id] ||
      !target ||
      target.kind !== this.extension.targetType
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.extension.id]: this.extension,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.extension.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.extension.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.extension.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => entityId !== this.extension.id,
      ),
    });
  }
}
