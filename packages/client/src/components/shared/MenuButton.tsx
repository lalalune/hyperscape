import React from "react";

interface MenuButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  size?: "compact" | "small" | "normal";
  circular?: boolean;
}

export function MenuButton({
  icon,
  label,
  active,
  onClick,
  size = "normal",
  circular = false,
}: MenuButtonProps) {
  const sizeClass =
    size === "compact"
      ? "w-9 h-9 text-lg"
      : size === "small"
        ? "w-10 h-10 text-xl"
        : "w-12 h-12 text-2xl";
  const shapeClass = circular ? "rounded-full" : "rounded-lg";

  return (
    <button
      onClick={onClick}
      className={`${sizeClass} ${shapeClass} text-white cursor-pointer flex items-center justify-center transition-all duration-200 touch-manipulation relative hover:scale-105 active:scale-95 ${
        active
          ? "border-2 border-blue-500/80 bg-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
          : "border border-white/20 bg-[rgba(12,12,20,0.95)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
      title={label}
    >
      {icon}
    </button>
  );
}
