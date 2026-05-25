import type { ReactElement } from "react";
import type { CalculationExpression } from "./CalculationTypes";

interface FormulaViewProps {
  readonly expression: CalculationExpression;
  getReferenceLabel(targetId: string): string;
}

const formatConstant = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export function FormulaView({ expression, getReferenceLabel }: FormulaViewProps) {
  const renderExpression = (node: CalculationExpression): ReactElement => {
    if (node.kind === "constant") {
      return <span className="formula-token">{formatConstant(node.value)}</span>;
    }

    if (node.kind === "reference") {
      return (
        <span className="formula-reference">
          {getReferenceLabel(node.targetId)}
        </span>
      );
    }

    if (node.kind === "pointDistance") {
      return (
        <span className="formula-reference">
          {`|${getReferenceLabel(node.pointAId)}${getReferenceLabel(
            node.pointBId,
          )}|`}
        </span>
      );
    }

    if (node.kind === "threePointAngle") {
      return (
        <span className="formula-reference">
          {`∠${getReferenceLabel(node.pointAId)}${getReferenceLabel(
            node.vertexPointId,
          )}${getReferenceLabel(node.pointCId)}`}
        </span>
      );
    }

    if (node.kind === "unary") {
      return (
        <span className="formula-unary">
          <span>{node.op}</span>
          <span>(</span>
          {renderExpression(node.child)}
          <span>)</span>
        </span>
      );
    }

    if (node.op === "div") {
      return (
        <span className="formula-fraction">
          <span className="formula-numerator">{renderExpression(node.left)}</span>
          <span className="formula-denominator">{renderExpression(node.right)}</span>
        </span>
      );
    }

    const symbol =
      node.op === "add" ? "+" : node.op === "sub" ? "-" : "×";

    return (
      <span className="formula-binary">
        <span>(</span>
        {renderExpression(node.left)}
        <span className="formula-operator">{symbol}</span>
        {renderExpression(node.right)}
        <span>)</span>
      </span>
    );
  };

  return <span className="formula-view">{renderExpression(expression)}</span>;
}

export default FormulaView;
