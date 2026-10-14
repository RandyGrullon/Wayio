'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clapperboard } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { RecreateTrip } from '@/components/trip/RecreateTrip'
import {
  MAX_DESCRIPCION_VISUAL,
  anadirFrase,
  quitarFrase,
} from '@/components/planner/catalogo'
import { guardarSemilla } from '@/components/planner/semilla'

/**
 * Caja de deseo de la portada (docs/DISENO.md §6.1): isla cliente de la
 * landing. Envía a /planificar?d=<texto>, que precarga la estación 00. Sin JS
 * funciona igual (formulario GET con name="d").
 *
 * Debajo: «Prefiero el formulario paso a paso» y «Desde un video», que abre
 * RecreateTrip; al confirmar, el destino y los lugares viajan al planificador
 * por sessionStorage.
 */

const IDEAS: readonly { label: string; frase: string }[] = [
  { label: 'Sorpréndeme', frase: 'Sorpréndeme con el destino.' },
  { label: 'Con niños', frase: 'Viajo con niños.' },
  { label: 'Fin de semana', frase: 'Es un fin de semana largo.' },
]

export function CajaDeseo() {
  const router = useRouter()
  const id = useId()
  const [texto, setTexto] = useState('')
  const [video, setVideo] = useState(false)

  const enviar = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    const t = texto.trim()
    router.push(t ? `/planificar?d=${encodeURIComponent(t)}` : '/planificar')
  }

  return (
    <>
      <form action="/planificar" method="get" onSubmit={enviar}>
        <div
          className={
            'rounded-card border border-border-strong bg-surface p-4 shadow-elev ' +
            'transition-[border-color,box-shadow] duration-(--dur-fast) ease-papel ' +
            'focus-within:border-ring focus-within:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]'
          }
        >
          <label htmlFor={id} className="sr-only">
            Cuéntanos qué viaje imaginas
          </label>
          <textarea
            id={id}
            name="d"
            rows={2}
            maxLength={MAX_DESCRIPCION_VISUAL}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder="Ej.: 6 días en Cartagena con mi pareja, playa tranquila y buena comida, unos US$1,800"
            className="block max-h-[7.4em] min-h-[3.2em] w-full resize-none bg-transparent px-1 text-[17px] leading-relaxed text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Ideas para empezar"
              className="flex flex-wrap gap-2"
            >
              {IDEAS.map((idea) => {
                const incluida = texto.includes(idea.frase)
                return (
                  <Chip
                    key={idea.label}
                    size="sm"
                    selected={incluida}
                    aria-pressed={incluida}
                    onClick={() =>
                      setTexto((t) =>
                        incluida
                          ? quitarFrase(t, idea.frase)
                          : anadirFrase(t, idea.frase).slice(
                              0,
                              MAX_DESCRIPCION_VISUAL
                            )
                      )
                    }
                  >
                    {idea.label}
                  </Chip>
                )
              })}
            </div>
            <Button
              type="submit"
              size="lg"
              iconEnd={<ArrowRight />}
              className="max-xs:w-full"
            >
              Trazar mi viaje
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink
          href="/planificar"
          variant="link"
          iconEnd={<ArrowRight className="size-4" />}
          className="text-[15px]"
        >
          Prefiero el formulario paso a paso
        </ButtonLink>
        <Button
          variant="outline"
          icon={<Clapperboard />}
          onClick={() => setVideo(true)}
        >
          Desde un video
        </Button>
      </div>

      <RecreateTrip
        open={video}
        onClose={() => setVideo(false)}
        loginRedirect="/"
        onConfirm={(destino, lugares) => {
          guardarSemilla({
            ...(destino.trim() ? { destino: destino.trim() } : {}),
            lugaresDeseados: lugares.map((l) => l.lugar),
          })
          setVideo(false)
          router.push('/planificar')
        }}
        onEscribirDestino={() => {
          setVideo(false)
          router.push('/planificar')
        }}
      />
    </>
  )
}
