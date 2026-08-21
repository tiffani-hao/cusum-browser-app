import type { AnalysisOptions } from "../core";

export type ConfiguredDiseasePresetId = "hiv";
export type DiseasePresetSelection = ConfiguredDiseasePresetId | "custom";

export interface DiseasePreset {
  id: ConfiguredDiseasePresetId;
  label: string;
  options: AnalysisOptions;
}

export const DEFAULT_DISEASE_PRESET: DiseasePreset = {
  id: "hiv",
  label: "HIV",
  options: {
    analysis_interval: "monthly",
    smoothing_window: 3,
    baseline_window: 36,
    k: 0.1,
    threshold: 3,
    group_by_risk_group: false,
  },
};

export const DISEASE_PRESETS: readonly DiseasePreset[] = [
  DEFAULT_DISEASE_PRESET,
];

export function diseasePresetById(id: string): DiseasePreset | undefined {
  return DISEASE_PRESETS.find((preset) => preset.id === id);
}
