import { aiClient } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/extractJson'
import type { Activity } from '@/types/activity'

export async function optimizeRoute(
  activities: Activity[]
): Promise<Activity[]> {
  const message = await aiClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Optimize the order of these activities to minimize travel time and maximize experience. Return ONLY a JSON array with the same activities reordered, no extra text:\n${JSON.stringify(activities)}`,
      },
    ],
  })

  const content = message.content[0]
  if (content?.type !== 'text') {
    throw new Error('Unexpected response type from AI')
  }

  return extractJson<Activity[]>(content.text)
}
