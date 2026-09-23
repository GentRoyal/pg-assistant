import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="w-full max-w-lg rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-[var(--ui-navy)]">
                {title}
              </h2>
              <Button variant="ghost" aria-label="Close dialog" onClick={onClose} className="!p-2">
                <X size={18} />
              </Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
