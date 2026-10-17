"use client";

import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Seconds to wait before the reveal — used for gentle per-card stagger. */
  delay?: number;
  className?: string;
}

/**
 * Quiet scroll reveal: fade + short slide-up the first time an element enters
 * the viewport. MotionConfig's reducedMotion="user" drops the transform for
 * visitors who prefer reduced motion (only a soft fade remains), and the CSS
 * reset in globals.css covers CSS transitions site-wide.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, delay, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
