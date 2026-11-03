import { Skeleton } from "@/components/ui/skeleton";

export default function AnswersLoading() {
  return <div className="mx-auto max-w-3xl px-6 py-10"><Skeleton className="h-8 w-32" /><Skeleton className="mt-2 h-4 w-80" /><div className="mt-8 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div></div>;
}
