export type CalculationUnit = "number" | "length" | "angle";

export type CalculationReferenceValueKind = "length" | "angle" | "measurement";

export type CalculationExpression =
  | {
      readonly kind: "constant";
      readonly value: number;
    }
  | {
      readonly kind: "reference";
      readonly targetId: string;
      readonly valueKind: CalculationReferenceValueKind;
    }
  | {
      readonly kind: "pointDistance";
      readonly pointAId: string;
      readonly pointBId: string;
    }
  | {
      readonly kind: "threePointAngle";
      readonly pointAId: string;
      readonly vertexPointId: string;
      readonly pointCId: string;
    }
  | {
      readonly kind: "unary";
      readonly op: "sin" | "cos" | "tan";
      readonly child: CalculationExpression;
    }
  | {
      readonly kind: "binary";
      readonly op: "add" | "sub" | "mul" | "div";
      readonly left: CalculationExpression;
      readonly right: CalculationExpression;
    };

export interface CalculationValue {
  readonly value: number;
  readonly unit: CalculationUnit;
}

export type CalculationResult =
  | {
      readonly ok: true;
      readonly value: CalculationValue;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };
