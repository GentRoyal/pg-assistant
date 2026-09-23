import { AlertTriangle, X } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'

export function DisclaimerBanner() {
  const { settings, updateSettings } = useSettings()
  if (settings.disclaimerAccepted) return null

  return (
    <div
      role="note"
      className="relative mx-auto mb-3 flex w-full max-w-3xl gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm sm:mb-4 sm:gap-3 sm:px-4 sm:py-3"
    >
      <AlertTriangle className="mt-0.5 shrink-0 text-[var(--ui-gold-deep)]" size={18} aria-hidden />
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold text-[var(--ui-navy)]">Friendly reminder</p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--ui-muted)] sm:text-sm">
          Answers come from UI regulation documents. Study aid only — confirm critical decisions with
          your department or Postgraduate College.
        </p>
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-lg text-[var(--ui-muted)] hover:bg-amber-100 hover:text-[var(--ui-navy)]"
        aria-label="Dismiss reminder"
        onClick={() => updateSettings({ disclaimerAccepted: true })}
      >
        <X size={16} />
      </button>
    </div>
  )
}
