"use client";

import React from "react";

type SectionProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export default function Section({
  children,
  style,
  className,
}: SectionProps) {
  return (
    <section
      className={className}
      style={{
        display: "grid",
        gap: 18,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </section>
  );
}