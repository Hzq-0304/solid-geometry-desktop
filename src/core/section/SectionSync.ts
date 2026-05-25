import type { BoardDocument } from "../document/BoardDocument";
import type { PlaneCanvasDocument } from "../plane2d/PlaneCanvasTypes";
import { createPlane2DSectionDocument } from "./SectionDocument";
import { solveSection } from "./SectionSolver";

export const refreshSection2DFrom3D = (args: {
  readonly sectionDocument: PlaneCanvasDocument;
  readonly sourceDocument: BoardDocument;
}): PlaneCanvasDocument => {
  const section = args.sectionDocument.section;

  if (section?.kind !== "section-from-3d") {
    return args.sectionDocument;
  }

  const sectionPlane = section.sectionPlane;
  const results = solveSection(args.sourceDocument, {
    sectionPlane,
    sourceDocumentId: section.source3DDocumentId ?? args.sourceDocument.id,
    sourceTabId: section.source3DTabId,
  });

  return createPlane2DSectionDocument(
    {
      title: args.sectionDocument.name,
      source3DTabId: section.source3DTabId,
      source3DDocumentId: section.source3DDocumentId,
      sourceSectionEntityId: section.sourceSectionEntityId,
      sectionPlane,
    },
    results,
  );
};

export const applySection2DChangesTo3D = (_args: {
  readonly sectionDocument: PlaneCanvasDocument;
  readonly sourceDocument: BoardDocument;
}): { readonly ok: false; readonly reason: "notImplemented" } => ({
  ok: false,
  reason: "notImplemented",
});
