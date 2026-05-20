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
  private readonly previousPosition: Vec3 | null;
  private readonly nextPosition: Vec3;

  constructor(pointId: EntityId, nextPosition: Vec3);
  constructor(pointId: EntityId, previousPosition: Vec3, nextPosition: Vec3);
  constructor(
    private readonly pointId: EntityId,
    previousPositionOrNextPosition: Vec3,
    nextPosition?: Vec3,
  ) {
    this.previousPosition = nextPosition
      ? cloneVec3(previousPositionOrNextPosition)
      : null;
    this.nextPosition = cloneVec3(nextPosition ?? previousPositionOrNextPosition);
  }

  execute(document: BoardDocument): BoardDocument {
    const entity = document.entities[this.pointId];

    if (!entity || entity.kind !== "point" || entity.pointKind === "constructed") {
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
    if (!this.previousPoint && !this.previousPosition) {
      return document;
    }

    const currentEntity = document.entities[this.pointId];

    if (!currentEntity || currentEntity.kind !== "point") {
      return document;
    }

    let restoredPoint: PointEntity;

    if (this.previousPoint) {
      restoredPoint = this.previousPoint;
    } else if (this.previousPosition) {
      restoredPoint = {
        ...currentEntity,
        position: cloneVec3(this.previousPosition),
        updatedAt: new Date().toISOString(),
      };
    } else {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [restoredPoint.id]: restoredPoint,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }
}
