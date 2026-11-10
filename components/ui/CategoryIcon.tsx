import React from "react";
import {
  Utensils,
  GlassWater,
  Coffee,
  UtensilsCrossed,
  ShoppingBasket,
  Pizza,
  Car,
  Fuel,
  Bus,
  CarTaxiFront,
  CircleParking,
  Wrench,
  ShoppingBag,
  Shirt,
  Smartphone,
  Lamp,
  Sparkles,
  Zap,
  Wifi,
  Tv,
  Home,
  Building,
  Hammer,
  Gamepad2,
  Plane,
  Palette,
  HeartPulse,
  Pill,
  Stethoscope,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Package,
  Heart,
  Briefcase,
  Award,
  Laptop,
  Building2,
  TrendingUp,
  LineChart,
  Coins,
  Gift,
  Tag,
  HandCoins,
  CreditCard,
  Users,
  Landmark,
  Flame,
  Droplet,
  Phone,
  FileText,
  Globe,
  Layers,
  MoreHorizontal,
  Sliders,
  HelpCircle,
  AlertTriangle,
  LucideIcon,
} from "lucide-react";
import { getParentCategory, getSubCategory } from "@/lib/categories";

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  GlassWater,
  Coffee,
  UtensilsCrossed,
  ShoppingBasket,
  Pizza,
  Car,
  Fuel,
  Bus,
  CarTaxiFront,
  CircleParking,
  Wrench,
  ShoppingBag,
  Shirt,
  Smartphone,
  Lamp,
  Sparkles,
  Zap,
  Wifi,
  Tv,
  Home,
  Building,
  Hammer,
  Gamepad2,
  Plane,
  Palette,
  HeartPulse,
  Pill,
  Stethoscope,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Package,
  Heart,
  Briefcase,
  Award,
  Laptop,
  Building2,
  TrendingUp,
  LineChart,
  Coins,
  Gift,
  Tag,
  HandCoins,
  CreditCard,
  Users,
  Landmark,
  Flame,
  Droplet,
  Phone,
  FileText,
  Globe,
  Layers,
  MoreHorizontal,
  Sliders,
  HelpCircle,
  AlertTriangle,
};

interface CategoryIconProps {
  categoryId?: string;
  subCategoryId?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AllCategoriesGlobeGraphic({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #0d3b4c 0%, #115e59 100%)",
        border: "1.5px solid rgba(45, 212, 191, 0.4)",
      }}
    >
      <svg
        width={Math.round(size * 0.7)}
        height={Math.round(size * 0.7)}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="#2dd4bf" strokeWidth="2" />
        <ellipse cx="12" cy="12" rx="4.5" ry="10" stroke="#facc15" strokeWidth="1.8" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="#38bdf8" strokeWidth="2" />
        <line x1="4.5" y1="7" x2="19.5" y2="7" stroke="#38bdf8" strokeWidth="1.5" />
        <line x1="4.5" y1="17" x2="19.5" y2="17" stroke="#38bdf8" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function CategoryIcon({
  categoryId,
  subCategoryId,
  size = "md",
  className = "",
}: CategoryIconProps) {
  const pixelSizes = {
    sm: 32,
    md: 44,
    lg: 52,
    xl: 64,
  };

  if (categoryId === "ALL_CATEGORIES" || categoryId === "ALL" || categoryId === "all_categories") {
    return <AllCategoriesGlobeGraphic size={pixelSizes[size]} className={className} />;
  }

  let iconName = "Package";
  let color = "#38bdf8";
  let bgColor = "#0c2b42";
  let border = "rgba(56, 189, 248, 0.3)";

  if (categoryId === "OTHER_CATEGORIES" || categoryId === "other_categories") {
    iconName = "Layers";
    color = "#a78bfa";
    bgColor = "#2e1065";
    border = "rgba(167, 139, 250, 0.3)";
  } else if (subCategoryId) {
    const sub = getSubCategory(subCategoryId);
    if (sub) {
      iconName = sub.child.iconName;
      color = sub.parent.color;
      bgColor = sub.parent.bgColor;
      border = sub.parent.badgeBorder;
    } else {
      // Subcategory not found in tree
      const parent = categoryId ? getParentCategory(categoryId) : undefined;
      if (parent) {
        iconName = parent.iconName;
        color = parent.color;
        bgColor = parent.bgColor;
        border = parent.badgeBorder;
      } else {
        iconName = "AlertTriangle";
        color = "#f59e0b";
        bgColor = "#382407";
        border = "rgba(245, 158, 11, 0.5)";
      }
    }
  } else if (categoryId) {
    const parent = getParentCategory(categoryId);
    if (parent) {
      iconName = parent.iconName;
      color = parent.color;
      bgColor = parent.bgColor;
      border = parent.badgeBorder;
    } else {
      // Check if categoryId is directly a subcategory
      const sub = getSubCategory(categoryId);
      if (sub) {
        iconName = sub.child.iconName;
        color = sub.parent.color;
        bgColor = sub.parent.bgColor;
        border = sub.parent.badgeBorder;
      } else {
        // Unknown category! Give special warning styling
        iconName = "AlertTriangle";
        color = "#f59e0b";
        bgColor = "#382407";
        border = "rgba(245, 158, 11, 0.5)";
      }
    }
  } else {
    // Missing category
    iconName = "HelpCircle";
    color = "#ef4444";
    bgColor = "#361010";
    border = "rgba(239, 68, 68, 0.5)";
  }

  const IconComponent = ICON_MAP[iconName] || Package;

  const sizeClasses = {
    sm: "w-8 h-8 rounded-full text-xs",
    md: "w-11 h-11 rounded-full text-sm",
    lg: "w-13 h-13 rounded-2xl text-base",
    xl: "w-16 h-16 rounded-2xl text-lg",
  };

  const iconSizes = {
    sm: 15,
    md: 20,
    lg: 24,
    xl: 28,
  };

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 transition-transform duration-200 shadow-sm ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: bgColor,
        border: `1.5px solid ${border}`,
        color: color,
      }}
    >
      <IconComponent size={iconSizes[size]} strokeWidth={2.2} />
    </div>
  );
}
