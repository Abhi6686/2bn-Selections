import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "level1" | "level2" | "level3";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-primary text-white shadow",
        variant === "secondary" && "border-transparent bg-secondary/20 text-secondary border border-secondary/30",
        variant === "destructive" && "border-transparent bg-destructive text-destructive-foreground shadow",
        variant === "outline" && "text-foreground border border-input",
        variant === "level1" && "border-transparent bg-emerald-950/20 text-emerald-800 border border-emerald-800/30 dark:bg-emerald-900/30 dark:text-emerald-400",
        variant === "level2" && "border-transparent bg-amber-950/20 text-amber-800 border border-amber-800/30 dark:bg-amber-900/30 dark:text-amber-400",
        variant === "level3" && "border-transparent bg-purple-950/20 text-purple-800 border border-purple-800/30 dark:bg-purple-900/30 dark:text-purple-400",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeProps as UI_BadgeProps };
