"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={"animate-pulse rounded-2xl bg-white/5 border border-white/10 " + className} />
  );
}
