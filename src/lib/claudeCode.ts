import type { Card } from '../types'

// Builds the initial Claude Code prompt from one or more selected tasks:
// title as a heading, summary as the body, in the order given (selection
// order for multi-task launches).
export function buildTaskPrompt(cards: Card[]): string {
  return cards
    .map((card) => (card.summary ? `${card.title}\n${card.summary}` : card.title))
    .join('\n\n')
}
