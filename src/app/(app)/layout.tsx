"use client";

import React from "react";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div style={{ paddingBottom: "96px" }}>{children}</div>

      <div className="md:hidden">
        <BottomNav />
      </div>
    </>
  );
}