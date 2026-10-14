import type { Metadata } from 'next'
import Link from 'next/link'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import { PaginaLegal } from './PaginaLegal'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Qué datos guarda Wayio, para qué los usa, con quién los comparte y cómo puedes pedir que los borremos.',
  alternates: { canonical: `${getBaseUrl()}/privacidad` },
}

const SECCIONES = [
  { id: 'quienes', titulo: 'Quiénes somos' },
  { id: 'datos', titulo: 'Qué datos guardamos' },
  { id: 'usos', titulo: 'Para qué los usamos' },
  { id: 'ia', titulo: 'Inteligencia artificial' },
  { id: 'terceros', titulo: 'Servicios de terceros' },
  { id: 'navegador', titulo: 'Lo que se guarda en tu navegador' },
  { id: 'conservacion', titulo: 'Cuánto tiempo los guardamos' },
  { id: 'derechos', titulo: 'Tus derechos' },
  { id: 'menores', titulo: 'Menores de edad' },
  { id: 'cambios', titulo: 'Cambios en esta política' },
] as const

/**
 * Política de privacidad (BORRADOR): describe lo que hace hoy el código de
 * Wayio (Supabase, Stripe, PostHog y Sentry si están activos, IA de
 * terceros, afiliados). La debe revisar un abogado antes de ser definitiva.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal
      kicker="Legal"
      titulo={
        <>
          Tu privacidad, <em className="italic">sin letra pequeña</em>
        </>
      }
      intro="Qué datos guarda Wayio, para qué los usa, con quién los comparte y cómo puedes pedir que los borremos."
      actualizado="2026-10-08"
      secciones={SECCIONES}
    >
      <h2 id="quienes">Quiénes somos</h2>
      <p>
        Wayio es un planificador de viajes con inteligencia artificial hecho en
        República Dominicana. En esta política, «Wayio», «nosotros» y «nuestro»
        se refieren al responsable del servicio. Si tienes cualquier pregunta
        sobre tus datos, escríbenos desde la página de{' '}
        <Link href="/contacto">contacto</Link>.
      </p>

      <h2 id="datos">Qué datos guardamos</h2>
      <h3>Tu cuenta</h3>
      <ul>
        <li>
          Tu email y tu nombre. Si entras con Google, también el nombre y la
          foto de perfil que Google comparte con nosotros.
        </li>
        <li>
          Tu contraseña, si la usas, la gestiona nuestro proveedor de cuentas
          (Supabase) de forma cifrada. Nosotros no podemos verla.
        </li>
      </ul>
      <h3>Tus viajes</h3>
      <ul>
        <li>
          Lo que escribes para planificar: destino, origen, fechas, número de
          viajeros, presupuesto, preferencias y la descripción libre del viaje.
        </li>
        <li>
          Los itinerarios que guardas, sus cambios y si decides compartirlos con
          un enlace público de solo lectura.
        </li>
      </ul>
      <h3>Viajes en grupo</h3>
      <ul>
        <li>
          Los mensajes, votos y gastos que se escriben en la sala del grupo. Los
          ven los miembros de ese viaje.
        </li>
        <li>
          Tu ubicación, solo si activas «Compartir mi ubicación». Se guarda la
          última posición y la hora en que se actualizó, y la ven los miembros
          del grupo. Deja de compartirse al apagarlo o al salir de la página.
        </li>
      </ul>
      <h3>Pagos</h3>
      <ul>
        <li>
          Los pagos los procesa Stripe. Guardamos el estado de tu plan, sus
          fechas y un identificador de cliente de Stripe. No vemos ni guardamos
          los datos de tu tarjeta.
        </li>
      </ul>
      <h3>Uso y errores</h3>
      <ul>
        <li>
          Si la analítica está activa, usamos PostHog para contar visitas y
          acciones (por ejemplo, «itinerario generado» o «viaje guardado») con
          un identificador interno, sin tu email ni los textos que escribes.
          Antes de enviar cualquier dirección, borramos los códigos de acceso de
          los enlaces de inicio de sesión.
        </li>
        <li>
          Si el registro de errores está activo, usamos Sentry para recibir los
          fallos técnicos y corregirlos. Puede incluir datos técnicos del
          navegador y de la página donde ocurrió el error.
        </li>
        <li>
          Para evitar abusos limitamos cuántas peticiones se pueden hacer en
          poco tiempo; para eso usamos temporalmente tu identificador de usuario
          o la dirección IP.
        </li>
      </ul>

      <h2 id="usos">Para qué los usamos</h2>
      <ul>
        <li>Crear, guardar y mostrarte tus itinerarios.</li>
        <li>Hacer funcionar la sala de grupo y los enlaces compartidos.</li>
        <li>Gestionar tu cuenta, tu plan y tus pagos.</li>
        <li>Entender cómo se usa Wayio, mejorarlo y corregir errores.</li>
        <li>Proteger el servicio frente a abusos.</li>
      </ul>
      <p>
        No vendemos tus datos personales ni los usamos para publicidad de
        terceros.
      </p>

      <h2 id="ia">Inteligencia artificial</h2>
      <p>
        Para trazar e interpretar tus viajes, Wayio envía el contenido de tu
        solicitud (destino, fechas, presupuesto, preferencias y la descripción
        que escribas) a un proveedor de modelos de inteligencia artificial, como
        Anthropic (Claude) o Groq, según la configuración del servicio. Si usas
        la función de video o de foto, también enviamos los fotogramas o la
        imagen para que la IA reconozca los lugares; los archivos temporales se
        borran al terminar.
      </p>
      <p>
        No enviamos tu email ni tu nombre a la IA. Aun así, te recomendamos no
        escribir en la descripción datos sensibles (documentos, salud,
        información de terceros). Los itinerarios son sugerencias generadas
        automáticamente: revisa horarios, precios y requisitos antes de viajar.
      </p>

      <h2 id="terceros">Servicios de terceros</h2>
      <p>
        Trabajamos con proveedores que procesan datos en nuestro nombre, cada
        uno con sus propias políticas:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong>: cuentas, base de datos y sincronización en
          tiempo real.
        </li>
        <li>
          <strong>Stripe</strong>: cobros y portal de pagos.
        </li>
        <li>
          <strong>Anthropic o Groq</strong>: generación de itinerarios con IA.
        </li>
        <li>
          <strong>PostHog</strong> y <strong>Sentry</strong>, si están activos:
          analítica de uso y registro de errores.
        </li>
        <li>
          <strong>OpenStreetMap (Nominatim)</strong>,{' '}
          <strong>OpenFreeMap</strong> y <strong>OpenWeather</strong>: ubicar
          lugares en el mapa, dibujar el mapa y el clima del destino. Solo
          reciben nombres de lugares o coordenadas, no tus datos de cuenta.
        </li>
        <li>
          <strong>Socios de reservas</strong> (como Booking.com, Viator,
          Skyscanner o Airalo): si pulsas uno de sus enlaces sales de Wayio y se
          aplican sus condiciones. Algunos son enlaces de afiliado: si reservas,
          Wayio puede recibir una comisión, sin costo extra para ti.
        </li>
      </ul>
      <p>
        Algunos de estos proveedores tratan los datos fuera de República
        Dominicana, por ejemplo en Estados Unidos o en la Unión Europea.
      </p>

      <h2 id="navegador">Lo que se guarda en tu navegador</h2>
      <ul>
        <li>Las cookies de sesión necesarias para que sigas conectado.</li>
        <li>Tu preferencia de tema (claro, oscuro o sistema).</li>
        <li>
          El estado del planificador mientras trabajas en un viaje, para no
          perderlo al recargar.
        </li>
        <li>
          Una copia de tus viajes para verlos sin conexión. Se borra al cerrar
          sesión.
        </li>
        <li>Si la analítica está activa, el identificador de PostHog.</li>
      </ul>

      <h2 id="conservacion">Cuánto tiempo los guardamos</h2>
      <p>
        Guardamos tus datos mientras tengas una cuenta. Si borras un viaje, se
        borran también su sala de grupo, mensajes, votos y gastos. Si pides
        borrar tu cuenta, eliminamos tus datos personales, salvo lo que la ley
        nos obligue a conservar (por ejemplo, registros de pagos).
      </p>

      <h2 id="derechos">Tus derechos</h2>
      <p>
        Puedes pedirnos acceder a tus datos, corregirlos, llevártelos o
        borrarlos, y oponerte a ciertos usos. Escríbenos desde la página de{' '}
        <Link href="/contacto">contacto</Link> y te responderemos lo antes
        posible. Si no quedas satisfecho, puedes acudir a la autoridad de
        protección de datos que corresponda.
      </p>

      <h2 id="menores">Menores de edad</h2>
      <p>
        Wayio no está pensado para menores de 16 años. Si crees que un menor nos
        dio sus datos sin permiso, escríbenos y los borraremos.
      </p>

      <h2 id="cambios">Cambios en esta política</h2>
      <p>
        Si cambiamos algo importante, lo avisaremos en Wayio antes de que se
        aplique. La fecha de arriba indica la última actualización.
      </p>
    </PaginaLegal>
  )
}
