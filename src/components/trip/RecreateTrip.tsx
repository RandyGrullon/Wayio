'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Clapperboard, ImageUp, Link2, MapPin } from 'lucide-react'
import {
  Button,
  ButtonLink,
  Spinner,
  buttonClasses,
} from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { ChipGroup } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import type { PlaceFromVideo, VideoAnalysisResult } from '@/lib/ai/analyzeVideo'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'

/**
 * «Desde un video o una foto» (docs/DISENO.md §6.1 y contrato de
 * /api/analyze-video en 01-backend.md). Modal en escritorio y sheet en móvil,
 * con Esc, focus trap y role=dialog (lo pone Modal).
 *
 * El destino detectado va al formulario y los lugares a lugaresDeseados. Si el
 * análisis de videos está desactivado (503 video_desactivado) ofrece subir una
 * foto o escribir el destino. Las fotos se reducen en el cliente (< ~2,8 MB
 * en base64) por el límite de cuerpo de Vercel.
 */

interface RecreateTripProps {
  /** Por compatibilidad: si se omite, el diálogo está abierto. */
  open?: boolean
  onConfirm: (destino: string, lugares: PlaceFromVideo[]) => void
  onClose: () => void
  /** Ruta a la que volver tras iniciar sesión (401). */
  loginRedirect?: string
  /** «Escribir el destino» (cuando el análisis no está disponible). */
  onEscribirDestino?: () => void
}

type Modo = 'video' | 'foto'

type Accion = 'login' | 'alternativas' | null

type Estado =
  | { tipo: 'inicial' }
  | { tipo: 'analizando' }
  | { tipo: 'error'; mensaje: string; accion: Accion }
  | { tipo: 'resultado'; data: VideoAnalysisResult }

const OPCIONES_MODO = [
  { value: 'video', label: 'Enlace de video', icon: <Link2 /> },
  { value: 'foto', label: 'Foto del lugar', icon: <ImageUp /> },
] as const

/** Tamaño máximo del base64 enviado (el servidor acepta 5 MB, Vercel ~4,5). */
const MAX_BASE64 = 2_800_000

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagen'))
    }
    img.src = url
  })
}

/** Reduce la foto a JPEG hasta que quepa en MAX_BASE64. */
async function comprimirImagen(file: File): Promise<string> {
  const img = await cargarImagen(file)
  let lado = 1600
  let calidad = 0.82
  for (let i = 0; i < 6; i++) {
    const escala = Math.min(
      1,
      lado / Math.max(img.naturalWidth, img.naturalHeight)
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', calidad)
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    if (base64.length <= MAX_BASE64) return base64
    lado = Math.round(lado * 0.75)
    calidad = Math.max(0.6, calidad - 0.08)
  }
  throw new Error('grande')
}

function esResultado(v: unknown): v is VideoAnalysisResult {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { lugares?: unknown }).lugares) &&
    typeof (v as { destinoSugerido?: unknown }).destinoSugerido === 'string'
  )
}

function campo(data: unknown, clave: 'error' | 'code'): string | null {
  if (typeof data !== 'object' || data === null) return null
  const v = (data as Record<string, unknown>)[clave]
  return typeof v === 'string' && v.trim() ? v : null
}

export function RecreateTrip({
  open = true,
  onConfirm,
  onClose,
  loginRedirect = '/planificar',
  onEscribirDestino,
}: RecreateTripProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [modo, setModo] = useState<Modo>('video')
  const [videoUrl, setVideoUrl] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' })
  const [destino, setDestino] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Al volver a abrir, empieza de cero.
  const [abiertoPrevio, setAbiertoPrevio] = useState(open)
  if (open !== abiertoPrevio) {
    setAbiertoPrevio(open)
    if (open) {
      setEstado({ tipo: 'inicial' })
      setVideoUrl('')
      setFoto(null)
      setDestino('')
      setElegidos([])
    }
  }

  // Cerrar el diálogo cancela un análisis en curso.
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])
  useEffect(() => () => abortRef.current?.abort(), [])

  const analizar = async () => {
    if (estado.tipo === 'analizando') return
    let body: Record<string, string>
    if (modo === 'video') {
      if (videoUrl.trim().length < 4) return
      body = { videoUrl: videoUrl.trim() }
    } else {
      if (!foto) return
      setEstado({ tipo: 'analizando' })
      try {
        body = {
          imageBase64: await comprimirImagen(foto),
          mediaType: 'image/jpeg',
        }
      } catch {
        setEstado({
          tipo: 'error',
          mensaje:
            'No pudimos leer esa foto. Prueba con otra en JPG, PNG o WebP.',
          accion: null,
        })
        return
      }
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setEstado({ tipo: 'analizando' })
    const fuente = modo === 'video' ? 'video' : 'imagen'
    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      const data: unknown = await res.json().catch(() => null)
      if (res.ok && esResultado(data)) {
        setEstado({ tipo: 'resultado', data })
        setDestino(data.destinoSugerido)
        setElegidos(data.lugares.map((l) => l.lugar))
        track('interpretacion_usada', {
          fuente,
          exito: true,
          camposDetectados: data.lugares.length,
        })
        return
      }
      track('interpretacion_usada', { fuente, exito: false })
      const code = campo(data, 'code')
      if (res.status === 401) {
        setEstado({
          tipo: 'error',
          mensaje: 'Inicia sesión para analizar videos y fotos.',
          accion: 'login',
        })
        return
      }
      setEstado({
        tipo: 'error',
        mensaje:
          campo(data, 'error') ??
          'No pudimos analizarlo en este momento. Inténtalo de nuevo en unos minutos.',
        accion:
          res.status === 503 && code === 'video_desactivado'
            ? 'alternativas'
            : null,
      })
    } catch {
      if (ctrl.signal.aborted) return
      setEstado({
        tipo: 'error',
        mensaje:
          'Se cortó la conexión mientras lo analizábamos. Inténtalo de nuevo.',
        accion: null,
      })
    }
  }

  const cancelarAnalisis = () => {
    abortRef.current?.abort()
    setEstado({ tipo: 'inicial' })
  }

  const confirmar = () => {
    if (estado.tipo !== 'resultado') return
    const lugares = estado.data.lugares.filter((l) =>
      elegidos.includes(l.lugar)
    )
    onConfirm(destino.trim(), lugares)
  }

  const listo = modo === 'video' ? videoUrl.trim().length >= 4 : foto !== null

  const footer =
    estado.tipo === 'resultado' ? (
      <>
        <Button
          variant="outline"
          onClick={() => setEstado({ tipo: 'inicial' })}
        >
          Volver
        </Button>
        <Button
          onClick={confirmar}
          disabled={!destino.trim() && elegidos.length === 0}
        >
          Usar en mi viaje
        </Button>
      </>
    ) : estado.tipo === 'analizando' ? (
      <>
        <Button variant="outline" onClick={cancelarAnalisis}>
          Cancelar análisis
        </Button>
        <Button loading loadingText="Analizando…">
          Analizar
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => void analizar()}
          disabled={!listo}
          icon={modo === 'video' ? <Clapperboard /> : <ImageUp />}
        >
          {modo === 'video' ? 'Analizar video' : 'Analizar foto'}
        </Button>
      </>
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desde un video o una foto"
      description="Pega el enlace de un video de viaje o sube una foto del lugar. La IA reconoce los sitios y los suma a tu viaje."
      footer={footer}
    >
      {estado.tipo === 'resultado' ? (
        <div className="flex flex-col gap-5">
          {estado.data.demo ? (
            <Callout tone="warning" title="Resultado de ejemplo">
              El análisis con IA no está disponible ahora mismo: estos lugares
              son solo una muestra.
            </Callout>
          ) : null}
          {estado.data.parcial ? (
            <Callout tone="info" title="Analizamos solo una parte">
              El video era largo y revisamos una parte. Puedes añadir lo que
              falte en la descripción.
            </Callout>
          ) : null}
          {estado.data.resumen ? (
            <p className="text-body-s text-fg-muted">{estado.data.resumen}</p>
          ) : null}
          <Input
            id={`${uid}-destino`}
            label="Destino"
            icon={<MapPin />}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Escribe el destino"
            hint={
              estado.data.destinoSugerido
                ? 'Puedes corregirlo si no es exacto.'
                : 'No reconocimos el destino: escríbelo tú.'
            }
            data-autofocus
          />
          {estado.data.lugares.length > 0 ? (
            <div>
              <p id={`${uid}-lugares`} className="mb-2 text-label text-fg">
                Lugares identificados ({estado.data.lugares.length})
              </p>
              <ChipGroup
                type="multiple"
                size="sm"
                labelledBy={`${uid}-lugares`}
                options={estado.data.lugares.map((l) => ({
                  value: l.lugar,
                  label: l.pais ? `${l.lugar} · ${l.pais}` : l.lugar,
                }))}
                value={elegidos}
                onValueChange={setElegidos}
              />
              <p className="mt-2 text-caption text-fg-muted">
                Desmarca los que no quieras visitar.
              </p>
            </div>
          ) : (
            <p className="text-body-s text-fg-muted">
              No identificamos lugares concretos, pero puedes usar el destino.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Segmented
            options={OPCIONES_MODO}
            value={modo}
            onValueChange={(v) => {
              setModo(v)
              if (estado.tipo === 'error') setEstado({ tipo: 'inicial' })
            }}
            label="Qué quieres analizar"
            fullWidth
            disabled={estado.tipo === 'analizando'}
          />

          {modo === 'video' ? (
            <Input
              id={`${uid}-url`}
              label="Enlace del video"
              type="url"
              inputMode="url"
              autoComplete="off"
              icon={<Link2 />}
              placeholder="https://www.youtube.com/watch?v=…"
              hint="YouTube, TikTok, Instagram, Vimeo o Facebook."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void analizar()
                }
              }}
              disabled={estado.tipo === 'analizando'}
              data-autofocus
            />
          ) : (
            <div>
              <p className="mb-1.5 text-label text-fg">Foto del lugar</p>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={`${uid}-foto`}
                  className={cn(
                    buttonClasses({ variant: 'outline', size: 'md' }),
                    'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                    estado.tipo === 'analizando' &&
                      'pointer-events-none opacity-45'
                  )}
                >
                  <ImageUp aria-hidden="true" strokeWidth={1.75} />
                  {foto ? 'Cambiar foto' : 'Elegir foto'}
                  <input
                    id={`${uid}-foto`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={estado.tipo === 'analizando'}
                    onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="min-w-0 truncate text-body-s text-fg-muted">
                  {foto ? foto.name : 'Ninguna foto elegida'}
                </span>
              </div>
              <p className="mt-1.5 text-caption text-fg-muted">
                JPG, PNG o WebP. La reducimos antes de enviarla.
              </p>
            </div>
          )}

          {estado.tipo === 'analizando' ? (
            <p
              role="status"
              className="flex items-start gap-2.5 rounded-control bg-surface-2 px-4 py-3 text-body-s text-fg-muted"
            >
              <Spinner className="mt-0.5 text-fg-subtle" />
              {modo === 'video'
                ? 'Analizando el video… puede tardar uno o dos minutos.'
                : 'Analizando la foto…'}
            </p>
          ) : null}

          {estado.tipo === 'error' ? (
            <Callout
              tone="danger"
              title="No pudimos analizarlo"
              action={
                estado.accion === 'login' ? (
                  <ButtonLink
                    variant="link"
                    href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
                  >
                    Iniciar sesión
                  </ButtonLink>
                ) : estado.accion === 'alternativas' ? (
                  <>
                    {modo === 'video' ? (
                      <Button
                        variant="link"
                        onClick={() => {
                          setModo('foto')
                          setEstado({ tipo: 'inicial' })
                        }}
                      >
                        Subir una foto
                      </Button>
                    ) : null}
                    <Button
                      variant="link"
                      onClick={onEscribirDestino ?? onClose}
                    >
                      Escribir el destino
                    </Button>
                  </>
                ) : undefined
              }
            >
              {estado.mensaje}
            </Callout>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
