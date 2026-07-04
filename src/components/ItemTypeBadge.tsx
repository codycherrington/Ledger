interface ItemTypeBadgeProps {
  kind: 'project' | 'folder'
}

const LABEL: Record<ItemTypeBadgeProps['kind'], string> = {
  project: 'Project',
  folder: 'Folder',
}

const CLASSES: Record<ItemTypeBadgeProps['kind'], string> = {
  project: 'text-indigo-400',
  folder: 'text-amber-400',
}

export default function ItemTypeBadge({ kind }: ItemTypeBadgeProps) {
  return <span className={`text-[10px] font-bold tracking-wide uppercase ${CLASSES[kind]}`}>{LABEL[kind]}</span>
}
