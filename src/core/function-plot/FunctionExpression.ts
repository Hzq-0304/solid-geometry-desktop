import { Parser } from "expr-eval";

import type { FunctionVariableName } from "./FunctionPlotTypes";

export type CompiledFunctionExpression = {
  readonly ok: true;
  readonly expression: string;
  readonly variables: readonly FunctionVariableName[];
  evaluate(variables: Record<FunctionVariableName, number>): number;
};

export type FunctionExpressionError = {
  readonly ok: false;
  readonly error: string;
};

export type FunctionExpressionResult =
  | CompiledFunctionExpression
  | FunctionExpressionError;

const parser = new Parser({
  operators: {
    assignment: false,
    comparison: false,
    conditional: false,
    in: false,
    logical: false,
  },
});

export const parseFunctionExpression = (
  expression: string,
  allowedVariables: readonly FunctionVariableName[],
): FunctionExpressionResult => {
  const normalizedExpression = expression.trim();

  if (!normalizedExpression) {
    return { ok: false, error: "表达式不能为空。" };
  }

  try {
    const parsedExpression = parser.parse(normalizedExpression);
    const usedVariables = parsedExpression.variables();
    const unknownVariable = usedVariables.find(
      (variable) => !allowedVariables.includes(variable as FunctionVariableName),
    );

    if (unknownVariable) {
      return {
        ok: false,
        error: `不支持的变量：${unknownVariable}。`,
      };
    }

    return {
      ok: true,
      expression: normalizedExpression,
      variables: usedVariables as FunctionVariableName[],
      evaluate: (variables) => {
        const value = parsedExpression.evaluate(variables);

        return typeof value === "number" ? value : Number.NaN;
      },
    };
  } catch {
    return { ok: false, error: "表达式错误，无法解析。" };
  }
};
