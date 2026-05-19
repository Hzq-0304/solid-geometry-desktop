import type { BoardDocument } from "../core/document/BoardDocument";
import type { EntityId, MeasurementEntity } from "../core/document/EntityTypes";
import { formatMeasurementText } from "../core/geometry/measurementUtils";

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

function GeometryOverlay({
  document,
  objectLabels,
  preselectedEntityId,
  onMeasurementPointerDown,
  onMeasurementPointerEnter,
  onMeasurementPointerLeave,
}: GeometryOverlayProps) {
  const measurements = getMeasurements(document);

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
    </div>
  );
}

export default GeometryOverlay;
