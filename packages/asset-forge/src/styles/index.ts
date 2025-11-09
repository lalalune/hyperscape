// Styles - Tokens and Utilities
// Consolidated from design-system into styles folder

// Design Tokens
export {
  colors,
  spacing,
  borderRadius,
  typography,
  effects,
  animation,
  layout,
} from "./tokens";

// Utilities
export {
  cn,
  createVariants,
  tokensToCSS,
  debounce,
  focusManager,
  animations,
  responsive as responsiveUtils,
  colorUtils,
} from "./utils";

// Import tokens for theme object
import * as tokens from "./tokens";

// Theme system
export const theme = {
  colors: tokens.colors,
  spacing: tokens.spacing,
  borderRadius: tokens.borderRadius,
  typography: tokens.typography,
  effects: tokens.effects,
  animation: tokens.animation,
  layout: tokens.layout,
};

// Common component patterns
export const patterns = {
  // Layout patterns
  stack: "flex flex-col space-y-4",
  hstack: "flex flex-row space-x-4",
  center: "flex items-center justify-center",

  // Interactive patterns
  clickable: "clickable",
  focusRing: "focus-ring",

  // Visual patterns
  glass: "glass",
  gradient: "gradient-bg",
  shadow: "shadow-md hover:shadow-lg transition-shadow duration-200",
};

// Responsive breakpoint helpers
export const responsiveLayouts = {
  mobile: "max-w-sm mx-auto",
  tablet: "max-w-md mx-auto sm:max-w-lg",
  desktop: "max-w-lg mx-auto sm:max-w-xl md:max-w-2xl lg:max-w-4xl",
  wide: "max-w-xs mx-auto sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl",
};
