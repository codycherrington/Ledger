export const DATA_DIR: string
export function ensureDirs(): void
export function saveState(state: Record<string, Record<string, any>>): void
export function loadState(): Record<string, Record<string, any>> | null
export function putAttachment(id: string, name: string, data: ArrayBuffer): void
export function getAttachment(id: string): { name: string; data: Uint8Array } | null
export function deleteAttachment(id: string): void
