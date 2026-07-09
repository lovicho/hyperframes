import { useEffect, useMemo } from "react";
import type { TimelineElement } from "../player";
import type { DomEditSelection } from "../components/editor/domEditing";
import { findMatchingTimelineElementId, findTimelineIdByAncestor } from "../utils/studioHelpers";

interface UseTimelineSelectionPreviewSyncParams {
  selectedElementId: string | null;
  selectedElementIds: Set<string>;
  timelineElements: TimelineElement[];
  domEditSelection: DomEditSelection | null;
  domEditGroupSelections: DomEditSelection[];
  activeCompPath: string | null;
  buildDomSelectionForTimelineElement: (
    element: TimelineElement,
  ) => Promise<DomEditSelection | null>;
  applyDomSelection: (
    selection: DomEditSelection | null,
    options?: { revealPanel?: boolean; additive?: boolean; preserveGroup?: boolean },
  ) => void;
  applyMarqueeSelection: (selections: DomEditSelection[], additive: boolean) => void;
}

function orderSelectedIds(ids: Set<string>, anchor: string | null): string[] {
  const ordered = [...ids];
  if (!anchor || !ids.has(anchor)) return ordered;
  return [anchor, ...ordered.filter((id) => id !== anchor)];
}

function selectionTimelineId(
  selection: DomEditSelection,
  timelineElements: TimelineElement[],
  activeCompPath: string | null,
): string | null {
  return (
    findMatchingTimelineElementId(selection, timelineElements) ??
    findTimelineIdByAncestor(
      selection.element,
      timelineElements,
      selection.sourceFile || activeCompPath || "index.html",
    )
  );
}

function selectionIdsMatch(currentIds: string[], selectedIds: string[]): boolean {
  if (currentIds.length !== selectedIds.length) return false;
  const selected = new Set(selectedIds);
  return currentIds.every((id) => selected.has(id));
}

export function useTimelineSelectionPreviewSync({
  selectedElementId,
  selectedElementIds,
  timelineElements,
  domEditSelection,
  domEditGroupSelections,
  activeCompPath,
  buildDomSelectionForTimelineElement,
  applyDomSelection,
  applyMarqueeSelection,
}: UseTimelineSelectionPreviewSyncParams): void {
  const selectedIds = useMemo(
    () => orderSelectedIds(selectedElementIds, selectedElementId),
    [selectedElementId, selectedElementIds],
  );
  const selectedKey = selectedIds.join("\0");

  useEffect(() => {
    const currentSelections =
      domEditGroupSelections.length > 1
        ? domEditGroupSelections
        : domEditSelection
          ? [domEditSelection]
          : [];
    const currentIds = currentSelections
      .map((selection) => selectionTimelineId(selection, timelineElements, activeCompPath))
      .filter((id): id is string => Boolean(id));

    if (selectedIds.length === 0) {
      if (currentSelections.length > 0) applyDomSelection(null, { revealPanel: false });
      return;
    }
    if (selectionIdsMatch(currentIds, selectedIds)) return;

    let cancelled = false;
    const syncSelection = async () => {
      const selections: DomEditSelection[] = [];
      for (const id of selectedIds) {
        const element = timelineElements.find((item) => (item.key ?? item.id) === id);
        if (!element) continue;
        const selection = await buildDomSelectionForTimelineElement(element);
        if (selection) selections.push(selection);
      }
      if (cancelled) return;
      if (selections.length === 0) {
        applyDomSelection(null, { revealPanel: false });
      } else if (selections.length === 1) {
        applyDomSelection(selections[0], { revealPanel: false });
      } else {
        applyMarqueeSelection(selections, false);
      }
    };

    void syncSelection();
    return () => {
      cancelled = true;
    };
  }, [
    activeCompPath,
    applyDomSelection,
    applyMarqueeSelection,
    buildDomSelectionForTimelineElement,
    domEditGroupSelections,
    domEditSelection,
    selectedIds,
    selectedKey,
    timelineElements,
  ]);
}
