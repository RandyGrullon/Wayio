'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

interface GroupChatProps {
  messages: ChatMessage[]
  currentUserId: string
  onSend: (text: string) => void
}

export function GroupChat({ messages, currentUserId, onSend }: GroupChatProps) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <div className="flex h-96 flex-col">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-1">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-fg-subtle">
              Sé el primero en escribir 👋
            </p>
          </div>
        ) : null}
        {messages.map((msg) => {
          const isOwn = msg.userId === currentUserId
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-3.5 py-2 text-sm shadow-[var(--shadow-soft)] ${
                  isOwn
                    ? 'grad-brand rounded-br-md text-white'
                    : 'rounded-bl-md border border-border bg-surface text-fg'
                }`}
              >
                {!isOwn ? (
                  <p className="mb-1 text-xs font-semibold text-brand-600">
                    {msg.userName}
                  </p>
                ) : null}
                <p className="break-words">{msg.text}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2 border-t border-border pt-3">
        <Input
          id="chat-input"
          placeholder="Escribe un mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          className="flex-1"
        />
        <Button onClick={handleSend} size="md">
          Enviar
        </Button>
      </div>
    </div>
  )
}
