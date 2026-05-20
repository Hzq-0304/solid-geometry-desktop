import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  EntityId,
  LinePlanePerpendicularEntity,
  PerpendicularLineEntity,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import {
  distanceBetweenVec3,
  dotVec3,
  projectPointToLine,
  subtractVec3,
  vec3Length,
} from "./geometryUtils";
import { calculateLinePlanePerpendicular } from "./linePlanePerpendicularUtils";
import { getPlaneFromThreePoints } from "./planeUtils";
import {
  getPlaneWorldPositions,
  getPointWorldPosition,
  getSegmentWorldPositions,
} from "./pointPositionUtils";

export interface ObjectInspectorInfo {
  readonly title: string;
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly lists?: readonly {
    readonly label: string;
    readonly items: readonly string[];
    readonly emptyText: string;
  }[];
}

const EPSILON = 1e-6;

const formatNumber = (value: number): string => {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value;

  return rounded.toFixed(3);
};

const formatVec3 = (position: { readonly x: number; readonly y: number; readonly z: number } | null): string =>
  position
    ? `(${formatNumber(position.x)}, ${formatNumber(position.y)}, ${formatNumber(position.z)})`
    : "invalid";

const getEntity = (
  document: BoardDocument,
  entityId: EntityId,
): BoardEntity | null => document.entities[entityId] ?? null;

const getPoint = (
  document: BoardDocument,
  pointId: EntityId,
): PointEntity | null => {
  const entity = document.entities[pointId];

  return entity?.kind === "point" ? entity : null;
};

const getSegment = (
  document: BoardDocument,
  segmentId: EntityId,
): SegmentEntity | null => {
  const entity = document.entities[segmentId];

  return entity?.kind === "segment" ? entity : null;
};

const getPlane = (
  document: BoardDocument,
  planeId: EntityId,
): PlaneEntity | null => {
  const entity = document.entities[planeId];

  return entity?.kind === "plane" ? entity : null;
};

const compactName = (name: string): string => {
  const trimmed = name.trim();
  const match = /([A-Za-z0-9]+)$/.exec(trimmed);

  return match?.[1] ?? trimmed;
};

export const getPointDisplayName = (
  document: BoardDocument,
  pointId: EntityId,
): string => {
  const point = getPoint(document, pointId);

  return point?.name?.trim() || pointId;
};

export const getSegmentDisplayName = (
  document: BoardDocument,
  segmentId: EntityId,
): string => {
  const segment = getSegment(document, segmentId);

  if (!segment) {
    return segmentId;
  }

  if (segment.nameSource === "manual" && segment.name?.trim()) {
    return segment.name.trim();
  }

  return `${compactName(getPointDisplayName(document, segment.pointIds[0]))}${compactName(
    getPointDisplayName(document, segment.pointIds[1]),
  )}`;
};

export const getPlaneDisplayName = (
  document: BoardDocument,
  planeId: EntityId,
): string => {
  const plane = getPlane(document, planeId);

  if (!plane) {
    return planeId;
  }

  if (plane.nameSource === "manual" && plane.name?.trim()) {
    return plane.name.trim();
  }

  return plane.pointIds
    .map((pointId) => compactName(getPointDisplayName(document, pointId)))
    .join("");
};

const getPerpendicularLabel = (
  document: BoardDocument,
  perpendicular:
    | PerpendicularLineEntity
    | LinePlanePerpendicularEntity,
): string => {
  if (perpendicular.nameSource === "manual" && perpendicular.name?.trim()) {
    return perpendicular.name.trim();
  }

  const endPointId =
    perpendicular.footPointId ?? perpendicular.directionPointId ?? "";

  return `${compactName(getPointDisplayName(document, perpendicular.pointId))}${compactName(
    endPointId ? getPointDisplayName(document, endPointId) : "?",
  )}`;
};

const getPointInfo = (
  point: PointEntity,
  document: BoardDocument,
): ObjectInspectorInfo => {
  const position = getPointWorldPosition(document, point.id);
  const rows = [
    {
      label: "类型",
      value: point.pointKind === "constructed" ? "构造点" : "点",
    },
    { label: "当前坐标", value: formatVec3(position) },
  ];

  if (!point.construction) {
    return {
      title: "点",
      rows: [...rows, { label: "构造方式", value: "自由点" }],
    };
  }

  if (point.construction.kind === "midpoint") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "中点" },
        { label: "点 1", value: getPointDisplayName(document, point.construction.pointAId) },
        { label: "点 2", value: getPointDisplayName(document, point.construction.pointBId) },
      ],
    };
  }

  if (point.construction.kind === "footToLine") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "点到线垂足" },
        { label: "源点", value: getPointDisplayName(document, point.construction.sourcePointId) },
        {
          label: "目标线段",
          value: getSegmentDisplayName(document, point.construction.targetSegmentId),
        },
      ],
    };
  }

  if (point.construction.kind === "footToPlane") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "点到平面垂足" },
        { label: "源点", value: getPointDisplayName(document, point.construction.sourcePointId) },
        {
          label: "目标平面",
          value: `平面 ${getPlaneDisplayName(document, point.construction.targetPlaneId)}`,
        },
      ],
    };
  }

  if (point.construction.kind === "perpendicularDirectionToLine") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "垂线方向点" },
        { label: "源点", value: getPointDisplayName(document, point.construction.sourcePointId) },
        {
          label: "目标线段",
          value: getSegmentDisplayName(document, point.construction.targetSegmentId),
        },
      ],
    };
  }

  if (point.construction.kind === "parallelSegmentEndpoint") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "平行线段端点" },
        {
          label: "依赖线段",
          value: getSegmentDisplayName(
            document,
            point.construction.sourceSegmentId,
          ),
        },
        {
          label: "固定端点",
          value: getPointDisplayName(
            document,
            point.construction.anchorPointId,
          ),
        },
      ],
    };
  }

  if (point.construction.kind === "parallelPlaneVertex") {
    return {
      title: "构造点",
      rows: [
        ...rows,
        { label: "构造方式", value: "平行平面顶点" },
        {
          label: "依赖平面",
          value: `平面 ${getPlaneDisplayName(
            document,
            point.construction.sourcePlaneId,
          )}`,
        },
        {
          label: "固定顶点",
          value: getPointDisplayName(
            document,
            point.construction.anchorPointId,
          ),
        },
      ],
    };
  }

  return {
    title: "构造点",
    rows: [
      ...rows,
      { label: "构造方式", value: "法线方向点" },
      { label: "源点", value: getPointDisplayName(document, point.construction.sourcePointId) },
      {
        label: "目标平面",
        value: `平面 ${getPlaneDisplayName(document, point.construction.targetPlaneId)}`,
      },
      {
        label: "方向",
        value: point.construction.sign > 0 ? "正向" : "反向",
      },
      { label: "长度", value: formatNumber(point.construction.length) },
    ],
  };
};

const getSegmentInfo = (
  segment: SegmentEntity,
  document: BoardDocument,
): ObjectInspectorInfo => {
  const positions = getSegmentWorldPositions(document, segment.id);
  const direction = positions ? subtractVec3(positions[1], positions[0]) : null;
  const perpendiculars = Object.values(document.entities)
    .filter(
      (entity): entity is PerpendicularLineEntity =>
        entity.kind === "perpendicularLine" &&
        entity.segmentId === segment.id &&
        entity.visible,
    )
    .map((perpendicular) => {
      const endPointId =
        perpendicular.footPointId ?? perpendicular.directionPointId ?? "";

      return `${getPerpendicularLabel(
        document,
        perpendicular,
      )}，过 ${getPointDisplayName(document, perpendicular.pointId)}，${
        perpendicular.constructionMode === "userDirection" ? "方向点" : "垂足"
      } ${endPointId ? getPointDisplayName(document, endPointId) : "invalid"}`;
    });

  return {
    title: "线段",
    rows: [
      { label: "类型", value: "线段" },
      {
        label: "端点",
        value: segment.pointIds.map((pointId) => getPointDisplayName(document, pointId)).join(", "),
      },
      {
        label: "长度",
        value: positions ? formatNumber(vec3Length(direction ?? { x: 0, y: 0, z: 0 })) : "invalid",
      },
      { label: "方向向量", value: formatVec3(direction) },
    ],
    lists: [
      {
        label: "垂线",
        items: perpendiculars,
        emptyText: "暂无构造垂线",
      },
    ],
  };
};

const getPlaneInfo = (
  plane: PlaneEntity,
  document: BoardDocument,
): ObjectInspectorInfo => {
  const positions = getPlaneWorldPositions(document, plane.pointIds);
  const planeEquation = positions
    ? getPlaneFromThreePoints(positions[0], positions[1], positions[2])
    : null;
  const normals = Object.values(document.entities)
    .filter(
      (entity): entity is LinePlanePerpendicularEntity =>
        entity.kind === "linePlanePerpendicular" &&
        entity.planeId === plane.id &&
        entity.visible,
    )
    .map((perpendicular) => {
      const endPointId =
        perpendicular.footPointId ?? perpendicular.directionPointId ?? "";

      return `${getPerpendicularLabel(
        document,
        perpendicular,
      )}，过 ${getPointDisplayName(document, perpendicular.pointId)}，${
        perpendicular.constructionMode === "userDirection" ? "方向点" : "垂足"
      } ${endPointId ? getPointDisplayName(document, endPointId) : "invalid"}`;
    });

  return {
    title: "平面",
    rows: [
      { label: "类型", value: "平面" },
      {
        label: "定义点",
        value: plane.pointIds.map((pointId) => getPointDisplayName(document, pointId)).join(", "),
      },
      {
        label: "法向量",
        value: planeEquation ? `n = ${formatVec3(planeEquation.normal)}` : "invalid",
      },
      {
        label: "平面方程",
        value: planeEquation
          ? `${formatNumber(planeEquation.normal.x)}x + ${formatNumber(
              planeEquation.normal.y,
            )}y + ${formatNumber(planeEquation.normal.z)}z + ${formatNumber(
              planeEquation.d,
            )} = 0`
          : "invalid",
      },
      {
        label: "状态",
        value: positions ? (planeEquation ? "有效" : "三点共线，平面无效") : "依赖点缺失",
      },
    ],
    lists: [
      {
        label: "法线",
        items: normals,
        emptyText: "暂无法线构造",
      },
    ],
  };
};

const getPerpendicularLineStatus = (
  perpendicular: PerpendicularLineEntity,
  document: BoardDocument,
): string => {
  const sourcePosition = getPointWorldPosition(document, perpendicular.pointId);
  const segmentPositions = getSegmentWorldPositions(document, perpendicular.segmentId);

  if (!sourcePosition || !segmentPositions) {
    return "依赖缺失";
  }

  if (perpendicular.constructionMode === "userDirection") {
    return perpendicular.directionPointId ? "有效" : "方向点缺失";
  }

  const projection = projectPointToLine(sourcePosition, segmentPositions[0], segmentPositions[1]);

  if (!projection) {
    return "目标线段退化";
  }

  return distanceBetweenVec3(sourcePosition, projection.foot) < EPSILON
    ? "点已在线上"
    : "有效";
};

const getPerpendicularInfo = (
  perpendicular: PerpendicularLineEntity,
  document: BoardDocument,
): ObjectInspectorInfo => {
  const endPointId =
    perpendicular.footPointId ?? perpendicular.directionPointId ?? "";

  return {
    title: "点到线垂线",
    rows: [
      { label: "类型", value: "点到线垂线" },
      { label: "过点", value: getPointDisplayName(document, perpendicular.pointId) },
      { label: "目标线段", value: getSegmentDisplayName(document, perpendicular.segmentId) },
      {
        label: perpendicular.constructionMode === "userDirection" ? "方向点" : "垂足",
        value: endPointId ? getPointDisplayName(document, endPointId) : "invalid",
      },
      { label: "状态", value: getPerpendicularLineStatus(perpendicular, document) },
    ],
  };
};

const getLinePlanePerpendicularStatus = (
  perpendicular: LinePlanePerpendicularEntity,
  document: BoardDocument,
): string => {
  const point = getPoint(document, perpendicular.pointId);
  const plane = getPlane(document, perpendicular.planeId);
  const projection =
    point && plane ? calculateLinePlanePerpendicular(point, plane, document) : null;

  if (!point || !plane) {
    return "依赖缺失";
  }

  if (perpendicular.constructionMode === "userDirection") {
    return perpendicular.directionPointId ? "有效" : "方向点缺失";
  }

  if (!projection) {
    return "平面无效";
  }

  return distanceBetweenVec3(projection.point, projection.foot) < EPSILON
    ? "点已在平面上"
    : "有效";
};

const getLinePlanePerpendicularInfo = (
  perpendicular: LinePlanePerpendicularEntity,
  document: BoardDocument,
): ObjectInspectorInfo => {
  const endPointId =
    perpendicular.footPointId ?? perpendicular.directionPointId ?? "";

  return {
    title: "线面垂直",
    rows: [
      { label: "类型", value: "线面垂直" },
      { label: "过点", value: getPointDisplayName(document, perpendicular.pointId) },
      {
        label: "目标平面",
        value: `平面 ${getPlaneDisplayName(document, perpendicular.planeId)}`,
      },
      {
        label: perpendicular.constructionMode === "userDirection" ? "方向点" : "垂足",
        value: endPointId ? getPointDisplayName(document, endPointId) : "invalid",
      },
      { label: "状态", value: getLinePlanePerpendicularStatus(perpendicular, document) },
    ],
  };
};

export const getObjectInspectorInfo = (
  entityId: EntityId,
  document: BoardDocument,
): ObjectInspectorInfo | null => {
  const entity = getEntity(document, entityId);

  if (!entity) {
    return null;
  }

  switch (entity.kind) {
    case "point":
      return getPointInfo(entity, document);
    case "segment":
      return getSegmentInfo(entity, document);
    case "plane":
      return getPlaneInfo(entity, document);
    case "perpendicularLine":
      return getPerpendicularInfo(entity, document);
    case "linePlanePerpendicular":
      return getLinePlanePerpendicularInfo(entity, document);
    default:
      return {
        title: entity.kind,
        rows: [{ label: "类型", value: entity.kind }],
      };
  }
};
