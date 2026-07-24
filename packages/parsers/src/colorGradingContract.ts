export const COLOR_GRADING_CONTRACT_VERSION = 1;
export const COLOR_GRADING_COLOR_SPACE = "rec709";

export const COLOR_GRADING_TOP_LEVEL_KEYS = [
  "enabled",
  "preset",
  "intensity",
  "adjust",
  "details",
  "effects",
  "palette",
  "lut",
  "colorSpace",
] as const;

export const COLOR_GRADING_ADJUST_KEYS = [
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "whites",
  "blacks",
  "temperature",
  "tint",
  "vibrance",
  "saturation",
] as const;

export const COLOR_GRADING_DETAIL_KEYS = [
  "vignette",
  "vignetteMidpoint",
  "vignetteRoundness",
  "vignetteFeather",
  "grain",
  "grainSize",
  "grainRoughness",
] as const;

export const COLOR_GRADING_EFFECT_KEYS = [
  "blur",
  "pixelate",
  "chromaBleed",
  "tapeDamage",
  "tapeTracking",
  "tapeNoise",
  "tapeSpeed",
  "filmArtifacts",
  "halftone",
  "halftoneSize",
  "twoInkPrint",
  "twoInkPrintSize",
  "ascii",
  "asciiSize",
  "asciiInvert",
  "asciiStyle",
  "asciiColor",
  "asciiRotation",
  "dither",
  "ditherSize",
  "bloom",
  "bloomRadius",
  "monoScreen",
  "monoScreenSize",
  "monoScreenAngle",
  "monoScreenSpread",
  "monoScreenShape",
  "monoScreenInvert",
  "scanlines",
  "scanlineCount",
  "scanlineSoftness",
  "chromaticAberration",
  "chromaticAngle",
  "crtCurvature",
  "digitalGlitch",
  "digitalGlitchColorSplit",
  "digitalGlitchLineTear",
  "digitalGlitchPixelate",
  "digitalGlitchBlockAmount",
  "digitalGlitchBlockDisplacement",
  "digitalGlitchBlockOpacity",
  "digitalGlitchSpeed",
  "engraving",
  "engravingSpacing",
  "engravingMinThickness",
  "engravingMaxThickness",
  "engravingAngle",
  "engravingContrast",
  "engravingSharpness",
  "engravingWave",
  "engravingWaveFrequency",
  "crosshatch",
  "crosshatchSpacing",
  "crosshatchThickness",
  "crosshatchAngle",
  "crosshatchContrast",
  "crosshatchEdges",
  "crosshatchLineWeight",
  "crosshatchWave",
  "crosshatchWaveFrequency",
  "kuwahara",
  "kuwaharaRadius",
  "kuwaharaSharpness",
  "kuwaharaSaturation",
] as const;

export const COLOR_GRADING_LUT_KEYS = ["src", "intensity"] as const;

type NumericLimit = Readonly<{ min: number; max: number }>;

const UNIT_LIMIT: NumericLimit = { min: 0, max: 1 };
const SIGNED_UNIT_LIMIT: NumericLimit = { min: -1, max: 1 };
const EFFECT_LIMIT_OVERRIDES: Readonly<Record<string, NumericLimit>> = {
  asciiStyle: { min: 0, max: 7 },
  bloom: { min: 0, max: 3 },
  bloomRadius: { min: 1, max: 100 },
  monoScreenShape: { min: 0, max: 4 },
};
const VARIABLE_REF = /^\$(?:\{[A-Za-z0-9_.:-]+\}|[A-Za-z0-9_.:-]+)$/;
const PALETTE_COLOR = /^#[0-9a-f]{6}$/i;

const OBJECT_SECTIONS = [
  ["adjust", COLOR_GRADING_ADJUST_KEYS],
  ["details", COLOR_GRADING_DETAIL_KEYS],
  ["effects", COLOR_GRADING_EFFECT_KEYS],
  ["lut", COLOR_GRADING_LUT_KEYS],
] as const;

export interface ColorGradingContractIssue {
  path: string;
  message: string;
  hint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isColorGradingVariableRef(value: unknown): value is string {
  return typeof value === "string" && VARIABLE_REF.test(value.trim());
}

function unknownKeysHint(path: string, unknown: readonly string[]): string {
  if (path !== "grading") return `Correct or remove the unsupported "${path}" keys.`;
  const sections = new Set(
    unknown.flatMap((key) =>
      OBJECT_SECTIONS.filter(([, keys]) => (keys as readonly string[]).includes(key)).map(
        ([section]) => section,
      ),
    ),
  );
  return sections.size === 1
    ? `Move those controls under "${[...sections][0]}".`
    : "Use only the documented media-treatment keys at the top level.";
}

function validateObject(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: ColorGradingContractIssue[],
): Record<string, unknown> | null {
  if (isColorGradingVariableRef(value)) return null;
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object or variable reference" });
    return null;
  }
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    issues.push({
      path,
      message: `has unsupported key(s): ${unknown.join(", ")}`,
      hint: unknownKeysHint(path, unknown),
    });
  }
  return value;
}

function validateNumericField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  limit: NumericLimit,
  issues: ColorGradingContractIssue[],
): void {
  const candidate = value[key];
  if (candidate === undefined || isColorGradingVariableRef(candidate)) return;
  if (
    typeof candidate !== "number" ||
    !Number.isFinite(candidate) ||
    candidate < limit.min ||
    candidate > limit.max
  ) {
    issues.push({
      path: path ? `${path}.${key}` : key,
      message: `must be a finite number from ${limit.min} through ${limit.max}`,
    });
  }
}

function validateNumericSection(
  value: Record<string, unknown>,
  path: string,
  keys: readonly string[],
  limitFor: (key: string) => NumericLimit,
  issues: ColorGradingContractIssue[],
): void {
  for (const key of keys) validateNumericField(value, key, path, limitFor(key), issues);
}

function validatePalette(value: unknown, issues: ColorGradingContractIssue[]): void {
  if (value === undefined || value === null || isColorGradingVariableRef(value)) return;
  const hint =
    'Use 2 to 6 colors in the intended mapping order, each written as exact "#RRGGBB", or use a project variable reference.';
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) {
    issues.push({ path: "palette", message: "must contain 2 to 6 hex colors", hint });
    return;
  }
  value.forEach((color, index) => {
    if (typeof color !== "string" || !PALETTE_COLOR.test(color)) {
      issues.push({
        path: `palette[${index}]`,
        message: "must be a six-digit hex color",
        hint,
      });
    }
  });
}

function validateLut(
  value: unknown,
  object: Record<string, unknown> | null,
  issues: ColorGradingContractIssue[],
): void {
  if (typeof value === "string") {
    if (!value.trim()) issues.push({ path: "lut", message: "must not be empty" });
    return;
  }
  if (!object) return;
  if (
    !isColorGradingVariableRef(object.src) &&
    (typeof object.src !== "string" || !object.src.trim())
  ) {
    issues.push({
      path: "lut.src",
      message: "must be a non-empty string or variable reference",
    });
  }
  validateNumericField(object, "intensity", "lut", UNIT_LIMIT, issues);
}

function validateEnabled(
  grading: Record<string, unknown>,
  issues: ColorGradingContractIssue[],
): void {
  if (
    grading.enabled !== undefined &&
    !isColorGradingVariableRef(grading.enabled) &&
    typeof grading.enabled !== "boolean"
  ) {
    issues.push({ path: "enabled", message: "must be a boolean or variable reference" });
  }
}

function validatePreset(
  grading: Record<string, unknown>,
  issues: ColorGradingContractIssue[],
): void {
  if (
    grading.preset !== undefined &&
    grading.preset !== null &&
    !isColorGradingVariableRef(grading.preset) &&
    (typeof grading.preset !== "string" || !grading.preset.trim())
  ) {
    issues.push({
      path: "preset",
      message: "must be a non-empty string, null, or variable reference",
    });
  }
}

function validateColorSpace(
  grading: Record<string, unknown>,
  issues: ColorGradingContractIssue[],
): void {
  if (
    grading.colorSpace !== undefined &&
    !isColorGradingVariableRef(grading.colorSpace) &&
    grading.colorSpace !== COLOR_GRADING_COLOR_SPACE
  ) {
    issues.push({
      path: "colorSpace",
      message: `must be "${COLOR_GRADING_COLOR_SPACE}" or a variable reference`,
    });
  }
}

function validateTopLevel(
  grading: Record<string, unknown>,
  issues: ColorGradingContractIssue[],
): void {
  validateEnabled(grading, issues);
  validateNumericField(grading, "intensity", "", UNIT_LIMIT, issues);
  validatePreset(grading, issues);
  validateColorSpace(grading, issues);
}

function validateSection(
  grading: Record<string, unknown>,
  key: (typeof OBJECT_SECTIONS)[number][0],
  keys: readonly string[],
  issues: ColorGradingContractIssue[],
): void {
  const section = grading[key];
  if (section === undefined || (key === "lut" && section === null)) return;
  if (key === "lut" && typeof section === "string") {
    validateLut(section, null, issues);
    return;
  }
  const object = validateObject(section, key, keys, issues);
  if (!object) return;
  if (key === "lut") return validateLut(section, object, issues);

  const limitFor = (control: string): NumericLimit => {
    if (key === "adjust" && control === "exposure") return { min: -2, max: 2 };
    if (key === "adjust" || (key === "details" && control === "vignetteRoundness")) {
      return SIGNED_UNIT_LIMIT;
    }
    return key === "effects" ? (EFFECT_LIMIT_OVERRIDES[control] ?? UNIT_LIMIT) : UNIT_LIMIT;
  };
  validateNumericSection(object, key, keys, limitFor, issues);
}

function validateSections(
  grading: Record<string, unknown>,
  issues: ColorGradingContractIssue[],
): void {
  for (const [key, keys] of OBJECT_SECTIONS) validateSection(grading, key, keys, issues);
}

/** Browser-safe structural validation shared by Lint, CLI, and Core consumers. */
export function validateColorGradingContract(value: unknown): ColorGradingContractIssue[] {
  if (typeof value === "string") {
    return value.trim() ? [] : [{ path: "grading", message: "is empty" }];
  }

  const issues: ColorGradingContractIssue[] = [];
  const grading = validateObject(value, "grading", COLOR_GRADING_TOP_LEVEL_KEYS, issues);
  if (!grading) return issues;

  validateTopLevel(grading, issues);
  validateSections(grading, issues);
  validatePalette(grading.palette, issues);
  return issues;
}
