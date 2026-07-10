import * as React from "react";
import { cn } from "../../lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "accent" | "current";
}

export function Spinner({
  className,
  size = "md",
  color = "primary",
  ...props
}: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-t-2 border-r-2 border-transparent",
        size === "sm" && "h-4 w-4 border-2",
        size === "md" && "h-8 w-8 border-2",
        size === "lg" && "h-12 w-12 border-3",
        color === "primary" && "border-t-primary border-r-primary",
        color === "secondary" && "border-t-secondary border-r-secondary",
        color === "accent" && "border-t-amber-500 border-r-amber-500",
        color === "current" && "border-t-current border-r-current",
        className
      )}
      {...props}
    />
  );
}
