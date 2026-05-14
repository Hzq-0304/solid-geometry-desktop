import type { BoardDocument } from "../document/BoardDocument";
import {
  createDefaultBoardSettings,
  createDefaultCameraState,
} from "../document/createEmptyDocument";
import { PROJECT_FILE_VERSION, type ProjectFile } from "./projectFile";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertBoardDocument = (value: unknown): BoardDocument => {
  if (!isObject(value)) {
    throw new Error("Project document is missing or invalid.");
  }

  if (!isObject(value.entities)) {
    throw new Error("Project document is missing entities.");
  }

  return value as unknown as BoardDocument;
};

export const importProject = (jsonText: string): BoardDocument => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  if (!isObject(parsed)) {
    throw new Error("The selected file is not a Solid Geometry project.");
  }

  const projectFile = parsed as Partial<ProjectFile>;

  if (projectFile.fileVersion !== PROJECT_FILE_VERSION) {
    throw new Error(
      `Unsupported project file version: ${String(projectFile.fileVersion)}`,
    );
  }

  const document = assertBoardDocument(projectFile.document);
  const timestamp = new Date().toISOString();

  return {
    ...document,
    settings: {
      ...createDefaultBoardSettings(),
      ...(isObject(document.settings) ? document.settings : {}),
    },
    cameraState: {
      ...createDefaultCameraState(),
      ...(isObject(document.cameraState) ? document.cameraState : {}),
    },
    selectedEntityIds: [],
    updatedAt: timestamp,
  };
};
