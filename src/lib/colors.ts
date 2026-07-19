export const COLOR_NAMES = [
  'slate',
  'red',
  'orange',
  'amber',
  'lime',
  'emerald',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
] as const

export type ColorName = (typeof COLOR_NAMES)[number]

interface ColorClasses {
  /** small dot / swatch background */
  dot: string
  /** chip text on dark background */
  text: string
  /** chip border tint */
  border: string
  /** soft tinted chip background */
  bgSoft: string
}

export const COLOR_CLASSES: Record<ColorName, ColorClasses> = {
  slate: { dot: 'bg-slate-400', text: 'text-slate-300', border: 'border-slate-400/30', bgSoft: 'bg-slate-400/10' },
  red: { dot: 'bg-red-400', text: 'text-red-300', border: 'border-red-400/30', bgSoft: 'bg-red-400/10' },
  orange: { dot: 'bg-orange-400', text: 'text-orange-300', border: 'border-orange-400/30', bgSoft: 'bg-orange-400/10' },
  amber: { dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-400/30', bgSoft: 'bg-amber-400/10' },
  lime: { dot: 'bg-lime-400', text: 'text-lime-300', border: 'border-lime-400/30', bgSoft: 'bg-lime-400/10' },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-400/30', bgSoft: 'bg-emerald-400/10' },
  teal: { dot: 'bg-teal-400', text: 'text-teal-300', border: 'border-teal-400/30', bgSoft: 'bg-teal-400/10' },
  sky: { dot: 'bg-sky-400', text: 'text-sky-300', border: 'border-sky-400/30', bgSoft: 'bg-sky-400/10' },
  blue: { dot: 'bg-blue-400', text: 'text-blue-300', border: 'border-blue-400/30', bgSoft: 'bg-blue-400/10' },
  indigo: { dot: 'bg-indigo-400', text: 'text-indigo-300', border: 'border-indigo-400/30', bgSoft: 'bg-indigo-400/10' },
  violet: { dot: 'bg-violet-400', text: 'text-violet-300', border: 'border-violet-400/30', bgSoft: 'bg-violet-400/10' },
  fuchsia: { dot: 'bg-fuchsia-400', text: 'text-fuchsia-300', border: 'border-fuchsia-400/30', bgSoft: 'bg-fuchsia-400/10' },
  pink: { dot: 'bg-pink-400', text: 'text-pink-300', border: 'border-pink-400/30', bgSoft: 'bg-pink-400/10' },
}

export function nextColor(usedCount: number): ColorName {
  return COLOR_NAMES[usedCount % COLOR_NAMES.length]
}

// Semantic (not decorative) color mappings, shared wherever priority/status
// need the same red/amber/green/slate meaning — table view, the task detail
// dialog's status picker, and the status pill shown on folder-filed tasks.
export const PRIORITY_COLOR: Record<'low' | 'med' | 'high', ColorName> = { high: 'red', med: 'amber', low: 'emerald' }
export const STATUS_COLOR: Record<string, ColorName> = {
  'To Do': 'red',
  'In Progress': 'amber',
  Done: 'emerald',
  Stash: 'slate',
}
