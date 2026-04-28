/**
 * Combat Style Selector
 *
 * Renders the banner grid of combat style options with heraldic shield icons.
 * Includes the draggable CombatStyleBanner sub-component and autocast badge.
 */

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { getPanelInsetStyle } from "@/ui/theme/themes";
import type { Theme } from "@/ui/theme/themes";
import {
  BannerStyleIcon,
  SHIELD_OUTER,
  SHIELD_INNER,
  XP_SHORT_LABELS,
} from "./StyleIcons";
import type { CombatStyleInfo, CombatStyleSelectorProps } from "./types";

/** Single combat style banner -- heraldic shield using theme colors */
const CombatStyleBanner = ({
  style: styleInfo,
  isActive,
  disabled,
  isMobile,
  onClick,
  theme,
}: {
  style: CombatStyleInfo;
  isActive: boolean;
  disabled: boolean;
  isMobile: boolean;
  onClick: () => void;
  theme: Theme;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `combatstyle-${styleInfo.id}`,
    data: {
      combatStyle: {
        id: styleInfo.id,
        label: styleInfo.label,
        color: styleInfo.color,
      },
      source: "combatstyle",
    },
    disabled,
  });

  const shortXp =
    XP_SHORT_LABELS[styleInfo.xp] ||
    `+${styleInfo.xp.slice(0, 3).toUpperCase()}`;
  const baseGradId = `banner-base-${styleInfo.id}`;
  const tintGradId = `banner-tint-${styleInfo.id}`;

  // Theme-derived colors
  const bgDark = theme.colors.background.primary;
  const bgMid = theme.colors.background.secondary;
  const bgLight = theme.colors.background.tertiary;
  const accentGold = theme.colors.accent.primary;
  const borderClr = theme.colors.border.default;
  const textMuted = theme.colors.text.muted;
  const textPrimary = theme.colors.text.primary;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        flex: "0 0 calc((100% - 3 * (var(--banner-gap))) / 4)",
        maxWidth: "calc((100% - 3 * (var(--banner-gap))) / 4)",
        minWidth: 0,
        position: "relative",
        opacity: disabled ? 0.5 : isDragging ? 0.6 : 1,
        transform: isDragging ? "scale(0.95)" : "scale(1)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
        touchAction: "none",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick();
        }}
        disabled={disabled}
        aria-pressed={isActive}
        className="combat-banner focus-visible:outline-none"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: isMobile ? "0.58" : "0.52",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          touchAction: "manipulation",
        }}
      >
        {/* SVG shield / crest shape */}
        <svg
          viewBox="0 0 100 130"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            filter: isActive
              ? `drop-shadow(0 3px 8px ${styleInfo.color}35) drop-shadow(0 1px 2px rgba(0,0,0,0.6))`
              : "drop-shadow(0 2px 5px rgba(0,0,0,0.5))",
            transition: "filter 0.2s ease",
          }}
        >
          <defs>
            {/* Theme base gradient */}
            <linearGradient id={baseGradId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isActive ? bgLight : bgMid}
                stopOpacity={1}
              />
              <stop
                offset="50%"
                stopColor={isActive ? bgMid : bgDark}
                stopOpacity={1}
              />
              <stop offset="100%" stopColor={bgDark} stopOpacity={1} />
            </linearGradient>
            {/* Color tint overlay for active state */}
            {isActive && (
              <linearGradient id={tintGradId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.28}
                />
                <stop
                  offset="55%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.1}
                />
                <stop
                  offset="100%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.03}
                />
              </linearGradient>
            )}
          </defs>

          {/* Outer shadow edge */}
          <path
            d={SHIELD_OUTER}
            fill="none"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={3.5}
          />
          {/* Base fill */}
          <path d={SHIELD_OUTER} fill={`url(#${baseGradId})`} />
          {/* Active color tint overlay */}
          {isActive && <path d={SHIELD_OUTER} fill={`url(#${tintGradId})`} />}
          {/* Border stroke -- gold accent inactive, style color active */}
          <path
            d={SHIELD_OUTER}
            fill="none"
            stroke={isActive ? `${styleInfo.color}aa` : `${borderClr}`}
            strokeWidth={isActive ? 1.8 : 1.2}
          />
          {/* Top edge highlight */}
          <line
            x1="10"
            y1="1.2"
            x2="90"
            y2="1.2"
            stroke={isActive ? `${styleInfo.color}44` : `${accentGold}18`}
            strokeWidth={0.8}
            strokeLinecap="round"
          />
          {/* Inner bevel for depth */}
          <path
            d={SHIELD_INNER}
            fill="none"
            stroke={
              isActive ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)"
            }
            strokeWidth={0.6}
          />
        </svg>

        {/* Icon protruding from top of shield */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: isMobile ? 28 : 34,
            height: isMobile ? 28 : 34,
            borderRadius: "50%",
            background: isActive
              ? `radial-gradient(circle, ${bgLight} 40%, ${bgMid} 100%)`
              : `radial-gradient(circle, ${bgMid} 40%, ${bgDark} 100%)`,
            border: isActive
              ? `1.5px solid ${styleInfo.color}88`
              : `1px solid ${borderClr}`,
            boxShadow: isActive
              ? `0 2px 6px ${styleInfo.color}30, 0 1px 3px rgba(0,0,0,0.4)`
              : "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          <BannerStyleIcon
            style={styleInfo.id}
            size={isMobile ? 16 : 20}
            color={isActive ? styleInfo.color : accentGold}
            muted={!isActive}
          />
        </div>

        {/* Content overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingTop: isMobile ? "16px" : "20px",
            paddingBottom: isMobile ? "18px" : "22px",
            gap: isMobile ? "2px" : "3px",
          }}
        >
          {/* Style name */}
          <span
            style={{
              fontSize: isMobile ? "8.5px" : "10px",
              fontWeight: 700,
              color: isActive ? textPrimary : textMuted,
              lineHeight: 1.15,
              textAlign: "center",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              textShadow: isActive
                ? `0 1px 3px rgba(0,0,0,0.7), 0 0 8px ${styleInfo.color}25`
                : "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {styleInfo.label}
          </span>

          {/* XP bonus label */}
          <span
            style={{
              fontSize: isMobile ? "8.5px" : "10px",
              fontWeight: 700,
              color: isActive ? styleInfo.color : `${accentGold}88`,
              lineHeight: 1,
              textAlign: "center",
              letterSpacing: "0.05em",
              textShadow: isActive ? `0 0 6px ${styleInfo.color}35` : "none",
            }}
          >
            {shortXp}
          </span>
        </div>
      </button>
    </div>
  );
};

/** Combat style selector section with banner grid, header, and cooldown indicator */
export const CombatStyleSelector = React.memo(function CombatStyleSelector({
  styles,
  activeStyleId,
  cooldown,
  compactPanel,
  theme,
  onStyleChange,
}: CombatStyleSelectorProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: compactPanel ? 6 : 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "9px",
            lineHeight: 1,
            color: theme.colors.text.muted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
          }}
        >
          Combat Styles
        </span>
        {activeStyleId === "autocast" && (
          <span
            style={{
              padding: "2px 5px",
              borderRadius: 4,
              background: "#8b5cf618",
              border: "1px solid #8b5cf633",
              fontSize: "8px",
              fontWeight: 700,
              color: "#c4b5fd",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Autocast
          </span>
        )}
      </div>
      <div
        style={
          {
            display: "flex",
            gap: compactPanel ? "4px" : "6px",
            width: "100%",
            marginTop: compactPanel ? 14 : 17,
            justifyContent: "center",
            "--banner-gap": compactPanel ? "4px" : "6px",
          } as React.CSSProperties
        }
      >
        {styles.map((s) => (
          <CombatStyleBanner
            key={s.id}
            style={s}
            isActive={activeStyleId === s.id}
            disabled={cooldown > 0}
            isMobile={compactPanel}
            onClick={() => onStyleChange(s.id)}
            theme={theme}
          />
        ))}
      </div>

      {cooldown > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "9px",
            color: theme.colors.state.warning,
            background: `${theme.colors.state.warning}10`,
            padding: "2px 5px",
            borderRadius: 4,
            border: `1px solid ${theme.colors.state.warning}25`,
            marginTop: compactPanel ? 4 : 6,
          }}
        >
          Style change in {Math.ceil(cooldown / 1000)}s
        </div>
      )}
    </>
  );
});
