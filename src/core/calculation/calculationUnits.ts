import type { CalculationValue } from "./CalculationTypes";

export const formatCalculationValue = (value: CalculationValue): string => {
  const formatted = value.value.toFixed(2);

  if (value.unit === "angle") {
    return `${formatted}°`;
  }

  return formatted;
};
