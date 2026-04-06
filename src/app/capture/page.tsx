import { Suspense } from "react";
import CaptureClient from "./CaptureClient";

type CapturePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = (await searchParams) ?? {};
  const rawText = params.text;
  const initialText = Array.isArray(rawText) ? rawText[0] ?? "" : rawText ?? "";

  return (
    <Suspense fallback={null}>
      <CaptureClient initialText={initialText} />
    </Suspense>
  );
}