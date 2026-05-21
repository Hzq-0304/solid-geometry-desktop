import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BoardDocument } from "../core/document/BoardDocument";
import type {
  EntityId,
  PlaneEntity,
  PointEntity,
  SegmentEntity,
} from "../core/document/EntityTypes";
import type { PointerInfo, ToolName } from "../core/tool/ToolTypes";
import type { Vec3 } from "../core/geometry/Vec3";
import GeometryOverlay, {
  type ProjectedObjectLabel,
} from "./GeometryOverlay";
import {
  getPlaneWorldPositions,
  getPointWorldPosition,
} from "../core/geometry/pointPositionUtils";
import type { SnapResult } from "../core/snap/SnapTypes";
import {
  createAxesWithLabels,
  disposeAxesWithLabels,
  syncAxesWithLabels,
} from "../renderer/three/axesWithLabels";
import { focusCameraOnDrawingPlane } from "../renderer/three/cameraViews";
import {
  disposeDrawingPlaneOverlay,
  syncDrawingPlaneOverlay,
} from "../renderer/three/drawingPlaneOverlay";
import {
  clearEntityObjects,
  syncDocumentEntitiesToScene,
} from "../renderer/three/entityRenderer";
import { getPointerInfoFromEvent } from "../renderer/three/pickingSystem";
import {
  disposePreviewCursor,
  syncPreviewCursor,
} from "../renderer/three/previewCursor";
import {
  disposeSegmentPreview,
  syncSegmentPreview,
} from "../renderer/three/segmentPreview";
import {
  disposePlanePreview,
  syncPlanePreview,
} from "../renderer/three/planePreview";
import { getScreenSpaceSnapResult } from "../renderer/three/screenSpaceSnapAdapter";
import {
  distancePointToScreenPoint,
  getPointerScreenPosition,
  worldPositionToScreenPosition,
  type ScreenPosition,
} from "../renderer/three/screenSpaceUtils";
import { updateLineMaterialResolution } from "../renderer/three/materials";

const CLICK_MOVE_THRESHOLD = 3;

interface SceneViewportProps {
  document: BoardDocument;
  currentTool: ToolName;
  highlightedPointIds: readonly EntityId[];
  highlightedEntityIds: readonly EntityId[];
  preselectedEntityId: EntityId | null;
  previewPosition: Vec3 | null;
  secondaryPreviewPosition: Vec3 | null;
  tertiaryPreviewPosition: Vec3 | null;
  segmentPreviewStartPosition: Vec3 | null;
  planePreviewPoints: readonly [Vec3, Vec3, Vec3] | null;
  focusRequestId: number;
  onCanvasPointerDown(pointerInfo: PointerInfo): void;
  onCanvasPointerMove(pointerInfo: PointerInfo): void;
  onSelectPointDragStart(pointerInfo: PointerInfo): void;
  onSelectPointDragMove(pointerInfo: PointerInfo): void;
  onSelectPointDragEnd(pointerInfo: PointerInfo): void;
  onSelectPointDragCancel(): void;
  onOverlayEntityPointerDown(entityId: EntityId, additive: boolean): void;
  onOverlayEntityPointerEnter(entityId: EntityId): void;
  onOverlayEntityPointerLeave(entityId: EntityId): void;
  isDraggingPoint: boolean;
}

const getPointLabelName = (point: PointEntity | null): string | null => {
  if (point?.nameSource !== "manual") {
    return null;
  }

  return point.name?.trim() || null;
};

const shouldShowPointLabel = (point: PointEntity): boolean =>
  point.visible && Boolean(getPointLabelName(point));

const getSegmentLabelName = (
  segment: SegmentEntity,
): string | null => {
  if (segment.nameSource !== "manual") {
    return null;
  }

  const name = segment.name?.trim();

  if (name) {
    return name;
  }

  return null;
};

const getPlaneLabelName = (
  plane: PlaneEntity,
): string | null => {
  if (plane.nameSource === "manual" && plane.name?.trim()) {
    return plane.name.trim();
  }

  return null;
};

const areObjectLabelsEqual = (
  first: readonly ProjectedObjectLabel[],
  second: readonly ProjectedObjectLabel[],
): boolean =>
  first.length === second.length &&
  first.every((label, index) => {
    const other = second[index];

    return (
      other &&
      label.id === other.id &&
      label.name === other.name &&
      label.selected === other.selected &&
      label.offsetX === other.offsetX &&
      label.offsetY === other.offsetY &&
      Math.abs(label.x - other.x) < 0.5 &&
      Math.abs(label.y - other.y) < 0.5
    );
  });

const isDefaultPlaneRawSnap = (snapResult: SnapResult | null): boolean =>
  snapResult?.type === "plane" && !snapResult.targetEntityId;

const createBoundaryFallbackSnapResult = (
  pointerInfo: PointerInfo,
): SnapResult | null =>
  pointerInfo.rawPositionSource === "boundary" && pointerInfo.worldPosition
    ? {
        position: pointerInfo.worldPosition,
        type: "boundary",
        description: "boundary",
      }
    : null;

function SceneViewport({
  document,
  currentTool,
  highlightedPointIds,
  highlightedEntityIds,
  preselectedEntityId,
  previewPosition,
  secondaryPreviewPosition,
  tertiaryPreviewPosition,
  segmentPreviewStartPosition,
  planePreviewPoints,
  focusRequestId,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onSelectPointDragStart,
  onSelectPointDragMove,
  onSelectPointDragEnd,
  onSelectPointDragCancel,
  onOverlayEntityPointerDown,
  onOverlayEntityPointerEnter,
  onOverlayEntityPointerLeave,
  isDraggingPoint,
}: SceneViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const focusRequestIdRef = useRef(focusRequestId);
  const documentRef = useRef(document);
  const currentToolRef = useRef(currentTool);
  const highlightedPointIdsRef = useRef(highlightedPointIds);
  const onCanvasPointerDownRef = useRef(onCanvasPointerDown);
  const onCanvasPointerMoveRef = useRef(onCanvasPointerMove);
  const onSelectPointDragStartRef = useRef(onSelectPointDragStart);
  const onSelectPointDragMoveRef = useRef(onSelectPointDragMove);
  const onSelectPointDragEndRef = useRef(onSelectPointDragEnd);
  const onSelectPointDragCancelRef = useRef(onSelectPointDragCancel);
  const preselectedEntityIdRef = useRef(preselectedEntityId);
  const objectLabelsRef = useRef<readonly ProjectedObjectLabel[]>([]);
  const [objectLabels, setObjectLabels] = useState<
    readonly ProjectedObjectLabel[]
  >([]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    currentToolRef.current = currentTool;
  }, [currentTool]);

  useEffect(() => {
    highlightedPointIdsRef.current = highlightedPointIds;
  }, [highlightedPointIds]);

  useEffect(() => {
    preselectedEntityIdRef.current = preselectedEntityId;
  }, [preselectedEntityId]);

  useEffect(() => {
    onCanvasPointerDownRef.current = onCanvasPointerDown;
  }, [onCanvasPointerDown]);

  useEffect(() => {
    onCanvasPointerMoveRef.current = onCanvasPointerMove;
  }, [onCanvasPointerMove]);

  useEffect(() => {
    onSelectPointDragStartRef.current = onSelectPointDragStart;
  }, [onSelectPointDragStart]);

  useEffect(() => {
    onSelectPointDragMoveRef.current = onSelectPointDragMove;
  }, [onSelectPointDragMove]);

  useEffect(() => {
    onSelectPointDragEndRef.current = onSelectPointDragEnd;
  }, [onSelectPointDragEnd]);

  useEffect(() => {
    onSelectPointDragCancelRef.current = onSelectPointDragCancel;
  }, [onSelectPointDragCancel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f8fb);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.panSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 1;
    controls.maxDistance = 200;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;
    focusCameraOnDrawingPlane(
      camera,
      controls,
      documentRef.current.settings.activeDrawingPlane,
    );

    const axes = createAxesWithLabels(documentRef.current.settings.coordinateHalfSize);
    scene.add(axes);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 8, 6);
    scene.add(directionalLight);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      const safeWidth = Math.max(1, width);
      const safeHeight = Math.max(1, height);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(safeWidth, safeHeight, false);
      updateLineMaterialResolution(scene, safeWidth, safeHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const resolveScreenSpaceSnapResult = (
      event: PointerEvent,
      pointerInfo: PointerInfo,
      ignoredSnapEntityIds: readonly EntityId[] = [],
    ): SnapResult | null => {
      if (!pointerInfo.worldPosition) {
        return null;
      }

      const snapResult = getScreenSpaceSnapResult({
        document: documentRef.current,
        activeDrawingPlane: documentRef.current.settings.activeDrawingPlane,
        rawWorldPosition: pointerInfo.worldPosition,
        pointerScreenPosition: getPointerScreenPosition(
          event,
          renderer.domElement,
        ),
        camera,
        canvas: renderer.domElement,
        ignoredEntityIds: ignoredSnapEntityIds,
        planeSnapEntityId:
          pointerInfo.planeSnapEntityId ??
          (pointerInfo.hitEntityType === "plane" ? pointerInfo.hitEntityId : null),
      });

      const boundarySnapResult = createBoundaryFallbackSnapResult(pointerInfo);

      return boundarySnapResult && isDefaultPlaneRawSnap(snapResult)
        ? boundarySnapResult
        : snapResult;
    };

    const createPointerInfo = (
      event: PointerEvent,
      ignoredSnapEntityIds: readonly EntityId[] = [],
    ): PointerInfo => {
      const pointerInfo = getPointerInfoFromEvent(
        event,
        renderer.domElement,
        camera,
        scene,
        documentRef.current,
        documentRef.current.settings.activeDrawingPlane,
        ignoredSnapEntityIds,
      );

      return {
        ...pointerInfo,
        snapResult: resolveScreenSpaceSnapResult(
          event,
          pointerInfo,
          ignoredSnapEntityIds,
        ),
      };
    };

    let pointerDownScreenPosition: ScreenPosition | null = null;
    let isDraggingView = false;
    let selectPointDrag:
      | {
          pointerId: number;
          pointId: EntityId;
          startScreenPosition: ScreenPosition;
          startPointerInfo: PointerInfo;
          started: boolean;
        }
      | null = null;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      pointerDownScreenPosition = getPointerScreenPosition(
        event,
        renderer.domElement,
      );
      isDraggingView = false;

      const pointerInfo = createPointerInfo(event);

      if (
        currentToolRef.current === "select" &&
        pointerInfo.hitEntityId &&
        pointerInfo.hitEntityType === "point"
      ) {
        selectPointDrag = {
          pointerId: event.pointerId,
          pointId: pointerInfo.hitEntityId,
          startScreenPosition: pointerDownScreenPosition,
          startPointerInfo: pointerInfo,
          started: false,
        };
        controls.enabled = false;
        renderer.domElement.setPointerCapture(event.pointerId);
        onCanvasPointerDownRef.current(pointerInfo);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (selectPointDrag && event.pointerId === selectPointDrag.pointerId) {
        const currentDrag = selectPointDrag;

        selectPointDrag = null;
        pointerDownScreenPosition = null;
        isDraggingView = false;
        controls.enabled = true;

        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }

        if (currentDrag.started) {
          onSelectPointDragEndRef.current(
            createPointerInfo(event, [currentDrag.pointId]),
          );
        }

        return;
      }

      if (event.button !== 0 || !pointerDownScreenPosition) {
        return;
      }

      const pointerUpScreenPosition = getPointerScreenPosition(
        event,
        renderer.domElement,
      );
      const moveDistance = distancePointToScreenPoint(
        pointerDownScreenPosition,
        pointerUpScreenPosition,
      );
      const isClick =
        !isDraggingView && moveDistance <= CLICK_MOVE_THRESHOLD;

      pointerDownScreenPosition = null;
      isDraggingView = false;

      if (isClick) {
        onCanvasPointerDownRef.current(createPointerInfo(event));
      }
    };

    let pointerMoveFrameId = 0;
    let latestPointerMoveEvent: PointerEvent | null = null;

    const flushPointerMove = () => {
      pointerMoveFrameId = 0;

      if (!latestPointerMoveEvent) {
        return;
      }

      const pointerInfo = getPointerInfoFromEvent(
        latestPointerMoveEvent,
        renderer.domElement,
        camera,
        scene,
        documentRef.current,
        documentRef.current.settings.activeDrawingPlane,
      );

      onCanvasPointerMoveRef.current({
        ...pointerInfo,
        snapResult: resolveScreenSpaceSnapResult(
          latestPointerMoveEvent,
          pointerInfo,
        ),
      });
      latestPointerMoveEvent = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (selectPointDrag && event.pointerId === selectPointDrag.pointerId) {
        if ((event.buttons & 1) !== 1) {
          return;
        }

        const pointerScreenPosition = getPointerScreenPosition(
          event,
          renderer.domElement,
        );
        const moveDistance = distancePointToScreenPoint(
          selectPointDrag.startScreenPosition,
          pointerScreenPosition,
        );

        if (moveDistance >= CLICK_MOVE_THRESHOLD) {
          const pointerInfo = createPointerInfo(event, [
            selectPointDrag.pointId,
          ]);

          if (!selectPointDrag.started) {
            selectPointDrag.started = true;
            onSelectPointDragStartRef.current(selectPointDrag.startPointerInfo);
          }

          onSelectPointDragMoveRef.current(pointerInfo);
        }

        return;
      }

      if (pointerDownScreenPosition && (event.buttons & 1) === 1) {
        const pointerScreenPosition = getPointerScreenPosition(
          event,
          renderer.domElement,
        );
        const moveDistance = distancePointToScreenPoint(
          pointerDownScreenPosition,
          pointerScreenPosition,
        );

        if (moveDistance > CLICK_MOVE_THRESHOLD) {
          isDraggingView = true;
          latestPointerMoveEvent = null;
          return;
        }
      }

      latestPointerMoveEvent = event;

      if (pointerMoveFrameId === 0) {
        pointerMoveFrameId = requestAnimationFrame(flushPointerMove);
      }
    };

    const handlePointerLeave = () => {
      if (selectPointDrag?.started) {
        return;
      }

      pointerDownScreenPosition = null;
      isDraggingView = false;
      latestPointerMoveEvent = null;
      onCanvasPointerMoveRef.current({
        worldPosition: null,
        hitEntityId: null,
        hitEntityType: null,
        drawingPlane: documentRef.current.settings.activeDrawingPlane,
        snapResult: null,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      });
    };

    const handlePointerCancel = () => {
      if (selectPointDrag) {
        if (renderer.domElement.hasPointerCapture(selectPointDrag.pointerId)) {
          renderer.domElement.releasePointerCapture(selectPointDrag.pointerId);
        }

        selectPointDrag = null;
        controls.enabled = true;
        onSelectPointDragCancelRef.current();
      }

      pointerDownScreenPosition = null;
      isDraggingView = false;
      latestPointerMoveEvent = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !selectPointDrag) {
        return;
      }

      if (renderer.domElement.hasPointerCapture(selectPointDrag.pointerId)) {
        renderer.domElement.releasePointerCapture(selectPointDrag.pointerId);
      }

      selectPointDrag = null;
      pointerDownScreenPosition = null;
      isDraggingView = false;
      latestPointerMoveEvent = null;
      controls.enabled = true;
      onSelectPointDragCancelRef.current();
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);

    let frameId = 0;
    const animate = () => {
      controls.update();

      const currentDocument = documentRef.current;
      const selectedEntityIds = currentDocument.selectedEntityIds;
      const preselectedId = preselectedEntityIdRef.current;
      const nextObjectLabels = Object.values(currentDocument.entities)
        .flatMap((entity): (ProjectedObjectLabel | null)[] => {
          if (entity.kind === "point") {
            if (!shouldShowPointLabel(entity)) {
              return [];
            }

            const labelName = getPointLabelName(entity);
            const position = getPointWorldPosition(currentDocument, entity.id);
            const screenPosition = position
              ? worldPositionToScreenPosition(
                  position,
                  camera,
                  renderer.domElement,
                )
              : null;

            return screenPosition && labelName
              ? [
                  {
                    id: entity.id,
                    name: labelName,
                    x: screenPosition.x,
                    y: screenPosition.y,
                    offsetX: 7,
                    offsetY: -10,
                    selected:
                      highlightedPointIdsRef.current.includes(entity.id) ||
                      selectedEntityIds.includes(entity.id) ||
                      preselectedId === entity.id,
                  },
                ]
              : [];
          }

          if (entity.kind === "segment" && entity.visible) {
            const labelName = getSegmentLabelName(entity);
            const startPoint = getPointWorldPosition(
              currentDocument,
              entity.pointIds[0],
            );
            const endPoint = getPointWorldPosition(
              currentDocument,
              entity.pointIds[1],
            );

            if (!labelName || !startPoint || !endPoint) {
              return [];
            }

            const midpoint: Vec3 = {
              x: (startPoint.x + endPoint.x) / 2,
              y: (startPoint.y + endPoint.y) / 2,
              z: (startPoint.z + endPoint.z) / 2,
            };
            const screenPosition = worldPositionToScreenPosition(
              midpoint,
              camera,
              renderer.domElement,
            );

            return screenPosition
              ? [
                  {
                    id: entity.id,
                    name: labelName,
                    x: screenPosition.x,
                    y: screenPosition.y,
                    offsetX: 8,
                    offsetY: -12,
                    selected:
                      selectedEntityIds.includes(entity.id) ||
                      preselectedId === entity.id,
                  },
                ]
              : [];
          }

          if (entity.kind === "plane" && (entity.visible ?? true)) {
            const labelName = getPlaneLabelName(entity);
            const points = getPlaneWorldPositions(
              currentDocument,
              entity.pointIds,
            );

            if (!labelName || !points) {
              return [];
            }

            const centroid: Vec3 = {
              x:
                (points[0].x +
                  points[1].x +
                  points[2].x) /
                3,
              y:
                (points[0].y +
                  points[1].y +
                  points[2].y) /
                3,
              z:
                (points[0].z +
                  points[1].z +
                  points[2].z) /
                3,
            };
            const screenPosition = worldPositionToScreenPosition(
              centroid,
              camera,
              renderer.domElement,
            );

            return screenPosition
              ? [
                  {
                    id: entity.id,
                    name: labelName,
                    x: screenPosition.x,
                    y: screenPosition.y,
                    offsetX: 10,
                    offsetY: -14,
                    selected:
                      selectedEntityIds.includes(entity.id) ||
                      preselectedId === entity.id,
                  },
                ]
              : [];
          }

          return [];
        })
        .filter((label): label is ProjectedObjectLabel => Boolean(label));

      if (!areObjectLabelsEqual(objectLabelsRef.current, nextObjectLabels)) {
        objectLabelsRef.current = nextObjectLabels;
        setObjectLabels(nextObjectLabels);
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (pointerMoveFrameId !== 0) {
        cancelAnimationFrame(pointerMoveFrameId);
      }
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );
      window.removeEventListener("keydown", handleKeyDown);
      disposePreviewCursor(scene);
      disposeSegmentPreview(scene);
      disposePlanePreview(scene);
      disposeDrawingPlaneOverlay(scene);
      disposeAxesWithLabels(axes);
      clearEntityObjects(scene);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  const syncLineResolution = () => {
    if (!sceneRef.current || !rendererRef.current) {
      return;
    }

    updateLineMaterialResolution(
      sceneRef.current,
      rendererRef.current.domElement.clientWidth,
      rendererRef.current.domElement.clientHeight,
    );
  };

  useEffect(() => {
    if (focusRequestId === focusRequestIdRef.current) {
      return;
    }

    focusRequestIdRef.current = focusRequestId;

    if (!cameraRef.current || !controlsRef.current) {
      return;
    }

    focusCameraOnDrawingPlane(
      cameraRef.current,
      controlsRef.current,
      document.settings.activeDrawingPlane,
    );
  }, [document.settings.activeDrawingPlane, focusRequestId]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncAxesWithLabels(sceneRef.current, document.settings);
  }, [
    document.settings.coordinateHalfSize,
    document.settings.showAxes,
  ]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncDocumentEntitiesToScene(
      sceneRef.current,
      document,
      highlightedPointIds,
      highlightedEntityIds,
      preselectedEntityId,
    );
    syncLineResolution();
  }, [document, highlightedEntityIds, highlightedPointIds, preselectedEntityId]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncDrawingPlaneOverlay(sceneRef.current, document.settings);
  }, [document.settings]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncPreviewCursor(
      sceneRef.current,
      previewPosition,
      currentTool === "point" ||
        currentTool === "segment" ||
        currentTool === "parallel" ||
        currentTool === "plane",
    );
    syncPreviewCursor(
      sceneRef.current,
      secondaryPreviewPosition,
      currentTool === "parallel" && secondaryPreviewPosition !== null,
      { name: "secondary-preview-cursor", size: 8, opacity: 0.58 },
    );
    syncPreviewCursor(
      sceneRef.current,
      tertiaryPreviewPosition,
      currentTool === "parallel" && tertiaryPreviewPosition !== null,
      { name: "tertiary-preview-cursor", size: 8, opacity: 0.58 },
    );
  }, [
    currentTool,
    previewPosition,
    secondaryPreviewPosition,
    tertiaryPreviewPosition,
  ]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncSegmentPreview(
      sceneRef.current,
      segmentPreviewStartPosition,
      previewPosition,
      (currentTool === "segment" ||
        currentTool === "perpendicular" ||
        currentTool === "parallel") &&
        segmentPreviewStartPosition !== null,
    );
    syncLineResolution();
  }, [currentTool, previewPosition, segmentPreviewStartPosition]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncPlanePreview(
      sceneRef.current,
      planePreviewPoints,
      currentTool === "parallel" && planePreviewPoints !== null,
    );
  }, [currentTool, planePreviewPoints]);

  return (
    <div
      className={
        [
          "scene-viewport",
          currentTool === "point" ||
          currentTool === "segment" ||
          currentTool === "perpendicular" ||
          currentTool === "midpoint" ||
          currentTool === "parallel" ||
          currentTool === "intersection" ||
          currentTool === "plane"
            ? "point-tool-active"
            : "",
          isDraggingPoint ? "dragging-point" : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      ref={hostRef}
    >
      <GeometryOverlay
        document={document}
        objectLabels={objectLabels}
        preselectedEntityId={preselectedEntityId}
        onMeasurementPointerDown={onOverlayEntityPointerDown}
        onMeasurementPointerEnter={onOverlayEntityPointerEnter}
        onMeasurementPointerLeave={onOverlayEntityPointerLeave}
      />
    </div>
  );
}

export default SceneViewport;
