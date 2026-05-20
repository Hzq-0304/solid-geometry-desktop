import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  PlaneEntity,
  PointEntity,
} from "../document/EntityTypes";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class AddParallelPlaneCommand implements Command {
  readonly name = "Add Parallel Plane";

  private previousSelectedEntityIds: readonly EntityId[] | null = null;

  constructor(
    private readonly anchorPoint: PointEntity,
    private readonly constructedVertices: readonly [PointEntity, PointEntity],
    private readonly plane: PlaneEntity,
  ) {}

  execute(document: BoardDocument): BoardDocument {
    const [firstVertex, secondVertex] = this.constructedVertices;

    if (
      document.entities[this.anchorPoint.id] ||
      document.entities[firstVertex.id] ||
      document.entities[secondVertex.id] ||
      document.entities[this.plane.id] ||
      firstVertex.pointKind !== "constructed" ||
      secondVertex.pointKind !== "constructed" ||
      firstVertex.construction?.kind !== "parallelPlaneVertex" ||
      secondVertex.construction?.kind !== "parallelPlaneVertex" ||
      firstVertex.construction.anchorPointId !== this.anchorPoint.id ||
      secondVertex.construction.anchorPointId !== this.anchorPoint.id ||
      firstVertex.construction.sourcePlaneId !==
        secondVertex.construction.sourcePlaneId ||
      document.entities[firstVertex.construction.sourcePlaneId]?.kind !==
        "plane" ||
      !this.plane.pointIds.includes(this.anchorPoint.id) ||
      !this.plane.pointIds.includes(firstVertex.id) ||
      !this.plane.pointIds.includes(secondVertex.id)
    ) {
      return document;
    }

    this.previousSelectedEntityIds = document.selectedEntityIds;

    const entities: Record<EntityId, BoardEntity> = {
      ...document.entities,
      [this.anchorPoint.id]: this.anchorPoint,
      [firstVertex.id]: firstVertex,
      [secondVertex.id]: secondVertex,
      [this.plane.id]: this.plane,
    };

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds: [this.plane.id],
    });
  }

  undo(document: BoardDocument): BoardDocument {
    const [firstVertex, secondVertex] = this.constructedVertices;

    if (
      !document.entities[this.plane.id] &&
      !document.entities[firstVertex.id] &&
      !document.entities[secondVertex.id] &&
      !document.entities[this.anchorPoint.id]
    ) {
      return document;
    }

    const entities: Record<EntityId, BoardEntity> = { ...document.entities };
    delete entities[this.plane.id];
    delete entities[firstVertex.id];
    delete entities[secondVertex.id];
    delete entities[this.anchorPoint.id];

    return touchDocument({
      ...document,
      entities,
      selectedEntityIds:
        this.previousSelectedEntityIds ?? document.selectedEntityIds,
    });
  }
}
