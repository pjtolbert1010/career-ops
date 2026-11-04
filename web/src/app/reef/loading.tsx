import { Skeleton } from "@/components/ui/skeleton";

export default function ReefLoading() {
  return (
    <div className="px-4" aria-label="Loading Reef Watch">
      <div className="mx-auto my-6 flex w-full max-w-[1280px] flex-col overflow-hidden rounded-[18px] lg:flex-row">
        <Skeleton className="min-h-[800px] flex-1 rounded-none" />
        <div className="w-full space-y-3 p-6 lg:w-[380px]">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-20 rounded-2xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-[10px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
