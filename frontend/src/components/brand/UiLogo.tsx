type UiLogoProps = {
  size?: number
  withWordmark?: boolean
  className?: string
}

export function UiLogo({ size = 40, withWordmark = false, className = '' }: UiLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/ui-logo.png"
        alt={withWordmark ? '' : 'University of Ibadan'}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        aria-hidden={withWordmark}
      />
      {withWordmark ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.95rem] font-semibold tracking-tight text-[var(--ui-navy)]">
            Academic Regulation Assistant
          </p>
          <p className="truncate text-xs font-medium text-[var(--ui-muted)]">University of Ibadan</p>
        </div>
      ) : (
        <span className="sr-only">University of Ibadan Academic Regulation Assistant</span>
      )}
    </div>
  )
}
