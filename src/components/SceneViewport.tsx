import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BoardDocument } from "../core/document/BoardDocument";
import type { EntityId, PointEntity } from "../core/document/EntityTypes";
import type { PointerInfo, ToolName } from "../core/tool/ToolTypes";
import type { Vec3 } from "../core/geometry/Vec3";
import GeometryOverlay, {
  type ProjectedPointLabel,
} from "./GeometryOverlay";
import {
  createAxesWithLabels,
  disposeAxesWithLabels,
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
  previewPosition: Vec3 | null;
  segmentPreviewStartPosition: Vec3 | null;
  focusRequestId: number;
  onCanvasPointerDown(pointerInfo: PointerInfo): void;
  onCanvasPointerMove(pointerInfo: PointerInfo): void;
  onSelectPointDragStart(pointerInfo: PointerInfo): void;
  onSelectPointDragMove(pointerInfo: PointerInfo): void;
  onSelectPointDragEnd(pointerInfo: PointerInfo): void;
  onSelectPointDragCancel(): void;
  onOverlayEntityPointerDown(entityId: EntityId, additive: boolean): void;
  isDraggingPoint: boolean;
}

const shouldShowPointLabel = (point: PointEntity): boolean =>
  point.visible && point.nameSource === "manual" && Boolean(point.name?.trim());

const arePointLabelsEqual = (
  first: readonly ProjectedPointLabel[],
  second: readonly ProjectedPointLabel[],
): boolean =>
  first.length === second.length &&
  first.every((label, index) => {
    const other = second[index];

    return (
      other &&
      label.id === other.id &&
      label.name === other.name &&
      label.selected === other.selected &&
      Math.abs(label.x - other.x) < 0.5 &&
      Math.abs(label.y - other.y) < 0.5
    );
  });

function SceneViewport({
  document,
  currentTool,
  highlightedPointIds,
  previewPosition,
  segmentPreviewStartPosition,
  focusRequestId,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onSelectPointDragStart,
  onSelectPointDragMove,
  onSelectPointDragEnd,
  onSelectPointDragCancel,
  onOverlayEntityPointerDown,
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
  const pointLabelsRef = useRef<readonly ProjectedPointLabel[]>([]);
  const [pointLabels, setPointLabels] = useState<readonly ProjectedPointLabel[]>(
    [],
  );

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

    const axes = createAxesWithLabels();
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
      );

      return {
        ...pointerInfo,
        snapResult: pointerInfo.worldPosition
          ? getScreenSpaceSnapResult({
              document: documentRef.current,
              activeDrawingPlane:
                documentRef.current.settings.activeDrawingPlane,
              rawWorldPosition: pointerInfo.worldPosition,
              pointerScreenPosition: getPointerScreenPosition(
                event,
                renderer.domElement,
              ),
              camera,
              canvas: renderer.domElement,
              ignoredEntityIds: ignoredSnapEntityIds,
            })
          : null,
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
        snapResult: pointerInfo.worldPosition
          ? getScreenSpaceSnapResult({
              document: documentRef.current,
              activeDrawingPlane:
                documentRef.current.settings.activeDrawingPlane,
              rawWorldPosition: pointerInfo.worldPosition,
              pointerScreenPosition: getPointerScreenPosition(
                latestPointerMoveEvent,
                renderer.domElement,
              ),
              camera,
              canvas: renderer.domElement,
            })
          : null,
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

      const nextPointLabels = Object.values(documentRef.current.entities)
        .filter((entity): entity is PointEntity =>
          entity.kind === "point" && shouldShowPointLabel(entity),
        )
        .map((point) => {
          const screenPosition = worldPositionToScreenPosition(
            point.position,
            camera,
            renderer.domElement,
          );

          return screenPosition
            ? {
                id: point.id,
                name: point.name?.trim() ?? "",
                x: screenPosition.x,
                y: screenPosition.y,
                selected: highlightedPointIdsRef.current.includes(point.id),
              }
            : null;
        })
        .filter((label): label is ProjectedPointLabel => Boolean(label));

      if (!arePointLabelsEqual(pointLabelsRef.current, nextPointLabels)) {
        pointLabelsRef.current = nextPointLabels;
        setPointLabels(nextPointLabels);
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

    syncDocumentEntitiesToScene(sceneRef.current, document, highlightedPointIds);
    syncLineResolution();
  }, [document, highlightedPointIds]);

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
      currentTool === "point" || currentTool === "segment",
    );
  }, [currentTool, previewPosition]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    syncSegmentPreview(
      sceneRef.current,
      segmentPreviewStartPosition,
      previewPosition,
      currentTool === "segment" && segmentPreviewStartPosition !== null,
    );
    syncLineResolution();
  }, [currentTool, previewPosition, segmentPreviewStartPosition]);

  return (
    <div
      className={
        [
          "scene-viewport",
          currentTool === "point" || currentTool === "segment"
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
        pointLabels={pointLabels}
        onMeasurementPointerDown={onOverlayEntityPointerDown}
      />
    </div>
  );
}

export default SceneViewport;
