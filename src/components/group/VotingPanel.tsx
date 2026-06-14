'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface VoteOption {
  id: string
  label: string
  votes: number
}

interface VotingPanelProps {
  question: string
  options: VoteOption[]
  onVote: (optionId: string) => void
}

export function VotingPanel({ question, options, onVote }: VotingPanelProps) {
  const [voted, setVoted] = useState<string | null>(null)
  const total = options.reduce((sum, o) => sum + o.votes, 0)

  const handleVote = (id: string) => {
    if (voted) return
    setVoted(id)
    onVote(id)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <p className="mb-3 font-bold text-fg">{question}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0
          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={voted !== null}
              className="relative overflow-hidden rounded-xl border border-border p-3 text-left transition-colors hover:border-brand-300 disabled:cursor-default"
            >
              <div
                className="absolute inset-0 bg-brand-50 transition-all duration-500 dark:bg-brand-500/15"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex justify-between">
                <span className="text-sm font-semibold text-fg">
                  {option.label}
                </span>
                <span className="text-sm font-medium text-fg-muted">
                  {pct}%
                </span>
              </div>
            </button>
          )
        })}
      </div>
      {voted ? (
        <p className="mt-3 text-xs font-medium text-green-600">
          ¡Voto registrado!
        </p>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() => setVoted(null)}
        disabled={!voted}
      >
        Cambiar voto
      </Button>
    </div>
  )
}
