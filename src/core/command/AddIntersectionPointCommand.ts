import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId, PointEntity } from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddIntersectionPointCommand implements Command {
  readonly name = "Add Intersection Point";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(private readonly point: PointEntity) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.point.id] ||
      this.point.pointKind !== "constructed" ||
      (this.point.construction?.kind !== "lineLineIntersection" &&
        this.point.construction?.kind !== "linePlaneIntersection")
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.point.id]: this.point,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.point.id],
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
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
