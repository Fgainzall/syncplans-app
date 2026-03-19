// src/components/BrandLogo.tsx
"use client";

import React from "react";

type BrandLogoProps = {
  variant?: "full" | "mark";
  size?: number;
  className?: string;
  textClassName?: string;
};

export default function BrandLogo({
  variant = "full",
  size = 28,
  className = "",
  textClassName = "",
}: BrandLogoProps) {
  const wrapperClass =
    "inline-flex items-center select-none" + (className ? ` ${className}` : "");

  const labelClass =
    "text-white font-semibold tracking-tight" +
    (textClassName ? ` ${textClassName}` : "");

  if (variant === "mark") {
    return (
      <div className={wrapperClass} aria-label="SyncPlans">
        <div
          style={{
            width: size,
            height: size,
            borderRadius: Math.max(10, Math.round(size * 0.32)),
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(8,12,20,0.96))",
            boxShadow:
              "0 10px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
            display: "grid",
            placeItems: "center",
            color: "#F8FBFF",
            fontSize: Math.max(14, Math.round(size * 0.42)),
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    );
  }

  return (
    <div
      className={wrapperClass}
      aria-label="SyncPlans"
      style={{ gap: 10 }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(10, Math.round(size * 0.32)),
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(8,12,20,0.96))",
          boxShadow:
            "0 10px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
          display: "grid",
          placeItems: "center",
          color: "#F8FBFF",
          fontSize: Math.max(14, Math.round(size * 0.42)),
          fontWeight: 900,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        S
      </div>

      <span
        className={labelClass}
        style={{
          fontSize: Math.max(16, Math.round(size * 0.64)),
          lineHeight: 1,
        }}
      >
        SyncPlans
      </span>
    </div>
  );
}