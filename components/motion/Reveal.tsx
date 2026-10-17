import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** 'scroll' reveals on viewport entry; 'load' fades in once at page load. */
  mode?: "scroll" | "load";
  className?: string;
}

/**
 * Progressive-enhancement reveal wrapper — a server component with no
 * client JS. The animation lives entirely in CSS (globals.css): content is
 * visible by default in the SSR HTML, reveals still run with scripting
 * disabled, unsupported browsers show content statically, and both
 * prefers-reduced-motion and print drop the animation outright.
 */
export function Reveal({ children, mode = "scroll", className }: RevealProps) {
  const base = mode === "load" ? "reveal-load" : "reveal-scroll";
  return (
    <div className={className ? `${base} ${className}` : base}>{children}</div>
  );
}
