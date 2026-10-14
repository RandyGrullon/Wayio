'use client'

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDown, SendHorizontal } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DUR, EASE } from '@/components/ui/motion'
import { cn } from '@/lib/utils/cn'
import {
  formatFecha,
  formatHora12,
  parseFecha,
  toISODateLocal,
} from '@/lib/utils/formatters'
import type { GroupMessageRow } from '@/types/database'

const MAX_MENSAJE = 1000
/** Distancia al fondo (px) para considerar que se está leyendo lo último. */
const CERCA_DEL_FONDO = 80

interface GroupChatProps {
  messages: GroupMessageRow[]
  currentUserId: string
  /** Ids de mensajes optimistas aún sin confirmar. */
  pendingIds: ReadonlySet<string>
  onSend: (text: string) => Promise<boolean>
  /** 'YYYY-MM-DD' local de hoy y de ayer (para los separadores). */
  hoy: string
  ayer: string
}

interface FilaChat {
  msg: GroupMessageRow
  fecha: Date | null
  /** 'YYYY-MM-DD' local del mensaje. */
  clave: string
  /** Primer mensaje de su día: lleva separador delante. */
  separador: boolean
}

function conSeparadores(messages: GroupMessageRow[]): FilaChat[] {
  const filas: FilaChat[] = []
  let anterior = ''
  for (const msg of messages) {
    const fecha = parseFecha(msg.created_at)
    const clave = fecha ? toISODateLocal(fecha) : ''
    filas.push({
      msg,
      fecha,
      clave,
      separador: Boolean(clave) && clave !== anterior,
    })
    if (clave) anterior = clave
  }
  return filas
}

function etiquetaDia(clave: string, hoy: string, ayer: string): string {
  if (clave === hoy) return 'Hoy'
  if (clave === ayer) return 'Ayer'
  return formatFecha(clave)
}

/**
 * Chat del grupo (docs/DISENO.md §6.8): autoscroll si se está al final y
 * píldora «Nuevos mensajes» si no; separadores por día; burbujas propias en
 * tinta y ajenas en papel con nombre y hora; compositor que crece de 44 a
 * 120 px. Enter envía (respetando la composición de acentos del IME) y
 * Mayús+Enter salta de línea.
 */
export function GroupChat({
  messages,
  currentUserId,
  pendingIds,
  onSend,
  hoy,
  ayer,
}: GroupChatProps) {
  const id = useId()
  const listaRef = useRef<HTMLDivElement | null>(null)
  const campoRef = useRef<HTMLTextAreaElement | null>(null)
  const alFondo = useRef(true)
  const forzarFondo = useRef(false)
  const [texto, setTexto] = useState('')
  const [vistos, setVistos] = useState(messages.length)
  const [lejos, setLejos] = useState(false)

  // Mensajes nuevos: si se estaba al final (o lo envié yo), bajar.
  useEffect(() => {
    const lista = listaRef.current
    if (!lista) return
    if (alFondo.current || forzarFondo.current) {
      forzarFondo.current = false
      lista.scrollTop = lista.scrollHeight
    }
  }, [messages.length])

  const onScroll = () => {
    const lista = listaRef.current
    if (!lista) return
    const cerca =
      lista.scrollHeight - lista.scrollTop - lista.clientHeight <
      CERCA_DEL_FONDO
    alFondo.current = cerca
    setLejos(!cerca)
    if (cerca) setVistos(messages.length)
  }

  const irAlFondo = () => {
    const lista = listaRef.current
    if (!lista) return
    lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' })
    setVistos(messages.length)
  }

  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio) return
    forzarFondo.current = true
    setTexto('')
    void onSend(limpio.slice(0, MAX_MENSAJE)).then((ok) => {
      // Si falló, se devuelve el texto al compositor para no perderlo.
      if (!ok) setTexto((actual) => (actual ? actual : limpio))
    })
    campoRef.current?.focus()
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    enviar()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    enviar()
  }

  const nuevos = lejos && messages.length > vistos
  const filas = conSeparadores(messages)

  return (
    <div className="flex flex-col">
      <div className="relative">
        <div
          ref={listaRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Mensajes del grupo"
          tabIndex={0}
          className="flex min-h-[420px] max-h-[calc(100dvh-320px)] flex-col gap-2 overflow-y-auto rounded-card border border-border bg-surface-2 p-3 focus-visible:outline-offset-2 sm:p-4"
        >
          {messages.length === 0 ? (
            <div className="m-auto">
              <EmptyState
                title="Nadie ha escrito todavía"
                description="Propón un plan, comparte una duda o saluda al grupo."
                className="py-6"
                action={
                  <button
                    type="button"
                    onClick={() => campoRef.current?.focus()}
                    className="rounded-sm text-[15px] font-semibold text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
                  >
                    Escribe el primero
                  </button>
                }
              />
            </div>
          ) : null}

          {filas.map(({ msg, fecha, clave, separador }) => {
            const propio = msg.user_id === currentUserId
            const pendiente = pendingIds.has(msg.id)
            const hora = fecha ? formatHora12(fecha) : ''

            return (
              <Fragment key={msg.id}>
                {separador ? (
                  <div
                    className="my-2 flex items-center gap-3"
                    role="separator"
                    aria-label={etiquetaDia(clave, hoy, ayer)}
                  >
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-border"
                    />
                    <span className="text-caption text-fg-subtle">
                      {etiquetaDia(clave, hoy, ayer)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-border"
                    />
                  </div>
                ) : null}

                {msg.tipo !== 'mensaje' ? (
                  <p
                    className={cn(
                      'mx-auto max-w-[44ch] rounded-full px-3 py-1 text-center text-caption',
                      msg.tipo === 'alerta'
                        ? 'bg-warning-bg text-warning-fg'
                        : 'text-fg-muted'
                    )}
                  >
                    {msg.mensaje}
                  </p>
                ) : (
                  <div
                    className={cn(
                      'flex max-w-full',
                      propio ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[min(80%,34rem)] px-3.5 py-2 text-body-s',
                        propio
                          ? 'rounded-[16px_16px_4px_16px] bg-surface-inverse text-fg-inverse dark:bg-tinta-800 dark:text-fg'
                          : 'rounded-[16px_16px_16px_4px] border border-border bg-surface text-fg',
                        pendiente && 'opacity-70'
                      )}
                    >
                      {!propio ? (
                        <p className="mb-0.5 text-[13px] font-semibold text-fg">
                          {msg.nombre_usuario}
                        </p>
                      ) : (
                        <span className="sr-only">Tú: </span>
                      )}
                      <p className="break-words whitespace-pre-wrap">
                        {msg.mensaje}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-right text-[12px] tnum',
                          // fg-subtle sobre tinta-800 da 4,4:1 en oscuro;
                          // fg-muted da 5,7:1 (AA a 12 px).
                          propio
                            ? 'text-fg-inverse/80 dark:text-fg-muted'
                            : 'text-fg-subtle'
                        )}
                      >
                        {pendiente ? 'Enviando…' : hora}
                      </p>
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>

        <AnimatePresence>
          {nuevos ? (
            <m.div
              key="nuevos"
              className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: DUR.base, ease: EASE.papel },
              }}
              exit={{
                opacity: 0,
                transition: { duration: DUR.fast, ease: EASE.salida },
              }}
            >
              <button
                type="button"
                onClick={irAlFondo}
                className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-inverse px-4 text-[14px] font-semibold text-fg-inverse shadow-elev"
              >
                <ArrowDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Nuevos mensajes
              </button>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <label htmlFor={`${id}-mensaje`} className="sr-only">
          Mensaje para el grupo
        </label>
        <textarea
          ref={campoRef}
          id={`${id}-mensaje`}
          rows={1}
          value={texto}
          maxLength={MAX_MENSAJE}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe un mensaje…"
          enterKeyHint="send"
          className="max-h-[120px] min-h-11 w-full resize-none rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-base leading-snug text-fg [field-sizing:content] placeholder:text-fg-subtle hover:border-fg-muted focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)] focus-visible:outline-none"
        />
        <IconButton
          type="submit"
          label="Enviar"
          variant="primary"
          size="icon"
          disabled={!texto.trim()}
        >
          <SendHorizontal />
        </IconButton>
      </form>
    </div>
  )
}
