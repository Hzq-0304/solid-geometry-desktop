import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  PerpendicularLineEntity,
  PointEntity,
} from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddPerpendicularLineCommand implements Command {
  readonly name = "Add Perpendicular Line";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(
    private readonly perpendicularLine: PerpendicularLineEntity,
    private readonly constructedPoint?: PointEntity,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.perpendicularLine.id] ||
      (this.constructedPoint && document.entities[this.constructedPoint.id])
    ) {
      return document;
    }

    if (
      document.entities[this.perpendicularLine.pointId]?.kind !== "point" ||
      document.entities[this.perpendicularLine.segmentId]?.kind !== "segment" ||
      (this.constructedPoint &&
        this.perpendicularLine.footPointId !== this.constructedPoint.id &&
        this.perpendicularLine.directionPointId !== this.constructedPoint.id)
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.perpendicularLine.id]: this.perpendicularLine,
    };

    if (this.constructedPoint) {
      entities[this.constructedPoint.id] = this.constructedPoint;
    }

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.perpendicularLine.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (
      !document.entities[this.perpendicularLine.id] &&
      (!this.constructedPoint || !document.entities[this.constructedPoint.id])
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.perpendicularLine.id];
    if (this.constructedPoint) {
      delete entities[this.constructedPoint.id];
    }

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
