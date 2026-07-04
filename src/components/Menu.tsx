import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { MoreIcon } from './icons'

interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface MenuProps {
  items: MenuItem[]
  trigger?: ReactNode
}

export default function Menu({ items, trigger }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label="More options"
            className="icon-btn"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreIcon />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="animate-pop-in bg-overlay z-50 min-w-[160px] rounded-xl border border-white/10 p-1 shadow-xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-sm outline-none hover:bg-white/[0.06] ${
                item.danger ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
