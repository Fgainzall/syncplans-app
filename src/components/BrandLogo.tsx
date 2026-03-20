"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type BrandLogoVariant = "default" | "mark" | "full" | string;

type BrandLogoProps = {
  size?: number;
  href?: string;
  showWordmark?: boolean;
  variant?: BrandLogoVariant;
  priority?: boolean;
};

const HEADER_LOGO_SRC = "/icons/brand/syncplans-header-mark.png";
const FALLBACK_LOGO_SRC = "/icons/brand/syncplans-logo.png";

export default function BrandLogo({
  size = 30,
  href,
  showWordmark,
  variant = "default",
  priority = true,
}: BrandLogoProps) {
  const [logoSrc, setLogoSrc] = useState(HEADER_LOGO_SRC);

  const resolvedShowWordmark =
    typeof showWordmark === "boolean"
      ? showWordmark
      : variant !== "mark";

  const iconSize = Math.max(20, size);
  const wordmarkSize = Math.max(18, Math.round(iconSize * 0.95));

  const content = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: resolvedShowWordmark ? 10 : 0,
        minWidth: 0,
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: iconSize,
          height: iconSize,
          flex: "0 0 auto",
        }}
      >
        <Image
          src={logoSrc}
          alt="SyncPlans"
          width={iconSize}
          height={iconSize}
          priority={priority}
          onError={() => {
            if (logoSrc !== FALLBACK_LOGO_SRC) {
              setLogoSrc(FALLBACK_LOGO_SRC);
            }
          }}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            display: "block",
          }}
        />
      </span>

      {resolvedShowWordmark && (
        <span
          style={{
            color: "#F8FAFC",
            fontWeight: 900,
            fontSize: wordmarkSize,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
            textRendering: "optimizeLegibility",
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
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {content}
      </Link>
    );
  }

  return content;
}