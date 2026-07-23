import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalLoading() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-6xl content-start gap-5 px-5 py-10">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_unusedValue, skeletonIndex) => (
          <Skeleton key={skeletonIndex} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </main>
  );
}
