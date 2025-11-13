/**
 * Extra utilities
 * THREE.js, animation, UI, and infrastructure utilities
 */

// Explicitly export our custom Curve class to avoid conflicts with THREE.Curve
export { Curve } from "./animation/Curve";

// Export other animation utilities
export { LerpVector3, LerpQuaternion, ReactiveVector3 } from "./animation";

// Organized subdirectories
export * from "./three"; // THREE.js utilities
export * from "./ui"; // UI rendering
