// src/components/BrandLogo.tsx
import React from "react";
import Image from "next/image";

type BrandLogoProps = {
  variant?: "full" | "mark";
  size?: number;
  className?: string;
  textClassName?: string;
  priority?: boolean;
};

const BRAND_ICON_SRC = "/icons/icon-192.png";

export default function BrandLogo({
  variant = "full",
  size = 28,
  className = "",
  textClassName = "",
  priority = false,
}: BrandLogoProps) {
  const wrapperClass =
    "inline-flex items-center select-none" + (className ? ` ${className}` : "");

  const labelClass =
    "text-white font-semibold tracking-tight" +
    (textClassName ? ` ${textClassName}` : "");

  return (
    <div className={wrapperClass} style={{ gap: variant === "full" ? 10 : 0 }}>
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(10, Math.round(size * 0.32)),
          overflow: "hidden",
          boxShadow:
            "0 10px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      >
        <Image
          src={BRAND_ICON_SRC}
          alt="SyncPlans"
          width={size}
          height={size}
          priority={priority}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {variant === "full" && (
        <span
          className={labelClass}
          style={{
            fontSize: Math.max(16, Math.round(size * 0.64)),
            lineHeight: 1,
          }}
        >
          SyncPlans
        </span>
      )}
    </div>
  );
}