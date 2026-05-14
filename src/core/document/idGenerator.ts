import type { EntityId } from "./EntityTypes";

const ENTITY_ID_PREFIX_PATTERN = /[^a-zA-Z0-9_-]/g;

let fallbackSequence = 0;

const normalizePrefix = (prefix: string): string => {
  const normalized = prefix.trim().replace(ENTITY_ID_PREFIX_PATTERN, "-");
  return normalized.length > 0 ? normalized : "entity";
};

const createFallbackIdPart = (): string => {
  fallbackSequence += 1;

  return [
    Date.now().toString(36),
    fallbackSequence.toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
};

export const createEntityId = (prefix = "entity"): EntityId => {
  const normalizedPrefix = normalizePrefix(prefix);
  const idPart = globalThis.crypto?.randomUUID?.() ?? createFallbackIdPart();

  return `${normalizedPrefix}_${idPart}`;
};
