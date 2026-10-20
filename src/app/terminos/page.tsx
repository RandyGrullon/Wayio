import type { Metadata } from 'next'
import Link from 'next/link'
import { PaginaLegal } from '@/app/privacidad/PaginaLegal'
import { TEXTO_CUPO_GRATIS } from '@/components/trip/limitesIA'
import { DIAS_PASE, NOMBRE_PLAN } from '@/constants/planes'
import { getBaseUrl } from '@/lib/utils/baseUrl'

export const metadata: Metadata = {
  title: 'Términos de uso',
  description:
    'Las condiciones para usar Wayio: qué ofrece el servicio, los planes de pago, los enlaces de socios y los límites de un itinerario hecho con IA.',
  alternates: { canonical: `${getBaseUrl()}/terminos` },
}

const SECCIONES = [
  { id: 'servicio', titulo: 'Qué es Wayio' },
  { id: 'ia', titulo: 'Itinerarios hechos con IA' },
  { id: 'cuenta', titulo: 'Tu cuenta' },
  { id: 'uso', titulo: 'Uso aceptable' },
  { id: 'contenido', titulo: 'Lo que tú publicas' },
  { id: 'planes', titulo: 'Planes y pagos' },
  { id: 'socios', titulo: 'Reservas y socios' },
  { id: 'responsabilidad', titulo: 'Responsabilidad' },
  { id: 'cambios', titulo: 'Cambios y contacto' },
] as const

/**
 * Términos de uso (BORRADOR). Redactados a partir de lo que hace hoy
 * Wayio; el responsable debe revisarlos con un abogado.
 */
export default function TerminosPage() {
  return (
    <PaginaLegal
      kicker="Legal"
      titulo={
        <>
          Términos de <em className="italic">uso</em>
        </>
      }
      intro="Las reglas del juego para usar Wayio, escritas para que se entiendan."
      actualizado="2026-10-17"
      secciones={SECCIONES}
    >
      <h2 id="servicio">Qué es Wayio</h2>
      <p>
        Wayio es un planificador de viajes con inteligencia artificial hecho en
        República Dominicana. Te ayuda a trazar itinerarios día a día, con
        horarios, mapa y un presupuesto estimado, a guardarlos, compartirlos y
        organizarlos en grupo. Al usar Wayio aceptas estos términos y la{' '}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
      <p>
        Wayio no es una agencia de viajes: no vende vuelos, hoteles ni
        actividades, ni se hace cargo de tus reservas.
      </p>

      <h2 id="ia">Itinerarios hechos con IA</h2>
      <p>
        Los itinerarios, horarios, precios y consejos los genera automáticamente
        un modelo de inteligencia artificial. Son una sugerencia para ayudarte a
        planificar y pueden contener errores o datos desactualizados: lugares
        cerrados, horarios distintos o precios que cambian.
      </p>
      <ul>
        <li>
          Los presupuestos son estimaciones y no incluyen los vuelos salvo que
          se indique lo contrario.
        </li>
        <li>
          Confirma siempre horarios, precios, requisitos de entrada, visados y
          condiciones de seguridad con fuentes oficiales antes de viajar.
        </li>
      </ul>

      <h2 id="cuenta">Tu cuenta</h2>
      <p>
        Para trazar viajes con la IA, guardarlos y usar la sala de grupo
        necesitas una cuenta, que es gratis. Eres responsable de mantener segura
        tu contraseña y de lo que se haga desde tu cuenta. Si notas un uso que
        no reconoces, escríbenos.
      </p>

      <h2 id="uso">Uso aceptable</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Usar Wayio para algo ilegal o para hacer daño a otras personas.</li>
        <li>
          Publicar en los grupos contenido ofensivo, acoso, spam o datos de
          otras personas sin su permiso.
        </li>
        <li>
          Intentar saltarse los límites de uso, automatizar peticiones de forma
          masiva o acceder a datos que no son tuyos.
        </li>
      </ul>
      <p>Podemos limitar o suspender cuentas que incumplan estas reglas.</p>

      <h2 id="contenido">Lo que tú publicas</h2>
      <p>
        Lo que escribes en Wayio (descripciones, mensajes, gastos) sigue siendo
        tuyo. Nos das permiso para guardarlo y mostrarlo dentro del servicio a
        quien corresponda: a ti, a los miembros de tu grupo o a quien tenga el
        enlace si compartes un viaje en modo de solo lectura.
      </p>

      <h2 id="planes">Planes y pagos</h2>
      <p>
        Los planes y sus precios se describen en{' '}
        <Link href="/precios">Planes y precios</Link>.
      </p>
      <ul>
        <li>
          <strong>{NOMBRE_PLAN.free}.</strong> Wayio es gratis con tu cuenta. El
          plan {NOMBRE_PLAN.free} incluye un cupo mensual de IA de{' '}
          {TEXTO_CUPO_GRATIS}, que se renueva el día 1 de cada mes a la
          medianoche (hora de República Dominicana). Lo que no uses en un mes no
          pasa al siguiente. Con el cupo agotado sigues teniendo tus viajes y
          puedes editarlos a mano.
        </li>
        <li>
          <strong>Pro.</strong> {NOMBRE_PLAN.pro_mensual} y{' '}
          {NOMBRE_PLAN.pro_anual} quitan el cupo mensual de la IA y suman
          funciones como las alertas de demora y el reagendar con IA. «Sin
          límite» es con uso justo: para proteger el servicio hay topes por hora
          y por día que alguien planificando y viajando no alcanza.
        </li>
        <li>
          <strong>{NOMBRE_PLAN.pro_por_viaje}.</strong> Es un pago único que
          activa Pro en toda tu cuenta durante {DIAS_PASE} días desde el pago.
          No se renueva: al terminar vuelves al plan {NOMBRE_PLAN.free}.
        </li>
        <li>
          Los pagos los procesa un proveedor de pagos externo y seguro; Wayio no
          ve ni guarda los datos de tu tarjeta. Las suscripciones se renuevan
          solas al final de cada periodo hasta que las canceles desde Tu cuenta,
          en el portal de pagos; si cancelas, conservas Pro hasta el final del
          periodo pagado.
        </li>
        <li>
          Si tienes un problema con un cobro, escríbenos antes de reclamar al
          banco y lo revisamos contigo.
        </li>
      </ul>

      <h2 id="socios">Reservas y socios</h2>
      <p>
        Wayio muestra enlaces a socios como Booking.com, Viator, Skyscanner o
        Airalo. Al pulsarlos sales de Wayio y la reserva queda entre tú y ese
        proveedor, con sus propias condiciones. Algunos enlaces son de afiliado:
        si reservas, Wayio puede recibir una comisión sin costo extra para ti.
      </p>

      <h2 id="responsabilidad">Responsabilidad</h2>
      <p>
        Hacemos lo posible para que Wayio funcione bien y esté disponible, pero
        el servicio se ofrece tal cual, sin garantías de que esté libre de
        errores o interrupciones. En la medida en que la ley lo permita, Wayio
        no responde por los daños que resulten de decisiones de viaje tomadas a
        partir de un itinerario, ni por los servicios de terceros.
      </p>

      <h2 id="cambios">Cambios y contacto</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es importante, lo
        avisaremos en Wayio antes de aplicarlo. Estos términos se rigen por las
        leyes de la República Dominicana. Para cualquier duda, visita la página
        de <Link href="/contacto">contacto</Link>.
      </p>
    </PaginaLegal>
  )
}
