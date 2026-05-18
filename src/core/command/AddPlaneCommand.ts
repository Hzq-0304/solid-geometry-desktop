import type { BoardDocument } from "../document/BoardDocument";
import type { BoardEntity, EntityId, PlaneEntity } from "../document/EntityTypes";
import {
  getPlaneFromThreePoints,
  getPlanePoints,
} from "../geometry/planeUtils";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddPlaneCommand implements Command {
  readonly name = "Add Plane";

  constructor(private readonly plane: PlaneEntity) {}

  execute(document: BoardDocument): BoardDocument {
    if (document.entities[this.plane.id]) {
      return document;
    }

    const [pointAId, pointBId, pointCId] = this.plane.pointIds;

    if (
      pointAId === pointBId ||
      pointAId === pointCId ||
      pointBId === pointCId
    ) {
      return document;
    }

    const points = getPlanePoints(document, this.plane.pointIds);

    if (
      !points ||
      !getPlaneFromThreePoints(
        points[0].position,
        points[1].position,
        points[2].position,
      )
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.plane.id]: this.plane,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.plane.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.plane.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => entityId !== this.plane.id,
      ),
    });
  }
}
