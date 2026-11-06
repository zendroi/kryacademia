import { ArrowRight } from "lucide-react"

export function InteractiveHoverButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`group relative w-auto cursor-pointer overflow-hidden rounded-full border p-2 px-6 text-center font-semibold disabled:pointer-events-none disabled:opacity-60 ${className || ""}`}
      {...props}
    >
      <div aria-hidden="true" className="absolute inset-0 translate-x-full bg-[var(--navy)] transition-transform duration-300 group-hover:translate-x-0" />
      <div className="relative flex items-center justify-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--navy)] transition-opacity duration-200 group-hover:opacity-0"></div>
        <span className="inline-block transition-all duration-300 group-hover:-translate-x-3 group-hover:opacity-0">
          {children}
        </span>
      </div>
      <div aria-hidden="true" className="absolute inset-0 z-10 flex translate-x-full items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        <span>{children}</span>
        <ArrowRight />
      </div>
    </button>
  )
}
