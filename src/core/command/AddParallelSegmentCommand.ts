import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddParallelSegmentCommand implements Command {
  readonly name = "Add Parallel Segment";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(
    private readonly anchorPoint: PointEntity,
    private readonly constructedEndpoint: PointEntity,
    private readonly segment: SegmentEntity,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.anchorPoint.id] ||
      document.entities[this.constructedEndpoint.id] ||
      document.entities[this.segment.id] ||
      this.constructedEndpoint.pointKind !== "constructed" ||
      this.constructedEndpoint.construction?.kind !==
        "parallelSegmentEndpoint" ||
      this.constructedEndpoint.construction.anchorPointId !==
        this.anchorPoint.id ||
      document.entities[this.constructedEndpoint.construction.sourceSegmentId]
        ?.kind !== "segment" ||
      !this.segment.pointIds.includes(this.anchorPoint.id) ||
      !this.segment.pointIds.includes(this.constructedEndpoint.id)
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.anchorPoint.id]: this.anchorPoint,
      [this.constructedEndpoint.id]: this.constructedEndpoint,
      [this.segment.id]: this.segment,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.segment.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (
      !document.entities[this.segment.id] &&
      !document.entities[this.constructedEndpoint.id] &&
      !document.entities[this.anchorPoint.id]
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.segment.id];
    delete entities[this.constructedEndpoint.id];
    delete entities[this.anchorPoint.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
