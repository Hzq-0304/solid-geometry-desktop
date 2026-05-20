import type { BoardDocument } from "../document/BoardDocument";
import type { Command } from "./Command";

export class CompositeCommand implements Command {
  constructor(
    readonly name: string,
    private readonly commands: readonly Command[],
  ) {}

  execute(document: BoardDocument): BoardDocument {
    return this.commands.reduce(
      (currentDocument, command) => command.execute(currentDocument),
      document,
    );
  }

  undo(document: BoardDocument): BoardDocument {
    return [...this.commands]
      .reverse()
      .reduce(
        (currentDocument, command) => command.undo(currentDocument),
        document,
      );
  }
}
