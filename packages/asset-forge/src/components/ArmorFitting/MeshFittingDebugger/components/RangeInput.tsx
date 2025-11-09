import React from "react";

import { cn } from "../../../../styles";

export const RangeInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = (props) => {
  return (
    <input
      type="range"
      {...props}
      className={cn(
        "w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer",
        "[&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full",
        "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none",
        "[&::-moz-range-thumb]:shadow-md",
        props.className,
      )}
    />
  );
};
