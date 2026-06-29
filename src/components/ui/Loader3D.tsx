import { Plane, Hotel, Car, Sparkles, MapPinned, Compass } from 'lucide-react'

const ICONS = {
  plane: Plane,
  hotel: Hotel,
  car: Car,
  sparkles: Sparkles,
  pin: MapPinned,
  compass: Compass,
} as const

export type Loader3DIcon = keyof typeof ICONS

interface Loader3DProps {
  icon: Loader3DIcon
  /** Coin size in px. */
  size?: number
}

/**
 * A "coin" carrying a Wayio-branded icon that rotates continuously in 3D. When
 * `icon` changes (e.g. searching flights → hotels → cars) the icon pops in with
 * a 3D flip, so each loading phase hands off smoothly. Both coin faces show the
 * current icon (the back one mirrored) so it stays readable through the spin.
 */
export function Loader3D({ icon, size = 112 }: Loader3DProps) {
  const Icon = ICONS[icon] ?? Compass
  const iconSize = Math.round(size * 0.42)
  const box = `${size}px`

  return (
    <div
      className="mx-auto [perspective:900px]"
      style={{ width: box, height: box }}
      role="status"
      aria-label="Cargando"
    >
      <div className="loader3d-spin relative h-full w-full [transform-style:preserve-3d]">
        <CoinFace Icon={Icon} iconKey={icon} iconSize={iconSize} />
        <CoinFace Icon={Icon} iconKey={icon} iconSize={iconSize} back />
      </div>
    </div>
  )
}

function CoinFace({
  Icon,
  iconKey,
  iconSize,
  back = false,
}: {
  Icon: (typeof ICONS)[Loader3DIcon]
  iconKey: string
  iconSize: number
  back?: boolean
}) {
  return (
    <div
      className="grad-brand absolute inset-0 flex items-center justify-center rounded-[28%] shadow-[var(--shadow-soft)] [backface-visibility:hidden]"
      style={back ? { transform: 'rotateY(180deg)' } : undefined}
    >
      {/* key remounts the icon on change → replays the 3D pop animation */}
      <span key={iconKey} className="loader3d-pop text-white">
        <Icon size={iconSize} strokeWidth={1.75} />
      </span>
    </div>
  )
}
