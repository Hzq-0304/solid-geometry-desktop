import {
  createPlane2DPoint,
  createPlane2DSegment,
  createPlaneCanvasDocument,
} from "../plane2d/planeCanvasUtils";
import type {
  Plane2DEntity,
  Plane2DSectionObjectRef,
  PlaneCanvasDocument,
  Vec2,
} from "../plane2d/PlaneCanvasTypes";
import type {
  SectionDocumentOptions,
  SectionLineResult,
  SectionResult,
} from "./SectionTypes";

const SECTION_LINE_HALF_LENGTH = 20;

const normalizeVec2 = (value: Vec2): Vec2 | null => {
  const length = Math.hypot(value.x, value.y);

  return length <= 1e-8 ? null : { x: value.x / length, y: value.y / length };
};

const makeSectionRef = (
  result: SectionResult,
  overrides: Partial<Plane2DSectionObjectRef> = {},
): Plane2DSectionObjectRef => ({
  kind: "section-object",
  sectionResultId: result.id,
  sourceRef: result.sourceRef,
  ...overrides,
});

const addSectionPoint = (
  entities: Record<string, Plane2DEntity>,
  id: string,
  position: Vec2,
  sectionRef: Plane2DSectionObjectRef,
) => {
  entities[id] = createPlane2DPoint(id, position, {
    locked: true,
    draggable: false,
    pointKind: "free",
    sectionRef,
    nameSource: "auto",
    showName: false,
  });
};

const addSectionLine = (
  entities: Record<string, Plane2DEntity>,
  result: SectionLineResult,
) => {
  const direction =
    result.lineKind === "segment" && result.endPoint2D
      ? normalizeVec2({
          x: result.endPoint2D.x - result.point2D.x,
          y: result.endPoint2D.y - result.point2D.y,
        })
      : normalizeVec2(result.direction2D);

  if (!direction) {
    return;
  }

  const start =
    result.lineKind === "segment"
      ? result.point2D
      : {
          x: result.point2D.x - direction.x * SECTION_LINE_HALF_LENGTH,
          y: result.point2D.y - direction.y * SECTION_LINE_HALF_LENGTH,
        };
  const end =
    result.lineKind === "segment" && result.endPoint2D
      ? result.endPoint2D
      : {
          x: result.point2D.x + direction.x * SECTION_LINE_HALF_LENGTH,
          y: result.point2D.y + direction.y * SECTION_LINE_HALF_LENGTH,
        };
  const sectionRef = makeSectionRef(result, {
    linePoint3D: result.point3D,
    lineDirection3D: result.direction3D,
    lineKind: result.lineKind,
  });
  const startPointId = `${result.id}-start`;
  const endPointId = `${result.id}-end`;
  const segmentId = `${result.id}-segment`;

  addSectionPoint(entities, startPointId, start, sectionRef);
  addSectionPoint(entities, endPointId, end, sectionRef);
  entities[segmentId] = createPlane2DSegment(segmentId, startPointId, endPointId, {
    locked: true,
    draggable: false,
    segmentKind: "constructed",
    sectionRef,
    nameSource: "auto",
    showName: false,
  });
};

export const createPlane2DSectionDocument = (
  options: SectionDocumentOptions,
  results: readonly SectionResult[],
): PlaneCanvasDocument => {
  const now = new Date().toISOString();
  const baseDocument = createPlaneCanvasDocument();
  const entities: Record<string, Plane2DEntity> = {};
  const coincidentPlanes = results
    .filter((result) => result.kind === "coincidentPlane")
    .map((result) => result.sourceRef);

  results.forEach((result) => {
    if (result.kind === "point") {
      addSectionPoint(
        entities,
        result.id,
        result.position2D,
        makeSectionRef(result, {
          position3D: result.position3D,
          lineKind: "point",
        }),
      );
      return;
    }

    if (result.kind === "line") {
      addSectionLine(entities, result);
    }
  });

  return {
    ...baseDocument,
    name: options.title,
    createdAt: now,
    updatedAt: now,
    entities,
    section: {
      kind: "section-from-3d",
      source3DTabId: options.source3DTabId,
      source3DDocumentId: options.source3DDocumentId,
      sourceSectionEntityId: options.sourceSectionEntityId,
      sectionPlane: {
        origin: options.sectionPlane.origin,
        normal: options.sectionPlane.normal,
        u: options.sectionPlane.u,
        v: options.sectionPlane.v,
      },
      coincidentPlanes,
      createdAt: now,
      liveUpdateEnabled: false,
      syncBackEnabled: false,
    },
  };
};
