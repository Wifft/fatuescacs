"use client";

import { useEffect, type RefObject } from "react";
import { parsePieceCode } from "@/lib/chess/describe";
import { pieceLabel } from "@/messages/es";

/**
 * react-chessboard renders each piece as a dnd-kit draggable (role="button", keyboard-movable)
 * without an accessible name. This names them ("Caballo negro en f6") and keeps the names in
 * sync as the board re-renders.
 */
export function usePieceLabels(
  ref: RefObject<HTMLElement | null>,
  boardId: string,
  /** Re-attach when this changes (e.g. the board mounts or shows another position). */
  key?: unknown,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const prefix = `${boardId}-square-`;
    const label = () => {
      for (const el of root.querySelectorAll<HTMLElement>('[aria-roledescription="draggable"]')) {
        const square = el.closest<HTMLElement>(`[id^="${prefix}"]`)?.id.slice(prefix.length);
        const code =
          el.querySelector<HTMLElement>("[data-piece]")?.dataset.piece ?? el.dataset.piece;
        const piece = code ? parsePieceCode(code) : null;
        if (!square || !piece) continue;
        const name = pieceLabel(piece.type, piece.color, square);
        if (el.getAttribute("aria-label") !== name) el.setAttribute("aria-label", name);
      }
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref, boardId, key]);
}
