/**
 * Destinos de las landings SEO /viaje/[slug] (generadas en build).
 */
export interface Destino {
  slug: string
  nombre: string
  nombreCorto: string
  pais: string
  descripcion: string
  keywords: string[]
  diasRecomendados: number
  mejorEpoca: string
  /** Imagen para redes (Open Graph / Twitter), relativa a metadataBase. */
  imagen: string
}

/**
 * Imagen social genérica de la app. La sirve la convención de Next
 * `src/app/opengraph-image.*` en /opengraph-image (no hay fotos por destino).
 */
export const OG_IMAGEN_GENERICA = '/opengraph-image'

type DatosDestino = Omit<Destino, 'imagen'>

const DATOS: DatosDestino[] = [
  {
    slug: 'japon',
    nombre: 'Japón',
    nombreCorto: 'Japón',
    pais: 'Japón',
    descripcion:
      'Descubre templos milenarios, gastronomía única y la perfecta fusión de tradición y modernidad.',
    keywords: [
      'viaje a japon',
      'itinerario japon',
      'tokio osaka kyoto',
      'que ver en japon',
    ],
    diasRecomendados: 14,
    mejorEpoca: 'Marzo–Mayo (cerezos) o Septiembre–Noviembre',
  },
  {
    slug: 'espana',
    nombre: 'España',
    nombreCorto: 'España',
    pais: 'España',
    descripcion:
      'Playas, flamenco, arquitectura Gaudí y la mejor gastronomía de Europa.',
    keywords: [
      'viaje a espana',
      'itinerario espana',
      'barcelona madrid sevilla',
      'que ver en espana',
    ],
    diasRecomendados: 10,
    mejorEpoca: 'Abril–Junio o Septiembre–Octubre',
  },
  {
    slug: 'italia',
    nombre: 'Italia',
    nombreCorto: 'Italia',
    pais: 'Italia',
    descripcion:
      'Arte, historia, pasta y la dolce vita en el corazón del Mediterráneo.',
    keywords: [
      'viaje a italia',
      'itinerario italia',
      'roma florencia venecia',
      'que ver en italia',
    ],
    diasRecomendados: 10,
    mejorEpoca: 'Abril–Junio o Septiembre–Octubre',
  },
  {
    slug: 'estados-unidos',
    nombre: 'Estados Unidos',
    nombreCorto: 'EE.UU.',
    pais: 'Estados Unidos',
    descripcion:
      'De Nueva York a Los Ángeles, una aventura sin límites en el país de las posibilidades.',
    keywords: [
      'viaje a estados unidos',
      'itinerario usa',
      'nueva york los angeles',
      'que ver en usa',
    ],
    diasRecomendados: 14,
    mejorEpoca: 'Primavera u Otoño según la región',
  },
  {
    slug: 'francia',
    nombre: 'Francia',
    nombreCorto: 'Francia',
    pais: 'Francia',
    descripcion:
      'París, los castillos del Loira, la Riviera y los viñedos de Burdeos te esperan.',
    keywords: [
      'viaje a francia',
      'itinerario francia',
      'paris torre eiffel',
      'que ver en francia',
    ],
    diasRecomendados: 8,
    mejorEpoca: 'Abril–Junio o Septiembre',
  },
  {
    slug: 'mexico',
    nombre: 'México',
    nombreCorto: 'México',
    pais: 'México',
    descripcion:
      'Pirámides mayas, cenotes, playas paradisíacas y la gastronomía más rica de América.',
    keywords: [
      'viaje a mexico',
      'itinerario mexico',
      'cancun ciudad de mexico',
      'que ver en mexico',
    ],
    diasRecomendados: 10,
    mejorEpoca: 'Diciembre–Abril (temporada seca)',
  },
  {
    slug: 'colombia',
    nombre: 'Colombia',
    nombreCorto: 'Colombia',
    pais: 'Colombia',
    descripcion:
      'La ciudad de la eterna primavera, la magia del Caribe y el café más aromático del mundo.',
    keywords: [
      'viaje a colombia',
      'itinerario colombia',
      'medellin cartagena bogota',
      'que ver en colombia',
    ],
    diasRecomendados: 10,
    mejorEpoca: 'Diciembre–Marzo o Junio–Agosto',
  },
  {
    slug: 'argentina',
    nombre: 'Argentina',
    nombreCorto: 'Argentina',
    pais: 'Argentina',
    descripcion:
      'Tango, Patagonia, cataratas del Iguazú y los mejores vinos del mundo.',
    keywords: [
      'viaje a argentina',
      'itinerario argentina',
      'buenos aires patagonia',
      'que ver en argentina',
    ],
    diasRecomendados: 14,
    mejorEpoca: 'Noviembre–Marzo (verano austral)',
  },
  {
    slug: 'republica-dominicana',
    nombre: 'República Dominicana',
    nombreCorto: 'Rep. Dominicana',
    pais: 'República Dominicana',
    descripcion:
      'Playas de ensueño, merengue y bachata, y la calidez del Caribe con todo incluido.',
    keywords: [
      'viaje a republica dominicana',
      'itinerario rd',
      'punta cana santo domingo',
      'que ver en rd',
    ],
    diasRecomendados: 7,
    mejorEpoca: 'Diciembre–Abril',
  },
  {
    slug: 'tailandia',
    nombre: 'Tailandia',
    nombreCorto: 'Tailandia',
    pais: 'Tailandia',
    descripcion:
      'Templos dorados, playas de película, street food increíble y la hospitalidad tailandesa.',
    keywords: [
      'viaje a tailandia',
      'itinerario tailandia',
      'bangkok phuket chiang mai',
      'que ver en tailandia',
    ],
    diasRecomendados: 12,
    mejorEpoca: 'Noviembre–Febrero',
  },
  {
    slug: 'peru',
    nombre: 'Perú',
    nombreCorto: 'Perú',
    pais: 'Perú',
    descripcion:
      'Machu Picchu, el Cusco imperial, la gastronomía más premiada y el Amazonas.',
    keywords: ['viaje a peru', 'machu picchu', 'cusco lima'],
    diasRecomendados: 10,
    mejorEpoca: 'Mayo–Octubre',
  },
  {
    slug: 'grecia',
    nombre: 'Grecia',
    nombreCorto: 'Grecia',
    pais: 'Grecia',
    descripcion:
      'Santorini, Atenas, islas del Egeo y la cuna de la civilización occidental.',
    keywords: ['viaje a grecia', 'santorini atenas', 'islas griegas'],
    diasRecomendados: 10,
    mejorEpoca: 'Mayo–Octubre',
  },
  {
    slug: 'portugal',
    nombre: 'Portugal',
    nombreCorto: 'Portugal',
    pais: 'Portugal',
    descripcion:
      'Lisboa, el Algarve, Porto y la saudade portuguesa que enamora a todos.',
    keywords: ['viaje a portugal', 'lisboa porto algarve'],
    diasRecomendados: 7,
    mejorEpoca: 'Abril–Octubre',
  },
  {
    slug: 'marruecos',
    nombre: 'Marruecos',
    nombreCorto: 'Marruecos',
    pais: 'Marruecos',
    descripcion:
      'Medinas milenarias, el desierto del Sahara y los colores de Chefchaouen.',
    keywords: ['viaje a marruecos', 'marrakech fez sahara'],
    diasRecomendados: 8,
    mejorEpoca: 'Marzo–Mayo u Octubre–Noviembre',
  },
  {
    slug: 'bali',
    nombre: 'Bali',
    nombreCorto: 'Bali',
    pais: 'Indonesia',
    descripcion:
      'La isla de los dioses: arrozales en terrazas, templos y surf perfecto.',
    keywords: ['viaje a bali', 'bali indonesia', 'ubud seminyak'],
    diasRecomendados: 10,
    mejorEpoca: 'Mayo–Septiembre',
  },
  {
    slug: 'turquia',
    nombre: 'Turquía',
    nombreCorto: 'Turquía',
    pais: 'Turquía',
    descripcion:
      'Capadocia, Estambul y las playas turquesas del Mediterráneo oriental.',
    keywords: ['viaje a turquia', 'estambul capadocia'],
    diasRecomendados: 10,
    mejorEpoca: 'Abril–Mayo o Septiembre–Octubre',
  },
  {
    slug: 'canada',
    nombre: 'Canadá',
    nombreCorto: 'Canadá',
    pais: 'Canadá',
    descripcion:
      'Vancouver, las Montañas Rocosas, Toronto y la aurora boreal en invierno.',
    keywords: ['viaje a canada', 'toronto vancouver banff'],
    diasRecomendados: 12,
    mejorEpoca: 'Junio–Septiembre',
  },
  {
    slug: 'australia',
    nombre: 'Australia',
    nombreCorto: 'Australia',
    pais: 'Australia',
    descripcion:
      'La Gran Barrera de Coral, Sídney, Uluru y fauna única en el mundo.',
    keywords: ['viaje a australia', 'sydney melbourne cairns'],
    diasRecomendados: 14,
    mejorEpoca: 'Septiembre–Noviembre',
  },
  {
    slug: 'cuba',
    nombre: 'Cuba',
    nombreCorto: 'Cuba',
    pais: 'Cuba',
    descripcion:
      'La Habana vintage, Trinidad colonial, playas de Varadero y salsa en vivo.',
    keywords: ['viaje a cuba', 'la habana varadero trinidad'],
    diasRecomendados: 8,
    mejorEpoca: 'Noviembre–Abril',
  },
  {
    slug: 'brasil',
    nombre: 'Brasil',
    nombreCorto: 'Brasil',
    pais: 'Brasil',
    descripcion:
      'Río de Janeiro, el Amazonas, Iguazú y el carnaval más grande del mundo.',
    keywords: ['viaje a brasil', 'rio de janeiro amazon'],
    diasRecomendados: 12,
    mejorEpoca: 'Abril–Junio o Agosto–Octubre',
  },
  {
    slug: 'costa-rica',
    nombre: 'Costa Rica',
    nombreCorto: 'Costa Rica',
    pais: 'Costa Rica',
    descripcion:
      'Pura Vida: volcanes, selvas, playas y el paraíso del ecoturismo.',
    keywords: ['viaje a costa rica', 'san jose arenal manuel antonio'],
    diasRecomendados: 8,
    mejorEpoca: 'Diciembre–Abril',
  },
  {
    slug: 'nueva-zelanda',
    nombre: 'Nueva Zelanda',
    nombreCorto: 'Nueva Zelanda',
    pais: 'Nueva Zelanda',
    descripcion:
      'Fiordos, volcanes, cultura maorí y los paisajes de El Señor de los Anillos.',
    keywords: ['viaje a nueva zelanda', 'auckland queenstown'],
    diasRecomendados: 14,
    mejorEpoca: 'Noviembre–Marzo',
  },
  {
    slug: 'india',
    nombre: 'India',
    nombreCorto: 'India',
    pais: 'India',
    descripcion:
      'El Taj Mahal, Rajastán, los Himalayas y los colores del festival Holi.',
    keywords: ['viaje a india', 'delhi agra rajasthan'],
    diasRecomendados: 14,
    mejorEpoca: 'Octubre–Marzo',
  },
  {
    slug: 'vietnam',
    nombre: 'Vietnam',
    nombreCorto: 'Vietnam',
    pais: 'Vietnam',
    descripcion:
      'Ha Long Bay, Hoi An, el Delta del Mekong y el mejor street food del sudeste asiático.',
    keywords: ['viaje a vietnam', 'hanoi ho chi minh halong'],
    diasRecomendados: 12,
    mejorEpoca: 'Noviembre–Abril',
  },
  {
    slug: 'egipto',
    nombre: 'Egipto',
    nombreCorto: 'Egipto',
    pais: 'Egipto',
    descripcion:
      'Las pirámides de Guiza, el Nilo, Luxor y el Mar Rojo cristalino.',
    keywords: ['viaje a egipto', 'el cairo piramides luxor'],
    diasRecomendados: 10,
    mejorEpoca: 'Octubre–Abril',
  },
  {
    slug: 'islandia',
    nombre: 'Islandia',
    nombreCorto: 'Islandia',
    pais: 'Islandia',
    descripcion:
      'Aurora boreal, géiseres, glaciares y la naturaleza más espectacular de Europa.',
    keywords: ['viaje a islandia', 'reykjavik aurora boreal'],
    diasRecomendados: 7,
    mejorEpoca: 'Junio–Agosto o Diciembre–Febrero',
  },
  {
    slug: 'noruega',
    nombre: 'Noruega',
    nombreCorto: 'Noruega',
    pais: 'Noruega',
    descripcion:
      'Fiordos noruegos, aurora boreal, vikingos y la ciudad de Bergen.',
    keywords: ['viaje a noruega', 'oslo bergen fiordos'],
    diasRecomendados: 8,
    mejorEpoca: 'Junio–Agosto o Diciembre–Febrero',
  },
  {
    slug: 'croacia',
    nombre: 'Croacia',
    nombreCorto: 'Croacia',
    pais: 'Croacia',
    descripcion:
      'Dubrovnik amurallada, las islas dálmatas y los lagos de Plitvice.',
    keywords: ['viaje a croacia', 'dubrovnik split plitvice'],
    diasRecomendados: 8,
    mejorEpoca: 'Mayo–Septiembre',
  },
  {
    slug: 'indonesia',
    nombre: 'Indonesia',
    nombreCorto: 'Indonesia',
    pais: 'Indonesia',
    descripcion:
      'Miles de islas, Komodo, Java y la diversidad natural más rica del planeta.',
    keywords: ['viaje a indonesia', 'jakarta java lombok'],
    diasRecomendados: 14,
    mejorEpoca: 'Mayo–Septiembre',
  },
  {
    slug: 'emiratos',
    nombre: 'Emiratos Árabes',
    nombreCorto: 'Dubai',
    pais: 'EAU',
    descripcion:
      'Dubái, Abu Dabi y el lujo del futuro en el corazón del desierto.',
    keywords: ['viaje a dubai', 'emiratos arabes abu dhabi'],
    diasRecomendados: 5,
    mejorEpoca: 'Noviembre–Marzo',
  },
  {
    slug: 'singapur',
    nombre: 'Singapur',
    nombreCorto: 'Singapur',
    pais: 'Singapur',
    descripcion:
      'La ciudad-estado más moderna de Asia: gastronomía, arquitectura y orden.',
    keywords: ['viaje a singapur', 'singapore marina bay'],
    diasRecomendados: 5,
    mejorEpoca: 'Todo el año',
  },
  {
    slug: 'kenia',
    nombre: 'Kenia',
    nombreCorto: 'Kenia',
    pais: 'Kenia',
    descripcion:
      'El safari más famoso del mundo, el Masái Mara y la Gran Migración.',
    keywords: ['safari kenia', 'masai mara nairobi'],
    diasRecomendados: 8,
    mejorEpoca: 'Julio–Octubre',
  },
  {
    slug: 'sudafrica',
    nombre: 'Sudáfrica',
    nombreCorto: 'Sudáfrica',
    pais: 'Sudáfrica',
    descripcion:
      'Los Cinco Grandes, Ciudad del Cabo, el Cabo de Buena Esperanza y el wine country.',
    keywords: ['viaje a sudafrica', 'ciudad del cabo safari'],
    diasRecomendados: 12,
    mejorEpoca: 'Mayo–Septiembre',
  },
  {
    slug: 'nepal',
    nombre: 'Nepal',
    nombreCorto: 'Nepal',
    pais: 'Nepal',
    descripcion:
      'El Everest, Katmandú, el trekking más legendario y la espiritualidad única.',
    keywords: ['viaje a nepal', 'katmandu everest trekking'],
    diasRecomendados: 10,
    mejorEpoca: 'Octubre–Noviembre o Marzo–Mayo',
  },
  {
    slug: 'cambodia',
    nombre: 'Camboya',
    nombreCorto: 'Camboya',
    pais: 'Camboya',
    descripcion:
      'Angkor Wat, Phnom Penh y la historia fascinante del pueblo jemer.',
    keywords: ['viaje a camboya', 'angkor wat siem reap'],
    diasRecomendados: 6,
    mejorEpoca: 'Noviembre–Febrero',
  },
  {
    slug: 'chile',
    nombre: 'Chile',
    nombreCorto: 'Chile',
    pais: 'Chile',
    descripcion:
      'Atacama, Patagonia, la Isla de Pascua y Santiago entre montañas y vino.',
    keywords: ['viaje a chile', 'santiago atacama patagonia'],
    diasRecomendados: 12,
    mejorEpoca: 'Noviembre–Marzo',
  },
  {
    slug: 'uruguay',
    nombre: 'Uruguay',
    nombreCorto: 'Uruguay',
    pais: 'Uruguay',
    descripcion:
      'Montevideo, Punta del Este, las bodegas del Tannat y el mate.',
    keywords: ['viaje a uruguay', 'montevideo punta del este'],
    diasRecomendados: 6,
    mejorEpoca: 'Diciembre–Marzo',
  },
  {
    slug: 'panama',
    nombre: 'Panamá',
    nombreCorto: 'Panamá',
    pais: 'Panamá',
    descripcion:
      'El canal más famoso del mundo, Bocas del Toro y la ciudad de rascacielos.',
    keywords: ['viaje a panama', 'ciudad de panama canal bocas del toro'],
    diasRecomendados: 6,
    mejorEpoca: 'Diciembre–Abril',
  },
  {
    slug: 'filipinas',
    nombre: 'Filipinas',
    nombreCorto: 'Filipinas',
    pais: 'Filipinas',
    descripcion:
      'Palawan, Boracay y más de 7000 islas de aguas turquesas e increíble snorkel.',
    keywords: ['viaje a filipinas', 'palawan boracay manila'],
    diasRecomendados: 12,
    mejorEpoca: 'Noviembre–Mayo',
  },
  {
    slug: 'suiza',
    nombre: 'Suiza',
    nombreCorto: 'Suiza',
    pais: 'Suiza',
    descripcion:
      'Los Alpes suizos, Zúrich, Ginebra, el chocolate y los relojes más precisos.',
    keywords: ['viaje a suiza', 'zurich ginebra alps'],
    diasRecomendados: 7,
    mejorEpoca: 'Junio–Septiembre o Diciembre–Marzo',
  },
  {
    slug: 'austria',
    nombre: 'Austria',
    nombreCorto: 'Austria',
    pais: 'Austria',
    descripcion:
      'Viena imperial, Salzburgo de Mozart y las montañas de los Alpes austríacos.',
    keywords: ['viaje a austria', 'viena salzburgo alpes'],
    diasRecomendados: 7,
    mejorEpoca: 'Abril–Octubre o Diciembre',
  },
  {
    slug: 'hungria',
    nombre: 'Hungría',
    nombreCorto: 'Hungría',
    pais: 'Hungría',
    descripcion:
      'Budapest, los balnearios termales, el Danubio y los vinos del Tokaj.',
    keywords: ['viaje a hungria', 'budapest danubio', 'balnearios budapest'],
    diasRecomendados: 5,
    mejorEpoca: 'Abril–Octubre',
  },
  {
    slug: 'republica-checa',
    nombre: 'República Checa',
    nombreCorto: 'Praga',
    pais: 'República Checa',
    descripcion:
      'Praga la ciudad de las cien torres, Český Krumlov y la mejor cerveza del mundo.',
    keywords: ['viaje a republica checa', 'praga viena'],
    diasRecomendados: 5,
    mejorEpoca: 'Abril–Octubre',
  },
  {
    slug: 'escocia',
    nombre: 'Escocia',
    nombreCorto: 'Escocia',
    pais: 'Reino Unido',
    descripcion: 'Edimburgo, los Highlands, el Loch Ness y el whisky escocés.',
    keywords: ['viaje a escocia', 'edimburgo highlands loch ness'],
    diasRecomendados: 7,
    mejorEpoca: 'Mayo–Septiembre',
  },
  {
    slug: 'irlanda',
    nombre: 'Irlanda',
    nombreCorto: 'Irlanda',
    pais: 'Irlanda',
    descripcion:
      'Los Acantilados de Moher, Dublín, el Ring of Kerry y los pubs más acogedores.',
    keywords: ['viaje a irlanda', 'dublin acantilados de moher'],
    diasRecomendados: 7,
    mejorEpoca: 'Mayo–Agosto',
  },
  {
    slug: 'belgica',
    nombre: 'Bélgica',
    nombreCorto: 'Bélgica',
    pais: 'Bélgica',
    descripcion:
      'Bruselas, Brujas, el chocolate y las mejores cervezas del mundo.',
    keywords: ['viaje a belgica', 'bruselas brujas chocolate'],
    diasRecomendados: 5,
    mejorEpoca: 'Abril–Septiembre',
  },
  {
    slug: 'paises-bajos',
    nombre: 'Países Bajos',
    nombreCorto: 'Amsterdam',
    pais: 'Países Bajos',
    descripcion:
      'Ámsterdam, los canales, los tulipanes, los museos y la cultura ciclista.',
    keywords: ['viaje a holanda', 'amsterdam paises bajos tulipanes'],
    diasRecomendados: 5,
    mejorEpoca: 'Abril–Octubre',
  },
]

/**
 * Lista publicada: sin slugs repetidos (generateStaticParams y el sitemap no
 * admiten duplicados) y con la imagen social genérica.
 */
export const DESTINOS: Destino[] = DATOS.filter(
  (d, i, todos) => todos.findIndex((x) => x.slug === d.slug) === i
).map((d) => ({ ...d, imagen: OG_IMAGEN_GENERICA }))

export function getDestino(slug: string): Destino | undefined {
  return DESTINOS.find((d) => d.slug === slug)
}

export function getTopDestinos(): Destino[] {
  return DESTINOS.slice(0, 10)
}
