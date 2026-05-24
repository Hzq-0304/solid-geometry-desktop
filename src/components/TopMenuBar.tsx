import { useEffect, useRef, useState } from "react";
import type { ActiveDrawingPlane } from "../core/document/BoardDocument";

type MenuName = "file" | "edit" | "view" | "help";

interface TopMenuBarProps {
  readonly canUse3dCommands: boolean;
  readonly hasWorkspace: boolean;
  readonly canSave: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canDelete: boolean;
  readonly activeDrawingPlane: ActiveDrawingPlane;
  readonly onNew3d: () => void;
  readonly onNewPlane: () => void;
  readonly onOpen: () => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onCloseWorkspace: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
  readonly onSetDrawingPlane: (plane: ActiveDrawingPlane) => void;
  readonly onToggleBoundaryCube: () => void;
  readonly onResetView: () => void;
  readonly onAbout: () => void;
}

const menuLabels: Record<MenuName, string> = {
  file: "文件",
  edit: "编辑",
  view: "视图",
  help: "帮助",
};

export default function TopMenuBar({
  canUse3dCommands,
  hasWorkspace,
  canSave,
  canUndo,
  canRedo,
  canDelete,
  activeDrawingPlane,
  onNew3d,
  onNewPlane,
  onOpen,
  onSave,
  onSaveAs,
  onCloseWorkspace,
  onUndo,
  onRedo,
  onDelete,
  onSetDrawingPlane,
  onToggleBoundaryCube,
  onResetView,
  onAbout,
}: TopMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        rootRef.current.contains(event.target)
      ) {
        return;
      }

      setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const runMenuAction = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  const renderMenuItem = (
    label: string,
    action: () => void,
    disabled = false,
  ) => (
    <button
      disabled={disabled}
      onClick={() => runMenuAction(action)}
      role="menuitem"
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="top-menu-bar" ref={rootRef}>
      <div className="top-menu-title">Solid Geometry Studio</div>
      <nav aria-label="应用菜单" className="top-menu-nav">
        {(Object.keys(menuLabels) as MenuName[]).map((menuName) => (
          <div className="top-menu-item" key={menuName}>
            <button
              className={openMenu === menuName ? "active" : ""}
              onClick={() =>
                setOpenMenu((currentMenu) =>
                  currentMenu === menuName ? null : menuName,
                )
              }
              type="button"
            >
              {menuLabels[menuName]}
            </button>
            {openMenu === menuName ? (
              <div className="top-menu-dropdown" role="menu">
                {menuName === "file" ? (
                  <>
                    {renderMenuItem("新建三维画布", onNew3d)}
                    {renderMenuItem("新建平面画布", onNewPlane)}
                    <div className="top-menu-separator" />
                    {renderMenuItem("打开", onOpen)}
                    {renderMenuItem("保存", onSave, !canSave)}
                    {renderMenuItem("另存为", onSaveAs, !canSave)}
                    <div className="top-menu-separator" />
                    {renderMenuItem(
                      "关闭当前画布",
                      onCloseWorkspace,
                      !hasWorkspace,
                    )}
                  </>
                ) : null}
                {menuName === "edit" ? (
                  <>
                    {renderMenuItem("撤销", onUndo, !canUndo)}
                    {renderMenuItem("重做", onRedo, !canRedo)}
                    <div className="top-menu-separator" />
                    {renderMenuItem("删除", onDelete, !canDelete)}
                  </>
                ) : null}
                {menuName === "view" ? (
                  <>
                    {(["XY", "XZ", "YZ"] as const).map((plane) =>
                      renderMenuItem(
                        `${plane}${activeDrawingPlane === plane ? " ✓" : ""}`,
                        () => onSetDrawingPlane(plane),
                        !canUse3dCommands,
                      ),
                    )}
                    <div className="top-menu-separator" />
                    {renderMenuItem(
                      "显示边界盒",
                      onToggleBoundaryCube,
                      !canUse3dCommands,
                    )}
                    {renderMenuItem("重置视角", onResetView, !canUse3dCommands)}
                  </>
                ) : null}
                {menuName === "help" ? (
                  <>
                    {renderMenuItem("关于", onAbout)}
                    {renderMenuItem("使用说明", () => undefined, true)}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </div>
  );
}
