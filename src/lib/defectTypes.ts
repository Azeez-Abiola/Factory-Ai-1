/** Shared defect-type contract used by Admin → AI Model & Categories and the Quality page. */
export interface DefectType {
  id: string;
  label: string;
  description: string;
  severity_hint?: "low" | "medium" | "high" | "critical";
  enabled?: boolean;
}

/** Starting set offered to a tenant that has not customised its defect list yet. */
export const DEFAULT_DEFECT_TYPES: DefectType[] = [
  { id: "surface-damage", label: "Surface damage", description: "scratches, dents, cracks or chips on the product surface", severity_hint: "medium", enabled: true },
  { id: "misalignment", label: "Misalignment", description: "parts, caps or labels not seated square or centred", severity_hint: "medium", enabled: true },
  { id: "label-error", label: "Label / print error", description: "missing, skewed, smudged or unreadable labels and codes", severity_hint: "medium", enabled: true },
  { id: "contamination", label: "Contamination", description: "foreign material, residue or spillage on or in the product", severity_hint: "high", enabled: true },
  { id: "packaging-defect", label: "Packaging defect", description: "torn, underfilled, unsealed or deformed packaging", severity_hint: "medium", enabled: true },
];

const normalise = (s: string) =>
  s.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

/** Does an alert belong to a configured defect type? Matches type, title or detection labels. */
export const matchesDefectType = (
  alert: { type?: string | null; title?: string | null; metadata?: Record<string, unknown> | null },
  defect: DefectType,
) => {
  const label = normalise(defect.label);
  if (!label) return false;
  const hay = normalise(`${alert.type ?? ""} ${alert.title ?? ""}`);
  if (hay.includes(label) || normalise(alert.type ?? "") === normalise(defect.id)) return true;
  const dets = (alert.metadata as { detections?: unknown[] } | null)?.detections;
  return Array.isArray(dets) && dets.some((d) => {
    const rec = d as Record<string, unknown>;
    return normalise(String(rec?.label ?? "")).includes(label)
      || normalise(String(rec?.defect_type ?? "")).includes(label);
  });
};
