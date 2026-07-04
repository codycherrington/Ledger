import { requireFS } from './persist'

export async function putAttachmentBlob(id: string, file: File): Promise<void> {
  await requireFS().putAttachment(id, file.name, await file.arrayBuffer())
}

export async function getAttachmentBlob(
  id: string,
  meta?: { name?: string; type?: string },
): Promise<File | undefined> {
  const result = await requireFS().getAttachment(id)
  if (!result) return undefined
  return new File([result.data as BlobPart], meta?.name ?? result.name, { type: meta?.type ?? '' })
}

export async function deleteAttachmentBlob(id: string): Promise<void> {
  await requireFS().deleteAttachment(id)
}
