import { Suspense } from "react";
import Client from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#050816",
          }}
        />
      }
    >
      <Client />
    </Suspense>
  );
}