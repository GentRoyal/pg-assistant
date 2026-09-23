import { motion } from 'framer-motion'
import { BookOpen, GraduationCap, ScrollText } from 'lucide-react'

const SUGGESTIONS = [
  {
    icon: BookOpen,
    text: 'How do I complete postgraduate course registration?',
  },
  {
    icon: ScrollText,
    text: 'What makes me eligible to sit an examination?',
  },
  {
    icon: GraduationCap,
    text: 'What are the basic thesis supervision requirements?',
  },
]

type Props = {
  onPick: (q: string) => void
}

export function EmptyState({ onPick }: Props) {
  return (
    <motion.div
      className="mx-auto flex w-full max-w-2xl flex-col items-center px-1 py-6 text-center sm:px-4 sm:py-10"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <img
        src="/ui-logo.png"
        alt="University of Ibadan"
        className="h-16 w-16 object-contain drop-shadow-sm sm:h-24 sm:w-24"
      />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-gold-deep)] sm:mt-4 sm:text-xs">
        University of Ibadan
      </p>
      <h1 className="mt-1.5 text-[1.35rem] font-bold leading-tight tracking-tight text-[var(--ui-navy)] sm:mt-2 sm:text-3xl">
        Academic Regulation Assistant
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ui-muted)] sm:mt-3 sm:text-[15px]">
        Your friendly PG study companion. Ask about regulations and get answers grounded in official
        documents — with sources you can check.
      </p>

      <div className="mt-5 grid w-full gap-2 sm:mt-8 sm:gap-2.5">
        {SUGGESTIONS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="flex min-h-12 items-start gap-3 rounded-2xl border border-[var(--ui-line)] bg-white px-3.5 py-3 text-left text-sm font-medium text-[var(--ui-ink)] shadow-sm transition hover:border-[var(--ui-navy)]/25 hover:bg-[var(--ui-soft)] active:scale-[0.99] sm:px-4 sm:py-3.5"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-soft)] text-[var(--ui-navy)]">
              <Icon size={16} aria-hidden />
            </span>
            <span className="pt-1">{text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
