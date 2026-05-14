import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  PointEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import { areVec3Equal, cloneVec3 } from "../geometry/geometryUtils";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class MovePointCommand implements Command {
  readonly name = "Move Point";

  private previousPoint: PointEntity | null = null;

  constructor(
    private readonly pointId: EntityId,
    private readonly nextPosition: Vec3,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    const entity = document.entities[this.pointId];

    if (!entity || entity.kind !== "point") {
      return document;
    }

    if (areVec3Equal(entity.position, this.nextPosition)) {
      return document;
    }

    this.previousPoint = entity;

    const updatedPoint: PointEntity = {
      ...entity,
      position: cloneVec3(this.nextPosition),
      updatedAt: new Date().toISOString(),
    };

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [entity.id]: updatedPoint,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!this.previousPoint) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.previousPoint.id]: this.previousPoint,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }
}
