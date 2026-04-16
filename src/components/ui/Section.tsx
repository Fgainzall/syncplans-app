"use client";

import React from "react";

type SectionProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  gap?: number;
  mobileGap?: number;
};

export default function Section({
  children,
  style,
  className,
  gap = 16,
  mobileGap = 14,
}: SectionProps) {
  return (
    <section
      className={[
        "sp-section",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        display: "grid",
        gap,
        width: "100%",
        ...style,
      }}
    >
      {children}

      <style jsx>{`
        @media (max-width: 768px) {
          .sp-section {
            gap: ${mobileGap}px !important;
          }
        }
      `}</style>
    </section>
  );
}