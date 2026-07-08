// @vitest-environment happy-dom

import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { openComposition } from "@hyperframes/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore, type TimelineElement } from "../player";
import { useElementLifecycleOps } from "./useElementLifecycleOps";
import { useTimelineEditing } from "./useTimelineEditing";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ZIndexEntry = {
  element: HTMLElement;
  zIndex: number;
  id?: string;
  selector?: string;
  selectorIndex?: number;
  sourceFile: string;
};

afterEach(() => {
  document.body.innerHTML = "";
  usePlayerStore.getState().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createPreviewIframe(
  clips: Array<{
    id: string;
    track: number;
    style?: string;
  }> = [
    { id: "front", track: 0 },
    { id: "back", track: 1 },
  ],
): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const doc = iframe.contentDocument;
  if (!doc) throw new Error("Expected iframe document");
  doc.body.innerHTML = clips
    .map(
      (clip) =>
        `<div id="${clip.id}" data-start="0" data-duration="2" data-track-index="${clip.track}"${
          clip.style ? ` style="${clip.style}"` : ""
        }></div>`,
    )
    .join("\n");
  return iframe;
}

function timelineElement(input: {
  id: string;
  track: number;
  zIndex: number;
  tag?: string;
}): TimelineElement {
  return {
    id: input.id,
    domId: input.id,
    hfId: `hf-${input.id}`,
    tag: input.tag ?? "div",
    start: 0,
    duration: 2,
    track: input.track,
    zIndex: input.zIndex,
    stackingContextId: "root",
    parentCompositionId: null,
    compositionAncestors: ["root"],
    sourceFile: "index.html",
    timingSource: "authored",
  };
}

function renderTimelineEditingHook(input: {
  timelineElements: TimelineElement[];
  iframe: HTMLIFrameElement;
  onZIndexCommit: (entries: ZIndexEntry[]) => void;
  projectId?: string | null;
  writeProjectFile?: (path: string, content: string) => Promise<void>;
  recordEdit?: (input: {
    label: string;
    kind: string;
    coalesceKey?: string;
    files: Record<string, { before: string; after: string }>;
  }) => Promise<void>;
  reloadPreview?: () => void;
  sdkSession?: Awaited<ReturnType<typeof openComposition>> | null;
  forceReloadSdkSession?: () => void;
}): {
  move: ReturnType<typeof useTimelineEditing>["handleTimelineElementMove"];
  resize: ReturnType<typeof useTimelineEditing>["handleTimelineElementResize"];
  unmount: () => void;
} {
  let move: ReturnType<typeof useTimelineEditing>["handleTimelineElementMove"] | null = null;
  let resize: ReturnType<typeof useTimelineEditing>["handleTimelineElementResize"] | null = null;

  function Harness() {
    const commitRef = useRef(input.onZIndexCommit);
    commitRef.current = input.onZIndexCommit;
    const hook = useTimelineEditing({
      projectId: input.projectId ?? null,
      activeCompPath: "index.html",
      timelineElements: input.timelineElements,
      showToast: vi.fn(),
      writeProjectFile: input.writeProjectFile ?? vi.fn(),
      recordEdit: input.recordEdit ?? vi.fn(),
      domEditSaveTimestampRef: { current: 0 },
      reloadPreview: input.reloadPreview ?? vi.fn(),
      previewIframeRef: { current: input.iframe },
      pendingTimelineEditPathRef: { current: new Set<string>() },
      uploadProjectFiles: vi.fn(),
      sdkSession: input.sdkSession,
      forceReloadSdkSession: input.forceReloadSdkSession,
      handleDomZIndexReorderCommitRef: commitRef,
    });
    move = hook.handleTimelineElementMove;
    resize = hook.handleTimelineElementResize;
    return null;
  }

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(<Harness />);
  });

  if (!move) throw new Error("Expected hook to expose move handler");
  if (!resize) throw new Error("Expected hook to expose resize handler");
  return {
    move,
    resize,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

function renderTimelineEditingHookWithLifecycle(input: {
  timelineElements: TimelineElement[];
  iframe: HTMLIFrameElement;
  commitPositionPatchToHtml: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;
}): {
  move: ReturnType<typeof useTimelineEditing>["handleTimelineElementMove"];
  unmount: () => void;
} {
  let move: ReturnType<typeof useTimelineEditing>["handleTimelineElementMove"] | null = null;

  function Harness() {
    const lifecycle = useElementLifecycleOps({
      activeCompPath: "index.html",
      showToast: vi.fn(),
      writeProjectFile: vi.fn(),
      domEditSaveTimestampRef: { current: 0 },
      editHistory: { recordEdit: vi.fn() },
      projectIdRef: { current: "p1" },
      reloadPreview: vi.fn(),
      clearDomSelection: vi.fn(),
      commitPositionPatchToHtml: input.commitPositionPatchToHtml,
    });
    const commitRef = useRef(lifecycle.handleDomZIndexReorderCommit);
    commitRef.current = lifecycle.handleDomZIndexReorderCommit;
    const hook = useTimelineEditing({
      projectId: null,
      activeCompPath: "index.html",
      timelineElements: input.timelineElements,
      showToast: vi.fn(),
      writeProjectFile: vi.fn(),
      recordEdit: vi.fn(),
      domEditSaveTimestampRef: { current: 0 },
      reloadPreview: vi.fn(),
      previewIframeRef: { current: input.iframe },
      pendingTimelineEditPathRef: { current: new Set<string>() },
      uploadProjectFiles: vi.fn(),
      handleDomZIndexReorderCommitRef: commitRef,
    });
    move = hook.handleTimelineElementMove;
    return null;
  }

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(<Harness />);
  });

  if (!move) throw new Error("Expected hook to expose move handler");
  return {
    move,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function flushAsyncWork(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

describe("useTimelineEditing timeline z-index reorder", () => {
  it("extends root duration through the fallback path when an SDK-backed move passes the end", async () => {
    const source = [
      `<div data-composition-id="main" data-duration="4">`,
      `  <div id="clip" data-hf-id="hf-clip" data-start="0" data-duration="2"></div>`,
      `</div>`,
    ].join("\n");
    const iframe = createPreviewIframe([{ id: "clip", track: 0 }]);
    const clip = timelineElement({ id: "clip", track: 0, zIndex: 0 });
    const sdkSession = await openComposition(source);
    const setTimingSpy = vi.spyOn(sdkSession, "setTiming");
    const writeProjectFile = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
    const recordEdit = vi.fn(async () => {});
    const forceReloadSdkSession = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = requestUrl(input);
        if (url.includes("/api/projects/p1/files/")) return jsonResponse({ content: source });
        if (url.includes("/api/projects/p1/gsap-mutations/")) return jsonResponse({ ok: true });
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
    usePlayerStore.getState().setDuration(4);
    const { move, unmount } = renderTimelineEditingHook({
      timelineElements: [clip],
      iframe,
      onZIndexCommit: vi.fn(),
      projectId: "p1",
      writeProjectFile,
      recordEdit,
      sdkSession,
      forceReloadSdkSession,
    });

    await act(async () => {
      await move(clip, { start: 3, track: clip.track });
    });

    expect(setTimingSpy).not.toHaveBeenCalled();
    expect(writeProjectFile.mock.calls[0]![1]).toContain(
      'data-composition-id="main" data-duration="5"',
    );
    expect(writeProjectFile.mock.calls[0]![1]).toContain('data-start="3"');
    expect(usePlayerStore.getState().duration).toBe(5);
    expect(forceReloadSdkSession).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("extends root duration through the fallback path when an SDK-backed resize passes the end", async () => {
    const source = [
      `<div data-composition-id="main" data-duration="4">`,
      `  <div id="clip" data-hf-id="hf-clip" data-start="0" data-duration="2"></div>`,
      `</div>`,
    ].join("\n");
    const iframe = createPreviewIframe([{ id: "clip", track: 0 }]);
    const clip = timelineElement({ id: "clip", track: 0, zIndex: 0 });
    const sdkSession = await openComposition(source);
    const setTimingSpy = vi.spyOn(sdkSession, "setTiming");
    const writeProjectFile = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
    const recordEdit = vi.fn(async () => {});
    const forceReloadSdkSession = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = requestUrl(input);
        if (url.includes("/api/projects/p1/files/")) return jsonResponse({ content: source });
        if (url.includes("/api/projects/p1/gsap-mutations/")) return jsonResponse({ ok: true });
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
    usePlayerStore.getState().setDuration(4);
    const { resize, unmount } = renderTimelineEditingHook({
      timelineElements: [clip],
      iframe,
      onZIndexCommit: vi.fn(),
      projectId: "p1",
      writeProjectFile,
      recordEdit,
      sdkSession,
      forceReloadSdkSession,
    });

    await act(async () => {
      await resize(clip, { start: 0, duration: 5, playbackStart: undefined });
    });

    expect(setTimingSpy).not.toHaveBeenCalled();
    expect(writeProjectFile.mock.calls[0]![1]).toContain(
      'data-composition-id="main" data-duration="5"',
    );
    expect(writeProjectFile.mock.calls[0]![1]).toContain('data-duration="5"></div>');
    expect(usePlayerStore.getState().duration).toBe(5);
    expect(forceReloadSdkSession).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("routes a vertical drag through the shared z-index commit without writing track-index", async () => {
    const iframe = createPreviewIframe([
      { id: "front", track: 0, style: "position: relative; z-index: 10" },
      { id: "back", track: 2, style: "position: relative; z-index: 1" },
    ]);
    const front = timelineElement({ id: "front", track: 0, zIndex: 10 });
    const back = timelineElement({ id: "back", track: 2, zIndex: 1 });
    const commit = vi.fn<(entries: ZIndexEntry[]) => void>();
    const { move, unmount } = renderTimelineEditingHook({
      timelineElements: [front, back],
      iframe,
      onZIndexCommit: commit,
    });

    await act(async () => {
      await move(back, {
        start: back.start,
        track: back.track,
        stackingReorder: {
          contextKey: "root",
          placement: { type: "onto", layerId: "layer-front" },
          zIndexChanges: [{ key: "back", zIndex: 10 }],
        },
      });
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Expected iframe document");

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0].map((entry) => [entry.id, entry.zIndex])).toEqual([
      ["back", 10],
    ]);
    expect(doc.getElementById("back")?.getAttribute("data-track-index")).toBe("2");

    unmount();
  });

  it("never writes z-index when the dragged clip is audio (no visual layer)", async () => {
    const iframe = createPreviewIframe([
      { id: "front", track: 0 },
      { id: "music", track: 1 },
    ]);
    const front = timelineElement({ id: "front", track: 0, zIndex: 0 });
    const music = timelineElement({ id: "music", track: 1, zIndex: 0, tag: "audio" });
    const commit = vi.fn<(entries: ZIndexEntry[]) => void>();
    const { move, unmount } = renderTimelineEditingHook({
      timelineElements: [front, music],
      iframe,
      onZIndexCommit: commit,
    });

    await act(async () => {
      await move(music, {
        start: music.start,
        track: music.track,
        stackingReorder: {
          contextKey: "root",
          placement: { type: "onto", layerId: "layer-front" },
          zIndexChanges: [{ key: "music", zIndex: 2 }],
        },
      });
    });

    expect(commit).not.toHaveBeenCalled();

    unmount();
  });

  it("commits only the minimum z-index changes resolved by the timeline drag", async () => {
    const iframe = createPreviewIframe([
      { id: "front", track: 0, style: "position: relative; z-index: 2" },
      { id: "back", track: 1, style: "position: relative; z-index: 1" },
      { id: "dragged", track: 2, style: "position: relative; z-index: 0" },
    ]);
    const front = timelineElement({ id: "front", track: 0, zIndex: 2 });
    const back = timelineElement({ id: "back", track: 1, zIndex: 1 });
    const dragged = timelineElement({ id: "dragged", track: 2, zIndex: 0 });
    const commit = vi.fn<(entries: ZIndexEntry[]) => void>();
    const { move, unmount } = renderTimelineEditingHook({
      timelineElements: [front, back, dragged],
      iframe,
      onZIndexCommit: commit,
    });

    await act(async () => {
      await move(dragged, {
        start: dragged.start,
        track: dragged.track,
        stackingReorder: {
          contextKey: "root",
          placement: { type: "between", beforeLayerId: "front", afterLayerId: "back" },
          zIndexChanges: [
            { key: "dragged", zIndex: 2 },
            { key: "front", zIndex: 3 },
          ],
        },
      });
    });

    expect(commit.mock.calls[0]![0].map((entry) => [entry.id, entry.zIndex])).toEqual([
      ["dragged", 2],
      ["front", 3],
    ]);

    unmount();
  });

  it("uses the shared lifecycle commit so static clips receive position relative", async () => {
    const iframe = createPreviewIframe([
      { id: "front", track: 0, style: "position: static" },
      { id: "back", track: 1, style: "position: static" },
    ]);
    const front = timelineElement({ id: "front", track: 0, zIndex: 0 });
    const back = timelineElement({ id: "back", track: 1, zIndex: 0 });
    const commitPositionPatchToHtml = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
    const { move, unmount } = renderTimelineEditingHookWithLifecycle({
      timelineElements: [front, back],
      iframe,
      commitPositionPatchToHtml,
    });

    await act(async () => {
      await move(back, {
        start: back.start,
        track: back.track,
        stackingReorder: {
          contextKey: "root",
          placement: { type: "above", layerId: "front" },
          zIndexChanges: [{ key: "back", zIndex: 2 }],
        },
      });
      await flushAsyncWork();
    });

    expect(commitPositionPatchToHtml).toHaveBeenCalled();
    expect(commitPositionPatchToHtml.mock.calls[0]![1]).toEqual([
      { type: "inline-style", property: "z-index", value: "2" },
      { type: "inline-style", property: "position", value: "relative" },
    ]);

    unmount();
  });

  it("keeps horizontal-only drag on the timing and GSAP shift path without z-index writes", async () => {
    const iframe = createPreviewIframe([{ id: "clip", track: 0 }]);
    const clip = timelineElement({ id: "clip", track: 0, zIndex: 0 });
    const commit = vi.fn<(entries: ZIndexEntry[]) => void>();
    const writeProjectFile = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
    const recordEdit = vi.fn(async () => {});
    const reloadPreview = vi.fn();
    const fetchMock = vi.fn(
      async (
        input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        const url = requestUrl(input);
        if (url.includes("/api/projects/p1/files/")) {
          return jsonResponse({
            content: '<div id="clip" data-start="0" data-track-index="0"></div>',
          });
        }
        if (url.includes("/api/projects/p1/gsap-mutations/")) {
          return jsonResponse({ ok: true });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const { move, unmount } = renderTimelineEditingHook({
      timelineElements: [clip],
      iframe,
      onZIndexCommit: commit,
      projectId: "p1",
      writeProjectFile,
      recordEdit,
      reloadPreview,
    });

    await act(async () => {
      await move(clip, { start: 1.25, track: clip.track });
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Expected iframe document");
    expect(doc.getElementById("clip")?.getAttribute("data-start")).toBe("1.25");
    expect(doc.getElementById("clip")?.getAttribute("data-track-index")).toBe("0");
    expect(commit).not.toHaveBeenCalled();
    expect(writeProjectFile.mock.calls[0]![1]).toContain('data-start="1.25"');
    expect(writeProjectFile.mock.calls[0]![1]).toContain('data-track-index="0"');
    expect(writeProjectFile.mock.calls[0]![1]).not.toContain("z-index");
    expect(
      fetchMock.mock.calls.some((call) => requestUrl(call[0]).includes("gsap-mutations")),
    ).toBe(true);

    unmount();
  });
});
