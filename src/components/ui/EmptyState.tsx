"use client";

import { ReactNode } from "react";

export default function EmptyState({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
        {icon ?? <span className="text-xl">✨</span>}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
