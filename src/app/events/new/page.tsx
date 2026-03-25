// src/app/events/new/page.tsx
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewEventPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const qp = new URLSearchParams();

  const keys = ["type", "date", "groupId", "eventId", "id", "lock", "from"];
  for (const key of keys) {
    const value = first(params[key]);
    if (value) qp.set(key, value);
  }

  redirect(`/events/new/details${qp.toString() ? `?${qp.toString()}` : ""}`);
}