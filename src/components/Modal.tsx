import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  size?: 'sm' | 'lg'
  /** Keep the title accessible to screen readers but hide it visually (e.g. when the body provides its own heading). */
  hideVisualTitle?: boolean
  /** Rendered in a footer that stays pinned below the scrollable body, rather than scrolling away with the content. */
  footer?: ReactNode
  children: ReactNode
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  lg: 'max-w-2xl',
}

export default function Modal({ open, onOpenChange, title, size = 'sm', hideVisualTitle, footer, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          className={`animate-dialog-in bg-panel fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 ${SIZE_CLASS[size]}`}
        >
          <div className="flex shrink-0 items-center justify-between p-6 pb-4">
            <Dialog.Title
              className={hideVisualTitle ? 'sr-only' : 'text-lg font-semibold text-slate-100'}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="icon-btn">
                <CloseIcon />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="shrink-0 border-t border-white/[0.06] px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
