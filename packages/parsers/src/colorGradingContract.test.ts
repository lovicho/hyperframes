import { describe, expect, it } from "vitest";
import {
  COLOR_GRADING_ADJUST_KEYS,
  COLOR_GRADING_DETAIL_KEYS,
  COLOR_GRADING_EFFECT_KEYS,
  COLOR_GRADING_LUT_KEYS,
  COLOR_GRADING_TOP_LEVEL_KEYS,
  isColorGradingVariableRef,
  validateColorGradingContract,
} from "./colorGradingContract";

describe("color grading contract", () => {
  it("publishes one complete key registry", () => {
    expect(COLOR_GRADING_TOP_LEVEL_KEYS).toContain("effects");
    expect(COLOR_GRADING_ADJUST_KEYS).toContain("exposure");
    expect(COLOR_GRADING_DETAIL_KEYS).toContain("grain");
    expect(COLOR_GRADING_EFFECT_KEYS).toContain("kuwahara");
    expect(COLOR_GRADING_LUT_KEYS).toEqual(["src", "intensity"]);
  });

  it("accepts the complete current contract and variable references", () => {
    expect(
      validateColorGradingContract({
        enabled: "$enabled",
        preset: "clean-studio",
        intensity: 0.8,
        adjust: { exposure: 0.1, contrast: "$contrast" },
        details: { grain: 0.1 },
        effects: { bloom: 1.2, bloomRadius: 24, asciiStyle: 4 },
        palette: ["#112233", "#abcdef"],
        lut: { src: "$lutPath", intensity: 0.5 },
        colorSpace: "rec709",
      }),
    ).toEqual([]);
    expect(isColorGradingVariableRef("${grade.amount}")).toBe(true);
  });

  it("rejects unknown fields, invalid ranges, and malformed palettes", () => {
    expect(
      validateColorGradingContract({
        mystery: true,
        adjust: { exposure: 3, mystery: 1 },
        details: { grain: -0.1 },
        effects: { bloom: 4, bloomRadius: 0 },
        palette: ["red"],
        lut: {},
        colorSpace: "display-p3",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "grading" }),
        expect.objectContaining({ path: "adjust" }),
        expect.objectContaining({ path: "adjust.exposure" }),
        expect.objectContaining({ path: "details.grain" }),
        expect.objectContaining({ path: "effects.bloom" }),
        expect.objectContaining({ path: "effects.bloomRadius" }),
        expect.objectContaining({ path: "palette" }),
        expect.objectContaining({ path: "lut.src" }),
        expect.objectContaining({ path: "colorSpace" }),
      ]),
    );
  });
});
