"use client";

import Image from "next/image";
import Link from "next/link";

type BrandLogoVariant = "default" | "mark" | "full" | string;

type BrandLogoProps = {
  size?: number;
  href?: string;
  showWordmark?: boolean;
  variant?: BrandLogoVariant;
};

export default function BrandLogo({
  size = 30,
  href,
  showWordmark,
  variant = "default",
}: BrandLogoProps) {
  const resolvedShowWordmark =
    typeof showWordmark === "boolean"
      ? showWordmark
      : variant !== "mark";

  const content = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: resolvedShowWordmark ? 10 : 0,
        minWidth: 0,
      }}
    >
      <Image
        src="/icons/brand/syncplans-logo.png"
        alt="SyncPlans"
        width={size}
        height={size}
        priority
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          flexShrink: 0,
        }}
      />

      {resolvedShowWordmark && (
        <span
          style={{
            color: "#F8FAFC",
            fontWeight: 900,
            fontSize: Math.max(20, Math.round(size * 0.95)),
            lineHeight: 1,
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
          }}
        >
          SyncPlans
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="Ir al inicio"
        style={{ textDecoration: "none", display: "inline-flex" }}
      >
        {content}
      </Link>
    );
  }

  return content;
}