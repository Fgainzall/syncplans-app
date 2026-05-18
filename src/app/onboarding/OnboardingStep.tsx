// src/app/onboarding/OnboardingStep.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";

type StepNumber = 1 | 2 | 3 | 4;
type CtaState = "idle" | "loading";

type Bullet = {
  title: string;
  body: string;
};

type PreviewItem = {
  label?: string;
  title: string;
  body: string;
  tone?: "cyan" | "violet" | "amber" | "green";
};

type Preview = {
  eyebrow: string;
  title: string;
  badge: string;
  items: PreviewItem[];
  footerTitle?: string;
  footerBody?: string;
};

type StartOption = {
  title: string;
  body: string;
  cta: string;
  target: string;
  kind: "shared" | "solo";
  featured?: boolean;
};

type OnboardingStepProps = {
  step: StepNumber;
  stepTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: Bullet[];
  preview: Preview;
  primaryCta?: string;
  nextStep?: 2 | 3 | 4;
  allowSkip?: boolean;
  showLogin?: boolean;
  options?: StartOption[];
};

const TOTAL_STEPS = 4;
const FLOW = "core";
const WEDGE = "shared_coordination";

export default function OnboardingStep({
  step,
  stepTitle,
  eyebrow,
  title,
  subtitle,
  body,
  bullets,
  preview,
  primaryCta,
  nextStep,
  allowSkip = false,
  showLogin = false,
  options,
}: OnboardingStepProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [skipState, setSkipState] = useState<CtaState>("idle");
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;
  const screen = `onboarding_step_${step}`;

  useEffect(() => {
    void trackScreenView({
      screen,
      metadata: { flow: FLOW, step, wedge: WEDGE },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: {
        flow: FLOW,
        step,
        screen,
        wedge: WEDGE,
      },
    });
  }, [screen, step]);

  function handleLogin() {
    void trackEvent({
      event: "onboarding_login_clicked",
      metadata: { screen, step, wedge: WEDGE },
    });

    router.push(`/auth/login${qsNext}`);
  }

  function handleBack() {
    const previousStep = Math.max(1, step - 1);

    void trackEvent({
      event: "onboarding_step_back_clicked",
      metadata: {
        from_step: step,
        to_step: previousStep,
        screen,
        wedge: WEDGE,
      },
    });

    router.push(`/onboarding/${previousStep}${qsNext}`);
  }

  function handleContinue() {
    if (!nextStep) return;

    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: {
        from_step: step,
        to_step: nextStep,
        screen,
        wedge: WEDGE,
      },
    });

    router.push(`/onboarding/${nextStep}${qsNext}`);
  }

  async function handleSkip() {
    if (skipState === "loading") return;
    setSkipState("loading");

    try {
      void trackEvent({
        event: "onboarding_skipped",
        metadata: {
          screen,
          step,
          destination: nextFinal,
          wedge: WEDGE,
        },
      });

      await markMyOnboardingCompleted();
      router.replace(nextFinal);
    } catch {
      setSkipState("idle");
    }
  }

  async function finishAndGo(option: StartOption) {
    if (loadingTarget) return;
    setLoadingTarget(option.target);

    try {
      await markMyOnboardingCompleted();

      void trackEvent({
        event: "onboarding_completed",
        metadata: {
          screen,
          wedge: WEDGE,
          choice: option.kind,
          target: option.target,
        },
      });

      router.replace(option.target);
    } catch {
      setLoadingTarget(null);
    }
  }

  return (
    <main className="sp-ob-page">
      <div className="sp-ob-glow sp-ob-glow-a" aria-hidden />
      <div className="sp-ob-glow sp-ob-glow-b" aria-hidden />
      <div className="sp-ob-grid-bg" aria-hidden />

      <section className="sp-ob-shell">
        <header className="sp-ob-topbar">
          <div className="sp-ob-brand">
            <div className="sp-ob-logo">
              <BrandLogo variant="mark" size={30} />
            </div>

            <div className="sp-ob-brand-copy">
              <span className="sp-ob-step">Paso {step} de {TOTAL_STEPS}</span>
              <span className="sp-ob-step-title">{stepTitle}</span>
            </div>
          </div>

          <div className="sp-ob-top-actions">
            <div className="sp-ob-progress" aria-label={`Paso ${step} de ${TOTAL_STEPS}`}>
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
                const current = index + 1;
                return (
                  <span
                    key={current}
                    className={current <= step ? "sp-ob-dot sp-ob-dot-active" : "sp-ob-dot"}
                  />
                );
              })}
            </div>

            {showLogin ? (
              <button type="button" className="sp-ob-top-link" onClick={handleLogin}>
                Ya tengo cuenta
              </button>
            ) : null}
          </div>
        </header>

        <div className="sp-ob-layout">
          <section className="sp-ob-main-card">
            <div className="sp-ob-kicker">{eyebrow}</div>

            <h1 className="sp-ob-title">{title}</h1>
            <p className="sp-ob-subtitle">{subtitle}</p>
            <p className="sp-ob-body">{body}</p>

            <div className="sp-ob-bullets">
              {bullets.map((item) => (
                <article key={item.title} className="sp-ob-bullet">
                  <span className="sp-ob-bullet-dot" aria-hidden />
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>

            {options?.length ? (
              <div className="sp-ob-options">
                {options.map((option) => {
                  const isLoading = loadingTarget === option.target;

                  return (
                    <article
                      key={option.title}
                      className={option.featured ? "sp-ob-option sp-ob-option-featured" : "sp-ob-option"}
                    >
                      <div>
                        {option.featured ? <span className="sp-ob-option-badge">Recomendado</span> : null}
                        <h2>{option.title}</h2>
                        <p>{option.body}</p>
                      </div>

                      <button
                        type="button"
                        className={option.featured ? "sp-ob-primary sp-ob-option-button" : "sp-ob-secondary sp-ob-option-button"}
                        onClick={() => finishAndGo(option)}
                        disabled={Boolean(loadingTarget)}
                      >
                        {isLoading ? "Entrando..." : option.cta}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}

            <div className="sp-ob-actions">
              {step > 1 ? (
                <button type="button" className="sp-ob-secondary" onClick={handleBack}>
                  Atrás
                </button>
              ) : null}

              {allowSkip ? (
                <button
                  type="button"
                  className="sp-ob-secondary"
                  onClick={handleSkip}
                  disabled={skipState === "loading"}
                >
                  {skipState === "loading" ? "Entrando..." : "Saltar"}
                </button>
              ) : null}

              {nextStep && primaryCta ? (
                <button type="button" className="sp-ob-primary" onClick={handleContinue}>
                  {primaryCta}
                </button>
              ) : null}
            </div>
          </section>

          <aside className="sp-ob-preview-card">
            <div className="sp-ob-preview-head">
              <div>
                <span className="sp-ob-preview-eyebrow">{preview.eyebrow}</span>
                <h2>{preview.title}</h2>
              </div>

              <span className="sp-ob-status">
                <span aria-hidden />
                {preview.badge}
              </span>
            </div>

            <div className="sp-ob-preview-list">
              {preview.items.map((item) => (
                <article key={`${item.title}-${item.body}`} className={`sp-ob-preview-item sp-ob-tone-${item.tone ?? "cyan"}`}>
                  {item.label ? <span>{item.label}</span> : null}
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            {preview.footerTitle || preview.footerBody ? (
              <div className="sp-ob-preview-footer">
                {preview.footerTitle ? <strong>{preview.footerTitle}</strong> : null}
                {preview.footerBody ? <p>{preview.footerBody}</p> : null}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <style>{onboardingCss}</style>
    </main>
  );
}

const onboardingCss = `
  .sp-ob-page {
    min-height: 100dvh;
    position: relative;
    overflow-x: hidden;
    color: #f8fafc;
    background: radial-gradient(circle at top, rgba(15, 23, 42, 0.96) 0%, #040816 42%, #030712 100%);
    padding: 20px 16px 28px;
  }

  .sp-ob-glow {
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(12px);
  }

  .sp-ob-glow-a {
    width: 320px;
    height: 320px;
    left: -140px;
    top: 100px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.16), transparent 68%);
  }

  .sp-ob-glow-b {
    width: 360px;
    height: 360px;
    right: -160px;
    top: 160px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.15), transparent 70%);
  }

  .sp-ob-grid-bg {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(148, 163, 184, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.035) 1px, transparent 1px);
    background-size: 36px 36px;
    mask-image: radial-gradient(circle at center, black 30%, transparent 86%);
    opacity: 0.55;
    pointer-events: none;
  }

  .sp-ob-shell {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 1120px;
    margin: 0 auto;
    border-radius: 28px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: linear-gradient(180deg, rgba(8, 15, 30, 0.88) 0%, rgba(2, 6, 23, 0.94) 100%);
    box-shadow: 0 22px 70px rgba(2, 6, 23, 0.44);
    backdrop-filter: blur(16px);
    padding: 18px;
  }

  .sp-ob-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .sp-ob-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .sp-ob-logo {
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 16px;
    border: 1px solid rgba(125, 211, 252, 0.22);
    background: rgba(15, 23, 42, 0.74);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .sp-ob-brand-copy {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .sp-ob-step {
    color: #a5f3fc;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  .sp-ob-step-title {
    color: rgba(226, 232, 240, 0.92);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sp-ob-top-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 auto;
  }

  .sp-ob-progress {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.58);
  }

  .sp-ob-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.36);
  }

  .sp-ob-dot-active {
    width: 18px;
    background: linear-gradient(135deg, #22d3ee, #8b5cf6);
  }

  .sp-ob-top-link {
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.58);
    color: rgba(241, 245, 249, 0.92);
    border-radius: 999px;
    padding: 10px 13px;
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .sp-ob-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.9fr);
    gap: 16px;
    align-items: stretch;
  }

  .sp-ob-main-card,
  .sp-ob-preview-card {
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(2, 6, 23, 0.78));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    padding: 22px;
  }

  .sp-ob-main-card {
    display: flex;
    flex-direction: column;
    min-height: 560px;
  }

  .sp-ob-kicker,
  .sp-ob-preview-eyebrow {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    border-radius: 999px;
    border: 1px solid rgba(34, 211, 238, 0.2);
    background: rgba(8, 145, 178, 0.14);
    color: #a5f3fc;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .sp-ob-title {
    margin: 18px 0 0;
    max-width: 740px;
    color: #f8fafc;
    font-size: clamp(36px, 6vw, 68px);
    line-height: 0.95;
    letter-spacing: -0.055em;
    font-weight: 950;
  }

  .sp-ob-subtitle {
    margin: 14px 0 0;
    max-width: 640px;
    color: rgba(226, 232, 240, 0.96);
    font-size: clamp(20px, 2.7vw, 30px);
    line-height: 1.08;
    letter-spacing: -0.03em;
    font-weight: 900;
  }

  .sp-ob-body {
    margin: 14px 0 0;
    max-width: 620px;
    color: rgba(203, 213, 225, 0.86);
    font-size: 16px;
    line-height: 1.65;
  }

  .sp-ob-bullets {
    display: grid;
    gap: 10px;
    margin-top: 22px;
  }

  .sp-ob-bullet {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(15, 23, 42, 0.58);
    padding: 14px 15px;
  }

  .sp-ob-bullet-dot {
    width: 8px;
    height: 8px;
    margin-top: 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #22d3ee, #8b5cf6);
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.38);
  }

  .sp-ob-bullet h2,
  .sp-ob-option h2 {
    margin: 0;
    color: #f8fafc;
    font-size: 16px;
    font-weight: 950;
    letter-spacing: -0.02em;
  }

  .sp-ob-bullet p,
  .sp-ob-option p {
    margin: 5px 0 0;
    color: rgba(203, 213, 225, 0.78);
    font-size: 14px;
    line-height: 1.45;
  }

  .sp-ob-actions {
    margin-top: auto;
    padding-top: 22px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .sp-ob-primary,
  .sp-ob-secondary {
    min-height: 46px;
    border: 0;
    border-radius: 16px;
    padding: 0 18px;
    font-size: 14px;
    font-weight: 950;
    cursor: pointer;
    transition: transform 160ms ease, opacity 160ms ease;
  }

  .sp-ob-primary:hover,
  .sp-ob-secondary:hover,
  .sp-ob-top-link:hover {
    transform: translateY(-1px);
  }

  .sp-ob-primary:disabled,
  .sp-ob-secondary:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .sp-ob-primary {
    color: #03111f;
    background: linear-gradient(135deg, #67e8f9, #8b5cf6);
    box-shadow: 0 16px 32px rgba(59, 130, 246, 0.25);
  }

  .sp-ob-secondary {
    color: rgba(241, 245, 249, 0.94);
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(15, 23, 42, 0.66);
  }

  .sp-ob-preview-card {
    display: flex;
    flex-direction: column;
    min-height: 560px;
  }

  .sp-ob-preview-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .sp-ob-preview-head h2 {
    margin: 10px 0 0;
    color: #f8fafc;
    font-size: 22px;
    line-height: 1.12;
    letter-spacing: -0.03em;
    font-weight: 950;
  }

  .sp-ob-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    color: #d9f99d;
    background: rgba(22, 101, 52, 0.2);
    border: 1px solid rgba(132, 204, 22, 0.22);
    font-size: 12px;
    font-weight: 900;
    padding: 8px 10px;
    white-space: nowrap;
  }

  .sp-ob-status span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #22c55e;
  }

  .sp-ob-preview-list {
    display: grid;
    gap: 11px;
  }

  .sp-ob-preview-item {
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.13);
    background: rgba(15, 23, 42, 0.62);
    padding: 15px;
  }

  .sp-ob-preview-item span {
    color: rgba(226, 232, 240, 0.58);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .sp-ob-preview-item h3 {
    margin: 5px 0 0;
    color: #f8fafc;
    font-size: 16px;
    font-weight: 950;
    letter-spacing: -0.02em;
  }

  .sp-ob-preview-item p {
    margin: 5px 0 0;
    color: rgba(203, 213, 225, 0.78);
    font-size: 13px;
    line-height: 1.45;
  }

  .sp-ob-tone-cyan { border-color: rgba(34, 211, 238, 0.18); background: rgba(8, 145, 178, 0.1); }
  .sp-ob-tone-violet { border-color: rgba(139, 92, 246, 0.2); background: rgba(76, 29, 149, 0.14); }
  .sp-ob-tone-amber { border-color: rgba(245, 158, 11, 0.22); background: rgba(120, 53, 15, 0.16); }
  .sp-ob-tone-green { border-color: rgba(34, 197, 94, 0.2); background: rgba(20, 83, 45, 0.14); }

  .sp-ob-preview-footer {
    margin-top: auto;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.13);
    background: rgba(2, 6, 23, 0.48);
    padding: 15px;
  }

  .sp-ob-preview-footer strong {
    display: block;
    color: #f8fafc;
    font-size: 15px;
    font-weight: 950;
  }

  .sp-ob-preview-footer p {
    margin: 5px 0 0;
    color: rgba(203, 213, 225, 0.76);
    font-size: 13px;
    line-height: 1.45;
  }

  .sp-ob-options {
    display: grid;
    gap: 12px;
    margin-top: 22px;
  }

  .sp-ob-option {
    display: grid;
    gap: 14px;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.58);
    padding: 16px;
  }

  .sp-ob-option-featured {
    border-color: rgba(34, 211, 238, 0.3);
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.19), rgba(76, 29, 149, 0.2));
  }

  .sp-ob-option-badge {
    display: inline-flex;
    width: fit-content;
    margin-bottom: 9px;
    border-radius: 999px;
    color: #bbf7d0;
    background: rgba(22, 101, 52, 0.22);
    border: 1px solid rgba(34, 197, 94, 0.22);
    padding: 6px 9px;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .sp-ob-option-button {
    width: 100%;
  }

  @media (max-width: 900px) {
    .sp-ob-page { padding: 14px 12px 24px; }
    .sp-ob-shell { padding: 14px; border-radius: 24px; }
    .sp-ob-topbar { align-items: flex-start; }
    .sp-ob-top-actions { flex-direction: column-reverse; align-items: flex-end; gap: 8px; }
    .sp-ob-layout { grid-template-columns: 1fr; }
    .sp-ob-main-card, .sp-ob-preview-card { min-height: auto; padding: 18px; border-radius: 22px; }
    .sp-ob-title { font-size: clamp(34px, 12vw, 52px); }
    .sp-ob-subtitle { font-size: clamp(19px, 6vw, 25px); }
    .sp-ob-preview-card { display: none; }
  }

  @media (max-width: 520px) {
    .sp-ob-brand { gap: 10px; }
    .sp-ob-logo { width: 40px; height: 40px; border-radius: 14px; }
    .sp-ob-step-title { max-width: 190px; font-size: 12px; }
    .sp-ob-progress { display: none; }
    .sp-ob-body { font-size: 15px; line-height: 1.58; }
    .sp-ob-actions { display: grid; grid-template-columns: 1fr; }
    .sp-ob-primary, .sp-ob-secondary { width: 100%; }
  }
`;
