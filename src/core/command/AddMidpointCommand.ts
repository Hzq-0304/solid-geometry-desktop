import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId, PointEntity } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddMidpointCommand implements Command {
  readonly name = "Add Midpoint";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(private readonly midpoint: PointEntity) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.midpoint.id] ||
      this.midpoint.pointKind !== "constructed" ||
      this.midpoint.construction?.kind !== "midpoint" ||
      document.entities[this.midpoint.construction.pointAId]?.kind !== "point" ||
      document.entities[this.midpoint.construction.pointBId]?.kind !== "point" ||
      this.midpoint.construction.pointAId ===
        this.midpoint.construction.pointBId
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.midpoint.id]: this.midpoint,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.midpoint.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.midpoint.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.midpoint.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
