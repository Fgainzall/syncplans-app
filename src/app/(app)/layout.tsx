"use client";

import React from "react";
import InstallAppBanner from "@/components/InstallAppBanner";
import MobileScaffold from "@/components/MobileScaffold";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileScaffold
        maxWidth={1180}
        paddingDesktop="18px 12px 120px"
        paddingMobile="14px 12px 120px"
      >
        {children}
      </MobileScaffold>
      <InstallAppBanner />
    </>
  );
}