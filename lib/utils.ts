import { clsx, type ClassValue } from "clsx";
import type { ShipmentHealth, AlertSeverity, MilestoneStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

type HealthStyle = { label: string; text: string; bg: string; dot: string };
type HealthStyleMap = Record<ShipmentHealth, HealthStyle>;

export const healthStyles: HealthStyleMap = {
  on_time: {
    label: "On Time",
    text: "text-success",
    bg: "bg-success-soft",
    dot: "bg-success",
  },
  delayed: {
    label: "Delayed",
    text: "text-danger",
    bg: "bg-danger-soft",
    dot: "bg-danger",
  },
  not_started: {
    label: "Not Started",
    text: "text-warning",
    bg: "bg-warning-soft",
    dot: "bg-warning",
  },
  completed: {
    label: "Completed",
    text: "text-success",
    bg: "bg-success-soft",
    dot: "bg-success",
  },
};

export function healthBadgeLabel(health: ShipmentHealth, delayDays: number) {
  if (health === "delayed") {
    return `Delayed · ${delayDays} day${delayDays === 1 ? "" : "s"}`;
  }
  if (health === "not_started") return "Not Started";
  if (health === "completed") return "Completed";
  return "On Time";
}

type SeverityStyle = { text: string; bg: string; border: string };
type SeverityStyleMap = Record<AlertSeverity, SeverityStyle>;

export const severityStyles: SeverityStyleMap = {
  critical: {
    text: "text-danger",
    bg: "bg-danger-soft",
    border: "border-danger/20",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning-soft",
    border: "border-warning/20",
  },
  info: {
    text: "text-info",
    bg: "bg-info-soft",
    border: "border-info/20",
  },
};

type MilestoneStyle = { circle: string; line: string; text: string };
type MilestoneStyleMap = Record<MilestoneStatus, MilestoneStyle>;

export const milestoneStyles: MilestoneStyleMap = {
  completed: {
    circle: "bg-success text-white",
    line: "bg-success",
    text: "text-text-primary",
  },
  current: {
    circle: "bg-accent text-white",
    line: "bg-border-strong",
    text: "text-text-primary",
  },
  delayed: {
    circle: "bg-danger text-white",
    line: "bg-border-strong",
    text: "text-text-primary",
  },
  pending: {
    circle: "bg-page text-text-tertiary border border-border-strong",
    line: "bg-border-strong",
    text: "text-text-tertiary",
  },
};

export function formatUpdatedAt(date: Date = new Date()) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The two businesses whose containers this system tracks. Every container
 * code is prefixed to say which one it belongs to — "C..." for Uncle
 * Bills, "A..." for Aiwibi Uganda — so the company is always derived from
 * the code itself rather than stored separately (one less thing for a
 * logistics manager to get out of sync when entering a new container).
 */
export type CompanyName = "Uncle Bills" | "Aiwibi Uganda" | "Unknown";

export function getCompanyForContainer(containerNumber: string): CompanyName {
  const prefix = containerNumber.trim().charAt(0).toUpperCase();
  if (prefix === "C") return "Uncle Bills";
  if (prefix === "A") return "Aiwibi Uganda";
  return "Unknown";
}

type CompanyBadgeStyle = { text: string; bg: string };
type CompanyBadgeStyleMap = Record<CompanyName, CompanyBadgeStyle>;

export const companyBadgeStyles: CompanyBadgeStyleMap = {
  "Uncle Bills": { text: "text-slate-600", bg: "bg-slate-100" },
  "Aiwibi Uganda": { text: "text-indigo-600", bg: "bg-indigo-50" },
  Unknown: { text: "text-text-secondary", bg: "bg-page" },
};

// Roles that may set how many days a container should spend at each
// milestone stage. Viewer is deliberately excluded.
export const STAGE_DURATION_MANAGER_ROLES = [
  "Admin",
  "Logistics Manager",
  "Operations Officer",
] as const;

export function canManageStageDurations(role: string): boolean {
  return (STAGE_DURATION_MANAGER_ROLES as readonly string[]).includes(role);
}