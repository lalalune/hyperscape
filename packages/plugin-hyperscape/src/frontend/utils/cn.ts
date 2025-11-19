/**
 * Utility function to merge Tailwind CSS class names
 *
 * Combines class names and handles conditional classes.
 * Similar to clsx/classnames but optimized for Tailwind.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
