import type { Escena } from '@/components/brand/Postal'
import type { Destino } from './destinos'

/**
 * Datos curados de cada landing /viaje/[slug] (docs/DISENO.md §6.10): ficha
 * rápida, un día de ejemplo y la escena de la postal. Contenido editorial:
 * el día de ejemplo es orientativo (Wayio ajusta horarios y orden a las
 * fechas reales del viaje) y no se presenta como horario oficial.
 */

export interface ActividadEjemplo {
  /** 'HH:MM' (24 h); la UI la muestra en 12 h es-DO. */
  hora: string
  nombre: string
  nota: string
}

export interface FichaDestino {
  /** Coordenadas reales de la ciudad del día de ejemplo. */
  lat: number
  lng: number
  /** Ciudad del día de ejemplo («Un día en …»). */
  ciudad: string
  moneda: string
  idioma: string
  idealPara: readonly string[]
  escena: Escena
  dia: readonly ActividadEjemplo[]
}

const a = (hora: string, nombre: string, nota: string): ActividadEjemplo => ({
  hora,
  nombre,
  nota,
})

const FICHAS: Record<string, FichaDestino> = {
  japon: {
    lat: 35.6762,
    lng: 139.6503,
    ciudad: 'Tokio',
    moneda: 'Yen japonés (JPY)',
    idioma: 'Japonés',
    idealPara: ['Cultura y templos', 'Gastronomía', 'Ciudades'],
    escena: 'ciudad',
    dia: [
      a(
        '08:30',
        'Santuario Meiji',
        'Paseo entre cedros antes de las multitudes.'
      ),
      a(
        '11:00',
        'Harajuku y Omotesandō',
        'La calle Takeshita y arquitectura moderna.'
      ),
      a(
        '13:00',
        'Ramen en Shibuya',
        'Barras pequeñas donde se pide en una máquina.'
      ),
      a(
        '16:00',
        'Templo Sensō-ji, Asakusa',
        'La calle Nakamise para comprar recuerdos.'
      ),
      a(
        '19:30',
        'Shinjuku de noche',
        'Yakitori en los callejones de Omoide Yokocho.'
      ),
    ],
  },
  espana: {
    lat: 40.4168,
    lng: -3.7038,
    ciudad: 'Madrid',
    moneda: 'Euro (EUR)',
    idioma: 'Español',
    idealPara: ['Arte e historia', 'Tapas', 'Playas'],
    escena: 'ciudad',
    dia: [
      a(
        '09:30',
        'Museo del Prado',
        'Velázquez y Goya; compra la entrada en línea.'
      ),
      a('12:30', 'Parque del Retiro', 'El Palacio de Cristal y el estanque.'),
      a(
        '14:30',
        'Almuerzo en La Latina',
        'Menú del día o tapas por la Cava Baja.'
      ),
      a(
        '17:30',
        'Palacio Real y Plaza Mayor',
        'Paseo por el Madrid de los Austrias.'
      ),
      a(
        '21:00',
        'Tapas en el Barrio de las Letras',
        'En Madrid se cena tarde.'
      ),
    ],
  },
  italia: {
    lat: 41.9028,
    lng: 12.4964,
    ciudad: 'Roma',
    moneda: 'Euro (EUR)',
    idioma: 'Italiano',
    idealPara: ['Arte e historia', 'Gastronomía', 'Ciudades'],
    escena: 'ciudad',
    dia: [
      a(
        '08:30',
        'Coliseo y Foro Romano',
        'Entrada combinada con horario reservado.'
      ),
      a('12:30', 'Almuerzo en Monti', 'Pasta cacio e pepe en una trattoria.'),
      a('15:00', 'Panteón y Piazza Navona', 'A pie, por calles empedradas.'),
      a('17:30', 'Fontana di Trevi', 'Mejor al caer la tarde.'),
      a('20:30', 'Cena en Trastevere', 'El barrio más animado de noche.'),
    ],
  },
  'estados-unidos': {
    lat: 40.7128,
    lng: -74.006,
    ciudad: 'Nueva York',
    moneda: 'Dólar estadounidense (USD)',
    idioma: 'Inglés',
    idealPara: ['Ciudades', 'Compras', 'Parques nacionales'],
    escena: 'ciudad',
    dia: [
      a(
        '09:00',
        'Central Park',
        'Entra por la calle 72 y camina hasta Bethesda.'
      ),
      a(
        '11:30',
        'Museo Metropolitano de Arte',
        'Elige dos o tres salas, no todo.'
      ),
      a(
        '14:00',
        'Almuerzo en Chelsea Market',
        'Muchas opciones bajo un mismo techo.'
      ),
      a('16:00', 'High Line', 'Parque elevado hasta Hudson Yards.'),
      a(
        '19:30',
        'Times Square y cena en Midtown',
        'Las luces se disfrutan de noche.'
      ),
    ],
  },
  francia: {
    lat: 48.8566,
    lng: 2.3522,
    ciudad: 'París',
    moneda: 'Euro (EUR)',
    idioma: 'Francés',
    idealPara: ['Arte', 'Gastronomía', 'Viajes en pareja'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Museo del Louvre', 'Reserva una franja horaria.'),
      a('12:30', 'Jardín de las Tullerías', 'Pausa entre fuentes y estatuas.'),
      a('14:00', 'Almuerzo en Le Marais', 'Bistrós y panaderías de barrio.'),
      a(
        '17:00',
        'Montmartre y el Sacré-Cœur',
        'La mejor vista gratuita de París.'
      ),
      a('20:30', 'Torre Eiffel iluminada', 'Destella a cada hora en punto.'),
    ],
  },
  mexico: {
    lat: 19.4326,
    lng: -99.1332,
    ciudad: 'Ciudad de México',
    moneda: 'Peso mexicano (MXN)',
    idioma: 'Español',
    idealPara: ['Gastronomía', 'Historia', 'Playas'],
    escena: 'ciudad',
    dia: [
      a(
        '09:00',
        'Zócalo y Catedral Metropolitana',
        'El corazón del Centro Histórico.'
      ),
      a('10:30', 'Templo Mayor', 'Las ruinas mexicas en pleno centro.'),
      a('13:30', 'Tacos al pastor', 'Una taquería del Centro Histórico.'),
      a(
        '16:00',
        'Museo Nacional de Antropología',
        'En el Bosque de Chapultepec.'
      ),
      a(
        '20:00',
        'Cena en la Roma o la Condesa',
        'Barrios arbolados y llenos de vida.'
      ),
    ],
  },
  colombia: {
    lat: 10.391,
    lng: -75.4794,
    ciudad: 'Cartagena',
    moneda: 'Peso colombiano (COP)',
    idioma: 'Español',
    idealPara: ['Playa', 'Historia colonial', 'Viajes en pareja'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Ciudad amurallada', 'Calles y balcones antes del calor.'),
      a('11:30', 'Castillo de San Felipe de Barajas', 'Lleva agua y sombrero.'),
      a('13:30', 'Almuerzo en Getsemaní', 'Pescado frito y arroz con coco.'),
      a(
        '16:00',
        'Murales y plazas de Getsemaní',
        'El barrio más vivo de la ciudad.'
      ),
      a('18:00', 'Atardecer en las murallas', 'Desde uno de los baluartes.'),
    ],
  },
  argentina: {
    lat: -34.6037,
    lng: -58.3816,
    ciudad: 'Buenos Aires',
    moneda: 'Peso argentino (ARS)',
    idioma: 'Español',
    idealPara: ['Ciudades', 'Naturaleza', 'Vino'],
    escena: 'ciudad',
    dia: [
      a('10:00', 'Plaza de Mayo y Casa Rosada', 'Donde empezó la ciudad.'),
      a('12:00', 'San Telmo', 'Adoquines, anticuarios y cafés.'),
      a(
        '13:30',
        'Almuerzo de parrilla',
        'Bife de chorizo y una copa de malbec.'
      ),
      a('16:00', 'La Boca y Caminito', 'Casas de colores junto al Riachuelo.'),
      a('21:30', 'Cena con tango', 'En Buenos Aires se cena tarde.'),
    ],
  },
  'republica-dominicana': {
    lat: 18.4861,
    lng: -69.9312,
    ciudad: 'Santo Domingo',
    moneda: 'Peso dominicano (DOP)',
    idioma: 'Español',
    idealPara: ['Playa', 'Historia colonial', 'Familia'],
    escena: 'ciudad',
    dia: [
      a(
        '09:00',
        'Catedral Primada de América',
        'La primera catedral del continente.'
      ),
      a('10:30', 'Calle El Conde', 'Paseo peatonal por la Zona Colonial.'),
      a('13:00', 'Almuerzo criollo', 'La bandera: arroz, habichuelas y carne.'),
      a(
        '15:30',
        'Alcázar de Colón y Plaza de España',
        'Con vista al río Ozama.'
      ),
      a(
        '18:00',
        'Atardecer en el Malecón',
        'Brisa del Caribe para cerrar el día.'
      ),
    ],
  },
  tailandia: {
    lat: 13.7563,
    lng: 100.5018,
    ciudad: 'Bangkok',
    moneda: 'Baht tailandés (THB)',
    idioma: 'Tailandés',
    idealPara: ['Templos', 'Comida callejera', 'Playas'],
    escena: 'ciudad',
    dia: [
      a(
        '08:30',
        'Gran Palacio y Wat Phra Kaew',
        'Ropa que cubra hombros y rodillas.'
      ),
      a('11:00', 'Wat Pho', 'El gran Buda reclinado.'),
      a('13:00', 'Almuerzo de pad thai', 'En un puesto cerca del río.'),
      a(
        '16:00',
        'Barco por el río Chao Phraya',
        'La ciudad vista desde el agua.'
      ),
      a('19:00', 'Chinatown de noche', 'Comida callejera en Yaowarat.'),
    ],
  },
  peru: {
    lat: -13.532,
    lng: -71.9675,
    ciudad: 'Cusco',
    moneda: 'Sol peruano (PEN)',
    idioma: 'Español y quechua',
    idealPara: ['Historia inca', 'Montaña', 'Gastronomía'],
    escena: 'montana',
    dia: [
      a(
        '09:00',
        'Plaza de Armas del Cusco',
        'Con calma: estás a unos 3,400 m.'
      ),
      a('10:30', 'Qorikancha', 'Templo inca bajo un convento colonial.'),
      a('13:00', 'Almuerzo en San Blas', 'El barrio de los artesanos.'),
      a('15:00', 'Sacsayhuamán', 'Murallas de piedra sobre la ciudad.'),
      a('19:30', 'Cena de cocina andina', 'Quinua, papas nativas y ají.'),
    ],
  },
  grecia: {
    lat: 37.9838,
    lng: 23.7275,
    ciudad: 'Atenas',
    moneda: 'Euro (EUR)',
    idioma: 'Griego',
    idealPara: ['Historia', 'Islas', 'Gastronomía'],
    escena: 'mar',
    dia: [
      a('08:00', 'Acrópolis y Partenón', 'Llega a la apertura por el calor.'),
      a(
        '11:00',
        'Museo de la Acrópolis',
        'Las piezas originales del Partenón.'
      ),
      a('13:30', 'Almuerzo en Plaka', 'Mezze, souvlaki y ensalada griega.'),
      a('16:30', 'Ágora Antigua', 'El centro de la vida de la ciudad clásica.'),
      a('19:30', 'Atardecer en el monte Licabeto', 'La mejor vista de Atenas.'),
    ],
  },
  portugal: {
    lat: 38.7223,
    lng: -9.1393,
    ciudad: 'Lisboa',
    moneda: 'Euro (EUR)',
    idioma: 'Portugués',
    idealPara: ['Ciudades', 'Gastronomía', 'Costa'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Tranvía 28 por Alfama', 'Súbete temprano para ir sentado.'),
      a(
        '10:30',
        'Castillo de San Jorge',
        'Vistas sobre los tejados y el Tajo.'
      ),
      a(
        '13:00',
        'Almuerzo en el Cais do Sodré',
        'Bacalao o sardinas a la brasa.'
      ),
      a('15:30', 'Belém', 'Monasterio de los Jerónimos y pastéis de Belém.'),
      a(
        '20:00',
        'Cena con fado en Alfama',
        'Reserva: los locales son pequeños.'
      ),
    ],
  },
  marruecos: {
    lat: 31.6295,
    lng: -7.9811,
    ciudad: 'Marrakech',
    moneda: 'Dírham marroquí (MAD)',
    idioma: 'Árabe y bereber; se habla francés',
    idealPara: ['Cultura', 'Desierto', 'Mercados'],
    escena: 'desierto',
    dia: [
      a('09:00', 'Jardín Majorelle', 'Temprano, antes de las filas.'),
      a('11:00', 'Palacio de la Bahía', 'Patios, azulejos y madera tallada.'),
      a(
        '13:00',
        'Tajín en la medina',
        'En una terraza con vista a los tejados.'
      ),
      a('15:30', 'Zocos de la medina', 'Regatear es parte de la compra.'),
      a('18:30', 'Plaza Jemaa el-Fna', 'Al anochecer se llena de puestos.'),
    ],
  },
  bali: {
    lat: -8.5069,
    lng: 115.2625,
    ciudad: 'Ubud',
    moneda: 'Rupia indonesia (IDR)',
    idioma: 'Indonesio y balinés',
    idealPara: ['Bienestar', 'Naturaleza', 'Surf'],
    escena: 'selva',
    dia: [
      a(
        '07:30',
        'Arrozales de Tegallalang',
        'Temprano, con luz suave y sin calor.'
      ),
      a('10:30', 'Bosque de los Monos', 'Guarda bien gafas y comida.'),
      a('13:00', 'Almuerzo de nasi campur', 'Arroz con varios acompañantes.'),
      a(
        '15:30',
        'Templo Tirta Empul',
        'Fuentes sagradas; se entra con sarong.'
      ),
      a('19:00', 'Danza tradicional', 'Espectáculos casi todas las noches.'),
    ],
  },
  turquia: {
    lat: 41.0082,
    lng: 28.9784,
    ciudad: 'Estambul',
    moneda: 'Lira turca (TRY)',
    idioma: 'Turco',
    idealPara: ['Historia', 'Gastronomía', 'Mercados'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Santa Sofía', 'Mil quinientos años de historia.'),
      a('10:30', 'Mezquita Azul', 'Respeta los horarios de oración.'),
      a('12:30', 'Almuerzo en Sultanahmet', 'Kebab, meze y té.'),
      a('14:30', 'Gran Bazar', 'Uno de los mercados cubiertos más antiguos.'),
      a('18:00', 'Crucero por el Bósforo', 'Entre Europa y Asia al atardecer.'),
    ],
  },
  canada: {
    lat: 49.2827,
    lng: -123.1207,
    ciudad: 'Vancouver',
    moneda: 'Dólar canadiense (CAD)',
    idioma: 'Inglés y francés',
    idealPara: ['Naturaleza', 'Ciudades', 'Familia'],
    escena: 'montana',
    dia: [
      a(
        '09:00',
        'Stanley Park en bicicleta',
        'El paseo marítimo rodea el parque.'
      ),
      a('12:00', 'Granville Island', 'Almuerzo en el mercado público.'),
      a('14:30', 'Gastown', 'El barrio más antiguo de la ciudad.'),
      a('16:00', 'Puente colgante de Capilano', 'Entre árboles gigantes.'),
      a('19:30', 'Cena en Yaletown', 'Mariscos del Pacífico.'),
    ],
  },
  australia: {
    lat: -33.8688,
    lng: 151.2093,
    ciudad: 'Sídney',
    moneda: 'Dólar australiano (AUD)',
    idioma: 'Inglés',
    idealPara: ['Playas', 'Naturaleza', 'Ciudades'],
    escena: 'mar',
    dia: [
      a(
        '09:00',
        'Ópera y Circular Quay',
        'El símbolo de la ciudad junto a la bahía.'
      ),
      a(
        '11:00',
        'Real Jardín Botánico',
        'Camino a la silla de Mrs. Macquarie.'
      ),
      a('13:00', 'Almuerzo en The Rocks', 'El barrio histórico del puerto.'),
      a('15:00', 'Ferry a Manly', 'Treinta minutos con vista a la bahía.'),
      a('19:00', 'Cena en Darling Harbour', 'Paseo nocturno junto al agua.'),
    ],
  },
  cuba: {
    lat: 23.1136,
    lng: -82.3666,
    ciudad: 'La Habana',
    moneda: 'Peso cubano (CUP)',
    idioma: 'Español',
    idealPara: ['Historia', 'Música', 'Playa'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Plaza de la Catedral', 'La Habana Vieja a pie.'),
      a(
        '11:00',
        'Plaza de Armas y calle Obispo',
        'Librerías y fachadas coloniales.'
      ),
      a('13:00', 'Almuerzo en un paladar', 'Restaurantes familiares cubanos.'),
      a(
        '16:00',
        'Paseo en carro clásico',
        'Por el Vedado y la Plaza de la Revolución.'
      ),
      a('18:30', 'Atardecer en el Malecón', 'Donde se reúne la ciudad.'),
    ],
  },
  brasil: {
    lat: -22.9068,
    lng: -43.1729,
    ciudad: 'Río de Janeiro',
    moneda: 'Real brasileño (BRL)',
    idioma: 'Portugués',
    idealPara: ['Playas', 'Naturaleza', 'Fiesta'],
    escena: 'playa',
    dia: [
      a('08:30', 'Cristo Redentor', 'Sube temprano para evitar nubes y filas.'),
      a('11:30', 'Escalera Selarón', 'Los azulejos de colores de Lapa.'),
      a('13:30', 'Almuerzo de feijoada', 'El plato de los sábados cariocas.'),
      a('16:00', 'Pan de Azúcar en teleférico', 'Quédate hasta el atardecer.'),
      a('19:00', 'Paseo por Copacabana', 'La playa de noche, con brisa.'),
    ],
  },
  'costa-rica': {
    lat: 10.4678,
    lng: -84.6427,
    ciudad: 'La Fortuna (Arenal)',
    moneda: 'Colón costarricense (CRC)',
    idioma: 'Español',
    idealPara: ['Naturaleza', 'Aventura', 'Familia'],
    escena: 'selva',
    dia: [
      a(
        '07:30',
        'Puentes colgantes',
        'Aves y monos entre la copa de los árboles.'
      ),
      a('10:30', 'Catarata de La Fortuna', 'Unos 500 escalones de bajada.'),
      a('13:00', 'Almuerzo de casado', 'Arroz, frijoles, plátano y ensalada.'),
      a(
        '15:30',
        'Senderos del volcán Arenal',
        'Coladas de lava cubiertas de bosque.'
      ),
      a('18:00', 'Aguas termales', 'Para cerrar el día en remojo.'),
    ],
  },
  'nueva-zelanda': {
    lat: -45.0312,
    lng: 168.6626,
    ciudad: 'Queenstown',
    moneda: 'Dólar neozelandés (NZD)',
    idioma: 'Inglés y maorí',
    idealPara: ['Aventura', 'Naturaleza', 'Paisajes'],
    escena: 'montana',
    dia: [
      a(
        '09:00',
        'Teleférico Skyline',
        'Vista del lago Wakatipu y los Remarkables.'
      ),
      a('11:00', 'Paseo junto al lago', 'Por los jardines de Queenstown.'),
      a('13:00', 'Almuerzo en el centro', 'Cafés y cocina local.'),
      a(
        '15:00',
        'Ruta a Glenorchy',
        'Una de las carreteras más bonitas del país.'
      ),
      a(
        '19:30',
        'Cena con vinos de Central Otago',
        'Famosos por su pinot noir.'
      ),
    ],
  },
  india: {
    lat: 28.6139,
    lng: 77.209,
    ciudad: 'Delhi',
    moneda: 'Rupia india (INR)',
    idioma: 'Hindi e inglés',
    idealPara: ['Cultura', 'Historia', 'Gastronomía'],
    escena: 'ciudad',
    dia: [
      a(
        '08:30',
        'Puerta de la India',
        'Paseo por la avenida antes del tráfico.'
      ),
      a('10:00', 'Tumba de Humayun', 'Precursora del Taj Mahal.'),
      a('13:00', 'Almuerzo en Old Delhi', 'Parathas y chai en Chandni Chowk.'),
      a(
        '15:00',
        'Fuerte Rojo y Jama Masjid',
        'Se entra a la mezquita descalzo.'
      ),
      a('19:00', 'Cena en Connaught Place', 'Cocina del norte de la India.'),
    ],
  },
  vietnam: {
    lat: 21.0278,
    lng: 105.8342,
    ciudad: 'Hanói',
    moneda: 'Dong vietnamita (VND)',
    idioma: 'Vietnamita',
    idealPara: ['Comida callejera', 'Naturaleza', 'Historia'],
    escena: 'ciudad',
    dia: [
      a('07:00', 'Lago Hoan Kiem', 'Tai chi y paseos al amanecer.'),
      a('09:30', 'Templo de la Literatura', 'La primera universidad del país.'),
      a('12:00', 'Almuerzo de bún chả', 'Cerdo a la brasa con fideos.'),
      a('15:00', 'Barrio Antiguo', 'Calles con oficios de siempre.'),
      a('19:00', 'Marionetas sobre el agua', 'Un arte tradicional del norte.'),
    ],
  },
  egipto: {
    lat: 29.9792,
    lng: 31.1342,
    ciudad: 'El Cairo y Guiza',
    moneda: 'Libra egipcia (EGP)',
    idioma: 'Árabe',
    idealPara: ['Historia', 'Desierto', 'Crucero por el Nilo'],
    escena: 'desierto',
    dia: [
      a(
        '08:00',
        'Pirámides de Guiza y la Esfinge',
        'A primera hora, con menos calor.'
      ),
      a('12:30', 'Almuerzo de koshari', 'El plato popular de El Cairo.'),
      a('14:30', 'Museo Egipcio de El Cairo', 'Siglos de historia faraónica.'),
      a(
        '17:30',
        'El Cairo copto',
        'Iglesias antiguas y callejones tranquilos.'
      ),
      a('20:00', 'Bazar Jan el-Jalili', 'Té de menta y regateo.'),
    ],
  },
  islandia: {
    lat: 64.1466,
    lng: -21.9426,
    ciudad: 'Reikiavik y el Círculo Dorado',
    moneda: 'Corona islandesa (ISK)',
    idioma: 'Islandés',
    idealPara: ['Naturaleza', 'Auroras', 'Aventura'],
    escena: 'montana',
    dia: [
      a(
        '08:30',
        'Salida al Círculo Dorado',
        'Mejor en carro propio o en tour.'
      ),
      a(
        '10:00',
        'Parque Nacional de Þingvellir',
        'Entre dos placas tectónicas.'
      ),
      a('12:30', 'Géiser Strokkur', 'Erupciona cada pocos minutos.'),
      a('14:30', 'Cascada de Gullfoss', 'Lleva ropa impermeable.'),
      a('19:00', 'Cena en Reikiavik', 'Pescado del Atlántico Norte.'),
    ],
  },
  noruega: {
    lat: 60.3913,
    lng: 5.3221,
    ciudad: 'Bergen',
    moneda: 'Corona noruega (NOK)',
    idioma: 'Noruego',
    idealPara: ['Fiordos', 'Naturaleza', 'Auroras'],
    escena: 'mar',
    dia: [
      a('09:00', 'Muelle de Bryggen', 'Casas hanseáticas de madera.'),
      a('10:30', 'Mercado de pescado', 'Salmón y mariscos frescos.'),
      a(
        '12:30',
        'Funicular al monte Fløyen',
        'La ciudad y el fiordo desde arriba.'
      ),
      a('15:00', 'Crucero por el fiordo', 'Paseos cortos desde el puerto.'),
      a(
        '19:30',
        'Cena de cocina noruega',
        'Bacalao, cordero o sopa de pescado.'
      ),
    ],
  },
  croacia: {
    lat: 42.6507,
    lng: 18.0944,
    ciudad: 'Dubrovnik',
    moneda: 'Euro (EUR)',
    idioma: 'Croata',
    idealPara: ['Costa', 'Historia', 'Islas'],
    escena: 'mar',
    dia: [
      a('08:00', 'Murallas de Dubrovnik', 'Temprano, antes del sol fuerte.'),
      a('11:00', 'Stradun y el casco antiguo', 'Calles de piedra pulida.'),
      a('13:00', 'Almuerzo de mariscos', 'Pescado del Adriático.'),
      a(
        '15:30',
        'Kayak hacia la isla de Lokrum',
        'Calas de agua transparente.'
      ),
      a('19:00', 'Teleférico al monte Srđ', 'El atardecer sobre la ciudad.'),
    ],
  },
  indonesia: {
    lat: -7.7956,
    lng: 110.3695,
    ciudad: 'Yogyakarta',
    moneda: 'Rupia indonesia (IDR)',
    idioma: 'Indonesio',
    idealPara: ['Templos', 'Naturaleza', 'Cultura'],
    escena: 'selva',
    dia: [
      a(
        '06:00',
        'Templo de Borobudur',
        'Muy temprano, con la luz del amanecer.'
      ),
      a('11:00', 'Taller de batik', 'La técnica textil tradicional de Java.'),
      a('13:00', 'Almuerzo de gudeg', 'Guiso de jaca, típico de la ciudad.'),
      a('15:30', 'Templo de Prambanan', 'El gran conjunto hindú de Java.'),
      a('18:30', 'Calle Malioboro', 'Puestos de comida y artesanía.'),
    ],
  },
  emiratos: {
    lat: 25.2048,
    lng: 55.2708,
    ciudad: 'Dubái',
    moneda: 'Dírham de los EAU (AED)',
    idioma: 'Árabe; el inglés está muy extendido',
    idealPara: ['Lujo', 'Compras', 'Desierto'],
    escena: 'desierto',
    dia: [
      a(
        '09:00',
        'Barrio histórico de Al Fahidi',
        'El Dubái de antes de los rascacielos.'
      ),
      a(
        '10:30',
        'Abra por el Creek',
        'Hasta los zocos del oro y las especias.'
      ),
      a('13:00', 'Almuerzo emiratí', 'Machboos y dátiles.'),
      a('15:30', 'Safari por el desierto', 'Dunas al atardecer.'),
      a(
        '20:00',
        'Burj Khalifa y la fuente de Dubái',
        'El espectáculo de agua es gratis.'
      ),
    ],
  },
  singapur: {
    lat: 1.3521,
    lng: 103.8198,
    ciudad: 'Singapur',
    moneda: 'Dólar de Singapur (SGD)',
    idioma: 'Inglés, malayo, mandarín y tamil',
    idealPara: ['Gastronomía', 'Ciudades', 'Familia'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Gardens by the Bay', 'Los superárboles y los invernaderos.'),
      a('11:30', 'Marina Bay', 'Paseo por la bahía.'),
      a('13:00', 'Almuerzo en un hawker centre', 'Pollo con arroz hainanés.'),
      a('15:30', 'Chinatown', 'Templos, tiendas y casas tradicionales.'),
      a('19:30', 'Clarke Quay de noche', 'Restaurantes junto al río.'),
    ],
  },
  kenia: {
    lat: -1.49,
    lng: 35.1439,
    ciudad: 'Masái Mara',
    moneda: 'Chelín keniano (KES)',
    idioma: 'Suajili e inglés',
    idealPara: ['Safari', 'Naturaleza', 'Fotografía'],
    escena: 'desierto',
    dia: [
      a('06:30', 'Safari al amanecer', 'La mejor hora para ver felinos.'),
      a('10:00', 'Desayuno en el campamento', 'Con vista a la sabana.'),
      a('13:00', 'Almuerzo y descanso', 'Las horas de más calor.'),
      a('16:00', 'Safari de la tarde', 'Los animales vuelven a moverse.'),
      a('19:30', 'Cena junto al fuego', 'Bajo un cielo muy estrellado.'),
    ],
  },
  sudafrica: {
    lat: -33.9249,
    lng: 18.4241,
    ciudad: 'Ciudad del Cabo',
    moneda: 'Rand sudafricano (ZAR)',
    idioma: 'Once idiomas oficiales; el inglés está muy extendido',
    idealPara: ['Naturaleza', 'Safari', 'Vino'],
    escena: 'montana',
    dia: [
      a(
        '08:30',
        'Montaña de la Mesa en teleférico',
        'Revisa el viento antes de subir.'
      ),
      a(
        '11:30',
        'Barrio Bo-Kaap',
        'Casas de colores y cocina malaya del Cabo.'
      ),
      a('13:00', 'Almuerzo en el V&A Waterfront', 'Junto al puerto.'),
      a('15:00', 'Playa de Boulders', 'La colonia de pingüinos africanos.'),
      a('18:30', 'Atardecer en Signal Hill', 'Vista de la ciudad y el océano.'),
    ],
  },
  nepal: {
    lat: 27.7172,
    lng: 85.324,
    ciudad: 'Katmandú',
    moneda: 'Rupia nepalí (NPR)',
    idioma: 'Nepalí',
    idealPara: ['Trekking', 'Espiritualidad', 'Montaña'],
    escena: 'montana',
    dia: [
      a(
        '08:00',
        'Estupa de Boudhanath',
        'Da la vuelta en el sentido del reloj.'
      ),
      a('10:30', 'Templo de Pashupatinath', 'A orillas del río Bagmati.'),
      a('13:00', 'Almuerzo de momos', 'Empanadillas al vapor.'),
      a('15:00', 'Plaza Durbar de Katmandú', 'Palacios y templos de madera.'),
      a('17:30', 'Swayambhunath', 'El templo de los monos, al atardecer.'),
    ],
  },
  cambodia: {
    lat: 13.4125,
    lng: 103.867,
    ciudad: 'Siem Reap y Angkor',
    moneda: 'Riel camboyano (KHR); el dólar se usa a diario',
    idioma: 'Jemer',
    idealPara: ['Templos', 'Historia', 'Cultura'],
    escena: 'selva',
    dia: [
      a('05:00', 'Amanecer en Angkor Wat', 'Lleva linterna para el camino.'),
      a('09:00', 'Templo de Bayon', 'Los rostros de piedra de Angkor Thom.'),
      a('12:00', 'Almuerzo de amok', 'Pescado al curry en hoja de plátano.'),
      a('14:30', 'Ta Prohm', 'El templo abrazado por las raíces.'),
      a('19:00', 'Mercado nocturno de Siem Reap', 'Artesanía y comida local.'),
    ],
  },
  chile: {
    lat: -33.4489,
    lng: -70.6693,
    ciudad: 'Santiago',
    moneda: 'Peso chileno (CLP)',
    idioma: 'Español',
    idealPara: ['Montaña', 'Vino', 'Desierto'],
    escena: 'montana',
    dia: [
      a(
        '09:30',
        'Plaza de Armas y Catedral',
        'El centro histórico de Santiago.'
      ),
      a('11:00', 'Cerro Santa Lucía', 'Un mirador en plena ciudad.'),
      a(
        '13:00',
        'Almuerzo en el Mercado Central',
        'Pescados y mariscos chilenos.'
      ),
      a('15:30', 'Barrio Lastarria', 'Cafés, librerías y museos.'),
      a('18:30', 'Cerro San Cristóbal', 'Los Andes al atardecer.'),
    ],
  },
  uruguay: {
    lat: -34.9011,
    lng: -56.1645,
    ciudad: 'Montevideo',
    moneda: 'Peso uruguayo (UYU)',
    idioma: 'Español',
    idealPara: ['Playa', 'Vino', 'Tranquilidad'],
    escena: 'playa',
    dia: [
      a(
        '10:00',
        'Ciudad Vieja y Plaza Independencia',
        'El Palacio Salvo y la puerta de la Ciudadela.'
      ),
      a('12:30', 'Almuerzo en el Mercado del Puerto', 'Parrilla uruguaya.'),
      a('15:00', 'Paseo por la Rambla', 'Kilómetros junto al Río de la Plata.'),
      a('17:00', 'Barrio Pocitos', 'Playa urbana y cafés.'),
      a('21:00', 'Cena de chivito', 'El sándwich nacional.'),
    ],
  },
  panama: {
    lat: 8.9824,
    lng: -79.5199,
    ciudad: 'Ciudad de Panamá',
    moneda: 'Balboa y dólar estadounidense (USD)',
    idioma: 'Español',
    idealPara: ['Ciudad', 'Playa', 'Naturaleza'],
    escena: 'ciudad',
    dia: [
      a(
        '09:00',
        'Esclusas de Miraflores',
        'Consulta el horario de paso de los barcos.'
      ),
      a('12:00', 'Almuerzo de sancocho', 'El caldo panameño de pollo.'),
      a('14:30', 'Casco Viejo', 'Plazas, iglesias y balcones restaurados.'),
      a('17:00', 'Cinta Costera', 'Paseo frente a los rascacielos.'),
      a('19:30', 'Cena en el Casco Viejo', 'Terrazas con vista a la bahía.'),
    ],
  },
  filipinas: {
    lat: 11.1784,
    lng: 119.393,
    ciudad: 'El Nido (Palawan)',
    moneda: 'Peso filipino (PHP)',
    idioma: 'Filipino e inglés',
    idealPara: ['Playas', 'Snorkel', 'Islas'],
    escena: 'playa',
    dia: [
      a('09:00', 'Laguna Grande en kayak', 'Entre paredes de roca caliza.'),
      a('11:30', 'Snorkel en isla Shimizu', 'Arrecifes de aguas tranquilas.'),
      a('13:00', 'Almuerzo en la playa', 'Pescado a la parrilla del tour.'),
      a('15:30', 'Playa Secreta', 'Se entra por un hueco en la roca.'),
      a(
        '18:00',
        'Atardecer en Las Cabanas',
        'La playa más famosa para el ocaso.'
      ),
    ],
  },
  suiza: {
    lat: 47.0502,
    lng: 8.3093,
    ciudad: 'Lucerna',
    moneda: 'Franco suizo (CHF)',
    idioma: 'Alemán, francés, italiano y romanche',
    idealPara: ['Montaña', 'Lagos', 'Trenes panorámicos'],
    escena: 'montana',
    dia: [
      a(
        '09:00',
        'Puente de la Capilla',
        'El puente de madera sobre el río Reuss.'
      ),
      a('10:30', 'Monumento al León', 'Tallado en la roca.'),
      a('12:30', 'Almuerzo junto al lago', 'Rösti o pescado del lago.'),
      a(
        '14:00',
        'Excursión al monte Pilatus',
        'En barco, tren de cremallera y teleférico.'
      ),
      a('19:00', 'Cena de fondue', 'Queso suizo para compartir.'),
    ],
  },
  austria: {
    lat: 48.2082,
    lng: 16.3738,
    ciudad: 'Viena',
    moneda: 'Euro (EUR)',
    idioma: 'Alemán',
    idealPara: ['Música', 'Arte', 'Cafés'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Palacio de Schönbrunn', 'Y sus jardines barrocos.'),
      a('12:30', 'Almuerzo de Wiener Schnitzel', 'El escalope vienés.'),
      a('14:30', 'Catedral de San Esteban', 'En el centro histórico.'),
      a('16:00', 'Café vienés', 'Tarta Sacher o strudel de manzana.'),
      a('19:30', 'Concierto de música clásica', 'Mozart, Strauss y compañía.'),
    ],
  },
  hungria: {
    lat: 47.4979,
    lng: 19.0402,
    ciudad: 'Budapest',
    moneda: 'Forinto húngaro (HUF)',
    idioma: 'Húngaro',
    idealPara: ['Termas', 'Historia', 'Vida nocturna'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Balneario Széchenyi', 'Aguas termales al aire libre.'),
      a('12:30', 'Almuerzo de gulash', 'La sopa húngara con pimentón.'),
      a('14:30', 'Parlamento húngaro', 'Visitas guiadas con reserva.'),
      a('16:30', 'Bastión de los Pescadores', 'Vistas al Danubio desde Buda.'),
      a('20:00', 'Crucero nocturno por el Danubio', 'La ciudad iluminada.'),
    ],
  },
  'republica-checa': {
    lat: 50.0755,
    lng: 14.4378,
    ciudad: 'Praga',
    moneda: 'Corona checa (CZK)',
    idioma: 'Checo',
    idealPara: ['Historia', 'Cerveza', 'Arquitectura'],
    escena: 'ciudad',
    dia: [
      a('08:00', 'Puente de Carlos', 'Temprano está casi vacío.'),
      a('09:30', 'Castillo de Praga', 'Y la catedral de San Vito.'),
      a('13:00', 'Almuerzo en Malá Strana', 'Cocina checa tradicional.'),
      a(
        '15:30',
        'Plaza de la Ciudad Vieja',
        'El reloj astronómico da la hora.'
      ),
      a('19:30', 'Cena en una cervecería', 'Cerveza checa de barril.'),
    ],
  },
  escocia: {
    lat: 55.9533,
    lng: -3.1883,
    ciudad: 'Edimburgo',
    moneda: 'Libra esterlina (GBP)',
    idioma: 'Inglés',
    idealPara: ['Historia', 'Paisajes', 'Whisky'],
    escena: 'montana',
    dia: [
      a('09:30', 'Castillo de Edimburgo', 'Sobre una roca volcánica.'),
      a('11:30', 'Royal Mile', 'Del castillo al palacio de Holyrood.'),
      a('13:00', 'Almuerzo en un pub', 'Sopa del día y pastel de carne.'),
      a('15:00', "Arthur's Seat", 'Subida corta con vista a la ciudad.'),
      a('19:00', 'Cata de whisky', 'Para entender las regiones escocesas.'),
    ],
  },
  irlanda: {
    lat: 53.3498,
    lng: -6.2603,
    ciudad: 'Dublín',
    moneda: 'Euro (EUR)',
    idioma: 'Inglés e irlandés',
    idealPara: ['Pubs', 'Paisajes', 'Historia'],
    escena: 'montana',
    dia: [
      a(
        '09:30',
        'Trinity College y el Libro de Kells',
        'La biblioteca antigua es imprescindible.'
      ),
      a('11:30', 'Castillo de Dublín', 'En pleno centro.'),
      a('13:00', 'Almuerzo en Temple Bar', 'Estofado irlandés.'),
      a('15:00', 'Guinness Storehouse', 'Termina con vista desde la terraza.'),
      a('20:00', 'Música en vivo en un pub', 'Sesiones de música tradicional.'),
    ],
  },
  belgica: {
    lat: 51.2093,
    lng: 3.2247,
    ciudad: 'Brujas',
    moneda: 'Euro (EUR)',
    idioma: 'Neerlandés, francés y alemán',
    idealPara: ['Chocolate', 'Cerveza', 'Arquitectura'],
    escena: 'ciudad',
    dia: [
      a(
        '10:00',
        'Plaza Mayor y el Campanario',
        'El centro medieval de Brujas.'
      ),
      a('11:30', 'Paseo en barca por los canales', 'Media hora entre puentes.'),
      a('13:00', 'Almuerzo de mejillones', 'Con papas fritas belgas.'),
      a(
        '15:00',
        'Beaterio de Brujas',
        'Un patio de paz junto al lago del Amor.'
      ),
      a('17:00', 'Taller de chocolate', 'Bombones hechos por ti.'),
    ],
  },
  'paises-bajos': {
    lat: 52.3676,
    lng: 4.9041,
    ciudad: 'Ámsterdam',
    moneda: 'Euro (EUR)',
    idioma: 'Neerlandés',
    idealPara: ['Canales', 'Museos', 'Bicicleta'],
    escena: 'ciudad',
    dia: [
      a('09:00', 'Rijksmuseum', 'Rembrandt y Vermeer.'),
      a('11:30', 'Museo Van Gogh', 'Entrada con hora reservada.'),
      a('13:30', 'Almuerzo en De Pijp', 'El mercado Albert Cuyp está al lado.'),
      a('15:30', 'Paseo en barco por los canales', 'La ciudad desde el agua.'),
      a('18:00', 'Barrio Jordaan', 'Canales tranquilos y cafés marrones.'),
    ],
  },
}

/** Ficha curada del destino (o null si no hay datos). */
export function getFicha(slug: string): FichaDestino | null {
  return FICHAS[slug] ?? null
}

export interface PreguntaFrecuente {
  pregunta: string
  respuesta: string
}

/**
 * Preguntas frecuentes del destino, a partir de sus datos curados (sin
 * promesas: precios y horarios reales dependen de las fechas del viaje).
 */
export function preguntasDestino(
  destino: Destino,
  ficha: FichaDestino | null
): PreguntaFrecuente[] {
  const n = destino.nombre
  const lista: PreguntaFrecuente[] = [
    {
      pregunta: `¿Cuántos días necesito para ${n}?`,
      respuesta: `Recomendamos unos ${destino.diasRecomendados} días para ver lo esencial de ${n} sin correr. Con Wayio puedes trazar desde un fin de semana hasta 30 días, y ajustar el ritmo a tu gusto.`,
    },
    {
      pregunta: `¿Cuál es la mejor época para viajar a ${n}?`,
      respuesta: `${destino.mejorEpoca}. Fuera de esas fechas también se puede viajar: Wayio adapta el plan a las fechas que elijas.`,
    },
  ]
  if (ficha) {
    lista.push(
      {
        pregunta: `¿Qué moneda se usa en ${n}?`,
        respuesta: `${ficha.moneda}. En Wayio ves el presupuesto estimado de tu viaje en dólares (USD), euros (EUR) o pesos dominicanos (DOP).`,
      },
      {
        pregunta: `¿Qué idioma se habla en ${n}?`,
        respuesta: `${ficha.idioma}.`,
      }
    )
  }
  lista.push({
    pregunta: `¿Cuánto cuesta planificar mi viaje a ${n} con Wayio?`,
    respuesta:
      'Trazar tu viaje es gratis: recibes tres versiones (Básico, Confort y Premium) con horarios día a día, mapa y un presupuesto estimado. Los vuelos y las reservas no están incluidos en el plan.',
  })
  return lista
}
