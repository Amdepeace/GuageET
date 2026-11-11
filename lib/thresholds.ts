import type { ThresholdRule } from "./data";

export type Light = "green" | "amber" | "red" | "unknown";

const RANK: Record<Light, number> = { unknown: 0, green: 1, amber: 2, red: 3 };

export function evalRule(rule: ThresholdRule, value: number | null | undefined): Light {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (rule.redAbove != null && value > rule.redAbove) return "red";
  if (rule.redBelow != null && value < rule.redBelow) return "red";
  if (rule.amberAbove != null && value > rule.amberAbove) return "amber";
  if (rule.amberBelow != null && value < rule.amberBelow) return "amber";
  return "green";
}

export function worst(lights: Light[]): Light {
  const known = lights.filter((l) => l !== "unknown");
  if (!known.length) return "unknown";
  return known.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}

export type RuleResult = { rule: ThresholdRule; value: number | null; light: Light };
