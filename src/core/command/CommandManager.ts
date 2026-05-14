import type { BoardDocument } from "../document/BoardDocument";
import type { Command } from "./Command";

export class CommandManager {
  private currentDocument: BoardDocument;
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  constructor(initialDocument: BoardDocument) {
    this.currentDocument = initialDocument;
  }

  getDocument(): BoardDocument {
    return this.currentDocument;
  }

  execute(command: Command): BoardDocument {
    const nextDocument = command.execute(this.currentDocument);

    if (nextDocument === this.currentDocument) {
      return this.currentDocument;
    }

    this.currentDocument = nextDocument;
    this.undoStack.push(command);
    this.redoStack.length = 0;

    return this.currentDocument;
  }

  undo(): BoardDocument {
    const command = this.undoStack.pop();

    if (!command) {
      return this.currentDocument;
    }

    this.currentDocument = command.undo(this.currentDocument);
    this.redoStack.push(command);

    return this.currentDocument;
  }

  redo(): BoardDocument {
    const command = this.redoStack.pop();

    if (!command) {
      return this.currentDocument;
    }

    this.currentDocument = command.execute(this.currentDocument);
    this.undoStack.push(command);

    return this.currentDocument;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoStack(): readonly Command[] {
    return [...this.undoStack];
  }

  getRedoStack(): readonly Command[] {
    return [...this.redoStack];
  }
}
