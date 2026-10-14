'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { createAnnouncement } from '@/lib/admin/actions'
import { horaRDaIso } from '@/lib/admin/horaRD'
import type { Platform } from '@/types/admin'
import { useAccion } from './useAccion'
import { VistaPreviaAnuncio } from './VistaPreviaAnuncio'

type Nivel = 'info' | 'warning' | 'critical'

const NIVELES: readonly { value: Nivel; label: string }[] = [
  { value: 'info', label: 'Información' },
  { value: 'warning', label: 'Aviso' },
  { value: 'critical', label: 'Crítico' },
]

const PLATAFORMAS: readonly { value: Platform; label: string }[] = [
  { value: 'all', label: 'Web y app móvil' },
  { value: 'web', label: 'Solo web' },
  { value: 'mobile', label: 'Solo app móvil' },
]

interface Errores {
  titulo?: string
  cuerpo?: string
  desde?: string
  hasta?: string
}

const FECHA_INVALIDA = 'Escribe una fecha y una hora válidas.'

/**
 * Formulario de anuncios con vista previa en vivo del banner en los dos temas
 * (docs/DISENO.md §6.12). Se publica activo; «Desde» y «Hasta» (opcionales,
 * en hora de República Dominicana) programan cuándo se muestra.
 */
export function AnnouncementForm() {
  const id = useId()
  const ejecutar = useAccion()
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [nivel, setNivel] = useState<Nivel>('info')
  const [plataforma, setPlataforma] = useState<Platform>('all')
  // Valores de <input type="datetime-local"> en hora de RD («2026-11-12T09:30»).
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const nuevos: Errores = {}
    if (!titulo.trim()) nuevos.titulo = 'Escribe un título corto.'
    if (!cuerpo.trim()) nuevos.cuerpo = 'Escribe el mensaje del anuncio.'
    const inicio = desde ? horaRDaIso(desde) : null
    const fin = hasta ? horaRDaIso(hasta) : null
    if (desde && !inicio) nuevos.desde = FECHA_INVALIDA
    if (hasta && !fin) nuevos.hasta = FECHA_INVALIDA
    if (fin && inicio && Date.parse(fin) < Date.parse(inicio)) {
      nuevos.hasta = 'Debe ser igual o posterior a «Desde».'
    } else if (fin && !desde && Date.parse(fin) < Date.now()) {
      nuevos.hasta = 'Esa fecha ya pasó: elige una posterior a ahora.'
    }
    setErrores(nuevos)
    if (Object.values(nuevos).some(Boolean)) return
    setEnviando(true)
    const ok = await ejecutar(
      () =>
        createAnnouncement({
          title: titulo,
          body: cuerpo,
          level: nivel,
          platform: plataforma,
          startsAt: inicio,
          endsAt: fin,
        }),
      { exito: 'Anuncio publicado', error: 'No se pudo publicar el anuncio' }
    )
    setEnviando(false)
    if (ok) {
      setTitulo('')
      setCuerpo('')
      setDesde('')
      setHasta('')
    }
  }

  return (
    <Card as="section" aria-labelledby={`${id}-titulo`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={enviar}
          noValidate
          className="flex min-w-0 flex-col gap-5"
        >
          <h2 id={`${id}-titulo`} className="text-title text-fg">
            Nuevo anuncio
          </h2>
          <Input
            fieldSize="md"
            label="Título"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              if (errores.titulo) setErrores((p) => ({ ...p, titulo: '' }))
            }}
            error={errores.titulo}
            maxLength={80}
            placeholder="Nuevo: viajes en grupo"
          />
          <Textarea
            label="Mensaje"
            value={cuerpo}
            onChange={(e) => {
              setCuerpo(e.target.value)
              if (errores.cuerpo) setErrores((p) => ({ ...p, cuerpo: '' }))
            }}
            error={errores.cuerpo}
            maxLength={240}
            placeholder="Una frase clara: qué cambia y qué debe hacer la persona."
            className="min-h-24"
          />
          <div className="flex flex-col">
            <span
              id={`${id}-nivel`}
              className="mb-1.5 block text-label text-fg"
            >
              Nivel
            </span>
            <Segmented
              labelledBy={`${id}-nivel`}
              options={NIVELES}
              value={nivel}
              onValueChange={setNivel}
              fullWidth
            />
          </div>
          <Select
            fieldSize="md"
            label="Dónde se muestra"
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value as Platform)}
            options={PLATAFORMAS}
            hint="La web lo muestra en menos de un minuto. La app móvil todavía no muestra anuncios."
          />
          <div className="grid gap-4 xs:grid-cols-2">
            <Input
              fieldSize="md"
              type="datetime-local"
              label="Desde"
              optional
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value)
                if (errores.desde || errores.hasta)
                  setErrores((p) => ({ ...p, desde: '', hasta: '' }))
              }}
              error={errores.desde}
              hint="Vacío: desde ya."
              className="tnum"
            />
            <Input
              fieldSize="md"
              type="datetime-local"
              label="Hasta"
              optional
              value={hasta}
              min={desde || undefined}
              onChange={(e) => {
                setHasta(e.target.value)
                if (errores.hasta) setErrores((p) => ({ ...p, hasta: '' }))
              }}
              error={errores.hasta}
              hint="Vacío: hasta que lo ocultes."
              className="tnum"
            />
            <p className="text-caption text-fg-muted xs:col-span-2">
              Fechas en hora de República Dominicana.
            </p>
          </div>
          <div>
            <Button
              type="submit"
              variant="tinta"
              icon={<Megaphone />}
              loading={enviando}
              loadingText="Publicando…"
            >
              Publicar anuncio
            </Button>
          </div>
        </form>

        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-title text-fg">Vista previa</p>
          <VistaPreviaAnuncio
            tema="claro"
            titulo={titulo}
            cuerpo={cuerpo}
            nivel={nivel}
          />
          <VistaPreviaAnuncio
            tema="oscuro"
            titulo={titulo}
            cuerpo={cuerpo}
            nivel={nivel}
          />
          <p className="text-caption text-fg-muted">
            Se publica activo y se muestra entre «Desde» y «Hasta» (sin fechas,
            desde ya y sin fin); puedes ocultarlo desde la lista cuando quieras.
          </p>
        </div>
      </div>
    </Card>
  )
}
