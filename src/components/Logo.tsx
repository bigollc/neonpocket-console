export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <div className={`relative grid place-items-center rounded-md bg-foreground text-background ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="size-4">
        <path d="M5 5h7l7 8v6h-7L5 11V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
