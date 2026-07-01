// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimelineClipDiamonds } from "./TimelineClipDiamonds";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
});

function pointerEvent(type: string, init: PointerEventInit): Event {
  if (typeof PointerEvent === "function") return new PointerEvent(type, init);
  return new MouseEvent(type, init);
}

function renderDiamonds(onClickKeyframe = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <TimelineClipDiamonds
        keyframesData={{
          format: "percentage",
          keyframes: [
            { percentage: 0, properties: { x: 0 } },
            { percentage: 50, properties: { x: 100 } },
          ],
        }}
        clipWidthPx={200}
        clipHeightPx={48}
        accentColor="#4ba3d2"
        isSelected
        currentPercentage={0}
        elementId="clip-1"
        selectedKeyframes={new Set()}
        onClickKeyframe={onClickKeyframe}
      />,
    );
  });
  return { host, root, onClickKeyframe };
}

describe("TimelineClipDiamonds", () => {
  it("treats primary pointerup without drag as a keyframe click", () => {
    const { host, root, onClickKeyframe } = renderDiamonds();
    const diamond = host.querySelector<HTMLButtonElement>('button[title="50%"]');
    expect(diamond).not.toBeNull();

    act(() => {
      diamond!.dispatchEvent(pointerEvent("pointerup", { bubbles: true, button: 0 }));
    });

    expect(onClickKeyframe).toHaveBeenCalledWith(50);
    act(() => root.unmount());
  });

  it("does not treat secondary pointerup as a keyframe click", () => {
    const { host, root, onClickKeyframe } = renderDiamonds();
    const diamond = host.querySelector<HTMLButtonElement>('button[title="50%"]');
    expect(diamond).not.toBeNull();

    act(() => {
      diamond!.dispatchEvent(pointerEvent("pointerup", { bubbles: true, button: 2 }));
    });

    expect(onClickKeyframe).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
