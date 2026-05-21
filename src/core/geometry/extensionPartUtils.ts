import type { BoardDocument } from "../document/BoardDocument";
import type {
  EntityId,
  ExtensionEntity,
  LinePlanePerpendicularEntity,
  PerpendicularLineEntity,
} from "../document/EntityTypes";
import { projectPointToLine } from "./geometryUtils";
import { calculateLinePlanePerpendicular } from "./linePlanePerpendicularUtils";
import {
  getPointWorldPosition,
  getSegmentWorldPositions,
} from "./pointPositionUtils";

export type ExtensionPartKind =
  | "manualSegmentExtension"
  | "manualPlaneExtension"
  | "perpendicularLineTargetExtension"
  | "linePlanePerpendicularPlaneExtension";

export type ExtensionPartSourceEntityType =
  | "extension"
  | "perpendicularLine"
  | "linePlanePerpendicular";

export interface ExtensionPartInfo {
  readonly id: string;
  readonly kind: ExtensionPartKind;
  readonly ownerEntityId: EntityId;
  readonly ownerEntityType: "segment" | "plane";
  readonly sourceEntityId: EntityId;
  readonly sourceEntityType: ExtensionPartSourceEntityType;
  readonly label: string;
  readonly visible: boolean;
  readonly canSnap: boolean;
}

const isExtensionVisible = (extension: ExtensionEntity): boolean =>
  extension.visible !== false;

const isHelperVisible = (
  entity: PerpendicularLineEntity | LinePlanePerpendicularEntity,
): boolean => entity.style?.showExtensionHelper !== false;

const getEntityDisplayName = (
  entity: {
    readonly id: EntityId;
    readonly name?: string;
    readonly nameSource?: "auto" | "manual";
  },
): string => entity.name?.trim() || entity.id;

const hasPerpendicularLineTargetExtension = (
  perpendicularLine: PerpendicularLineEntity,
  document: BoardDocument,
): boolean => {
  if (perpendicularLine.constructionMode === "userDirection") {
    return false;
  }

  const sourcePointPosition = getPointWorldPosition(
    document,
    perpendicularLine.pointId,
  );
  const segmentPositions = getSegmentWorldPositions(
    document,
    perpendicularLine.segmentId,
  );

  if (!sourcePointPosition || !segmentPositions) {
    return false;
  }

  const projection = projectPointToLine(
    sourcePointPosition,
    segmentPositions[0],
    segmentPositions[1],
  );

  return Boolean(projection && (projection.t < 0 || projection.t > 1));
};

const hasLinePlanePerpendicularPlaneExtension = (
  linePlanePerpendicular: LinePlanePerpendicularEntity,
  document: BoardDocument,
): boolean => {
  if (linePlanePerpendicular.constructionMode === "userDirection") {
    return false;
  }

  const point = document.entities[linePlanePerpendicular.pointId];
  const plane = document.entities[linePlanePerpendicular.planeId];

  if (point?.kind !== "point" || plane?.kind !== "plane") {
    return false;
  }

  const projection = calculateLinePlanePerpendicular(point, plane, document);

  return Boolean(projection && !projection.isFootInTriangle);
};

export const getExtensionPartsForEntity = (
  entityId: EntityId,
  document: BoardDocument,
): readonly ExtensionPartInfo[] => {
  const owner = document.entities[entityId];

  if (owner?.kind !== "segment" && owner?.kind !== "plane") {
    return [];
  }

  const parts: ExtensionPartInfo[] = [];

  for (const entity of Object.values(document.entities)) {
    if (
      entity.kind === "extension" &&
      entity.targetId === owner.id &&
      entity.targetType === owner.kind
    ) {
      const visible = isExtensionVisible(entity);

      parts.push({
        id: `extension:${entity.id}`,
        kind:
          owner.kind === "segment"
            ? "manualSegmentExtension"
            : "manualPlaneExtension",
        ownerEntityId: owner.id,
        ownerEntityType: owner.kind,
        sourceEntityId: entity.id,
        sourceEntityType: "extension",
        label:
          owner.kind === "segment"
            ? "手动延长到坐标边界"
            : "手动延展到坐标边界",
        visible,
        canSnap: visible && entity.snapEnabled !== false,
      });
    }

    if (
      owner.kind === "segment" &&
      entity.kind === "perpendicularLine" &&
      entity.segmentId === owner.id &&
      hasPerpendicularLineTargetExtension(entity, document)
    ) {
      const visible = isHelperVisible(entity);

      parts.push({
        id: `perpendicularLine:${entity.id}`,
        kind: "perpendicularLineTargetExtension",
        ownerEntityId: owner.id,
        ownerEntityType: "segment",
        sourceEntityId: entity.id,
        sourceEntityType: "perpendicularLine",
        label: `垂线 ${getEntityDisplayName(entity)} 的目标线延长`,
        visible,
        canSnap: false,
      });
    }

    if (
      owner.kind === "plane" &&
      entity.kind === "linePlanePerpendicular" &&
      entity.planeId === owner.id &&
      hasLinePlanePerpendicularPlaneExtension(entity, document)
    ) {
      const visible = isHelperVisible(entity);

      parts.push({
        id: `linePlanePerpendicular:${entity.id}`,
        kind: "linePlanePerpendicularPlaneExtension",
        ownerEntityId: owner.id,
        ownerEntityType: "plane",
        sourceEntityId: entity.id,
        sourceEntityType: "linePlanePerpendicular",
        label: `线面垂直 ${getEntityDisplayName(entity)} 的辅助延展`,
        visible,
        canSnap: false,
      });
    }
  }

  return parts;
};
