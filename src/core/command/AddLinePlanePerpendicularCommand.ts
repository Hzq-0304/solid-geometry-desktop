import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  LinePlanePerpendicularEntity,
  PointEntity,
} from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddLinePlanePerpendicularCommand implements Command {
  readonly name = "Add Line Plane Perpendicular";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(
    private readonly constructedPoint: PointEntity,
    private readonly linePlanePerpendicular: LinePlanePerpendicularEntity,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.linePlanePerpendicular.id] ||
      document.entities[this.constructedPoint.id]
    ) {
      return document;
    }

    if (
      document.entities[this.linePlanePerpendicular.pointId]?.kind !== "point" ||
      document.entities[this.linePlanePerpendicular.planeId]?.kind !== "plane" ||
      (this.linePlanePerpendicular.footPointId !== this.constructedPoint.id &&
        this.linePlanePerpendicular.directionPointId !== this.constructedPoint.id)
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.constructedPoint.id]: this.constructedPoint,
      [this.linePlanePerpendicular.id]: this.linePlanePerpendicular,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.linePlanePerpendicular.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (
      !document.entities[this.linePlanePerpendicular.id] &&
      !document.entities[this.constructedPoint.id]
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.linePlanePerpendicular.id];
    delete entities[this.constructedPoint.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
