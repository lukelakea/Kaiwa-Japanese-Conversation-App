/** A non-blocking error strip shown just above the input. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto w-full max-w-3xl px-4 py-2 text-sm text-red-300">
      <span className="rounded-lg bg-red-500/10 px-3 py-1.5">{message}</span>
    </div>
  );
}
