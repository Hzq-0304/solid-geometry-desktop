export const generatePointNames = (
  startName: string,
  count: number,
): readonly string[] => {
  const trimmedName = startName.trim();

  if (count <= 0) {
    return [];
  }

  if (/^[A-Za-z]$/.test(trimmedName)) {
    const startIndex = trimmedName.toUpperCase().charCodeAt(0) - 65;

    return Array.from({ length: count }, (_, index) => {
      const sequenceIndex = startIndex + index;
      const letter = String.fromCharCode(65 + (sequenceIndex % 26));
      const suffix = Math.floor(sequenceIndex / 26);

      return suffix === 0 ? letter : `${letter}${suffix}`;
    });
  }

  const match = /^(.+?)(\d+)$/.exec(trimmedName || "P1");

  if (match) {
    const prefix = match[1];
    const startNumber = Number(match[2]);

    return Array.from({ length: count }, (_, index) =>
      `${prefix}${startNumber + index}`,
    );
  }

  const prefix = trimmedName || "P";

  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
};
