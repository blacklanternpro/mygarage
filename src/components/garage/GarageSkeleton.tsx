export function GarageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your garage" className="mx-auto max-w-[1280px]">
      <div className="h-[76px] bg-brand" />
      <div className="space-y-3 px-4 py-5">
        <div className="h-5 w-40 rounded bg-stone-deep" />
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[112px] w-[220px] shrink-0 rounded-md bg-bench" />
          ))}
        </div>
        <div className="h-14 w-64 rounded bg-stone-deep" />
        <div className="h-[220px] rounded-md bg-bench" />
        <div className="h-[160px] rounded-md bg-bench" />
      </div>
    </div>
  );
}
