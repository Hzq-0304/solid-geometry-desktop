import FormulaView from "../core/calculation/FormulaView";
import type { CalculationValue } from "../core/calculation/CalculationTypes";
import { evaluateCalculationExpression } from "../core/calculation/calculationEvaluator";
import { formatCalculationValue } from "../core/calculation/calculationUnits";
import type { BoardDocument } from "../core/document/BoardDocument";
import type {
  CalculationEntity,
  EntityId,
  MeasurementEntity,
} from "../core/document/EntityTypes";
import {
  distanceBetweenVec3,
  dotVec3,
  subtractVec3,
} from "../core/geometry/geometryUtils";
import {
  calculateMeasurementValue,
  formatMeasurementText,
  getSegmentLengthById,
} from "../core/geometry/measurementUtils";
import { getPointWorldPosition } from "../core/geometry/pointPositionUtils";

export interface ProjectedObjectLabel {
  readonly id: EntityId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly selected: boolean;
}

interface GeometryOverlayProps {
  readonly document: BoardDocument;
  readonly objectLabels: readonly ProjectedObjectLabel[];
  readonly preselectedEntityId: EntityId | null;
  onMeasurementPointerDown(entityId: EntityId, additive: boolean): void;
  onMeasurementPointerEnter(entityId: EntityId): void;
  onMeasurementPointerLeave(entityId: EntityId): void;
}

const getMeasurements = (document: BoardDocument): readonly MeasurementEntity[] =>
  Object.values(document.entities).filter(
    (entity): entity is MeasurementEntity =>
      entity.kind === "measurement" && entity.visible,
  );

const getCalculations = (document: BoardDocument): readonly CalculationEntity[] =>
  Object.values(document.entities).filter(
    (entity): entity is CalculationEntity =>
      entity.kind === "calculation" && entity.visible,
  );

const resolveBoardCalculationReference = (
  document: BoardDocument,
  targetId: string,
): CalculationValue | null => {
  const entity = document.entities[targetId];

  if (entity?.kind === "segment") {
    const value = getSegmentLengthById(document, targetId);

    return value === null ? null : { value, unit: "length" };
  }

  if (entity?.kind === "measurement") {
    const value = calculateMeasurementValue(entity, document);

    if (!value) {
      return null;
    }

    return {
      value: value.value,
      unit: value.unit === "deg" ? "angle" : "length",
    };
  }

  return null;
};

const resolveBoardCalculationGeometry = (document: BoardDocument) => ({
  pointDistance: (pointAId: string, pointBId: string): CalculationValue | null => {
    const pointA = getPointWorldPosition(document, pointAId);
    const pointB = getPointWorldPosition(document, pointBId);

    return pointA && pointB
      ? { value: distanceBetweenVec3(pointA, pointB), unit: "length" }
      : null;
  },
  threePointAngle: (
    pointAId: string,
    vertexPointId: string,
    pointCId: string,
  ): CalculationValue | null => {
    const pointA = getPointWorldPosition(document, pointAId);
    const vertex = getPointWorldPosition(document, vertexPointId);
    const pointC = getPointWorldPosition(document, pointCId);

    if (!pointA || !vertex || !pointC) {
      return null;
    }

    const vectorA = subtractVec3(pointA, vertex);
    const vectorC = subtractVec3(pointC, vertex);
    const lengthA = distanceBetweenVec3(pointA, vertex);
    const lengthC = distanceBetweenVec3(pointC, vertex);

    if (lengthA <= 1e-9 || lengthC <= 1e-9) {
      return null;
    }

    const cosine = Math.min(
      1,
      Math.max(-1, dotVec3(vectorA, vectorC) / (lengthA * lengthC)),
    );

    return { value: (Math.acos(cosine) * 180) / Math.PI, unit: "angle" };
  },
});

const getBoardCalculationReferenceLabel = (
  document: BoardDocument,
  targetId: string,
): string => {
  const entity = document.entities[targetId];

  if (!entity) {
    return "引用失效";
  }

  if (entity.kind === "segment") {
    return `|${entity.name?.trim() || entity.id}|`;
  }

  return entity.name?.trim() || entity.id;
};

function GeometryOverlay({
  document,
  objectLabels,
  preselectedEntityId,
  onMeasurementPointerDown,
  onMeasurementPointerEnter,
  onMeasurementPointerLeave,
}: GeometryOverlayProps) {
  const measurements = getMeasurements(document);
  const calculations = getCalculations(document);

  return (
    <div className="geometry-overlay" aria-hidden={false}>
      <div className="object-label-layer" aria-hidden="true">
        {objectLabels.map((label) => (
          <span
            className={
              label.selected
                ? "geometry-object-label selected"
                : "geometry-object-label"
            }
            key={label.id}
            style={{
              transform: `translate(${label.x + label.offsetX}px, ${
                label.y + label.offsetY
              }px)`,
            }}
          >
            {label.name}
          </span>
        ))}
      </div>

      <div className="measurement-list" aria-label="Measurements">
        {measurements.map((measurement) => {
          const text = formatMeasurementText(measurement, document);

          if (!text) {
            return null;
          }

          const selected = document.selectedEntityIds.includes(measurement.id);
          const preselected =
            !selected && preselectedEntityId === measurement.id;

          return (
            <button
              className={
                selected
                  ? "measurement-overlay-item selected"
                  : preselected
                    ? "measurement-overlay-item preselected"
                    : "measurement-overlay-item"
              }
              key={measurement.id}
              onPointerEnter={() => onMeasurementPointerEnter(measurement.id)}
              onPointerLeave={() => onMeasurementPointerLeave(measurement.id)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onMeasurementPointerDown(measurement.id, event.ctrlKey);
              }}
              type="button"
            >
              {text.overlinePrefix ? (
                <>
                  <span className="segment-name-overline">{text.prefix}</span>
                  <span>{` = ${text.valueText}${text.unitText}`}</span>
                </>
              ) : (
                <span>{text.formattedText}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="measurement-list calculation-list" aria-label="Calculations">
        {calculations.map((calculation) => {
          const result = evaluateCalculationExpression(
            calculation.expression,
            (targetId) => resolveBoardCalculationReference(document, targetId),
            resolveBoardCalculationGeometry(document),
          );
          const selected = document.selectedEntityIds.includes(calculation.id);
          const preselected =
            !selected && preselectedEntityId === calculation.id;

          return (
            <button
              className={
                selected
                  ? "measurement-overlay-item calculation-overlay-item selected"
                  : preselected
                    ? "measurement-overlay-item calculation-overlay-item preselected"
                    : "measurement-overlay-item calculation-overlay-item"
              }
              key={calculation.id}
              onPointerEnter={() => onMeasurementPointerEnter(calculation.id)}
              onPointerLeave={() => onMeasurementPointerLeave(calculation.id)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onMeasurementPointerDown(calculation.id, event.ctrlKey);
              }}
              type="button"
            >
              <FormulaView
                expression={calculation.expression}
                getReferenceLabel={(targetId) =>
                  getBoardCalculationReferenceLabel(document, targetId)
                }
              />
              <span>
                {" = "}
                {result.ok ? formatCalculationValue(result.value) : "引用失效"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GeometryOverlay;
