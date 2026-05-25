import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface WorkspaceTabBarItem {
  readonly id: string;
  readonly kind: "geometry3d" | "plane2d";
  readonly title: string;
  readonly isDirty: boolean;
}

interface WorkspaceTabBarProps {
  readonly tabs: readonly WorkspaceTabBarItem[];
  readonly activeTabId: string | null;
  onActivate(tabId: string): void;
  onClose(tabId: string): void;
  onReorder(tabIds: readonly string[]): void;
}

interface TabRectSnapshot {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
}

interface DragState {
  readonly tabId: string;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly currentClientX: number;
  readonly pointerOffsetX: number;
  readonly draggedRect: TabRectSnapshot;
  readonly tabRects: readonly TabRectSnapshot[];
  readonly originalOrder: readonly string[];
  readonly order: readonly string[];
  readonly isDragging: boolean;
}

const DRAG_THRESHOLD_PX = 4;

const getTabLabel = (tab: WorkspaceTabBarItem) =>
  tab.kind === "geometry3d" ? "3D" : "2D";

export default function WorkspaceTabBar({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onReorder,
}: WorkspaceTabBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const visualOrder = useMemo(() => {
    if (!dragState?.isDragging) {
      return tabs.map((tab) => tab.id);
    }

    return dragState.order;
  }, [dragState, tabs]);

  const orderedTabs = visualOrder
    .map((tabId) => tabs.find((tab) => tab.id === tabId))
    .filter((tab): tab is WorkspaceTabBarItem => Boolean(tab));

  const getTargetOrder = (
    state: DragState,
    currentClientX: number,
  ): readonly string[] => {
    const otherTabIds = state.originalOrder.filter(
      (tabId) => tabId !== state.tabId,
    );
    const draggedCenterX =
      currentClientX - state.pointerOffsetX + state.draggedRect.width / 2;
    let targetIndex = otherTabIds.length;

    otherTabIds.some((tabId, index) => {
      const rect = state.tabRects.find((tabRect) => tabRect.id === tabId);

      if (rect && draggedCenterX < rect.centerX) {
        targetIndex = index;
        return true;
      }

      return false;
    });

    const nextOrder = [...otherTabIds];
    nextOrder.splice(targetIndex, 0, state.tabId);

    return nextOrder;
  };

  const startDragCandidate = (
    event: React.PointerEvent<HTMLButtonElement>,
    tabId: string,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const container = containerRef.current;
    const tabElement = event.currentTarget.closest<HTMLElement>(
      "[data-workspace-tab-id]",
    );

    if (!container || !tabElement) {
      return;
    }

    const tabRects = Array.from(
      container.querySelectorAll<HTMLElement>("[data-workspace-tab-id]"),
    ).map((element) => {
      const rect = element.getBoundingClientRect();
      const id = element.dataset.workspaceTabId ?? "";

      return {
        id,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
      };
    });
    const draggedRect = tabRects.find((rect) => rect.id === tabId);

    if (!draggedRect) {
      return;
    }

    container.setPointerCapture(event.pointerId);
    setDragState({
      tabId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      currentClientX: event.clientX,
      pointerOffsetX: event.clientX - draggedRect.left,
      draggedRect,
      tabRects,
      originalOrder: tabs.map((tab) => tab.id),
      order: tabs.map((tab) => tab.id),
      isDragging: false,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.abs(event.clientX - dragState.startClientX);
    const isDragging = dragState.isDragging || distance >= DRAG_THRESHOLD_PX;
    const nextState = {
      ...dragState,
      currentClientX: event.clientX,
      isDragging,
    };

    setDragState({
      ...nextState,
      order: isDragging
        ? getTargetOrder(nextState, event.clientX)
        : dragState.originalOrder,
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const { tabId, isDragging, order } = dragState;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(null);

    if (isDragging) {
      onReorder(order);
      return;
    }

    onActivate(tabId);
  };

  const cancelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(null);
  };

  const renderTabContent = (tab: WorkspaceTabBarItem) => (
    <>
      <span className="workspace-tab-icon">{getTabLabel(tab)}</span>
      {tab.isDirty ? <span className="workspace-tab-dirty">●</span> : null}
      <span className="workspace-tab-title">{tab.title}</span>
    </>
  );

  const draggedTab = dragState
    ? tabs.find((tab) => tab.id === dragState.tabId) ?? null
    : null;
  const dragLayerLeft = dragState
    ? dragState.currentClientX - dragState.pointerOffsetX
    : 0;

  return (
    <div
      className="workspace-tab-bar"
      onPointerCancel={cancelDrag}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      ref={containerRef}
    >
      {orderedTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isDragPlaceholder =
          dragState?.tabId === tab.id && dragState.isDragging;

        if (isDragPlaceholder) {
          return (
            <div
              className="workspace-tab-placeholder"
              key={tab.id}
              style={{
                width: dragState.draggedRect.width,
                height: dragState.draggedRect.height,
              }}
            />
          );
        }

        return (
          <div
            className={isActive ? "workspace-tab active" : "workspace-tab"}
            data-workspace-tab-id={tab.id}
            key={tab.id}
          >
            <button
              className="workspace-tab-main"
              data-tab-id={tab.id}
              onPointerDown={(event) => startDragCandidate(event, tab.id)}
              title={tab.title}
              type="button"
            >
              {renderTabContent(tab)}
            </button>
            <button
              aria-label={`关闭 ${tab.title}`}
              className="workspace-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
      {dragState?.isDragging && draggedTab
        ? createPortal(
            <div
              className={
                draggedTab.id === activeTabId
                  ? "workspace-tab workspace-tab-drag-layer active"
                  : "workspace-tab workspace-tab-drag-layer"
              }
              style={{
                left: dragLayerLeft,
                top: dragState.draggedRect.top,
                width: dragState.draggedRect.width,
                height: dragState.draggedRect.height,
              }}
            >
              <button className="workspace-tab-main" tabIndex={-1} type="button">
                {renderTabContent(draggedTab)}
              </button>
              <button
                aria-hidden="true"
                className="workspace-tab-close"
                tabIndex={-1}
                type="button"
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
