import { describe, expect, it, vi } from 'vitest'
import { deleteAttachmentBlob, getAttachmentBlob, putAttachmentBlob } from '../../src/store/attachments'
import { createMockBoardFS } from '../setup'

describe('putAttachmentBlob', () => {
  it('sends the file\'s name and raw bytes to the Electron bridge', async () => {
    window.boardFS = createMockBoardFS()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await putAttachmentBlob('att1', file)

    expect(window.boardFS.putAttachment).toHaveBeenCalledWith('att1', 'notes.txt', expect.any(ArrayBuffer))
  })
})

describe('getAttachmentBlob', () => {
  it('returns undefined when the bridge has no matching attachment', async () => {
    window.boardFS = createMockBoardFS()
    await expect(getAttachmentBlob('missing')).resolves.toBeUndefined()
  })

  it('wraps the returned bytes as a File, preferring caller-supplied name/type over the stored ones', async () => {
    window.boardFS = createMockBoardFS()
    window.boardFS.getAttachment = vi.fn(async () => ({ name: 'stored-name.txt', data: new Uint8Array([1, 2, 3]) }))

    const file = await getAttachmentBlob('att1', { name: 'override.txt', type: 'text/csv' })

    expect(file).toBeDefined()
    expect(file!.name).toBe('override.txt')
    expect(file!.type).toBe('text/csv')
  })

  it('falls back to the bridge\'s stored name when no caller metadata is given', async () => {
    window.boardFS = createMockBoardFS()
    window.boardFS.getAttachment = vi.fn(async () => ({ name: 'stored-name.txt', data: new Uint8Array([1, 2, 3]) }))

    const file = await getAttachmentBlob('att1')

    expect(file!.name).toBe('stored-name.txt')
  })
})

describe('deleteAttachmentBlob', () => {
  it('delegates to the bridge\'s deleteAttachment', async () => {
    window.boardFS = createMockBoardFS()
    await deleteAttachmentBlob('att1')
    expect(window.boardFS.deleteAttachment).toHaveBeenCalledWith('att1')
  })
})
