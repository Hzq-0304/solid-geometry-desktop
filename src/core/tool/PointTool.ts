import { createEntityId } from "../document/idGenerator";
import type { ToolContext } from "./ToolContext";
import type { PointerInfo, Tool } from "./ToolTypes";

const getNextPointName = (context: ToolContext): string => {
  const pointCount = Object.values(context.getDocument().entities).filter(
    (entity) => entity.kind === "point",
  ).length;

  return `P${pointCount + 1}`;
};

export class PointTool implements Tool {
  readonly name = "point";

  onPointerDown(pointerInfo: PointerInfo, context: ToolContext): void {
    const snapResult =
      pointerInfo.snapResult ??
      (pointerInfo.worldPosition
        ? context.snapPosition(pointerInfo.worldPosition)
        : null);

    if (!snapResult) {
      return;
    }

    context.addPoint(snapResult.position, {
      id: createEntityId("point"),
      name: getNextPointName(context),
      style: { color: "#111111" },
    });
  }
}
