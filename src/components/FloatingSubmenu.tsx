import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type FloatingSubmenuPlacement = "right-start" | "left-start";

interface FloatingSubmenuProps {
  readonly anchorElement: HTMLElement | null;
  readonly children: ReactNode;
  readonly className?: string;
  readonly open: boolean;
  readonly placement?: FloatingSubmenuPlacement;
  readonly role?: string;
  readonly ariaLabel?: string;
  onClose(): void;
}

const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 6;

export default function FloatingSubmenu({
  anchorElement,
  children,
  className,
  open,
  placement = "right-start",
  role = "menu",
  ariaLabel,
  onClose,
}: FloatingSubmenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const updatePosition = () => {
    const menu = menuRef.current;

    if (!anchorElement || !menu) {
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const preferredRight = placement === "right-start";
    const rightLeft = anchorRect.right + ANCHOR_GAP;
    const leftLeft = anchorRect.left - menuRect.width - ANCHOR_GAP;
    let left = preferredRight ? rightLeft : leftLeft;
    let top = anchorRect.top;

    if (left + menuRect.width > window.innerWidth - VIEWPORT_GAP) {
      left = leftLeft;
    }

    if (left < VIEWPORT_GAP) {
      left = rightLeft;
    }

    if (top + menuRect.height > window.innerHeight - VIEWPORT_GAP) {
      top = window.innerHeight - menuRect.height - VIEWPORT_GAP;
    }

    setPosition({
      left: Math.max(VIEWPORT_GAP, left),
      top: Math.max(VIEWPORT_GAP, top),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
  }, [anchorElement, children, open, placement]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        menuRef.current?.contains(target) ||
        anchorElement?.contains(target)
      ) {
        return;
      }

      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [anchorElement, onClose, open]);

  if (!open || !anchorElement) {
    return null;
  }

  return createPortal(
    <div
      aria-label={ariaLabel}
      className={className ? `floating-submenu ${className}` : "floating-submenu"}
      ref={menuRef}
      role={role}
      style={position}
    >
      {children}
    </div>,
    document.body,
  );
}
