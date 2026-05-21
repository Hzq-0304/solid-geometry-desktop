import type { BoardDocument } from "../document/BoardDocument";

export const PROJECT_FILE_VERSION = 1;
export const PROJECT_APP_NAME = "Solid Geometry Studio";
export const PROJECT_APP_VERSION = "1.2.2";

export interface ProjectFile {
  readonly fileVersion: number;
  readonly appName: string;
  readonly appVersion: string;
  readonly savedAt: string;
  readonly document: BoardDocument;
}
