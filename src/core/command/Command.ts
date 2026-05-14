import type { BoardDocument } from "../document/BoardDocument";

export interface Command {
  readonly name: string;
  execute(document: BoardDocument): BoardDocument;
  undo(document: BoardDocument): BoardDocument;
}
