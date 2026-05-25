import type {
  CalculationExpression,
  CalculationReferenceValueKind,
  CalculationResult,
  CalculationUnit,
  CalculationValue,
} from "./CalculationTypes";

export type CalculationReferenceResolver = (
  targetId: string,
  valueKind: CalculationReferenceValueKind,
) => CalculationValue | null;

export interface CalculationGeometryResolver {
  pointDistance(pointAId: string, pointBId: string): CalculationValue | null;
  threePointAngle(
    pointAId: string,
    vertexPointId: string,
    pointCId: string,
  ): CalculationValue | null;
}

const isFiniteValue = (value: CalculationValue): boolean =>
  Number.isFinite(value.value);

const sameUnit = (
  left: CalculationValue,
  right: CalculationValue,
): CalculationUnit | null => (left.unit === right.unit ? left.unit : null);

const invalid = (error: string): CalculationResult => ({ ok: false, error });

const valid = (value: CalculationValue): CalculationResult =>
  isFiniteValue(value) ? { ok: true, value } : invalid("计算结果无效");

const evaluateBinary = (
  op: "add" | "sub" | "mul" | "div",
  left: CalculationValue,
  right: CalculationValue,
): CalculationResult => {
  if (op === "add" || op === "sub") {
    const unit = sameUnit(left, right);

    return unit
      ? valid({
          value: op === "add" ? left.value + right.value : left.value - right.value,
          unit,
        })
      : invalid("单位不兼容");
  }

  if (op === "mul") {
    if (left.unit === "number" && right.unit === "number") {
      return valid({ value: left.value * right.value, unit: "number" });
    }

    if (left.unit === "number" && right.unit !== "number") {
      return valid({ value: left.value * right.value, unit: right.unit });
    }

    if (right.unit === "number" && left.unit !== "number") {
      return valid({ value: left.value * right.value, unit: left.unit });
    }

    return invalid("只能用数值乘以长度或角度");
  }

  if (Math.abs(right.value) <= Number.EPSILON) {
    return invalid("除数不能为 0");
  }

  if (left.unit === "number" && right.unit === "number") {
    return valid({ value: left.value / right.value, unit: "number" });
  }

  if (right.unit === "number") {
    return valid({ value: left.value / right.value, unit: left.unit });
  }

  if (left.unit === right.unit) {
    return valid({ value: left.value / right.value, unit: "number" });
  }

  return invalid("单位不兼容");
};

export const evaluateCalculationExpression = (
  expression: CalculationExpression,
  resolveReference: CalculationReferenceResolver,
  resolveGeometry?: CalculationGeometryResolver,
): CalculationResult => {
  if (expression.kind === "constant") {
    return valid({ value: expression.value, unit: "number" });
  }

  if (expression.kind === "reference") {
    const value = resolveReference(expression.targetId, expression.valueKind);

    return value ? valid(value) : invalid("引用失效");
  }

  if (expression.kind === "pointDistance") {
    const value = resolveGeometry?.pointDistance(
      expression.pointAId,
      expression.pointBId,
    );

    return value ? valid(value) : invalid("引用失效");
  }

  if (expression.kind === "threePointAngle") {
    const value = resolveGeometry?.threePointAngle(
      expression.pointAId,
      expression.vertexPointId,
      expression.pointCId,
    );

    return value ? valid(value) : invalid("角度退化或引用失效");
  }

  if (expression.kind === "unary") {
    const child = evaluateCalculationExpression(
      expression.child,
      resolveReference,
      resolveGeometry,
    );

    if (!child.ok) {
      return child;
    }

    if (child.value.unit !== "angle") {
      return invalid("三角函数只能用于角度");
    }

    const radians = (child.value.value * Math.PI) / 180;
    const value =
      expression.op === "sin"
        ? Math.sin(radians)
        : expression.op === "cos"
          ? Math.cos(radians)
          : Math.tan(radians);

    return valid({ value, unit: "number" });
  }

  const left = evaluateCalculationExpression(
    expression.left,
    resolveReference,
    resolveGeometry,
  );

  if (!left.ok) {
    return left;
  }

  const right = evaluateCalculationExpression(
    expression.right,
    resolveReference,
    resolveGeometry,
  );

  if (!right.ok) {
    return right;
  }

  return evaluateBinary(expression.op, left.value, right.value);
};

export const collectCalculationReferenceIds = (
  expression: CalculationExpression,
): readonly string[] => {
  if (expression.kind === "reference") {
    return [expression.targetId];
  }

  if (expression.kind === "pointDistance") {
    return [expression.pointAId, expression.pointBId];
  }

  if (expression.kind === "threePointAngle") {
    return [
      expression.pointAId,
      expression.vertexPointId,
      expression.pointCId,
    ];
  }

  if (expression.kind === "unary") {
    return collectCalculationReferenceIds(expression.child);
  }

  if (expression.kind === "binary") {
    return [
      ...collectCalculationReferenceIds(expression.left),
      ...collectCalculationReferenceIds(expression.right),
    ];
  }

  return [];
};
