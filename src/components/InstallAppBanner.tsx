"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppBanner() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => {
      const standalone =
        media.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };

    checkInstalled();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", checkInstalled);
    } else {
      media.addListener(checkInstalled);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);

      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", checkInstalled);
      } else {
        media.removeListener(checkInstalled);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setPromptEvent(null);
    }
  };

  if (isInstalled || !promptEvent) return null;

  return (
    <div style={wrap}>
      <div style={copyBlock}>
        <div style={title}>Instala SyncPlans</div>
        <div style={text}>Úsalo como app y entra más rápido la próxima vez.</div>
      </div>

      <button type="button" onClick={handleInstall} style={button}>
        Instalar
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 12,
  right: 12,
  bottom: "calc(env(safe-area-inset-bottom) + 84px)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 14px",
  borderRadius: 20,
  background: "rgba(15,15,18,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  backdropFilter: "blur(14px)",
};

const copyBlock: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const title: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
};

const text: React.CSSProperties = {
  color: "rgba(255,255,255,0.72)",
  fontSize: 12,
  lineHeight: 1.35,
};

const button: React.CSSProperties = {
  border: "none",
  outline: "none",
  cursor: "pointer",
  borderRadius: 999,
  padding: "10px 14px",
  background: "#FFFFFF",
  color: "#111111",
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
};