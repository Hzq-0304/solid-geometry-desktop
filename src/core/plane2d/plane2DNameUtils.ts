import type {
  Plane2DEntity,
  PlaneCanvasDocument,
} from "./PlaneCanvasTypes";

export const normalizePlane2DName = (name: string): string => name.trim();

const isPlane2DNameVisibleOrManual = (entity: Plane2DEntity): boolean =>
  entity.nameSource === "manual" || entity.showName === true;

export const getPlane2DManualName = (
  entity: Plane2DEntity,
): string | null => {
  const normalizedName = normalizePlane2DName(entity.name ?? "");

  if (!normalizedName || !isPlane2DNameVisibleOrManual(entity)) {
    return null;
  }

  return normalizedName;
};

export const findPlane2DNameOwner = (
  document: PlaneCanvasDocument,
  name: string,
  excludeEntityIds: readonly string[] = [],
): Plane2DEntity | null => {
  const normalizedName = normalizePlane2DName(name);

  if (!normalizedName) {
    return null;
  }

  const excludedIds = new Set(excludeEntityIds);

  return (
    Object.values(document.entities).find((entity) => {
      if (excludedIds.has(entity.id)) {
        return false;
      }

      return getPlane2DManualName(entity) === normalizedName;
    }) ?? null
  );
};

export const findDuplicatePlane2DNames = (
  document: PlaneCanvasDocument,
  names: readonly string[],
  excludeEntityIds: readonly string[] = [],
): readonly string[] => {
  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();

  names.forEach((name) => {
    const normalizedName = normalizePlane2DName(name);

    if (!normalizedName) {
      return;
    }

    if (
      seenNames.has(normalizedName) ||
      findPlane2DNameOwner(document, normalizedName, excludeEntityIds)
    ) {
      duplicateNames.add(normalizedName);
    }

    seenNames.add(normalizedName);
  });

  return [...duplicateNames];
};
