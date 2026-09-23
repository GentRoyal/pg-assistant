import { motion } from 'framer-motion'

const SUGGESTIONS = [
  {
    label: 'Course registration',
    question: 'How do I complete postgraduate course registration?',
  },
  {
    label: 'Exam eligibility',
    question: 'What makes me eligible to sit an examination?',
  },
  {
    label: 'Thesis supervision',
    question: 'What are the basic thesis supervision requirements?',
  },
]

type Props = {
  onPick: (q: string) => void
}

export function EmptyState({ onPick }: Props) {
  return (
    <motion.div
      className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center px-2 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <img
          src="/ui-logo.png"
          alt=""
          className="h-12 w-12 object-contain sm:h-14 sm:w-14"
        />
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ui-gold-deep)]">
            University of Ibadan
          </p>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-[var(--ui-navy)] sm:text-xl">
            Academic Regulation Assistant
          </h1>
        </div>
      </div>

      <p className="mt-3 max-w-sm text-sm text-[var(--ui-muted)]">
        Ask a question, or try one of these:
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map(({ label, question }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(question)}
            className="min-h-10 rounded-full border border-[var(--ui-line)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ui-navy)] shadow-sm transition hover:border-[var(--ui-navy)]/30 hover:bg-[var(--ui-soft)] active:scale-[0.98]"
          >
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
