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

export class AddPlanePlaneIntersectionCommand implements Command {
  readonly name = "Add Plane-Plane Intersection";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(
    private readonly startPoint: PointEntity,
    private readonly endPoint: PointEntity,
    private readonly segment: SegmentEntity,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    if (
      document.entities[this.startPoint.id] ||
      document.entities[this.endPoint.id] ||
      document.entities[this.segment.id] ||
      this.startPoint.pointKind !== "constructed" ||
      this.endPoint.pointKind !== "constructed" ||
      this.startPoint.construction?.kind !==
        "planePlaneIntersectionEndpoint" ||
      this.endPoint.construction?.kind !== "planePlaneIntersectionEndpoint" ||
      !this.segment.pointIds.includes(this.startPoint.id) ||
      !this.segment.pointIds.includes(this.endPoint.id)
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.startPoint.id]: this.startPoint,
      [this.endPoint.id]: this.endPoint,
      [this.segment.id]: this.segment,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.segment.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.segment.id];
    delete entities[this.startPoint.id];
    delete entities[this.endPoint.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
