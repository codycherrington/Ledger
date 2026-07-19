import { describe, expect, it } from 'vitest'
import { buildTaskPrompt } from '../../src/lib/claudeCode'
import type { Card } from '../../src/types'

function makeCard(overrides: Partial<Card>): Card {
  return {
    id: 'c1',
    columnId: 'col1',
    title: 'Untitled',
    tagIds: [],
    links: [],
    attachments: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('buildTaskPrompt', () => {
  it('joins title and summary for a single card', () => {
    const card = makeCard({ title: 'Fix the bug', summary: 'It crashes on launch.' })
    expect(buildTaskPrompt([card])).toBe('Fix the bug\nIt crashes on launch.')
  })

  it('uses just the title when a card has no summary', () => {
    const card = makeCard({ title: 'Fix the bug' })
    expect(buildTaskPrompt([card])).toBe('Fix the bug')
  })

  it('joins multiple cards, in order, separated by a blank line', () => {
    const cards = [
      makeCard({ id: 'c1', title: 'First task', summary: 'Do this first.' }),
      makeCard({ id: 'c2', title: 'Second task' }),
      makeCard({ id: 'c3', title: 'Third task', summary: 'Do this last.' }),
    ]
    expect(buildTaskPrompt(cards)).toBe('First task\nDo this first.\n\nSecond task\n\nThird task\nDo this last.')
  })

  it('returns an empty string for no cards', () => {
    expect(buildTaskPrompt([])).toBe('')
  })
})
