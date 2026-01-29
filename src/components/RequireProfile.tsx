"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMyProfile } from "@/lib/profilesDb";

export default function RequireProfile({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const profile = await getMyProfile();

        if (!profile && !pathname.startsWith("/onboarding")) {
          router.replace("/onboarding/profile");
          return;
        }

        if (alive) setReady(true);
      } catch (err) {
        console.warn("RequireProfile fallback:", err);
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ready) return null;

  return <>{children}</>;
}
