import SummaryClient from "./SummaryClient";

type SearchParamsInput = {
  highlightId?: string | string[];
  eventId?: string | string[];
  appliedToast?: string | string[];
  toast?: string | string[];
};

type PageProps = {
  searchParams?: Promise<SearchParamsInput> | SearchParamsInput;
};

function pickFirst(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SummaryPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams
    ? await searchParams
    : undefined;

  const highlightId =
    pickFirst(resolvedSearchParams?.highlightId) ??
    pickFirst(resolvedSearchParams?.eventId);

  const appliedToast =
    pickFirst(resolvedSearchParams?.appliedToast) ??
    pickFirst(resolvedSearchParams?.toast);

  return (
    <SummaryClient
      highlightId={highlightId}
      appliedToast={appliedToast}
    />
  );
}