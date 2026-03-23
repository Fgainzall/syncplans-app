"use client";

import type { CSSProperties, ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export default function Section({ children, style }: SectionProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        marginBottom: 20,
        ...style,
      }}
    >
      {children}
    </section>
  );
}