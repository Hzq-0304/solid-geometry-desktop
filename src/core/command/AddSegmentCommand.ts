import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

const isPointEntity = (
  document: BoardDocument,
  entityId: EntityId,
): boolean => document.entities[entityId]?.kind === "point";

export class AddSegmentCommand implements Command {
  readonly name = "Add Segment";

  constructor(private readonly segment: SegmentEntity) {}

  execute(document: BoardDocument): BoardDocument {
    const [startPointId, endPointId] = this.segment.pointIds;

    if (document.entities[this.segment.id]) {
      return document;
    }

    if (startPointId === endPointId) {
      return document;
    }

    if (
      !isPointEntity(document, startPointId) ||
      !isPointEntity(document, endPointId)
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.segment.id]: this.segment,
    };

    return touchDocument({
      ...document,
      entities,
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!document.entities[this.segment.id]) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.segment.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: document.selectedEntityIds.filter(
        (entityId) => entityId !== this.segment.id,
      ),
    });
  }
}
