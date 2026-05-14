import type { BoardDocument } from "../document/BoardDocument";
import {
  PROJECT_APP_NAME,
  PROJECT_APP_VERSION,
  PROJECT_FILE_VERSION,
  type ProjectFile,
} from "./projectFile";

export const exportProject = (document: BoardDocument): string => {
  const projectFile: ProjectFile = {
    fileVersion: PROJECT_FILE_VERSION,
    appName: PROJECT_APP_NAME,
    appVersion: PROJECT_APP_VERSION,
    savedAt: new Date().toISOString(),
    document,
  };

  return JSON.stringify(projectFile, null, 2);
};
