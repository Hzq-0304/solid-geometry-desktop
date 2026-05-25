import type { BoardDocument } from "../document/BoardDocument";
import type {
  BoardEntity,
  ExtensionEntity,
  PlaneEntity,
  PolygonEntity,
  SegmentEntity,
} from "../document/EntityTypes";
import type { Vec3 } from "../geometry/Vec3";
import {
  addVec3,
  crossVec3,
  dotVec3,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
  vec3Length,
} from "../geometry/geometryUtils";
import { getPlaneFromThreePoints, type PlaneEquation } from "../geometry/planeUtils";
import {
  getPlaneWorldPositions,
  getPointWorldPosition,
  getSegmentWorldPositions,
} from "../geometry/pointPositionUtils";
import {
  projectDirectionToSection2D,
  projectPointToSection2D,
} from "./SectionProjection";
import type {
  SectionLineResult,
  SectionPlane3D,
  SectionPointResult,
  SectionResult,
  SectionSolveOptions,
  SectionSourceRef,
} from "./SectionTypes";

const SECTION_EPSILON = 1e-8;

type SegmentPlaneIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly point: Vec3 }
  | { readonly kind: "contained" };

type PlanePlaneIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "coincident" }
  | { readonly kind: "line"; readonly point: Vec3; readonly direction: Vec3 };

const isVisible = (entity: BoardEntity): boolean => entity.visible !== false;

const getSourceTypeLabel = (entity: BoardEntity): string => {
  switch (entity.kind) {
    case "segment":
      return "3D 线段";
    case "plane":
      return "3D 平面";
    case "polygon":
      return "3D 面";
    case "extension":
      return entity.targetType === "plane" ? "3D 平面延展" : "3D 线段延长";
    default:
      return `3D ${entity.kind}`;
  }
};

const getSourceName = (entity: BoardEntity): string | undefined =>
  entity.name?.trim() || undefined;

const makeSourceRef = (
  entity: BoardEntity,
  options: SectionSolveOptions,
  relation: SectionSourceRef["relation"],
): SectionSourceRef => ({
  sourceDocumentId: options.sourceDocumentId,
  sourceTabId: options.sourceTabId,
  sourceEntityId: entity.id,
  sourceEntityType: getSourceTypeLabel(entity),
  sourceName: getSourceName(entity),
  relation,
});

const sectionPlaneToEquation = (plane: SectionPlane3D): PlaneEquation => ({
  normal: plane.normal,
  point: plane.origin,
  d: -dotVec3(plane.normal, plane.origin),
});

const getPlaneEquationFromPlaneEntity = (
  document: BoardDocument,
  plane: PlaneEntity,
): PlaneEquation | null => {
  const positions = getPlaneWorldPositions(document, plane.pointIds);

  return positions
    ? getPlaneFromThreePoints(positions[0], positions[1], positions[2])
    : null;
};

const getPlaneEquationFromPolygonEntity = (
  document: BoardDocument,
  polygon: PolygonEntity,
): PlaneEquation | null => {
  const points = polygon.pointIds.slice(0, 3).map((pointId) =>
    getPointWorldPosition(document, pointId),
  );

  return points[0] && points[1] && points[2]
    ? getPlaneFromThreePoints(points[0], points[1], points[2])
    : null;
};

const getTargetPlaneEquationForExtension = (
  document: BoardDocument,
  extension: ExtensionEntity,
): PlaneEquation | null => {
  const target = document.entities[extension.targetId];

  if (extension.targetType === "plane" && target?.kind === "plane") {
    return getPlaneEquationFromPlaneEntity(document, target);
  }

  return null;
};

const intersectSegmentWithPlane = (
  a: Vec3,
  b: Vec3,
  plane: PlaneEquation,
): SegmentPlaneIntersection => {
  const da = dotVec3(plane.normal, a) + plane.d;
  const db = dotVec3(plane.normal, b) + plane.d;
  const aOnPlane = Math.abs(da) <= SECTION_EPSILON;
  const bOnPlane = Math.abs(db) <= SECTION_EPSILON;

  if (aOnPlane && bOnPlane) {
    return { kind: "contained" };
  }

  if (!aOnPlane && !bOnPlane && da * db > 0) {
    return { kind: "none" };
  }

  const denominator = da - db;

  if (Math.abs(denominator) <= SECTION_EPSILON) {
    return { kind: "none" };
  }

  const t = da / denominator;

  if (t < -SECTION_EPSILON || t > 1 + SECTION_EPSILON) {
    return { kind: "none" };
  }

  const direction = subtractVec3(b, a);

  return { kind: "point", point: addVec3(a, scaleVec3(direction, t)) };
};

const intersectLineWithPlane = (
  point: Vec3,
  direction: Vec3,
  plane: PlaneEquation,
): SegmentPlaneIntersection => {
  const denominator = dotVec3(plane.normal, direction);
  const signedDistance = dotVec3(plane.normal, point) + plane.d;

  if (Math.abs(denominator) <= SECTION_EPSILON) {
    return Math.abs(signedDistance) <= SECTION_EPSILON
      ? { kind: "contained" }
      : { kind: "none" };
  }

  return {
    kind: "point",
    point: addVec3(point, scaleVec3(direction, -signedDistance / denominator)),
  };
};

const intersectPlaneWithPlane = (
  first: PlaneEquation,
  second: PlaneEquation,
): PlanePlaneIntersection => {
  const direction = crossVec3(first.normal, second.normal);
  const denominator = dotVec3(direction, direction);

  if (denominator <= SECTION_EPSILON * SECTION_EPSILON) {
    const signedDistance = dotVec3(first.normal, second.point) + first.d;

    return Math.abs(signedDistance) <= SECTION_EPSILON
      ? { kind: "coincident" }
      : { kind: "none" };
  }

  const point = scaleVec3(
    addVec3(
      scaleVec3(crossVec3(second.normal, direction), -first.d),
      scaleVec3(crossVec3(direction, first.normal), -second.d),
    ),
    1 / denominator,
  );
  const normalizedDirection = normalizeVec3(direction, SECTION_EPSILON);

  return normalizedDirection
    ? { kind: "line", point, direction: normalizedDirection }
    : { kind: "none" };
};

const pushPointResult = (
  results: SectionResult[],
  options: SectionSolveOptions,
  entity: BoardEntity,
  id: string,
  point: Vec3,
) => {
  results.push({
    id,
    kind: "point",
    position3D: point,
    position2D: projectPointToSection2D(options.sectionPlane, point),
    sourceRef: makeSourceRef(entity, options, "line-plane-intersection-point"),
  } satisfies SectionPointResult);
};

const pushLineResult = (
  results: SectionResult[],
  options: SectionSolveOptions,
  entity: BoardEntity,
  id: string,
  point: Vec3,
  direction: Vec3,
  relation: SectionSourceRef["relation"],
  lineKind: "segment" | "line",
  endPoint?: Vec3,
) => {
  const normalizedDirection = normalizeVec3(direction, SECTION_EPSILON);
  const direction2D = normalizedDirection
    ? projectDirectionToSection2D(options.sectionPlane, normalizedDirection)
    : null;

  if (
    !normalizedDirection ||
    !direction2D ||
    Math.hypot(direction2D.x, direction2D.y) <= SECTION_EPSILON
  ) {
    return;
  }

  results.push({
    id,
    kind: "line",
    point3D: point,
    direction3D: normalizedDirection,
    point2D: projectPointToSection2D(options.sectionPlane, point),
    direction2D,
    sourceRef: makeSourceRef(entity, options, relation),
    lineKind,
    endPoint3D: endPoint,
    endPoint2D: endPoint
      ? projectPointToSection2D(options.sectionPlane, endPoint)
      : undefined,
  } satisfies SectionLineResult);
};

const solveSegmentEntity = (
  document: BoardDocument,
  options: SectionSolveOptions,
  segment: SegmentEntity,
  results: SectionResult[],
) => {
  const positions = getSegmentWorldPositions(document, segment.id);

  if (!positions || vec3Length(subtractVec3(positions[1], positions[0])) <= SECTION_EPSILON) {
    return;
  }

  const intersection = intersectSegmentWithPlane(
    positions[0],
    positions[1],
    sectionPlaneToEquation(options.sectionPlane),
  );

  if (intersection.kind === "point") {
    pushPointResult(results, options, segment, `section-point-${segment.id}`, intersection.point);
  } else if (intersection.kind === "contained") {
    pushLineResult(
      results,
      options,
      segment,
      `section-contained-segment-${segment.id}`,
      positions[0],
      subtractVec3(positions[1], positions[0]),
      "line-contained-in-section-plane",
      "segment",
      positions[1],
    );
  }
};

const solvePlaneLikeEntity = (
  document: BoardDocument,
  options: SectionSolveOptions,
  entity: PlaneEntity | PolygonEntity | ExtensionEntity,
  plane: PlaneEquation | null,
  results: SectionResult[],
) => {
  if (!plane) {
    return;
  }

  const intersection = intersectPlaneWithPlane(
    sectionPlaneToEquation(options.sectionPlane),
    plane,
  );

  if (intersection.kind === "coincident") {
    results.push({
      id: `section-coincident-${entity.id}`,
      kind: "coincidentPlane",
      sourceRef: makeSourceRef(
        entity,
        options,
        "plane-coincident-with-section-plane",
      ),
    });
    return;
  }

  if (intersection.kind !== "line") {
    return;
  }

  pushLineResult(
    results,
    options,
    entity,
    `section-plane-line-${entity.id}`,
    intersection.point,
    intersection.direction,
    entity.kind === "extension"
      ? "face-extension-intersection-line"
      : "plane-plane-intersection-line",
    "line",
  );
};

const solveExtensionEntity = (
  document: BoardDocument,
  options: SectionSolveOptions,
  extension: ExtensionEntity,
  results: SectionResult[],
) => {
  const target = document.entities[extension.targetId];

  if (extension.targetType === "plane") {
    solvePlaneLikeEntity(
      document,
      options,
      extension,
      getTargetPlaneEquationForExtension(document, extension),
      results,
    );
    return;
  }

  if (target?.kind !== "segment") {
    return;
  }

  const positions = getSegmentWorldPositions(document, target.id);

  if (!positions) {
    return;
  }

  const direction = subtractVec3(positions[1], positions[0]);

  if (vec3Length(direction) <= SECTION_EPSILON) {
    return;
  }

  const intersection = intersectLineWithPlane(
    positions[0],
    direction,
    sectionPlaneToEquation(options.sectionPlane),
  );

  if (intersection.kind === "point") {
    pushPointResult(
      results,
      options,
      extension,
      `section-extension-point-${extension.id}`,
      intersection.point,
    );
  } else if (intersection.kind === "contained") {
    pushLineResult(
      results,
      options,
      extension,
      `section-extension-line-${extension.id}`,
      positions[0],
      direction,
      "line-contained-in-section-plane",
      "line",
    );
  }
};

export const solveSection = (
  document: BoardDocument,
  options: SectionSolveOptions,
): readonly SectionResult[] => {
  const results: SectionResult[] = [];

  Object.values(document.entities).forEach((entity) => {
    if (!isVisible(entity)) {
      return;
    }

    if (entity.kind === "segment") {
      solveSegmentEntity(document, options, entity, results);
      return;
    }

    if (entity.kind === "plane") {
      solvePlaneLikeEntity(
        document,
        options,
        entity,
        getPlaneEquationFromPlaneEntity(document, entity),
        results,
      );
      return;
    }

    if (entity.kind === "polygon") {
      solvePlaneLikeEntity(
        document,
        options,
        entity,
        getPlaneEquationFromPolygonEntity(document, entity),
        results,
      );
      return;
    }

    if (entity.kind === "extension") {
      solveExtensionEntity(document, options, entity, results);
    }
  });

  return results;
};
