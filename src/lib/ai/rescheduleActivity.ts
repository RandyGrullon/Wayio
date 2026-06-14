import { aiClient } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/extractJson'
import type { Activity } from '@/types/activity'

export async function rescheduleActivity(
  activity: Activity,
  reason: string,
  availableSlots: string[]
): Promise<Activity> {
  const message = await aiClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Reschedule this activity due to: ${reason}. Available slots: ${availableSlots.join(', ')}. Return ONLY the updated activity as a JSON object, no extra text:\n${JSON.stringify(activity)}`,
      },
    ],
  })

  const content = message.content[0]
  if (content?.type !== 'text') {
    throw new Error('Unexpected response type from AI')
  }

  return extractJson<Activity>(content.text)
}
