import type { PlaneCanvasDocument } from "./PlaneCanvasTypes";

export type Plane2DHistoryMode = "record" | "silent" | "commit";

export interface Plane2DDocumentChangeOptions {
  readonly history?: Plane2DHistoryMode;
  readonly label?: string;
  readonly before?: PlaneCanvasDocument;
}

export interface Plane2DHistoryEntry {
  readonly label: string;
  readonly before: PlaneCanvasDocument;
  readonly after: PlaneCanvasDocument;
}

export interface Plane2DHistoryState {
  readonly undoStack: readonly Plane2DHistoryEntry[];
  readonly redoStack: readonly Plane2DHistoryEntry[];
}

const HISTORY_LIMIT = 100;

export const createPlane2DHistoryState = (): Plane2DHistoryState => ({
  undoStack: [],
  redoStack: [],
});

export const clonePlaneCanvasDocument = (
  document: PlaneCanvasDocument,
): PlaneCanvasDocument => {
  if (typeof structuredClone === "function") {
    return structuredClone(document);
  }

  return JSON.parse(JSON.stringify(document)) as PlaneCanvasDocument;
};

const snapshotPlaneCanvasDocument = (
  document: PlaneCanvasDocument,
): PlaneCanvasDocument => ({
  ...clonePlaneCanvasDocument(document),
  selectedEntityIds: [],
});

export const arePlaneCanvasDocumentsEqual = (
  left: PlaneCanvasDocument,
  right: PlaneCanvasDocument,
): boolean =>
  JSON.stringify(snapshotPlaneCanvasDocument(left)) ===
  JSON.stringify(snapshotPlaneCanvasDocument(right));

export const pushPlane2DHistoryEntry = (
  history: Plane2DHistoryState,
  label: string,
  before: PlaneCanvasDocument,
  after: PlaneCanvasDocument,
): Plane2DHistoryState => {
  if (arePlaneCanvasDocumentsEqual(before, after)) {
    return history;
  }

  const entry: Plane2DHistoryEntry = {
    label,
    before: snapshotPlaneCanvasDocument(before),
    after: snapshotPlaneCanvasDocument(after),
  };
  const undoStack = [...history.undoStack, entry].slice(-HISTORY_LIMIT);

  return {
    undoStack,
    redoStack: [],
  };
};

export const undoPlane2DHistory = (
  history: Plane2DHistoryState,
): {
  readonly history: Plane2DHistoryState;
  readonly document: PlaneCanvasDocument | null;
} => {
  const entry = history.undoStack[history.undoStack.length - 1];

  if (!entry) {
    return { history, document: null };
  }

  return {
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, entry],
    },
    document: clonePlaneCanvasDocument(entry.before),
  };
};

export const redoPlane2DHistory = (
  history: Plane2DHistoryState,
): {
  readonly history: Plane2DHistoryState;
  readonly document: PlaneCanvasDocument | null;
} => {
  const entry = history.redoStack[history.redoStack.length - 1];

  if (!entry) {
    return { history, document: null };
  }

  return {
    history: {
      undoStack: [...history.undoStack, entry],
      redoStack: history.redoStack.slice(0, -1),
    },
    document: clonePlaneCanvasDocument(entry.after),
  };
};
