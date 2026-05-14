import type {
  BoardDocument,
  BoardSettings,
} from "../document/BoardDocument";
import type { Command } from "./Command";

const touchDocument = (document: BoardDocument): BoardDocument => ({
  ...document,
  updatedAt: new Date().toISOString(),
});

export class UpdateDocumentSettingsCommand implements Command {
  readonly name = "Update Document Settings";

  private previousSettings: BoardSettings | null = null;

  constructor(private readonly update: Partial<BoardSettings>) {}

  execute(document: BoardDocument): BoardDocument {
    const hasChanges = Object.entries(this.update).some(
      ([key, value]) =>
        document.settings[key as keyof BoardSettings] !== value,
    );

    if (!hasChanges) {
      return document;
    }

    this.previousSettings = document.settings;

    return touchDocument({
      ...document,
      settings: {
        ...document.settings,
        ...this.update,
      },
    });
  }

  undo(document: BoardDocument): BoardDocument {
    if (!this.previousSettings) {
      return document;
    }

    return touchDocument({
      ...document,
      settings: this.previousSettings,
    });
  }
}
