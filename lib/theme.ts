export type ThemeColorId = "blue" | "green" | "purple" | "cyan" | "amber" | "rose";

export interface ThemeColorConfig {
  id: ThemeColorId;
  name: string;
  badge?: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  glow: string;
  subtle: string;
  border: string;
  gradient: string;
  previewColor: string;
}

export const DEFAULT_THEME_COLOR: ThemeColorId = "green";

export const THEME_COLORS: ThemeColorConfig[] = [
  {
    id: "green",
    name: "Emerald Green",
    badge: "Best",
    description: "Money Documents color identity",
    primary: "#10b981",
    primaryHover: "#059669",
    primaryLight: "#34d399",
    primaryDark: "#047857",
    glow: "rgba(16, 185, 129, 0.35)",
    subtle: "rgba(16, 185, 129, 0.12)",
    border: "rgba(52, 211, 153, 0.28)",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    previewColor: "#10b981",
  },
  {
    id: "blue",
    name: "Ocean Blue",
    badge: "Classic",
    description: "Declane's Documents color identity",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primaryLight: "#60a5fa",
    primaryDark: "#1e40af",
    glow: "rgba(37, 99, 235, 0.35)",
    subtle: "rgba(37, 99, 235, 0.12)",
    border: "rgba(59, 130, 246, 0.28)",
    gradient: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    previewColor: "#2563eb",
  },
  {
    id: "purple",
    name: "Neon Violet",
    badge: "Vibrant",
    description: "Sleek cyberpunk violet & electric indigo",
    primary: "#8b5cf6",
    primaryHover: "#7c3aed",
    primaryLight: "#a78bfa",
    primaryDark: "#6d28d9",
    glow: "rgba(139, 92, 246, 0.35)",
    subtle: "rgba(139, 92, 246, 0.12)",
    border: "rgba(167, 139, 250, 0.28)",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    previewColor: "#8b5cf6",
  },
  {
    id: "cyan",
    name: "Cyber Cyan",
    badge: "Modern",
    description: "High-tech energetic cyan & sky blue",
    primary: "#06b6d4",
    primaryHover: "#0891b2",
    primaryLight: "#22d3ee",
    primaryDark: "#0e7490",
    glow: "rgba(6, 182, 212, 0.35)",
    subtle: "rgba(6, 182, 212, 0.12)",
    border: "rgba(34, 211, 238, 0.28)",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    previewColor: "#06b6d4",
  },
  {
    id: "amber",
    name: "Sunset Amber",
    badge: "Warm",
    description: "Warm golden amber & energetic sunset",
    primary: "#f59e0b",
    primaryHover: "#d97706",
    primaryLight: "#fbbf24",
    primaryDark: "#b45309",
    glow: "rgba(245, 158, 11, 0.35)",
    subtle: "rgba(245, 158, 11, 0.12)",
    border: "rgba(251, 191, 36, 0.28)",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    previewColor: "#f59e0b",
  },
  {
    id: "rose",
    name: "Rose Pink",
    badge: "Bold",
    description: "Sophisticated modern crimson & rose",
    primary: "#f43f5e",
    primaryHover: "#e11d48",
    primaryLight: "#fb7185",
    primaryDark: "#be123c",
    glow: "rgba(244, 63, 94, 0.35)",
    subtle: "rgba(244, 63, 94, 0.12)",
    border: "rgba(251, 113, 133, 0.28)",
    gradient: "linear-gradient(135deg, #f43f5e, #e11d48)",
    previewColor: "#f43f5e",
  },
];

export function getThemeColorConfig(id: string): ThemeColorConfig {
  const found = THEME_COLORS.find((c) => c.id === id);
  return found || THEME_COLORS[0];
}
