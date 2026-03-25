"use client";

import React from "react";
import InstallAppBanner from "@/components/InstallAppBanner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <InstallAppBanner />
    </>
  );
}