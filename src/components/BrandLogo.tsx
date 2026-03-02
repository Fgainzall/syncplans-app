// src/components/BrandLogo.tsx
"use client";

import React from "react";

type BrandLogoProps = {
  /** "full" = ícono + texto, "mark" = solo ícono */
  variant?: "full" | "mark";
  /** Tamaño del ícono en px (alto y ancho) */
  size?: number;
  className?: string;
};

const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  size = 28,
  className = "",
}) => {
  const iconSize = `${size}px`;
  const wrapperClass =
    "inline-flex items-center gap-2 select-none" +
    (className ? ` ${className}` : "");

  return (
    <div className={wrapperClass}>
      {/* Ícono "S" futurista */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <defs>
          {/* Degradado principal azul -> violeta */}
          <linearGradient
            id="syncplans-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#17D2FF" />
            <stop offset="100%" stopColor="#7B3CFF" />
          </linearGradient>

          {/* Glow suave en el centro */}
          <radialGradient id="syncplans-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Trazo en forma de “S” gruesa */}
        <path
          d="
            M 18 14
            C 18 9 22 6 27 6
            L 40 6
            C 46 6 50 10 50 16
            C 50 22 46 26 40 26
            L 30 26
            C 24 26 20 30 20 36
            C 20 42 24 46 30 46
            L 37 46
            C 43 46 48 50 48 56
            C 48 60 45 63 41 63
            L 26 63
            C 20 63 16 59 16 53
          "
          fill="none"
          stroke="url(#syncplans-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glow central */}
        <circle cx="32" cy="34" r="12" fill="url(#syncplans-glow)" />

        {/* Punto central sólido */}
        <circle cx="32" cy="34" r="3.2" fill="#FFFFFF" />
      </svg>

      {/* Texto SyncPlans solo en variante "full" */}
      {variant === "full" && (
        <span className="text-white text-lg font-semibold tracking-tight">
          SyncPlans
        </span>
      )}
    </div>
  );
};

export default BrandLogo;