# Wayio: especificación de diseño definitiva

**Sistema «Cuaderno de Ruta», v1.0 (2026-10-08).** Documento de referencia para implementar. Los desarrolladores no necesitan leer las propuestas anteriores: todo lo que hace falta está aquí.

Para validar, se renderizaron el logo, el app icon, el favicon, el sello, una maqueta del hero en claro y oscuro y 12 fotogramas de la animación de entrada. Se usó Edge headless sobre archivos HTML locales. Los ratios de contraste se calcularon con la fórmula de luminancia relativa de WCAG 2.x. Los colores del mapa se tomaron de los style JSON reales de OpenFreeMap (positron y dark).

Archivos de verificación, en [`docs/diseno/`](diseno/):

- `logo1.png` (logo, isotipo, app icon y favicon en claro y oscuro)
- `mock1.png` (maqueta del hero en claro y oscuro)
- `frames.png` (12 fotogramas de la animación de entrada)
- `sello.png`
- `intro.html` (prototipo de la intro: con `?t=ms` se congela un fotograma y con `&dark=1` se ve en oscuro)

---

## 0. Decisiones de dirección

La base es la propuesta **editorial** (ganadora): tipografía primero, papel, tinta, un solo acento, capítulos por día, sellos, notas, postales generativas, el rigor de sus tokens y su accesibilidad, y su admin.

### Debilidades de la base corregidas

| Debilidad señalada                                                          | Corrección                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crema + arcilla + serif recuerda a Claude/Anthropic (`#DE7B55` ≈ `#D97757`) | La tinta pasa a **azul noche de carta náutica** (`#0F1E2E`). El acento único es **Rosa de Bayahíbe** (`#C21A66`), un magenta con raíz dominicana: es la flor nacional y también el color de las rutas en las cartas náuticas. El modo oscuro es **noche azul** (`#0B1622`), no marrón. |
| Fraunces sobre crema está gastado y cuesta en RN (fontTools)                | La display pasa a **Newsreader**, serif editorial sobria con opsz 6–72. En cartografía los lugares se rotulan en serif itálica. En RN se usa `@expo-google-fonts`.                                                                                                                     |
| La W se lee dos veces en el lockup                                          | **No hay lockup horizontal.** El wordmark `wayio` es la marca principal y su «w» ya es la ruta. El isotipo se usa solo y nunca se pone junto al wordmark.                                                                                                                              |
| Logo e intro sin validar                                                    | Están renderizados y prototipados por fotogramas (ver arriba).                                                                                                                                                                                                                         |
| La metáfora «Edición N.º 01» suena a revista elitista                       | Se habla de **«versiones»** y de «cuaderno de ruta». La voz usa verbos de ruta: «Trazar mi viaje».                                                                                                                                                                                     |
| El papel puede verse sucio                                                  | El fondo es `#F7F4EE`, poco saturado. Todo el contenido va en superficies **blancas** `#FFFFFF`. No hay textura de grano.                                                                                                                                                              |
| El tagline era plano                                                        | Nuevo tagline: «Traza tu viaje · Vive el camino».                                                                                                                                                                                                                                      |
| El botón «Saltar» era enfocable dentro de un overlay `aria-hidden`          | El overlay no tiene ningún elemento enfocable. Se salta con un listener global (puntero, tecla, rueda, toque).                                                                                                                                                                         |
| El icono del toast en oscuro daba 1,80:1                                    | Hay tokens de toast por tema, verificados (6,64–10,27).                                                                                                                                                                                                                                |
| Los sellos informativos iban rotados a 11 px                                | Los sellos informativos van a 12 px y sin rotar. Solo se rotan los sellos decorativos.                                                                                                                                                                                                 |
| La barra «No» de las votaciones daba 1,40:1                                 | Pasa a `fg-subtle` (6,23), con 2 px de separación y etiquetas.                                                                                                                                                                                                                         |
| Los consejos rotaban solos (incumple WCAG 2.2.2)                            | No hay temporizador: cambian con la fase real o con un botón.                                                                                                                                                                                                                          |
| No se gestionaba el foco entre pasos                                        | Al cambiar de paso, el foco va al H1 (graft de _producto_).                                                                                                                                                                                                                            |
| La itálica sin preload estaba en el H1, que es el LCP                       | Una sola declaración de Newsreader con normal + itálica, ambas precargadas.                                                                                                                                                                                                            |
| `mode='wait'` con `layoutId`                                                | `AnimatePresence mode="popLayout"` + `LazyMotion` con **domMax**, que es el que incluye las animaciones de layout.                                                                                                                                                                     |
| La intro arrancaba después de hidratar y dependía de un LayoutGroup         | La intro es **CSS servido en el SSR** y arranca en el primer paint. El relevo usa un **FLIP medido** (graft de _producto_).                                                                                                                                                            |
| `html{overflow:hidden}` durante la intro                                    | Eliminado: sin JS podía dejar la página bloqueada.                                                                                                                                                                                                                                     |
| Contornos de Fraunces para el logo                                          | El logo es **monolínea con paths exactos**, reutilizables en la web, la intro, la imagen OG y RN.                                                                                                                                                                                      |

### Injertos de las otras propuestas

- **Cartográfica:**
  - la historia local del acento (Rosa de Bayahíbe);
  - el portal circular de salida de la intro, que se abre desde el punto;
  - las coordenadas de Santo Domingo con efecto scramble;
  - el stepper de ruta global en el header;
  - la ficha «Tu ruta», que se rellena en vivo;
  - estaciones del formulario que cambian de **forma** al completarse;
  - «Lo que entendimos», con chips editables;
  - un único «TOTAL ESTIMADO» con barra apilada;
  - la barra inferior de `/trip` en móvil;
  - reagendar en 3 pasos;
  - «Faltan N días»;
  - la exclusión de bots y deep links en la intro y un tope duro de 3,2 s;
  - un lint de pares de contraste;
  - hápticos en la intro móvil;
  - el chiste del 404 «Isla Nula 0,0000°».
- **Producto:**
  - la intro en CSS servida en el SSR, con el hero ya pintado debajo y revelado solo con `transform`;
  - el FLIP medido con `getBoundingClientRect`;
  - un logo hecho de paths de trazo con `pathLength`;
  - la estela de puntos durante el vuelo;
  - «el punto» como submarca: GPS, loader y guardado;
  - el indicador de encaje con el presupuesto;
  - filas comparativas alineadas, con «Igual» donde no cambia nada;
  - «Hoy» como vista por defecto durante el viaje;
  - horas en formato 12 h es-DO;
  - el foco al H1 en cada paso;
  - el aviso a los 45 s;
  - el toast «3 cambios · Deshacer»;
  - el mapa sin destruirse al cambiar los días;
  - Geist Mono sin preload;
  - `ThemeColors = typeof light` en RN.

### Debilidades de las otras propuestas que no se heredan

- **De cartográfica:**
  - «SDQ → MAD» en los paquetes, que sugería un vuelo incluido;
  - los bucles en el hero;
  - el abuso de overline condensada;
  - las perforaciones del logo rellenas con el color de fondo (aquí se resuelven con `mask`);
  - el código de barras decorativo.
- **De producto:**
  - los bordes de control a 1,44:1;
  - el foco del mismo color que el error;
  - MapLibre en la landing;
  - el bottom sheet arrastrable sobre el mapa (conflicto de gestos);
  - dos sistemas de selección.

---

## 1. Concepto y principios

### 1.1 Concepto

**Wayio es un cuaderno de ruta que se escribe solo.** La IA hace el trabajo y la marca lo presenta con criterio. Cada viaje tiene:

- una **portada**: el destino en serif grande;
- **capítulos**: los días;
- **notas de ruta**: consejos y advertencias;
- **sellos**: hitos como «Guardado», «Disponible sin conexión» o «Solo lectura»;
- un **mapa con aire de carta impresa**.

El lenguaje gráfico es **la línea y el punto**. Las rutas son trazos monolínea con remates redondos y el destino es un punto magenta. Ese lenguaje aparece en el logo, la intro, la pantalla de carga, la línea de tiempo, el punto GPS («estás aquí»), los estados vacíos y las postales generativas.

### 1.2 Paleta con significado

| Color                                                   | Significado y uso                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Papel** `#F7F4EE` y blanco `#FFFFFF`                  | Lienzo y superficies                                                                                     |
| **Tinta** `#0F1E2E`, el azul noche de una carta impresa | Texto y estructura. **Todo lo seleccionado se marca en tinta.**                                          |
| **Rosa de Bayahíbe** `#C21A66`                          | El **único** acento de acción: CTA principal, punto del logo, «estás aquí», palabra en itálica del hero. |
| **Mar** `#1E5A57`                                       | Enlaces, información y foco                                                                              |
| **Latón** `#9A7531`                                     | Detalles premium: sellos, estrellas y filetes                                                            |

Los estados tienen tonos propios: éxito verde, aviso ámbar y peligro **rojo bermellón** `#B42318`, que se distingue del magenta.

### 1.3 Principios

1. **La tinta manda.** La jerarquía se construye con familia, tamaño y peso, no con color.
2. **Un solo magenta por vista.** Ya sea el CTA o el punto, nunca dos CTA magenta en la misma vista.
3. **Seleccionado = tinta, en todo el sistema.** Chips, tabs, chips de día, paquete elegido y barra inferior. Un solo sistema de selección.
4. **Papel antes que pantalla.** Filetes finos en lugar de sombras pesadas. Sin glass salvo en el header. Sin gradientes en textos ni botones.
5. **Cartografía con función.** Las coordenadas son reales, las rutas son reales y la retícula es tenue.
6. **Honestidad.** Nada de estrellas inventadas, «Más elegido» sin datos, progreso falso, mensajes para desarrolladores en la UI ni vuelos insinuados que no están incluidos.
7. **Movimiento con propósito.** Lo importante se traza, aterriza o se sella. No hay bucles infinitos fuera del progreso real.
8. **AA en los dos temas.** Ningún control se distingue solo por un filete decorativo y ningún estado se comunica solo con color.

### 1.4 Voz

Experta, cálida y sin prisa: un amigo dominicano que conoce el lugar.

| En lugar de                     | Escribir                               |
| ------------------------------- | -------------------------------------- |
| «Generar itinerario»            | «Trazar mi viaje»                      |
| «Regenerar»                     | «Otra versión»                         |
| «Generando…»                    | «Trazando tu viaje…»                   |
| «Revoluciona tus viajes con IA» | «Tu próximo viaje, trazado día a día.» |

- La IA se representa con el icono lucide `Compass` y no con `Sparkles`. Las etiquetas siguen diciendo «IA» por claridad: «Ajustar con IA».
- Los consejos se llaman «Notas de ruta». Las advertencias van bajo «Antes de ir».
- Tagline: **«Traza tu viaje · Vive el camino»**.
- Números con `Intl` en `es-DO`:
  - importes estimados como «US$1,840» o «RD$108,500», sin decimales; los pagos con 2 decimales;
  - fechas como «sáb, 12 nov» y rangos como «12–18 nov 2026»;
  - horas en 12 h, «9:30 a. m.».
- Nunca se muestra una fecha ISO cruda.

---

## 2. Tokens: `src/app/globals.css`

### 2.1 Bloque completo (sustituye al archivo actual)

```css
@import 'tailwindcss';

/* Dark mode por clase (html.dark), mismo mecanismo que hoy */
@custom-variant dark (&:where(.dark, .dark *));

/* Radio animable del portal de la intro */
@property --wy-r {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@theme {
  /* ── Familias (variables que inyecta next/font en <html>) ───────────── */
  --font-display:
    var(--font-newsreader), 'Iowan Old Style', 'Palatino Linotype', Georgia,
    serif;
  --font-sans:
    var(--font-instrument), ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
    sans-serif;
  --font-mono:
    var(--font-geist-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace;

  /* ── ROSA · Rosa de Bayahíbe (acción, destino, la marca) ────────────── */
  --color-rosa-50: #fff0f6;
  --color-rosa-100: #ffddeb;
  --color-rosa-200: #ffbad6;
  --color-rosa-300: #ff8ab8;
  --color-rosa-400: #f55a9a;
  --color-rosa-500: #e0307d; /* solo gráfico: nunca con texto encima */
  --color-rosa-600: #c21a66;
  --color-rosa-700: #a11254;
  --color-rosa-800: #800f45;
  --color-rosa-900: #640e39;
  --color-rosa-950: #3d0520;

  /* ── MAR · verde-azul profundo (enlaces, info, foco) ────────────────── */
  --color-mar-50: #eff7f5;
  --color-mar-100: #d6ece8;
  --color-mar-200: #aed8d1;
  --color-mar-300: #7fbfb6;
  --color-mar-400: #519f96;
  --color-mar-500: #33827a;
  --color-mar-600: #246b66;
  --color-mar-700: #1e5a57;
  --color-mar-800: #1a4a48;
  --color-mar-900: #173e3c;
  --color-mar-950: #0b2423;

  /* ── TINTA · texto y estructura ─────────────────────────────────────── */
  --color-tinta-50: #f2f5f8;
  --color-tinta-100: #e1e8ef;
  --color-tinta-200: #b6c2ce;
  --color-tinta-300: #9aaabb;
  --color-tinta-400: #7088a0;
  --color-tinta-500: #767d86;
  --color-tinta-600: #56626f;
  --color-tinta-700: #46525f;
  --color-tinta-800: #2c4258;
  --color-tinta-900: #142435;
  --color-tinta-950: #0f1e2e;

  /* ── NOCHE · superficies del modo oscuro ────────────────────────────── */
  --color-noche-600: #2e4760;
  --color-noche-700: #22384d;
  --color-noche-800: #1f344a;
  --color-noche-850: #18293b;
  --color-noche-900: #112131;
  --color-noche-950: #0b1622;

  /* ── PAPEL · neutros cálidos de superficie (no para texto) ──────────── */
  --color-papel-50: #fbf9f5;
  --color-papel-100: #f7f4ee;
  --color-papel-150: #f1eee8;
  --color-papel-200: #efeae1;
  --color-papel-300: #e2dcd0;
  --color-papel-400: #c9c1b2;
  --color-papel-500: #a39b8c;
  --color-papel-600: #7d7668;
  --color-papel-700: #5e584d;
  --color-papel-800: #403c35;
  --color-papel-900: #2a2723;

  /* ── LATÓN · premium (casi siempre gráfico) ─────────────────────────── */
  --color-laton-50: #faf5ea;
  --color-laton-100: #f2e6ca;
  --color-laton-200: #e6cd95;
  --color-laton-300: #d9b468;
  --color-laton-400: #c79a45;
  --color-laton-500: #b08a3e;
  --color-laton-600: #9a7531;
  --color-laton-700: #7e5f22;
  --color-laton-800: #654b1e;
  --color-laton-900: #533e1c;
  --color-laton-950: #2e210d;

  /* ── Estados ────────────────────────────────────────────────────────── */
  --color-verde-50: #edf5ee;
  --color-verde-200: #a8e8c4;
  --color-verde-300: #93d6a6;
  --color-verde-600: #2e6b3f;
  --color-verde-700: #23582f;
  --color-verde-950: #15302a;
  --color-ambar-50: #fbf1d9;
  --color-ambar-200: #fbd48c;
  --color-ambar-300: #f2c76e;
  --color-ambar-700: #7a5200;
  --color-ambar-800: #6b4800;
  --color-ambar-950: #2d2c22;
  --color-rojo-50: #fdeeec;
  --color-rojo-200: #ffc2b5;
  --color-rojo-300: #ff9c85;
  --color-rojo-600: #b42318;
  --color-rojo-700: #912018;
  --color-rojo-950: #35212a;

  /* ── Días del mapa: base (mapa claro) y luz (mapa oscuro) ───────────── */
  --color-dia-base-1: #a63f26;
  --color-dia-luz-1: #e58a68; /* Terracota */
  --color-dia-base-2: #1e5a57;
  --color-dia-luz-2: #6fb8ae; /* Mar */
  --color-dia-base-3: #7e5f22;
  --color-dia-luz-3: #d9b468; /* Latón */
  --color-dia-base-4: #3b4c8c;
  --color-dia-luz-4: #8e9ee0; /* Índigo */
  --color-dia-base-5: #7a3b69;
  --color-dia-luz-5: #d08bc0; /* Ciruela */
  --color-dia-base-6: #4f6427;
  --color-dia-luz-6: #a9c26b; /* Oliva */
  --color-dia-base-7: #1f6f95;
  --color-dia-luz-7: #6cb8de; /* Azul Caribe */
  --color-dia-base-8: #8a2f3c;
  --color-dia-luz-8: #e07f8c; /* Burdeos */
  --color-dia-base-9: #4a5560;
  --color-dia-luz-9: #a9b6c2; /* Pizarra */
  --color-dia-base-10: #9a5b13;
  --color-dia-luz-10: #e3a15a; /* Ocre */

  /* ── TEMPORAL: alias de escalas viejas → nuevas (borrar tras el codemod) */
  --color-brand-50: #eff7f5;
  --color-brand-100: #d6ece8;
  --color-brand-200: #aed8d1;
  --color-brand-300: #7fbfb6;
  --color-brand-400: #519f96;
  --color-brand-500: #33827a;
  --color-brand-600: #246b66;
  --color-brand-700: #1e5a57;
  --color-brand-800: #1a4a48;
  --color-brand-900: #173e3c;
  --color-brand-950: #0b2423;
  --color-coral-50: #fff0f6;
  --color-coral-100: #ffddeb;
  --color-coral-200: #ffbad6;
  --color-coral-300: #ff8ab8;
  --color-coral-400: #f55a9a;
  --color-coral-500: #e0307d;
  --color-coral-600: #c21a66;
  --color-coral-700: #a11254;
  --color-coral-800: #800f45;
  --color-coral-900: #640e39;
  --color-coral-950: #3d0520;
  --color-sun-50: #faf5ea;
  --color-sun-100: #f2e6ca;
  --color-sun-200: #e6cd95;
  --color-sun-300: #d9b468;
  --color-sun-400: #c79a45;
  --color-sun-500: #b08a3e;
  --color-sun-600: #9a7531;
  --color-sun-700: #7e5f22;
  --color-sun-800: #654b1e;
  --color-sun-900: #533e1c;

  /* ── Tipos (text-<rol>) ─────────────────────────────────────────────── */
  --text-display-xl: clamp(2.75rem, 1.6rem + 4.8vw, 5.5rem);
  --text-display-xl--line-height: 0.98;
  --text-display-xl--letter-spacing: -0.03em;
  --text-display-xl--font-weight: 500;
  --text-display-l: clamp(2.25rem, 1.5rem + 3.2vw, 3.75rem);
  --text-display-l--line-height: 1.02;
  --text-display-l--letter-spacing: -0.025em;
  --text-display-l--font-weight: 500;
  --text-h1: clamp(1.875rem, 1.5rem + 1.6vw, 2.5rem);
  --text-h1--line-height: 1.1;
  --text-h1--letter-spacing: -0.02em;
  --text-h1--font-weight: 600;
  --text-h2: clamp(1.5rem, 1.3rem + 0.9vw, 1.875rem);
  --text-h2--line-height: 1.15;
  --text-h2--letter-spacing: -0.015em;
  --text-h2--font-weight: 600;
  --text-h3: 1.25rem;
  --text-h3--line-height: 1.25;
  --text-h3--letter-spacing: -0.01em;
  --text-h3--font-weight: 600;
  --text-title: 1.0625rem;
  --text-title--line-height: 1.35;
  --text-title--letter-spacing: -0.005em;
  --text-title--font-weight: 600;
  --text-lead: clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem);
  --text-lead--line-height: 1.55;
  --text-body: 1rem;
  --text-body--line-height: 1.6;
  --text-body-s: 0.9375rem;
  --text-body-s--line-height: 1.5;
  --text-label: 0.875rem;
  --text-label--line-height: 1.3;
  --text-label--font-weight: 600;
  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.4;
  --text-caption--letter-spacing: 0.01em;
  --text-caption--font-weight: 500;
  --text-overline: 0.75rem;
  --text-overline--line-height: 1.2;
  --text-overline--letter-spacing: 0.14em;
  --text-overline--font-weight: 600;
  --text-data: 0.8125rem;
  --text-data--line-height: 1.4;
  --text-data--letter-spacing: 0.02em;
  --text-data--font-weight: 500;
  --text-num-xl: clamp(2.25rem, 2rem + 1vw, 2.75rem);
  --text-num-xl--line-height: 1;
  --text-num-xl--letter-spacing: -0.02em;
  --text-num-xl--font-weight: 600;
  --text-num-l: 1.75rem;
  --text-num-l--line-height: 1.1;
  --text-num-l--letter-spacing: -0.015em;
  --text-num-l--font-weight: 600;

  /* ── Radios (se ELIMINAN los overrides de --radius-xl/2xl/3xl) ──────── */
  --radius-stamp: 0.25rem; /* 4: badges, sellos rectangulares */
  --radius-control: 0.75rem; /* 12: inputs, selects, textarea, toasts, popups */
  --radius-card: 1rem; /* 16: tarjetas, mapa embebido */
  --radius-sheet: 1.5rem; /* 24: modales, sheets, postal del hero */
  /* botones, chips, avatares, pistas de segmented y switches: rounded-full */

  /* ── Curvas (no se pisan las ease-in/out por defecto de TW4) ────────── */
  --ease-papel: cubic-bezier(0.22, 1, 0.36, 1); /* entradas */
  --ease-salida: cubic-bezier(0.4, 0, 1, 1); /* salidas */
  --ease-tinta: cubic-bezier(
    0.65,
    0,
    0.35,
    1
  ); /* trazos, desplazamientos A→B */
  --ease-sello: cubic-bezier(0.34, 1.56, 0.64, 1); /* aterrizajes y sellos */
  --ease-portal: cubic-bezier(0.76, 0, 0.24, 1); /* revelados de pantalla */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1); /* TEMPORAL: alias legado */

  /* ── Animaciones ────────────────────────────────────────────────────── */
  --animate-shimmer: wy-shimmer 1.4s linear infinite;
  --animate-hormigas: wy-hormigas 1.2s linear infinite;
  --animate-sello: wy-sello 260ms var(--ease-sello) both;
  --animate-ping-gps: wy-ping 2s var(--ease-papel) 3;
  --animate-rise: wy-rise 420ms var(--ease-papel) both;
  @keyframes wy-shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  @keyframes wy-hormigas {
    to {
      stroke-dashoffset: -20;
    }
  }
  @keyframes wy-sello {
    0% {
      opacity: 0;
      transform: scale(1.3) rotate(-12deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(-6deg);
    }
  }
  @keyframes wy-ping {
    0% {
      opacity: 0.35;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(2.4);
    }
  }
  @keyframes wy-rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* ── Alturas y medidas (h-control-md, w-sidebar, …) ─────────────────── */
  --spacing-control-sm: 2.25rem; /* 36: admin y terciarios (área táctil ampliada) */
  --spacing-control-md: 2.75rem; /* 44: por defecto, objetivo táctil */
  --spacing-control-lg: 3.25rem; /* 52: inputs públicos y CTA de formulario */
  --spacing-control-xl: 3.75rem; /* 60: CTA del hero */
  --spacing-header: 4rem; /* 64 desktop */
  --spacing-header-sm: 3.5rem; /* 56 móvil */
  --spacing-bottombar: 4.5rem; /* 72 (+ safe-area) */
  --spacing-sidebar: 15.5rem; /* 248 admin */

  /* ── Contenedores (max-w-content, …) ────────────────────────────────── */
  --container-content: 77.5rem; /* 1240 */
  --container-prose: 42rem; /* ~68ch */
  --container-form: 40rem; /* 640 */
  --container-admin: 90rem; /* 1440 */

  --breakpoint-xs: 22.5rem; /* 360 */
  --blur-header: 10px;
}

/* ── Semánticos: CLARO ──────────────────────────────────────────────────── */
:root {
  color-scheme: light;
  --bg: #f7f4ee;
  --surface: #ffffff;
  --surface-2: #efeae1;
  --surface-raised: #ffffff;
  --surface-inverse: #142435;
  --surface-inverse-hover: #22384d;
  --fg: #0f1e2e;
  --fg-muted: #46525f;
  --fg-subtle: #56626f;
  --fg-inverse: #f7f4ee;
  --border: #e2dcd0; /* filete decorativo */
  --rule: #c9c1b2; /* filete medio: rieles, hover de tarjeta */
  --border-strong: #767d86; /* controles ≥3:1 (inputs, chips, outline) */
  --primary: #c21a66;
  --primary-hover: #a11254;
  --primary-pressed: #800f45;
  --primary-fg: #ffffff;
  --primary-soft: #fff0f6;
  --primary-soft-fg: #800f45;
  --primary-text: #a11254;
  --accent: #1e5a57;
  --accent-hover: #1a4a48;
  --accent-fg: #ffffff;
  --accent-soft: #eff7f5;
  --accent-soft-fg: #1a4a48;
  --brass: #9a7531;
  --brass-text: #7e5f22;
  --brass-soft: #faf5ea;
  --brass-soft-fg: #654b1e;
  --success: #2e6b3f;
  --success-bg: #edf5ee;
  --success-fg: #23582f;
  --warning: #7a5200;
  --warning-bg: #fbf1d9;
  --warning-fg: #6b4800;
  --danger: #b42318;
  --danger-hover: #912018;
  --on-danger: #ffffff;
  --danger-bg: #fdeeec;
  --danger-fg: #912018;
  --info: #1e5a57;
  --info-bg: #eff7f5;
  --info-fg: #1a4a48;
  --ring: #246b66;
  --ring-inverse: #7fbfb6;
  --overlay: rgb(11 22 34 / 0.55);
  --selection: #ffddeb;
  --shimmer: #f7f4ee;
  --toast-success: #9ae0b4;
  --toast-danger: #ffa899;
  --toast-action: #ff8ab8;
  --gps: #c21a66;
  --gps-ring: #ffffff;
  --map-casing: #ffffff;
  --map-label: #46525f;
  --dia-1: #a63f26;
  --dia-2: #1e5a57;
  --dia-3: #7e5f22;
  --dia-4: #3b4c8c;
  --dia-5: #7a3b69;
  --dia-6: #4f6427;
  --dia-7: #1f6f95;
  --dia-8: #8a2f3c;
  --dia-9: #4a5560;
  --dia-10: #9a5b13;
  --dia-num: #ffffff;
  --sh-card: 0 1px 0 rgb(15 30 46 / 0.04), 0 1px 3px rgb(15 30 46 / 0.06);
  --sh-elev:
    0 2px 4px -2px rgb(15 30 46 / 0.06), 0 14px 32px -12px rgb(15 30 46 / 0.18);
  --sh-float:
    0 10px 20px -10px rgb(15 30 46 / 0.14),
    0 28px 64px -20px rgb(15 30 46 / 0.3);
  /* duraciones: duration-(--dur-fast) */
  --dur-instant: 80ms;
  --dur-fast: 140ms;
  --dur-base: 200ms;
  --dur-medium: 280ms;
  --dur-slow: 420ms;
  --dur-page: 520ms;
  /* capas: z-(--z-header) */
  --z-base: 0;
  --z-sticky: 20;
  --z-header: 30;
  --z-dropdown: 40;
  --z-sheet: 50;
  --z-modal: 60;
  --z-toast: 70;
  --z-tooltip: 90;
  --z-intro: 100;
}

/* ── Semánticos: OSCURO (noche de carta) ───────────────────────────────── */
.dark {
  color-scheme: dark;
  --bg: #0b1622;
  --surface: #112131;
  --surface-2: #18293b;
  --surface-raised: #1f344a;
  --surface-inverse: #f1eee8;
  --surface-inverse-hover: #e2dcd0;
  --fg: #f1eee8;
  --fg-muted: #b6c2ce;
  --fg-subtle: #9aaabb;
  --fg-inverse: #0f1e2e;
  --border: #22384d;
  --rule: #2e4760;
  --border-strong: #7088a0;
  --primary: #f55a9a;
  --primary-hover: #ff8ab8;
  --primary-pressed: #ffbad6;
  --primary-fg: #0b1622;
  --primary-soft: #3a1d35;
  --primary-soft-fg: #ffbad6;
  --primary-text: #ff8ab8;
  --accent: #7fbfb6;
  --accent-hover: #aed8d1;
  --accent-fg: #0b1622;
  --accent-soft: #133038;
  --accent-soft-fg: #aed8d1;
  --brass: #d9b468;
  --brass-text: #e9c88a;
  --brass-soft: #2c2a24;
  --brass-soft-fg: #e9c88a;
  --success: #93d6a6;
  --success-bg: #15302a;
  --success-fg: #a8e8c4;
  --warning: #f2c76e;
  --warning-bg: #2d2c22;
  --warning-fg: #fbd48c;
  --danger: #ff9c85;
  --danger-hover: #ffc2b5;
  --on-danger: #0b1622;
  --danger-bg: #35212a;
  --danger-fg: #ffc2b5;
  --info: #7fbfb6;
  --info-bg: #133038;
  --info-fg: #aed8d1;
  --ring: #7fbfb6;
  --ring-inverse: #1e5a57;
  --overlay: rgb(3 8 14 / 0.7);
  --selection: #6b1440;
  --shimmer: #1f344a;
  --toast-success: #23582f;
  --toast-danger: #b42318;
  --toast-action: #a11254;
  --gps: #f55a9a;
  --gps-ring: #0b1622;
  --map-casing: #0b1622;
  --map-label: #b6c2ce;
  --dia-1: #e58a68;
  --dia-2: #6fb8ae;
  --dia-3: #d9b468;
  --dia-4: #8e9ee0;
  --dia-5: #d08bc0;
  --dia-6: #a9c26b;
  --dia-7: #6cb8de;
  --dia-8: #e07f8c;
  --dia-9: #a9b6c2;
  --dia-10: #e3a15a;
  --dia-num: #0b1622;
  --sh-card: 0 0 0 1px rgb(255 255 255 / 0.02);
  --sh-elev: 0 2px 4px rgb(0 0 0 / 0.3), 0 14px 32px -12px rgb(0 0 0 / 0.6);
  --sh-float:
    0 10px 24px -10px rgb(0 0 0 / 0.5), 0 28px 64px -20px rgb(0 0 0 / 0.7);
}

/* ── Utilidades semánticas (bg-surface, text-fg-muted, ring-ring, bg-dia-3…) */
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-raised: var(--surface-raised);
  --color-surface-inverse: var(--surface-inverse);
  --color-surface-inverse-hover: var(--surface-inverse-hover);
  --color-surface-muted: var(--surface-2); /* alias legado */
  --color-bg-elev: var(--surface-raised); /* alias legado */
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-fg-subtle: var(--fg-subtle);
  --color-fg-inverse: var(--fg-inverse);
  --color-border: var(--border);
  --color-rule: var(--rule);
  --color-border-strong: var(--border-strong);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-pressed: var(--primary-pressed);
  --color-primary-fg: var(--primary-fg);
  --color-primary-soft: var(--primary-soft);
  --color-primary-soft-fg: var(--primary-soft-fg);
  --color-primary-text: var(--primary-text);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-fg: var(--accent-fg);
  --color-accent-soft: var(--accent-soft);
  --color-accent-soft-fg: var(--accent-soft-fg);
  --color-brass: var(--brass);
  --color-brass-text: var(--brass-text);
  --color-brass-soft: var(--brass-soft);
  --color-brass-soft-fg: var(--brass-soft-fg);
  --color-success: var(--success);
  --color-success-bg: var(--success-bg);
  --color-success-fg: var(--success-fg);
  --color-warning: var(--warning);
  --color-warning-bg: var(--warning-bg);
  --color-warning-fg: var(--warning-fg);
  --color-danger: var(--danger);
  --color-danger-hover: var(--danger-hover);
  --color-on-danger: var(--on-danger);
  --color-danger-bg: var(--danger-bg);
  --color-danger-fg: var(--danger-fg);
  --color-info: var(--info);
  --color-info-bg: var(--info-bg);
  --color-info-fg: var(--info-fg);
  --color-ring: var(--ring);
  --color-ring-inverse: var(--ring-inverse);
  --color-overlay: var(--overlay);
  --color-gps: var(--gps);
  --color-toast-success: var(--toast-success);
  --color-toast-danger: var(--toast-danger);
  --color-toast-action: var(--toast-action);
  --color-dia-1: var(--dia-1);
  --color-dia-2: var(--dia-2);
  --color-dia-3: var(--dia-3);
  --color-dia-4: var(--dia-4);
  --color-dia-5: var(--dia-5);
  --color-dia-6: var(--dia-6);
  --color-dia-7: var(--dia-7);
  --color-dia-8: var(--dia-8);
  --color-dia-9: var(--dia-9);
  --color-dia-10: var(--dia-10);
  --color-dia-num: var(--dia-num);
  --shadow-card: var(--sh-card);
  --shadow-elev: var(--sh-elev);
  --shadow-float: var(--sh-float);
  --shadow-soft: var(--sh-card); /* alias legado */
  --shadow-lg: var(--sh-float); /* repara var(--shadow-lg) de ResultActions */
}

@layer base {
  *,
  ::before,
  ::after {
    border-color: var(--border);
  }
  html {
    -webkit-tap-highlight-color: transparent;
    text-size-adjust: 100%;
  }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.6;
    font-optical-sizing: auto;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    accent-color: var(--primary);
  }
  h1,
  h2,
  h3 {
    text-wrap: balance;
  }
  p,
  li {
    text-wrap: pretty;
  }
  ::selection {
    background: var(--selection);
    color: var(--fg);
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  input[type='date']::-webkit-calendar-picker-indicator {
    cursor: pointer;
    border-radius: 6px;
    padding: 2px;
    opacity: 0.7;
    transition: opacity 140ms;
  }
  input[type='date']::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--rule);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--fg-subtle);
    background-clip: content-box;
  }
}

/* ── Utilidades propias ─────────────────────────────────────────────────── */
@utility tnum {
  font-variant-numeric: tabular-nums lining-nums;
}

@utility kicker {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-stretch: 85%;
  color: var(--fg-muted);
}
@utility kicker-filete {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  &::before {
    content: '';
    width: 1.5rem;
    height: 1px;
    background: var(--brass);
  }
}

@utility reticula {
  position: relative;
  isolation: isolate;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-color: var(--rule);
    opacity: 0.45;
    -webkit-mask:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpath d='M0 .5H160M.5 0V160' stroke='%23000' fill='none'/%3E%3C/svg%3E")
        0 0 / 160px 160px,
      radial-gradient(ellipse at 50% 30%, #000 0%, transparent 70%);
    -webkit-mask-composite: source-in;
    mask:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpath d='M0 .5H160M.5 0V160' stroke='%23000' fill='none'/%3E%3C/svg%3E")
        0 0 / 160px 160px,
      radial-gradient(ellipse at 50% 30%, #000 0%, transparent 70%);
    mask-composite: intersect;
  }
}

/* Divisor de boleto con muescas (la tarjeta padre lleva overflow-hidden) */
@utility perforado {
  position: relative;
  height: 1.25rem;
  background-image: linear-gradient(to right, var(--rule) 50%, transparent 0);
  background-size: 8px 1px;
  background-repeat: repeat-x;
  background-position: 0 50%;
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: -0.625rem;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--border);
  }
  &::before {
    left: -0.6875rem;
  }
  &::after {
    right: -0.6875rem;
  }
}

/* Sello informativo: legible, 12 px, SIN rotación */
@utility sello {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 1.5rem;
  padding-inline: 0.5rem;
  border-radius: var(--radius-stamp);
  border: 1.5px solid currentColor;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-stretch: 85%;
}

/* ── TEMPORAL: utilidades legadas para no romper durante la migración ──── */
@utility grad-brand {
  background-color: var(--primary);
}
@utility text-gradient {
  color: var(--fg);
}
@utility bg-aurora {
  background-color: var(--bg);
}
@utility glass {
  background-color: var(--surface);
  border: 1px solid var(--border);
}

/* ── Intro (la lógica completa está en la sección 9) ───────────────────── */
.wy-intro {
  display: none;
}
html[data-intro='play'] .wy-intro,
html[data-intro='skip'] .wy-intro {
  display: grid;
}
html[data-intro='play'] .wy-intro {
  animation: wy-clock 2100ms linear both;
}
html[data-intro='play']:not([data-intro-js]) .wy-intro {
  animation:
    wy-clock 2100ms linear both,
    wy-intro-out 320ms var(--ease-salida) 2150ms forwards;
}
html[data-intro='skip'] .wy-intro {
  animation: wy-intro-out 200ms var(--ease-salida) forwards;
  pointer-events: none;
}
html[data-intro='play'] [data-wy-logo] {
  opacity: 0;
}
html[data-intro='play']:not([data-intro-js]) [data-wy-logo] {
  animation: wy-hide-until 2450ms step-end both;
}
html[data-intro='play'] .wy-hero-item {
  transform: translateY(16px);
}
.wy-hero-item {
  transition: transform var(--dur-page) var(--ease-papel);
  transition-delay: calc(var(--i, 0) * 60ms);
}
@keyframes wy-clock {
  from {
    opacity: 1;
  }
  to {
    opacity: 1;
  }
}
@keyframes wy-intro-out {
  to {
    opacity: 0;
    visibility: hidden;
  }
}
@keyframes wy-hide-until {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* ── Movimiento reducido: se conserva el feedback de color/opacidad ────── */
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-property:
      opacity, color, background-color, border-color, outline-color, fill,
      stroke !important;
    transition-duration: 120ms !important;
    transition-delay: 0s !important;
  }
  .wy-intro {
    display: none !important;
  }
  .wy-hero-item {
    transform: none !important;
  }
}

/* ── Impresión (Exportar PDF) ──────────────────────────────────────────── */
@media print {
  :root,
  .dark {
    --bg: #fff;
    --surface: #fff;
    --surface-2: #fff;
    --fg: #0f1e2e;
    --fg-muted: #46525f;
  }
  body {
    background: #fff;
    color: #0f1e2e;
    font-size: 11pt;
  }
  [data-print='hide'] {
    display: none !important;
  }
  [data-print='page'] {
    break-before: page;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
}
```

**Nota de migración.** Los alias `TEMPORAL` sirven para desplegar los tokens sin romper nada, pero **no garantizan el contraste**. Las combinaciones `grad-brand text-white`, `bg-coral-500 text-white` y cualquier `text-white` sobre `bg-*-500` se migran en la fase 1, porque en oscuro el primario lleva texto de tinta. Cuando el codemod termina, se borran los alias.

### 2.2 Mapeo de clases viejas a nuevas (codemod)

| Antes                                                                             | Después                                                                                                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `grad-brand text-white` (botones, chips «Elegido», burbujas, bloque «Tres pasos») | `bg-primary text-primary-fg hover:bg-primary-hover` (CTA) / `bg-surface-inverse text-fg-inverse` (selección, burbuja propia) |
| `text-gradient`                                                                   | `text-fg`. El acento va en `<em className="font-display italic text-primary">`                                               |
| `bg-aurora`                                                                       | `bg-bg reticula` (hero, login, carga, 404) / `bg-bg` (el resto)                                                              |
| `glass`                                                                           | `bg-surface border border-border`. Header: `bg-bg/88 backdrop-blur-header`                                                   |
| `bg-surface-muted`                                                                | `bg-surface-2` (el alias se mantiene)                                                                                        |
| `bg-bg-elev`                                                                      | `bg-surface-raised`                                                                                                          |
| `border-border-strong`                                                            | Mismo nombre, ahora ≥3:1. Para hairline de hover o rieles: `border-rule`                                                     |
| `text-brand-600/700` (enlaces)                                                    | `text-accent hover:text-accent-hover underline underline-offset-[3px]`                                                       |
| `bg-brand-50 text-brand-700 …` (avisos info)                                      | `<Callout tone="info">`                                                                                                      |
| `bg-sun-50 border-sun-200 … dark:…` (avisos)                                      | `<Callout tone="warning">`                                                                                                   |
| `bg-coral-*`                                                                      | `bg-primary` / `bg-primary-soft text-primary-soft-fg`                                                                        |
| `red-*`, `green-*`, `emerald-*`, `blue-*`, `indigo-*`, `purple-*`, `gray-*`       | Tokens semánticos: `danger`, `success`, `info`, `fg-*`, `surface-*`, `border`                                                |
| `shadow-[var(--shadow-soft)]` y las sombras rgba teal                             | `shadow-card` / `shadow-elev`. Las sombras de color se eliminan                                                              |
| `rounded-3xl` / `rounded-2xl` (tarjetas)                                          | `rounded-card`                                                                                                               |
| `rounded-xl` (inputs)                                                             | `rounded-control`                                                                                                            |
| botones `rounded-xl`                                                              | `rounded-full`                                                                                                               |
| `animate-float`, `animate-pulse-ring`, `loader3d-*`                               | Se eliminan (Loader3D lo sustituye `RutaDeFases`)                                                                            |
| `focus:ring-brand-500/…`, `focus:outline-none`                                    | Foco global `:focus-visible`. En inputs, ver §5.2                                                                            |
| `text-[10px]`, `text-[11px]`                                                      | `text-caption` (13) o `kicker` (12, mínimo absoluto)                                                                         |
| `font-extrabold` en titulares                                                     | `font-display text-h1` (600) / `text-display-*` (500)                                                                        |
| `DAY_COLORS` hex                                                                  | `src/constants/mapColors.ts` exporta `DAY_BASE`, `DAY_LUZ` y `dayColor(i, theme)`. En CSS: `bg-dia-N`                        |
| `formatCurrency(…'en-US')`                                                        | `Intl.NumberFormat('es-DO', { style:'currency', currency, maximumFractionDigits: 0 })` (la firma no cambia)                  |

---

## 3. Fuentes (`src/app/layout.tsx`)

Las tres familias se comprobaron en `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`:

- **Newsreader**: opsz 6–72, wght 200–800, normal e itálica.
- **Instrument Sans**: wdth 75–100, wght 400–700.
- **Geist Mono**: wght 100–900.

```tsx
import { Newsreader, Instrument_Sans, Geist_Mono } from 'next/font/google'

// Display: titulares ≥20 px, palabra de acento del hero, destinos. Normal + itálica en
// una sola declaración, ambas precargadas (la itálica está en el H1, que es el LCP).
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
})
// UI y texto: cuerpo, botones, formularios, tablas, números (tnum).
const instrument = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'], // overlines semicondensadas (font-stretch: 85%)
  variable: '--font-instrument',
  display: 'swap',
})
// Datos: coordenadas, IATA, IDs y claves del admin. Sin preload: se descarga solo si se usa.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
})

// <html lang="es" suppressHydrationWarning
//   className={`${newsreader.variable} ${instrument.variable} ${geistMono.variable} h-full`}>
```

- `latin` cubre á, é, í, ó, ú, ü, ñ, ¿, ¡, « y »; no hace falta `latin-ext`.
- `adjustFontFallback` viene activo por defecto y reduce el CLS.
- `viewport.themeColor` pasa a `#F7F4EE` en claro y `#0B1622` en oscuro.

**Reglas de uso:**

- Newsreader solo a partir de 20 px. El opsz lo resuelve `font-optical-sizing:auto`.
- La itálica se usa en una palabra o frase por titular y en los nombres de destino de las portadas.
- Como máximo dos pesos de Newsreader por vista (500 y 600).
- Instrument Sans: 400 en cuerpo, 500–600 en la UI.
- Geist Mono solo en datos: `18.4861° N · 69.9312° O`, `SDQ`, IDs.
- Las **horas no van en mono**: van en Instrument Sans con tnum, en 12 h.

### Recetas de tipo

| Rol                                         | Clases                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| H1 del hero                                 | `font-display text-display-xl` + `<em className="italic text-primary">` |
| H1 de portada, formulario, SEO, login y 404 | `font-display text-display-l`                                           |
| H1 de página (trip, grupo, admin a 28 px)   | `font-display text-h1`                                                  |
| Sección, título de día                      | `font-display text-h2`                                                  |
| Tarjeta editorial, modal                    | `font-display text-h3`                                                  |
| Título de UI (actividad, fila)              | `text-title`                                                            |
| Lead                                        | `text-lead text-fg-muted max-w-[36ch]` (hero) / `max-w-[60ch]`          |
| Cuerpo                                      | `text-body max-w-prose`                                                 |
| UI densa                                    | `text-body-s`                                                           |
| Etiqueta de campo                           | `text-label`                                                            |
| Caption                                     | `text-caption text-fg-muted`                                            |
| Overline / kicker                           | `kicker` (+ `kicker-filete`)                                            |
| Dato mono                                   | `font-mono text-data`                                                   |
| Precio de paquete, total                    | `text-num-xl tnum`                                                      |
| KPI admin                                   | `text-num-l tnum`                                                       |

---

## 4. Contrastes AA verificados

Calculados con `(L1+0,05)/(L2+0,05)` sobre colores sólidos con `contrast.ps1` y `days.ps1`. Los mínimos son 4,5 para texto normal y 3 para texto grande y componentes de UI (WCAG 1.4.11).

### 4.1 Claro

| Par                                                                                                      | Ratio                                   |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `fg #0F1E2E` / bg `#F7F4EE` · surface `#FFF` · surface-2 `#EFEAE1`                                       | 15,36 · 16,86 · 14,07                   |
| `fg-muted #46525F` / bg · surface · surface-2                                                            | 7,27 · 7,98 · 6,66                      |
| `fg-subtle #56626F` / bg · surface · surface-2                                                           | 5,67 · 6,23 · 5,20                      |
| `fg-subtle` / primary-soft · accent-soft · warning-bg · danger-bg · success-bg · tierra positron         | 5,65 · 5,72 · 5,54 · 5,52 · 5,60 · 5,59 |
| **Botón primario**: blanco / `#C21A66` · hover `#A11254` · pressed `#800F45`                             | **5,78** · 7,69 · 10,13                 |
| `primary #C21A66` como texto (itálica del hero) / bg · surface                                           | 5,26 · 5,78                             |
| `primary-text #A11254` / bg · surface · surface-2                                                        | 7,01 · 7,69 · 6,42                      |
| `primary-soft-fg #800F45` / `#FFF0F6`                                                                    | 9,19                                    |
| Enlace `accent #1E5A57` / bg · surface · surface-2                                                       | 7,20 · 7,91 · 6,60                      |
| Blanco / accent                                                                                          | 7,91                                    |
| `accent-soft-fg #1A4A48` / `#EFF7F5`                                                                     | 9,11                                    |
| `brass-text #7E5F22` / bg · surface                                                                      | 5,39 · 5,92                             |
| `brass-soft-fg #654B1E` / `#FAF5EA`                                                                      | 7,49                                    |
| success `#2E6B3F` / bg · surface; fg/bg `#23582F/#EDF5EE`; blanco/success                                | 5,81 · 6,38; 7,53; 6,38                 |
| warning `#7A5200` / bg · surface; fg/bg `#6B4800/#FBF1D9`                                                | 6,30 · 6,92; 7,32                       |
| danger `#B42318` / bg · surface · surface-2; blanco/danger; fg/bg `#912018/#FDEEEC`                      | 5,99 · 6,57 · 5,49; 6,57; 7,68          |
| `fg-inverse #F7F4EE` / inverse `#142435` (toast, chip seleccionado, pie, burbuja propia)                 | 14,35                                   |
| Pie: `#B6C2CE` · `#9AAABB` / `#142435`                                                                   | 8,70 · 6,63                             |
| Toast claro: acción `#FF8AB8` · icono éxito `#9AE0B4` · icono error `#FFA899` · enlace `#7FD1C6`         | 7,18 · 10,27 · 8,48 · 8,88              |
| Banda CTA: papel / `#C21A66`; botón invertido `#A11254` / papel                                          | 5,26; 7,01                              |
| Selección: fg / `#FFDDEB`                                                                                | 13,48                                   |
| **UI** `border-strong #767D86` / surface · bg · surface-2                                                | 4,16 · 3,79 · 3,47                      |
| **UI** foco `ring #246B66` / bg · surface · surface-2 · primary-soft                                     | 5,68 · 6,23 · 5,20 · 5,65               |
| **UI** foco sobre inverse: `ring-inverse #7FBFB6` / `#142435` (`#246B66` daría 2,53: prohibido)          | 7,52                                    |
| **UI** latón gráfico `#9A7531` / bg · surface                                                            | 3,85 · 4,23                             |
| **UI** switch: pista apagada `#767D86`/bg; thumb blanco/apagado; encendido `#1E5A57`/bg; thumb/encendido | 3,79; 4,16; 7,20; 7,91                  |
| **UI** votos: No `#56626F` · Sí `#1E5A57` / surface                                                      | 6,23 · 7,91                             |

Entre sí, «Sí» y «No» dan 1,27. Por eso van separados por 2 px y siempre con etiqueta y porcentaje.

Los filetes decorativos `border #E2DCD0` (1,37) y `rule #C9C1B2` (1,79) no delimitan ningún control.

### 4.2 Oscuro

| Par                                                                                                     | Ratio                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `fg #F1EEE8` / bg `#0B1622` · surface `#112131` · surface-2 `#18293B` · raised `#1F344A`                | 15,74 · 14,11 · 12,78 · 11,00         |
| `fg-muted #B6C2CE` / bg · surface · surface-2 · raised                                                  | 10,07 · 9,02 · 8,17 · 7,04            |
| `fg-subtle #9AAABB` / bg · surface · surface-2 · raised                                                 | 7,67 · 6,88 · 6,23 · 5,36             |
| **Botón primario**: tinta `#0B1622` / `#F55A9A` · hover `#FF8AB8` · pressed `#FFBAD6`                   | **5,91** · 8,31 · 11,50               |
| `primary-text #FF8AB8` / bg · surface · surface-2 · raised                                              | 8,31 · 7,45 · 6,75 · 5,81             |
| `primary-soft-fg #FFBAD6` / `#3A1D35`; fg / `#3A1D35`                                                   | 9,41; 12,89                           |
| `accent #7FBFB6` / bg · surface · surface-2 · raised; tinta/accent                                      | 8,71 · 7,80 · 7,07 · 6,09; 8,71       |
| `accent-soft-fg #AED8D1` / `#133038`; accent / accent-soft                                              | 8,98; 6,65                            |
| `brass-text #E9C88A` / bg · surface · brass-soft                                                        | 11,36 · 10,18 · 8,95                  |
| success `#93D6A6` / bg · surface; fg/bg; tinta/success                                                  | 10,77 · 9,65; 10,08; 10,77            |
| warning `#F2C76E` / bg · surface; fg/bg                                                                 | 11,43 · 10,24; 9,97                   |
| danger `#FF9C85` / bg · surface · surface-2 · raised; tinta/danger; fg/bg                               | 8,98 · 8,05 · 7,29 · 6,28; 8,98; 9,72 |
| `fg-inverse #0F1E2E` / inverse `#F1EEE8`                                                                | 14,56                                 |
| Burbuja propia: fg / `#2C4258`                                                                          | 8,95                                  |
| Toast oscuro (fondo `#F1EEE8`): acción `#A11254` · éxito `#23582F` · error `#B42318` · enlace `#1E5A57` | 6,64 · 7,23 · 5,68 · 6,83             |
| Selección: fg / `#6B1440`                                                                               | 10,08                                 |
| **UI** `border-strong #7088A0` / bg · surface · surface-2 · raised                                      | 4,96 · 4,45 · 4,03 · 3,47             |
| **UI** primario gráfico `#F55A9A` / bg · surface · raised                                               | 5,91 · 5,30 · 4,13                    |
| **UI** `ring-inverse #1E5A57` / `#F1EEE8`                                                               | 6,83                                  |
| **UI** switch: apagado `#7088A0`/surface; thumb `#F1EEE8`/apagado; thumb tinta/encendido                | 4,45; 3,17; 8,71                      |

### 4.3 Mapa

Colores reales de OpenFreeMap:

- positron: tierra `#F2F3F0`, agua `#C2C8CA`, bosque `#DCE0DC`;
- dark: tierra `#0C0C0C`, agua `#1B1B1D`, bosque `#202020`.

| Par                                                                                | Ratio                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| GPS claro `#C21A66` / tierra · agua positron                                       | 5,19 · 3,42                                              |
| GPS oscuro `#F55A9A` / dark · fork noche `#0E1925`                                 | 6,35 · 5,75                                              |
| Etiquetas positron `#000` / `#F2F3F0`                                              | 18,85                                                    |
| **Etiquetas del estilo dark original `#656565` / `#0C0C0C`**                       | **3,36: falla** (por eso hace falta el fork oscuro, §10) |
| Etiquetas del fork claro `#46525F` / `#EFEBE3` · fork oscuro `#B6C2CE` / `#0E1925` | 6,71 · 9,79                                              |

Los colores de los días están en §10.

### 4.4 Reglas que salen del cálculo

1. En oscuro, **nunca** va texto blanco sobre el primario (3,08): el texto es tinta.
2. `rosa-500` nunca lleva texto encima.
3. El latón 600 no se usa como texto pequeño.
4. Ningún control se dibuja solo con `border` o `rule`: los controles usan `border-strong`.
5. Lo que va sobre superficies inversas usa `ring-inverse` para el foco.
6. Primario y peligro tienen luminancia parecida (1,14 en claro, 1,52 en oscuro), así que se distinguen por el tono (332° frente a 4°) **y siempre** por el icono y el verbo. El botón danger solo aparece dentro de diálogos de confirmación.
7. Hay que añadir `scripts/check-contrast.mjs` en CI: lee los pares permitidos de `tokens.contrast.json` (esta tabla) y falla si alguno baja de su mínimo. Los colores con alfa (header al 88 %, velo) y el mapa se verifican además con axe o Lighthouse en los dos temas.

---

## 5. Primitivas

Ruta: `src/components/ui/*`. Todas usan tokens y funcionan igual en los dos temas. Los iconos son de lucide con `strokeWidth={1.75}` (2 a 16 px) y `aria-hidden`. Los botones que solo llevan icono tienen `aria-label` obligatorio.

### 5.1 Button

La API se mantiene (`variant`, `size`, `loading`, `fullWidth`) y se corrige a `disabled={disabled || loading}`, con `aria-busy`.

```
base: group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap
      rounded-full font-sans font-semibold
      transition-[background-color,color,border-color,transform] duration-(--dur-fast) ease-papel
      active:scale-[.98] active:duration-(--dur-instant)
      disabled:cursor-not-allowed disabled:opacity-45
      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
```

| Variante                       | Clases                                                                                                     | Uso                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `primary`                      | `bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-pressed`                              | Uno por vista                                                     |
| `tinta` (nueva)                | `bg-surface-inverse text-fg-inverse hover:bg-surface-inverse-hover focus-visible:outline-ring`             | Acción fuerte no principal (Guardar cuando el CTA es otro, admin) |
| `soft` (= `secondary` antiguo) | `bg-surface-2 text-fg hover:bg-papel-300 dark:hover:bg-noche-800`                                          | Terciaria rellena                                                 |
| `outline`                      | `border border-border-strong bg-transparent text-fg hover:bg-surface-2`                                    | Secundaria                                                        |
| `ghost`                        | `bg-transparent text-fg hover:bg-surface-2`                                                                | Barras y menús                                                    |
| `link`                         | `h-auto px-0 rounded-sm text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover` | Enlaces con forma de botón                                        |
| `danger`                       | `bg-danger text-on-danger hover:bg-danger-hover`                                                           | **Solo** dentro de ConfirmDialog                                  |
| `danger-outline`               | `border border-danger/40 text-danger hover:bg-danger-bg`                                                   | Listas, zona de peligro                                           |

Alias de compatibilidad: `accent` → `primary` y `secondary` → `soft`. Ambos se marcan `@deprecated`.

| Tamaño                         | Alto                  | Padding     | Texto | Icono |
| ------------------------------ | --------------------- | ----------- | ----- | ----- |
| `sm`                           | `h-control-sm` (36)   | `px-3.5`    | 14    | 16    |
| `md`                           | `h-control-md` (44)   | `px-[18px]` | 15    | 18    |
| `lg`                           | `h-control-lg` (52)   | `px-[22px]` | 16    | 18    |
| `xl`                           | `h-control-xl` (60)   | `px-7`      | 17    | 20    |
| `icon` / `icon-sm` / `icon-lg` | 44 / 36 / 52 cuadrado | 0           | —     | 18    |

- **Loading:** un spinner de aro de 16 px (`border-2 border-current border-t-transparent animate-spin`) ocupa el sitio del icono inicial, sin cambiar el ancho. El label pasa a gerundio («Guardando…»).
- **Flecha del CTA:** `group-hover:translate-x-0.5`.
- **`sm` en táctil:** amplía el área con `relative after:absolute after:-inset-1`.

### 5.2 Input, Textarea, Select y Date

Hay que crear `Textarea.tsx` y `Select.tsx` con la misma API que `Input`: `label`, `hint`, `error`, `icon`, `suffix`, `optional`. El admin también los usa.

- **Label:** `text-label text-fg mb-1.5 block`. Los opcionales añaden `<span className="font-normal text-fg-subtle">(opcional)</span>`.
- **Campo:**
  ```
  h-control-lg (público) / h-control-md (admin) w-full rounded-control border border-border-strong bg-surface
  px-3.5 text-base text-fg placeholder:text-fg-subtle
  hover:border-fg-muted
  focus-visible:outline-none focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]
  aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--danger)]
  disabled:bg-surface-2 disabled:text-fg-subtle
  ```
  El texto es de 16 px para evitar el zoom de iOS. El icono inicial mide 18 px en `fg-subtle`, va en `absolute left-3.5` y el campo lleva `pl-11`.
- **Hint:** `text-caption text-fg-muted mt-1.5`, con `id` enlazado por `aria-describedby`.
- **Error:** `text-[14px] text-danger mt-1.5 flex gap-1.5` con `AlertCircle` de 16 px. Lleva `aria-invalid` y `aria-describedby`, y el error tiene prioridad sobre el hint.
- **Presupuesto:** input numérico `tnum` con un Segmented compacto `USD | EUR | DOP` (`h-9`) dentro, a la derecha. El campo lleva `pr-[148px]`.
- **Select:** nativo, con `appearance-none` y `ChevronDown` de 18 px en `absolute right-3.5 pointer-events-none`.
- **Date:** nativo, con `color-scheme` del tema. Debajo, un resumen `text-caption text-fg-muted` con `aria-live="polite"`: «6 noches · sáb, 12 nov → vie, 18 nov». «Hoy» se calcula en **hora local**: `new Date().toLocaleDateString('en-CA')`.
- **Stepper de personas:** `[−]` y `[+]` de 44 px (`outline icon`) con `aria-label` «Quitar viajero» y «Añadir viajero», y el valor en `text-[20px] font-semibold tnum` con `aria-live`. Rango de 1 a 20 con guarda: nunca produce NaN.
- **Textarea «Cuéntanos tu viaje ideal»:**
  - `min-h-32` y crecimiento automático hasta 280 px, con `field-sizing: content` y JS como respaldo;
  - `rounded-control p-3.5 text-base leading-relaxed`;
  - contador `font-mono text-[12px] text-fg-subtle tnum` abajo a la derecha, «124/600», que pasa a `text-warning` a partir de 560;
  - debajo, chips de sugerencia que **añaden** texto.

### 5.3 Chip y Segmented

- **Chip de elección:**

  ```
  inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-[15px] font-medium text-fg
  hover:bg-surface-2
  aria-checked:border-surface-inverse aria-checked:bg-surface-inverse aria-checked:text-fg-inverse
  ```

  - El área táctil llega a 44 px con un margen vertical en el contenedor.
  - El icono lucide de 18 px se sustituye por `Check` al seleccionar: escala 0,6→1 en 160 ms.
  - El grupo es `role="radiogroup"` con `role="radio"` y `aria-checked`, con tabindex itinerante y flechas. Si los chips son toggles, `role="checkbox"`.
  - Disposición `flex flex-wrap gap-2`, nunca un grid con huérfanos.

- **Chip de filtro (admin):** `h-9 px-3 text-[14px]` con contador en un `Badge` `tnum`.
- **Segmented:**
  - pista `inline-flex rounded-full bg-surface-2 p-1`;
  - ítems `h-9` (`h-11` en táctil) `px-4 text-[14px] font-semibold text-fg-muted rounded-full`;
  - el seleccionado lleva un thumb `motion.span layoutId` con `bg-surface shadow-card` (en oscuro, `bg-surface-raised`), texto `text-fg` y spring firme;
  - `role="radiogroup"`.

### 5.4 Card

`Card.tsx` deja de ser código muerto: se activa y se usa en todas las pantallas.

| Variante                                        | Clases                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `default`                                       | `rounded-card border border-border bg-surface p-5 md:p-6`                                                                                                                                                                                  |
| `elevated`                                      | `+ shadow-elev` (en oscuro, `+ border-border`)                                                                                                                                                                                             |
| `interactive`                                   | `+ transition hover:border-rule hover:-translate-y-0.5 hover:shadow-elev focus-visible:outline-ring`                                                                                                                                       |
| `selected`                                      | `border-2 border-fg` (compensa con `p-[19px]`)                                                                                                                                                                                             |
| `nota` (Notas de ruta)                          | `rounded-card bg-brass-soft border-l-[3px] border-brass p-5`, con `kicker` en `text-brass-text` «NOTAS DE RUTA» y una lista `text-body-s`                                                                                                  |
| `boleto` (Ficha, Completa tu viaje, Mis viajes) | `rounded-card border border-border bg-surface overflow-hidden`. Franja superior `bg-surface-inverse text-fg-inverse kicker px-5 h-9 flex items-center`, filas etiqueta/valor (`kicker` + `font-display text-[20px]`) y divisor `perforado` |
| `postal`                                        | Arte generativo 4:5 o 4:3 arriba y pie `p-5` con kicker, `font-display text-h3` y caption. **El texto nunca va sobre el arte.**                                                                                                            |

**Callout** (`Callout.tsx`, sustituye todos los avisos escritos a mano):

```
flex gap-3 rounded-card border p-4 text-body-s
tone=info:    bg-info-bg border-info/30 text-info-fg
tone=warning: bg-warning-bg border-warning/30 text-warning-fg
tone=danger:  bg-danger-bg border-danger/30 text-danger-fg  role="alert"
tone=success: bg-success-bg border-success/30 text-success-fg
```

Lleva icono de 20 px (Info, AlertTriangle, AlertCircle, CheckCircle2), título `text-[15px] font-semibold` y acción opcional `link`. Los que no son errores usan `role="status"`.

### 5.5 Badge y Sello

La API (`default | brand | accent | success | warning | error`) se mantiene: la usan 8 pantallas del admin y ActivityItem. Se añaden `info`, `laton` y `sello`.

```
inline-flex h-6 items-center gap-1 rounded-stamp px-2 text-[12px] font-semibold tracking-[0.02em]
default: bg-surface-2 text-fg-muted
brand:   bg-accent-soft text-accent-soft-fg   (el teal viejo pasa a mar)
accent:  bg-primary-soft text-primary-soft-fg (el coral viejo pasa a rosa)
success: bg-success-bg text-success-fg · warning: bg-warning-bg text-warning-fg · error: bg-danger-bg text-danger-fg
info:    bg-info-bg text-info-fg · laton: bg-brass-soft text-brass-soft-fg
sello:   utilidad `sello` + text-fg (o text-brass-text / text-primary-text)
```

- Etiquetas siempre en español.
- Viajes: planificando → `info` «Planificando»; en_viaje → `accent` «En viaje»; completado → `success` «Completado»; cancelado → `default` «Cancelado».
- Suscripciones: active → `success` «Activa»; trialing → `info` «En prueba»; past_due → `warning` «Pago pendiente»; canceled → `default` «Cancelada».

**Sello decorativo** (`src/components/brand/Sello.tsx`): solo para momentos de marca y para refuerzos, nunca como única señal.

- Usos: «GUARDADO» al guardar, «ELEGIDA» en el paquete, el sello circular de la postal, el 404 y el OG.
- Rotación fija de −4° a −8° y entrada con `animate-sello`.
- Lleva `aria-hidden`. Su información siempre existe también como texto accesible.

### 5.6 Modal, Sheet y ConfirmDialog

`Modal.tsx` se activa y se le añade:

- focus trap y devolución del foco al cerrar;
- `role="dialog" aria-modal aria-labelledby aria-describedby`;
- cierre con Esc y con clic en el velo;
- bloqueo del scroll (ya lo tiene).

| Variante               | Especificación                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Velo                   | `fixed inset-0 bg-overlay z-(--z-modal)`, sin blur                                                                                                                                                                                                                                         |
| Modal (≥640)           | `w-[min(560px,calc(100vw-32px))] rounded-sheet bg-surface-raised p-7 shadow-float` (en oscuro `+border border-border`). Título `font-display text-h3`, cierre `ghost icon` de 44 con `X` y `aria-label="Cerrar"`. Pie `flex justify-end gap-3`: cancelar `outline`, principal a la derecha |
| Sheet (<640)           | `fixed inset-x-0 bottom-0 rounded-t-sheet bg-surface-raised max-h-[90dvh] pb-[max(16px,env(safe-area-inset-bottom))]`, asa `mx-auto mt-2 h-1 w-9 rounded-full bg-rule`. Se cierra arrastrando más del 30 % o con velocidad mayor de 500 px/s                                               |
| Drawer derecho (≥1024) | `w-[420px] h-dvh rounded-l-sheet`, para «Ajustar con IA»                                                                                                                                                                                                                                   |
| ConfirmDialog          | Sustituye `window.confirm`. Título en pregunta («¿Eliminar este viaje?»), consecuencia en `text-fg-muted` y botón `danger` con el verbo exacto («Eliminar viaje»). Para acciones irreversibles hay que **escribir el email o el nombre**                                                   |

### 5.7 Tabs

- Lista: `relative flex gap-6 border-b border-border overflow-x-auto`, con máscara de fade de 24 px en móvil.
- Tab: `h-12 text-[15px] font-semibold text-fg-muted aria-selected:text-fg`.
- Indicador: `motion.span layoutId` `absolute -bottom-px h-0.5 bg-fg` (seleccionado = tinta) con spring firme.
- Accesibilidad: `role="tablist|tab|tabpanel"`, `aria-selected`, `aria-controls`, flechas, Home y End.
- Contador opcional en un `Badge` `default` («Chat 3»).

**Chips de día:** son tabs con forma de chip.

- `h-9 px-3 rounded-full border border-border-strong text-[14px] font-semibold tnum`, con un punto de 8 px `bg-dia-N`, «01» y la fecha corta «sáb 12» en `text-fg-subtle`.
- Seleccionado: `bg-surface-inverse text-fg-inverse`; el punto conserva su color.
- Sticky bajo el header (`top-16 z-(--z-sticky) bg-bg/92 backdrop-blur-header`), con «Todo» al inicio.

### 5.8 Toast

Hay que crear `ToastProvider` + `useToast()`.

- **Posición:** abajo al centro en móvil (16 px por encima de la barra inferior y del safe area) y abajo a la derecha en desktop (24 px).
- **Estilo:** `max-w-[400px] rounded-control bg-surface-inverse text-fg-inverse px-4 py-3 shadow-float text-[14px] font-medium`.
- **Icono:** 18 px en `text-toast-success` o `text-toast-danger`.
- **Acción:** `font-semibold text-toast-action underline-offset-2`. El foco de lo que va dentro usa `outline-ring-inverse`.
- **Accesibilidad y tiempos:** `role="status"` (errores con `role="alert"`). Dura 5 s, u 8 s si lleva acción, y se pausa con hover o foco. Máximo 3 apilados.
- **Movimiento:** entra con `y 12→0` + opacidad en 220 ms y sale en 160 ms.

### 5.9 Skeleton

- `rounded-[inherit] bg-surface-2` con `background-image: linear-gradient(90deg, var(--surface-2) 0%, var(--shimmer) 50%, var(--surface-2) 100%)`, `background-size: 200% 100%` y `animate-shimmer`. Con movimiento reducido es estático.
- Las líneas de texto tienen `h-[0.7em] rounded-[4px]`.
- Plantillas: portada, timeline (columna de hora de 64 más dos líneas y un badge), tarjeta de versión, fila de tabla, stat card y mapa (`bg-surface-2 reticula` con `Map` de 24 px y «Cargando mapa…»).

### 5.10 EmptyState

- Contenedor: `mx-auto max-w-[360px] text-center py-12`.
- Ilustración de línea de 96 px: trazo de 2 px en `text-rule`, la ruta punteada, y un acento único en `text-primary` (el punto) o un sello «?» en `text-brass`.
- `font-display text-h3`, `text-body-s text-fg-muted max-w-[40ch]` y **una sola** acción.

| Caso           | Texto                            | Acción                   |
| -------------- | -------------------------------- | ------------------------ |
| Sin viajes     | «Aún no tienes viajes guardados» | «Trazar mi primer viaje» |
| Chat vacío     | «Nadie ha escrito todavía»       | «Escribe el primero»     |
| Sin gastos     | «Sin gastos todavía»             | «Añadir gasto»           |
| Búsqueda vacía | «Ningún resultado para "ana"»    | «Limpiar búsqueda»       |

El **error es distinto del vacío**: `CloudOff`, «No pudimos cargar esto» y «Reintentar».

### 5.11 Header (`SiteHeader` único, variantes `marketing | flujo | app | minimo`)

Sustituye al header propio de trip, compartido y grupo.

- **Contenedor:** `sticky top-0 z-(--z-header) h-header-sm md:h-header bg-bg/88 backdrop-blur-header`. La hairline inferior `border-b border-border` aparece al pasar de 8 px de scroll (200 ms).
- **Izquierda:** `<Link href="/" aria-label="Wayio, inicio"><Logo data-wy-logo className="h-[26px] md:h-[30px] w-auto" /></Link>`.
- **Centro:**
  - `marketing` (≥lg): «Destinos», «Cómo funciona», «Viajes en grupo» (`text-[15px] font-medium text-fg-muted hover:text-fg`);
  - `flujo`: el **Stepper de ruta** (§5.15).
- **Derecha:**
  - ThemeToggle `ghost icon` de 40 con menú Claro / Oscuro / Sistema (`Sun`, `Moon`, `Monitor`), que mantiene la clave `wayio-theme` y el evento `wayio-theme-change`;
  - sin sesión: «Iniciar sesión» `ghost sm`, que se oculta en modo demo;
  - con sesión: «Mis viajes» `ghost sm` (`Map`, → `/viajes`) y avatar de 32 con menú (Mis viajes, Cuenta, Admin si aplica, Cerrar sesión);
  - CTA «Planificar viaje» `primary sm` desde md, oculto mientras se ve el hero.
- **Variante `app`:** «← Mis viajes» `ghost sm` y menú de usuario. En `/trip` lleva el pill «EN VIVO» (punto `bg-gps`) si el GPS está activo; en `/viaje-compartido`, el `sello` «SOLO LECTURA»; en `/group`, una pila de 3 avatares.
- **Skip link:** «Saltar al contenido», `sr-only focus:not-sr-only`, como primer elemento.

### 5.12 Footer («contraportada»)

- Contenedor: `bg-surface-inverse text-fg-inverse py-16 md:py-24`. En oscuro, `bg-noche-900 border-t border-border text-fg`.
- Wordmark de 64 px de alto. Columnas Producto / Destinos (top 10 SEO) / Ayuda y legal (Privacidad, Términos, Contacto), con enlaces `text-[15px] text-tinta-200` y kicker de columna `text-tinta-300`. En móvil, acordeón.
- Barra final en `font-mono text-[12px] text-tinta-300`: «© 2026 Wayio · Hecho en República Dominicana · 18.4861° N 69.9312° O».

### 5.13 Admin: DataTable, StatCard, BarChart y Switch

**DataTable:**

- **Contenedor:** `Card p-0 overflow-hidden`.
- **Cabecera:** `thead sticky top-0 h-10 bg-surface-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-muted`, ordenable con `aria-sort` y `ArrowUpDown` de 14 px.
- **Filas:**
  - `h-[52px]`, o `h-10` con el toggle de densidad;
  - `text-[14px]`, separador `border-t border-border` y `hover:bg-surface-2`;
  - la fila entera es un Link con foco visible y `ChevronRight` de 16 px al final.
- **Celdas:**
  - números alineados a la derecha con `tnum`;
  - IDs y claves en `font-mono text-[13px]` con botón copiar de 32 px (área de 44);
  - badges en español.
- **Acciones de fila:** menú `MoreHorizontal` de 44. Las destructivas van al final, separadas, en `text-danger` y con ConfirmDialog.
- **Responsive:** por debajo de md, tarjetas apiladas con el campo principal y 2–3 metadatos; las 6 columnas o más también pasan a tarjeta. Primera columna sticky en tablet.
- **Pie:** «Mostrando 1–25 de 1,284», anterior / números / siguiente en `h-control-sm`.
- **Estados:**
  - skeleton de 8 filas;
  - error con `Callout danger` y «Reintentar» (las queries deben **propagar** el error en lugar de devolver `[]`);
  - vacío diferenciado («No hay usuarios» frente a «Ningún resultado para "ana"» con «Limpiar búsqueda»).

**StatCard:**

- `Card p-5` con `kicker`, valor `text-num-l tnum` (la tarjeta principal ocupa 2 columnas, con `text-num-xl`) y caption.
- Chip de delta con signo, flecha y texto: `▲ 12,4 %` en `text-success-fg bg-success-bg` o `▼` en danger.
- Sparkline opcional de 32 px: trazo de 1,5 px en `text-accent` y último punto en `text-primary`.
- La prop `accent` (clase literal) pasa a `tone: 'neutral'|'success'|'warning'|'danger'`.

**BarChart:**

- Barras `fill-accent` con radio superior de 2 px.
- Eje Y con 4 marcas en `text-caption text-fg-subtle` y eje X «12 nov» cada 7 días; grid de 1 px en `--border`.
- Cada barra es un `<button>` con `aria-label="12 nov: 34 registros"` y tooltip en tinta con hover y foco.
- «Ver como tabla» muestra la serie. Barra apilada al 100 % con `mar-600`, `rosa-600` y `laton-600`, con leyenda y %.

**Switch (ToggleAction):**

- Pista `w-11 h-6 rounded-full bg-tinta-500 dark:bg-tinta-400`; encendida, `bg-accent`.
- Thumb de 20 px en `bg-surface` (en oscuro `#F1EEE8`, que sobre encendido pasa a `bg-noche-950`) con spring firme.
- Área táctil de 44.
- `role="switch" aria-checked aria-label`. Usa `useOptimistic` y revierte con toast si falla.

### 5.14 Avatar

- `size-8 rounded-full grid place-items-center text-[13px] font-semibold text-dia-num`, con el color del día del miembro: `bg-dia-((index % 10) + 1)`.
- El blanco sobre las bases de día da ≥5,41 y la tinta sobre las variantes luz da ≥6,58.
- Pila: `-space-x-2` con anillo de 2 px en `ring-bg`, máximo 5 y luego «+3».

### 5.15 Stepper de ruta (header del flujo)

- `<nav aria-label="Progreso del viaje"><ol>` con 4 estaciones: **Tu viaje · Trazado · Versiones · Itinerario**.
- Cada estación es un círculo de 10 px:
  - pendiente: aro de 2 px en `border-strong`;
  - actual: aro de 2 px en `primary` con punto interior y `aria-current="step"`;
  - hecha: relleno `fg`.
- Conectores de 24 px: `rule` punteado si está pendiente, sólido `fg` si está hecho. El tramo se traza con `scaleX` 0→1 en 420 ms (`ease-tinta`).
- Labels `text-[13px]`: la actual en `text-fg font-semibold` y el resto en `text-fg-subtle`.
- Las estaciones hechas son enlaces para volver a ese paso.
- En móvil se reduce a «2 de 4 · Trazado» y una barra de 2 px bajo el header (`bg-primary`, ancho igual al %).

---

## 6. Layout por pantalla

### General

- Contenedor `mx-auto max-w-content px-4 md:px-6 lg:px-8`.
- Grid de 12 columnas con gap de 24 (32 en xl).
- Secciones de marketing con `py-[72px] md:py-24 lg:py-32`; dentro de la app, `space-y-8`.
- Pilas de 8 / 12 / 16 / 24 / 32 / 48. Lectura con un máximo de 68 ch.
- **Un solo `primary` por vista.** Todos los avisos van en `Callout`. Toda pantalla tiene sus estados de carga, error y vacío.
- Desaparecen de la UI pública los textos para desarrolladores (`.env`, `STRIPE_SECRET_KEY`, «API key»). En su lugar: «La búsqueda de hoteles no está disponible ahora».

**Arquitectura recomendada**, que también sirve para la intro y el LCP:

- `/` es la landing en **Server Component**, con islas cliente pequeñas: caja de deseo, menú y modal de video.
- `/planificar` alberga el flujo cliente, con el paso en la URL: `?paso=datos|trazado|versiones|itinerario`.
- El estado se guarda en `sessionStorage` (`wayio-flujo-v1`), así que Atrás y recargar no lo pierden.
- `/?destino=x` redirige a `/planificar?destino=x`.
- Las llamadas de `logicToPreserve` (`handleSubmit`, `handleSelectPackage`, `handleSaveTrip`, `handleShare`, etc.) no cambian.

**Al cambiar de paso:**

- scroll a 0 sin animación;
- `h1.focus()` (con `tabIndex={-1}`);
- se actualiza el `document.title` («Versiones · Cartagena | Wayio»).

### 6.1 Landing (`/`)

1. **Banner de anuncios**, si existe.
   - `h-10 text-[14px]` con el color del nivel: `info-bg` / `warning-bg` / `danger-bg`.
   - Icono, texto y cierre `ghost icon-sm` con `aria-label="Cerrar anuncio"`.
   - El descarte se guarda por id en `localStorage`, con try/catch.
   - No se muestra en `/admin`.
2. **Header `marketing`.**
3. **Portada.**
   - `reticula pt-14 pb-[72px] lg:pt-24 lg:pb-28`. Grid `lg:grid-cols-12 gap-12`.
   - **Izquierda** (`lg:col-span-7`; todo `wy-hero-item` con `--i` 0..4):
     - `kicker kicker-filete` «PLANIFICADOR DE VIAJES CON IA · HECHO EN RD».
     - H1 `font-display text-display-xl`: «Tu próximo viaje, <em class="italic text-primary">trazado</em> día a día.»
     - Lead `max-w-[36ch]`: «Cuéntanos qué imaginas. Wayio arma tres versiones de tu itinerario, con horarios, mapa y presupuesto en USD, EUR o DOP. Tú eliges.»
     - **Caja de deseo:** `Card` con `border-border-strong rounded-card shadow-elev p-4`.
       - Textarea de 2 a 4 líneas sin borde propio, `text-[17px]`. Placeholder: «Ej.: 6 días en Cartagena con mi pareja, playa tranquila y buena comida, unos US$1,800».
       - Pie `flex flex-wrap justify-between gap-3`: chips de 36 «Sorpréndeme», «Con niños» y «Fin de semana», y el botón `primary lg` «Trazar mi viaje» con `ArrowRight`.
       - Envía a `/planificar?d=<texto codificado>`; el planificador precarga la sección 00.
     - Debajo: `link` «Prefiero el formulario paso a paso →» y `outline md` «Desde un video» (`Clapperboard`), que abre RecreateTrip rediseñado como Modal/Sheet (con dark mode, Esc y `role=dialog`). Al confirmar, el destino va al formulario y los lugares a chips de la descripción.
     - Línea de confianza `text-caption text-fg-subtle`: «Gratis para empezar · Sin tarjeta · 47 guías de destino». Sin estrellas.
   - **Derecha** (`lg:col-span-5`): una Postal generativa 4:5 de Santo Domingo con `rounded-sheet`.
     - Pie con kicker `text-dia-2` «DÍA 02 · SANTO DOMINGO», `font-display text-h3` «Zona Colonial al amanecer» y tres filas `tnum`: «9:00 a. m. Catedral Primada · 11:30 a. m. Calle El Conde · 1:00 p. m. Almuerzo criollo».
     - Sello circular rotado −8° que sobresale de la esquina superior derecha (fuera del `overflow-hidden`).
     - En móvil la postal va bajo la caja, en 4:3 y con `max-h-[360px]`.
   - **Nada se mueve en bucle.**
4. **«Cómo funciona».** `kicker` y `font-display text-h2` «Tres pasos, una sola ruta».
   - Una línea horizontal (vertical en móvil) con 3 estaciones numeradas en `font-display text-[56px] text-primary-text` «01 · 02 · 03»: Cuéntanos (`PenLine`), Compara 3 versiones (`Columns3`), Viaja con el mapa en vivo (`Navigation`).
   - La línea se traza **una vez** al entrar en la vista.
5. **«Así se ve tu itinerario».** Banda `bg-surface-2`.
   - A la izquierda, un DayCard real de demostración (timeline). A la derecha, un fragmento de mapa en **SVG estático** (sin MapLibre) con 4 marcadores, una ruta y una mini tarjeta de presupuesto.
   - Caption: «Ejemplo de un plan Confort de 5 días en Samaná».
6. **«Destinos para empezar».** `font-display text-h2` con `link` «Ver los 47 destinos».
   - 4 columnas en lg, 2 en md y carrusel `snap-x` en móvil (tarjetas al 78 %).
   - Cada una es una Postal con el país en `kicker`, el nombre en `font-display text-[22px]` y «4–6 días · Mejor época: dic–abr».
7. **«Viaja en grupo».** Texto con 3 puntos (`MessagesSquare`, `Vote`, `Wallet`) frente a una maqueta estática de la sala.
8. **Banda final.**
   - `bg-primary text-primary-fg rounded-sheet mx-4 lg:mx-8 py-16 text-center`, con `font-display text-display-l` «¿A dónde vamos?».
   - Botón invertido: en claro `bg-bg text-primary-text`; en oscuro `bg-noche-950 text-primary-text`. Texto: «Trazar mi viaje».
9. **Footer.**

### 6.2 Planificador (`/planificar?paso=datos`)

- **Header `flujo`.**
- **Desktop:** grid de 12 columnas.
- **Izquierda** (`lg:col-span-5`, `sticky top-24`): la **Ficha «Tu ruta»**, un Card `boleto`.
  - Franja «WAYIO · TU RUTA».
  - Filas DESTINO / FECHAS / VIAJEROS / PRESUPUESTO / ESTILO / NIVEL, con valores `font-display text-[20px]` que se rellenan en vivo con un crossfade de 140 ms. Si no hay destino: «Sorpresa» con `Dices`.
  - Divisor `perforado` y pie `text-caption` «Trazamos 3 versiones · tarda entre 20 y 60 s».
  - Debajo, **«Lo que entendimos»**: chips editables derivados de la descripción (si el backend los devuelve) y el botón `ghost sm` «Aplicar al formulario». Sin backend, el bloque no aparece.
- **Derecha** (`lg:col-span-7`): H1 `font-display text-display-l` «Diseña tu viaje» y el formulario en **estaciones** numeradas, unidas por una línea punteada vertical a la izquierda. Cada estación es un círculo de 24 px: hueco con su número cuando está pendiente y relleno `fg` con `Check` cuando el bloque es válido. Así el estado se comunica por forma y no solo por color.

| Estación                                 | Contenido                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00 · Cuéntanos tu viaje ideal (opcional) | Textarea de 4 filas precargada desde el hero, contador /600 y chips que añaden frases: «Viajo con niños», «Sin madrugar», «Comida local», «Accesible», «Naturaleza», «Vida nocturna». Hint: «Escríbelo como se lo contarías a un amigo. La IA lo usa para afinar ritmo, intereses y restricciones.» Va en el payload como `descripcion` y no sustituye a los campos |
| 01 · Destino                             | Segmented «Lo elijo yo \| Sorpréndeme» (sustituye al checkbox con emoji). Input Destino con `MapPin` y autocompletado de los 47 destinos (lee `?destino=`). Input «Ciudad de origen» con `PlaneTakeoff`                                                                                                                                                             |
| 02 · Fechas                              | Dos dates (2 columnas desde `xs:`) y el resumen «6 noches · sáb, 12 nov → vie, 18 nov». El regreso se deshabilita sin salida y se limpia si queda antes que la salida                                                                                                                                                                                               |
| 03 · Viajeros y presupuesto              | Stepper de personas y presupuesto con segmented de moneda. Hint: «Para hospedaje, actividades y comidas. El vuelo se estima aparte.»                                                                                                                                                                                                                                |
| 04 · Estilo                              | 7 chips en radiogroup con wrap: Aventura `Mountain`, Relax `Sun`, Cultura `Landmark`, Familia `Users`, Crucero `Ship`, Romántico `Heart`, Gastronomía `UtensilsCrossed`. «Zona del crucero» aparece animando la altura en 280 ms y es obligatoria si se elige crucero                                                                                               |
| 05 · Nivel preferido                     | Segmented «Básico 3★ \| Confort 4★ \| Premium 5★», con caption «Igual verás las tres versiones para comparar»                                                                                                                                                                                                                                                       |

- **Envío:** `primary xl fullWidth` «Trazar mi viaje» con `ArrowRight`.
- **Errores:**
  - en línea por campo y, además, un resumen `Callout danger` `role="alert"` arriba con anclas;
  - los errores de zod del servidor (400) **se asignan a cada campo**.
- **Al volver** desde versiones o tras un error, el formulario se rehidrata con `formData`. `TripForm` acepta `initialValues`.
- **Móvil:**
  - una columna, con la ficha como acordeón arriba («Tu ruta · Cartagena · 6 noches · 2»);
  - barra fija inferior `h-bottombar` con «Cartagena · 6 noches · 2» y `primary md` «Trazar».

### 6.3 Carga (`?paso=trazado`)

- **Header `flujo`**, con «Cancelar» `ghost sm` a la derecha. Cancelar aborta el fetch con `AbortController` y vuelve al formulario con los datos.
- **Pantalla:** `bg-bg reticula min-h-dvh`, con una columna `max-w-[560px] mx-auto pt-16`.
- **Kicker:** «TRAZANDO TU VIAJE · CARTAGENA · 12–18 NOV».
- **RutaDeFases** (sustituye a Loader3D): SVG horizontal (vertical por debajo de 640 px) con 4 sellos de 40 px.

| Sello       | Texto                                     |
| ----------- | ----------------------------------------- |
| Contexto    | «Clima y ubicación»                       |
| Itinerario  | «La IA arma 3 versiones», icono `Compass` |
| Coordenadas | «Ubicando lugares»                        |
| Listo       | —                                         |

- Pendiente: aro en `border-strong`. Activo: aro `primary` con punto. Hecho: relleno `fg` con `Check` en `fg-inverse`.
- Tramos completados sólidos en `fg`; el tramo en curso, punteado `primary` con `animate-hormigas`.
- **Fases reales del SSE:** `cache | demo | contexto | ia | coords | listo | error`. El icono, el texto y el tramo salen de la **misma** fase. Se elimina el temporizador de 13 s.
- **Texto de fase:**
  - `font-display text-h2` con el `label` real del SSE, dentro de `aria-live="polite"`;
  - `text-caption` «Suele tardar entre 20 y 60 segundos» y un cronómetro `font-mono tnum` «00:24»;
  - a los 45 s: «Está tardando más de lo normal; seguimos trabajando».
- **Debajo:** skeleton de las 3 tarjetas de versión y una tarjeta «Mientras tanto» con **un consejo por fase**, sin temporizador, y el botón `link` «Otro consejo».
- **Error:**
  - el sello activo pasa a `danger` con `X`, sin sacudidas;
  - `Callout danger` y acciones «Reintentar» (`primary`) y «Editar datos» (`outline`);
  - **no se regenera dos veces**: si el stream emite `error`, no se llama al fallback POST de forma automática.
- **Caché o demo:** la ruta completa se traza en 600 ms. La demo muestra un `Callout warning` «Te mostramos un ejemplo: no pudimos trazar tu plan ahora mismo».

### 6.4 Versiones (`?paso=versiones`)

- **Cabecera:**
  - `ghost sm` «← Editar datos»;
  - chips de resumen enlazados a su campo: «Cartagena · 12–18 nov · 2 viajeros · US$1,800»;
  - kicker «3 VERSIONES · 6 NOCHES»;
  - H1 `font-display text-h1` «Elige cómo quieres vivirlo».
- **Demo:** `Callout warning` y «Reintentar». **Nunca** se muestra un destino distinto del pedido (nada de «Tokio»).
- **Desktop:** `grid grid-cols-3 gap-6` con `subgrid` para alinear las filas. Cada tarjeta es `role="radio"` dentro de un `radiogroup`.
  1. `kicker` de la versión: Básico en `text-accent`, Confort en `text-primary-text` y Premium en `text-brass-text`. Confort lleva el `Badge laton` **«Equilibrio ideal»**, una recomendación editorial; desaparece «Más elegido».
  2. Estrellas de hotel en latón (16 px) y «Hoteles 4★».
  3. Precio `text-num-xl tnum` «US$1,840» y el caption «US$920 por persona · sin vuelo».
  4. **Encaje con el presupuesto**, con texto, icono y barra de 6 px. Siempre texto, nunca solo color.
     - ≤100 %: `success`, «Dentro de tu presupuesto (91 %)».
     - 100–115 %: `warning`, «Un poco por encima (108 %)».
     - Más del 115 %: `danger`, «Por encima de tu presupuesto (132 %)».
  5. Filas alineadas: Días, Actividades («18 · 7 de pago»), Hospedaje, Transporte, Ritmo («3 act./día»). Si un valor es igual al de Básico, se muestra «Igual» en `text-fg-subtle`.
  6. «Lo que la hace distinta»: 2–3 viñetas de `variantesTier`.
  7. Indicador de radio «Seleccionar». Seleccionada: `border-2 border-fg shadow-elev`, «Seleccionada» y el sello decorativo «ELEGIDA».
  - **No hay «SDQ → MAD» ni iconos de avión** que sugieran un vuelo incluido.
- **Seleccionar no navega.** La barra sticky inferior (`h-bottombar`, `bg-surface/95 border-t`) muestra «Confort · US$1,840» y `primary lg` «Ver itinerario Confort», que llama a `handleSelectPackage`. Además hay un `outline` «Comparar en tabla», que abre un modal con una tabla de 3 columnas.
- **Móvil:** segmented de nivel sticky, tarjetas con `snap-x` al 88 % y la misma barra inferior.

### 6.5 Resultado (`?paso=itinerario`)

- **Portada** (`lg:grid-cols-12`):
  - **Izquierda** (7 columnas):
    - kicker «ITINERARIO · CONFORT · 6 DÍAS»;
    - H1 `font-display text-display-l`; el destino puede ir en itálica si es un nombre de lugar;
    - meta con iconos: `CalendarDays` «12–18 nov 2026», `Users` «2 viajeros» y coordenadas `font-mono`;
    - `resumenViaje` como `text-lead max-w-[60ch]`, recortado a 3 líneas con «Leer más».
  - **Acciones:**
    - `primary` «Guardar viaje». Sin sesión dice «Guardar e iniciar sesión» y **guarda el itinerario en sessionStorage** (`wayio-pendiente-v1`) antes de ir a `/login?redirect=/planificar?paso=itinerario`; al volver lo recupera y lo guarda.
    - `outline` «Compartir», `ghost` «Editar» y `icon` «Más», con un menú navegable con flechas: Añadir al calendario, Exportar PDF, Otra versión, Cambiar versión, Nuevo viaje.
    - En móvil, el primario va a todo el ancho y el resto en una fila.
  - **Derecha** (5 columnas): Postal 4:3 con el sello «CARTAGENA · COLOMBIA».
- **Franja de datos:** 4 celdas separadas por hairlines (2×2 en móvil).
  - «Total estimado US$2,310», que es **el mismo número** que la tarjeta de total.
  - «Ahora en Cartagena 29 °C, soleado»: etiqueta honesta, porque el dato es el clima actual.
  - «Actividades 18».
  - «Por persona US$1,155».
- **Cuerpo:**
  - **Desktop:** contenido en 7 columnas y **mapa sticky** en 5 (`top-20 h-[calc(100dvh-104px)] rounded-card`). El mapa no se recrea al cambiar los días.
  - **Móvil:** banda de mapa de 240 px con «Ampliar mapa», que abre un sheet a pantalla completa.
  - **Barra de días:** chips de día sticky, sincronizados con el scroll mediante IntersectionObserver y con el mapa (`flyTo`).
- **Días como capítulos** (`data-print="page"`):
  - kicker en `text-dia-N` «DÍA 01 · SÁB, 12 NOV»;
  - `font-display text-h2` con el título;
  - meta «Cartagena · US$210 estimado» en la moneda del viaje.
- **Timeline de cada día:**
  - Columna de hora de 64 px: «9:30» en `text-[15px] font-semibold tnum` con «a. m.» en caption debajo; el fin en `text-fg-subtle`.
  - Riel punteado de 2 px en `rule`, con un punto de 12 px `bg-dia-N` por actividad.
  - Contenido sin caja, separado por hairlines:
    - `text-title` con el nombre y un `Badge` de tipo;
    - descripción `text-body-s` en 2 líneas con «Ver más», que despliega `consejos` y `mejorHoraVisita`;
    - meta `Clock` «1 h 30», `Wallet` «US$25» (moneda del viaje) y `MapPin` con la dirección truncada;
    - acciones `ghost sm` «Cómo llegar» (`Navigation`) y `outline sm` «Reservar» (patrocinado, `rel="sponsored noopener noreferrer"`).
  - Entre actividades, un conector `text-caption`: «15 min hasta la siguiente».
- **Modo edición:**
  - `Callout info` sticky «Modo edición · Listo»;
  - controles de 44 px: asa `GripVertical`, `ArrowUp`, `ArrowDown`, editar y borrar (con confirmación);
  - editor en línea en una Card;
  - pulsar «Listo» con un borrador abierto pide confirmación;
  - cancelar una actividad nueva la elimina;
  - las actividades nuevas se geocodifican.
- **Antes de ir** (advertencias): `Callout warning`. **Notas de ruta** (consejos): Card `nota`.
- **«Completa tu viaje»:**
  - 3 Cards `boleto` compactas (Vuelo, Hospedaje y Carro), cada una con switch, estimación `tnum` y un enlace patrocinado;
  - **una sola tarjeta «TOTAL ESTIMADO»**, que sustituye a BudgetDisplay y a los totales contradictorios:
    - barra apilada de 8 px (plan en `dia-2`, vuelo en `dia-7`, hospedaje en `dia-3`, carro en `dia-6`) con leyenda y valores;
    - total en `text-num-xl tnum`, monto por persona y el encaje con el presupuesto;
    - `tinta lg` «Reservar con depósito (15 %)». Si el viaje no está guardado: «Guarda el viaje para reservar».
- **«Disponibilidad real»:**
  - Tabs Hoteles | Actividades | Vuelos;
  - los vuelos llegan con el IATA de origen y destino precargado y editable en `font-mono`;
  - los resultados van en Cards con proveedor, precio y CTA;
  - si un proveedor no está configurado, se muestra un vacío honesto.
- **Ajustar con IA:**
  - FAB `tinta` `h-[52px] rounded-full` con `Compass` y el texto «Ajustar con IA» (abajo a la derecha; en móvil, sobre la barra);
  - abre un drawer de 420 px o un sheet con sugerencias, historial (burbujas propias en `surface-inverse`, respuestas en `surface` con el resumen del cambio) y «Deshacer último ajuste»;
  - tras cada ajuste, las actividades cambiadas se resaltan con `bg-primary-soft`, que se desvanece en 1,2 s, y sale el toast «3 cambios en el día 3 · Deshacer».
- **Impresión:** `data-print="hide"` en header, acciones, FAB, mapa interactivo, anexos y chat. Un día por página, Newsreader en los títulos y un pie con la URL y la fecha.

### 6.6 Viaje guardado / en vivo (`/trip/[id]`)

- **Header `app`.**
- **Un solo aviso de conexión:**
  - con conexión: `sello` «DISPONIBLE SIN CONEXIÓN · guardado 8 oct, 2:32 p. m.»;
  - sin conexión: `Callout warning` con `CloudOff`, «Sin conexión: tu copia guardada del 17 mar, 9:12 a. m.».
  - La barra global de OfflineRegister no se muestra en esta ruta.
- **Portada compacta:** H1 `font-display text-h1`, meta y badge de crucero si aplica.
  - Segmented **«Hoy | Itinerario»**. «Hoy» es la vista por defecto si la fecha cae dentro del viaje.
  - Antes del viaje: «Faltan 23 días» en `text-num-l`.
  - Acciones: Compartir (sheet con «Vista de solo lectura» y «Sala del grupo», cada una con copiar y toast), Grupo y Reservar.
- **HOY:**
  - Tarjeta **AHORA** invertida (`bg-surface-inverse text-fg-inverse rounded-card p-5`): kicker «AHORA · 10:42 a. m.», la actividad en `font-display text-[28px]`, una barra del tiempo transcurrido y «Siguiente en 35 min · Café San Alberto · 8 min a pie».
  - Botones `primary lg` «Cómo llegar» y `ghost` «Me la perdí». Este último abre un sheet de 3 pasos: «¿Te la perdiste?» → «Buscando nueva hora…» → sugerencia con «Aceptar» y «Descartar». **Tocar la tarjeta no marca nada.**
- **Pill de GPS:**
  - «Activar ubicación»;
  - «Activando…»;
  - «Ubicación activa», que **solo** aparece tras recibir la primera posición;
  - «Permiso denegado · Cómo activarlo».
  - Mensajes de error en español.
- **Mapa:** 40 dvh en móvil o sticky en desktop, con el punto GPS (§10) y el siguiente tramo en `gps`.
- **Conflictos:** `Callout` por severidad, sin botones de solución mientras el contrato no los soporte.
- **Alerta de embarque:** sheet con `role="alert"`, `Ship`, «Regresa al barco antes de las 5:30 p. m. (en 45 min)» y las acciones «Ver puerto en el mapa» (que esta vez sí funciona) y «Ocultar por hoy». Se compara la **fecha** y la hora, y no reaparece después de cerrarla.
- **ITINERARIO:** timeline de solo lectura y «Para tu próxima visita» con las pendientes.
- **Móvil:** barra inferior `h-bottombar` con 4 ítems (Hoy, Mapa, Días, Más), icono de 22 px y label `text-[12px] font-semibold`.
  - Activo: `text-fg` con indicador superior de 2 px en `bg-fg`. Inactivo: `text-fg-muted`.
  - «Mapa» abre el mapa a pantalla completa. **No hay un sheet arrastrable sobre el mapa**, para evitar conflictos de gestos.
- **Estados:** skeleton de portada y timeline. Si no existe, el EmptyState del 404.

### 6.7 Compartido (`/viaje-compartido/[id]`)

- **Server Component** con `generateMetadata` y `opengraph-image.tsx`: póster de papel con el destino en Newsreader, las fechas, el sello y el wordmark, pensado para WhatsApp.
- **Header `minimo`:** wordmark, `sello` «SOLO LECTURA», ThemeToggle y `primary sm` «Crear el mío».
- **Contenido:**
  - portada con kicker «UN PLAN COMPARTIDO POR ANA» (si hay nombre), H1 `display-l`, meta y postal;
  - mapa y días en solo lectura, como `<ol>` semántica sin botones deshabilitados, con enlaces «Cómo llegar»;
  - «Antes de ir» y Notas de ruta.
- **Banda** `bg-primary`: «¿Te gusta este plan? Hazlo tuyo», con el botón invertido «Copiar a mis viajes» y `outline` «Planificar el mío».
- **Error:** «Este viaje ya no se comparte o el enlace está roto».
- **Depende de corregir la RLS o de una ruta con service role** (ver el inventario).

### 6.8 Grupo (`/group/[id]`)

- **Header `app`.** Portada con kicker «SALA DEL GRUPO», H1, pila de avatares, «6 viajeros» y `outline` «Invitar» (copia el enlace).
- **Desktop:** grid 5/7.
  - **Izquierda:** mapa de 320 px con los miembros como avatares-pin, lista de miembros («Ubicación actualizada 10:42 a. m.» o «Sin ubicación», badge «Tú») y switch «Compartir mi ubicación», que conecta con `updateLocation`.
  - **Derecha:** Tabs Chat · Votos · Gastos (en móvil se añade Miembros).
- **Chat:**
  - área `min-h-[420px] max-h-[calc(100dvh-320px)]` con autoscroll y la píldora «Nuevos mensajes»;
  - separadores «Hoy»;
  - burbujas propias `bg-surface-inverse text-fg-inverse` (en oscuro `bg-tinta-800 text-fg`) con `rounded-[16px_16px_4px_16px]`;
  - ajenas `bg-surface border` con `rounded-[16px_16px_16px_4px]`, el nombre en `text-[13px] font-semibold` y la hora en `text-[12px] tnum text-fg-subtle`;
  - compositor con textarea autogrow de 44 a 120 px y `primary icon` «Enviar». Enter respeta `isComposing`.
- **Votos:**
  - una Card por actividad: «¿Incluimos Islas del Rosario?»;
  - segmented Sí/No de 44;
  - barra de resultado: Sí en `accent`, No en `fg-subtle`, separadas por 2 px y con «4 sí · 1 no» y `tnum`;
  - el voto propio se carga desde `activity_votes`.
- **Gastos:**
  - formulario: Concepto, Monto (en la moneda del viaje), «Pagó» y «Entre quiénes» (chips de miembros);
  - lista con concepto, pagador, fecha e importe `tnum` alineado a la derecha;
  - Card «Balances» con frases: «Ana le debe US$45 a Luis».

### 6.9 Login y auth (`/login`, `/auth/recuperar`, `/auth/nueva-clave`, `/auth/abrir-app`)

Todas comparten un `AuthShell`.

- **Desktop:** split 7/5.
  - **Izquierda:** `bg-surface-2 reticula`, con una Postal grande, la cita `font-display text-display-l` «Cada viaje empieza con una página en blanco.» y un sello. El isotipo se traza **una vez**, sin bucles.
  - **Derecha:** columna `max-w-[400px]` centrada.
    - Wordmark como enlace a inicio.
    - H1 `text-h1` «Bienvenido de vuelta» o «Crea tu cuenta».
    - `outline lg fullWidth` «Continuar con Google» con el G oficial.
    - Divisor «o con tu email»: hairline con texto sobre el mismo fondo, sin caja.
    - Campos **con label**: Nombre (registro), Email (`inputMode="email"`, `autoComplete`), Contraseña con `icon` ojo de 44 y `aria-label="Mostrar contraseña"`.
    - `link` «¿Olvidaste tu contraseña?» a la derecha.
    - `primary lg fullWidth` «Iniciar sesión».
    - Alternancia «¿No tienes cuenta? Crear cuenta» y caption legal con enlaces a Términos y Privacidad.
- **Errores:** `Callout danger` en español (errores de Supabase mapeados).
- **Registro correcto:** EmptyState «Revisa tu email» (`MailCheck`), que se limpia al cambiar de modo.
- `?redirect` se respeta también con email. En modo demo, `Callout info` y formulario deshabilitado.
- **Móvil:** solo la columna derecha, con una banda de postal de 120 px arriba.

### 6.10 SEO (`/viaje/[destino]`)

- **Header `marketing`.** Migas «Destinos / República Dominicana».
- **Hero 7/5:**
  - kicker con el país y las coordenadas `font-mono`;
  - H1 `display-l` «Viaje a <em>Samaná</em>»;
  - lead y keywords (chips de 32 px);
  - `primary lg` «Trazar Samaná con IA» → `/planificar?destino=samana` (ahora sí se lee), con caption «Gratis · 3 versiones en un minuto»;
  - a la derecha, una Postal 4:5 con sello.
- **Ficha rápida:** aside sticky con `<dl>` y hairlines: Días recomendados, Mejor época, País, Moneda, Idioma, Ideal para.
- **«Un día en Samaná»:** timeline de ejemplo en solo lectura (JSON curado por destino).
- **«Qué incluye tu plan»:** 6 ítems con iconos lucide, **solo funciones reales**.
- **«Otros destinos»** en postales y FAQ en acordeón con JSON-LD `FAQPage`.
- `opengraph-image.tsx` por destino, que sustituye los `/destinos/*.jpg` inexistentes.
- Slug inexistente: el 404 de marca.

### 6.11 Mis viajes (`/viajes`, nueva)

- Rejilla de Cards `boleto` mini con el destino en `font-display text-[20px]`, las fechas, un Badge de estado y «Editado hace 2 días».
- Filtros Próximos | En curso | Pasados.
- Vacío: EmptyState con «Trazar mi primer viaje».
- Arregla el enlace roto «Mis viajes» (`/trip`).
- Stripe: `success_url` → `/trip/{id}?pago=ok` (reserva) o `/viajes?suscripcion=ok`; `cancel_url` → `/trip/{id}?pago=cancelado` o `/viajes`.

### 6.12 Admin

**Shell:**

- **Sidebar:** `w-sidebar sticky top-0 h-dvh bg-surface border-r border-border`.
  - Arriba: wordmark de 22 px y `Badge brand` «Admin».
  - Grupos con `kicker`:
    - **OPERACIÓN:** Panel `LayoutDashboard`, Usuarios `Users`, Viajes `Map`, Grupos `MessagesSquare`.
    - **NEGOCIO:** Suscripciones `CreditCard`, Referidos `Gift`, Uso de IA `Bot`.
    - **PLATAFORMA:** Funciones `Flag`, Anuncios `Megaphone`, Auditoría `ScrollText`, Ajustes `Settings`.
  - Ítem `h-10 rounded-control px-3 text-[14px] font-medium text-fg-muted` con icono de 18 px. Activo: `bg-surface-2 text-fg`, barra izquierda de 3 px en `bg-primary` y `aria-current="page"`.
  - Pie: email truncado (con `title`), «Volver a la app» y «Cerrar sesión».
- **Topbar** de 56 px: migas, búsqueda ⌘K (usuarios y viajes) y ThemeToggle.
- **Contenido:** `max-w-admin p-6 lg:p-8`. Por debajo de lg, el sidebar pasa a drawer con hamburguesa.
- **Por sección:** `loading.tsx` (skeletons), `error.tsx` («Reintentar») y `metadata` «Usuarios · Admin | Wayio».
- **Cada página llama a `requireAdmin`**, como pide el propio `auth.ts`.
- **Todo con tokens:** el modo oscuro deja de estar roto.

**Páginas:**

- **Panel:**
  - h1 `font-display text-[28px]` «Panel» y segmented 7 d | 30 d | 90 d (o la etiqueta fija «Últimos 30 días» si el backend no lo soporta);
  - fila 1: MRR como StatCard principal (ARR en subtexto), Usuarios y Viajes, con delta y sparkline;
  - fila 2: Suscripciones activas, Nuevos, Llamadas IA y Costo IA;
  - 2 BarChart con ejes y «Viajes por paquete» como barra apilada al 100 %.
- **Listas** (Usuarios, Viajes, Suscripciones, Referidos, Auditoría):
  - toolbar con búsqueda `h-control-md w-full sm:w-80` y botón limpiar;
  - filtros con conteo que **conservan** los demás `searchParams` y reinician `page`;
  - contador «1,284 usuarios»;
  - DataTable.
- **Detalle** (usuario o viaje):
  - migas, h1, ID `font-mono` con copiar y estado a la derecha;
  - tabs Resumen | Viajes | Suscripción | Referidos | IA;
  - cambios de rol o plan con un select **controlado**, ConfirmDialog y reversión si falla, con toast de resultado;
  - **Zona de peligro:** Card `border-danger/40` con `danger-outline` «Banear» y «Eliminar cuenta» (hay que escribir el email). Redirige tras eliminar y bloquea actuar sobre la propia cuenta.
- **Funciones (flags):**
  - `Callout info` «La web y la app aún no consumen estas flags»;
  - tabla con switch, clave `font-mono`, plataforma, valor JSON y fecha;
  - sheet de creación y de edición precargada.
- **Anuncios:** formulario con vista previa en vivo del banner en los dos temas, programación desde/hasta cuando la action lo acepte y lista con switch.
- **Auditoría:** acciones humanizadas («Cambió el rol a admin»), objetivo enlazado y metadatos en `<details>` con `font-mono text-[12px]`.
- **IA:** StatCards (Éxito «—» si hay 0 llamadas), costo diario y tablas por proveedor y modelo con cabecera y tokens.
- **Ajustes:** una Card por ajuste, cada una con su guardado; el mantenimiento pide confirmación; Card de solo lectura «Estado del entorno».

### 6.13 404, error y carga

- **`not-found.tsx`:**
  - header, columna `max-w-[560px] pt-24` y `reticula`;
  - ilustración SVG: una w de ruta punteada que se corta y termina en un sello de latón «?» a −8°;
  - `font-mono text-[12px]` «ERROR 404 · 0.0000° N · 0.0000° E · ISLA NULA»;
  - H1 `display-l` «Esta página no está en el mapa» y el cuerpo «Puede que el enlace esté roto o que el viaje ya no se comparta.»;
  - `primary` «Volver al inicio» y `outline` «Explorar destinos».
- **`error.tsx`** (cliente): «Algo se torció en el camino», `primary` «Reintentar» (`reset`), `outline` «Volver al inicio» y caption `font-mono` «Código: {digest}».
- **`global-error.tsx`:** estilos inline mínimos en papel y tinta, sin depender de fuentes.
- **`loading.tsx`:** skeleton de portada y timeline. **Nunca** un spinner de pantalla completa.

---

## 7. Movimiento

### 7.1 Tokens

| Token                           | Valor  | Uso                                     |
| ------------------------------- | ------ | --------------------------------------- |
| `--dur-instant`                 | 80 ms  | Pulsar                                  |
| `--dur-fast`                    | 140 ms | Hover, color, icono                     |
| `--dur-base`                    | 200 ms | Toggles, salidas de toast, tooltips     |
| `--dur-medium`                  | 280 ms | Chips, tabs, dropdowns, modal, acordeón |
| `--dur-slow`                    | 420 ms | Entradas de contenido, sheet, tarjetas  |
| `--dur-page`                    | 520 ms | Cambio de paso, versión → portada       |
| `ease-papel` `(.22,1,.36,1)`    | —      | Entradas                                |
| `ease-salida` `(.4,0,1,1)`      | —      | Salidas (≈30 % más cortas)              |
| `ease-tinta` `(.65,0,.35,1)`    | —      | Trazos SVG y desplazamientos A→B        |
| `ease-sello` `(.34,1.56,.64,1)` | —      | Aterrizajes, sellos                     |
| `ease-portal` `(.76,0,.24,1)`   | —      | Revelados                               |

**Springs** (`src/lib/motion.ts`):

- `suave = { type:'spring', stiffness: 260, damping: 30 }` (layout, morphs, FLIP);
- `firme = { stiffness: 500, damping: 38 }` (thumb, indicador de tabs, switch);
- `sello = { stiffness: 600, damping: 18 }`.

### 7.2 Infraestructura

En `src/components/providers/MotionProvider.tsx`, montado en el layout raíz:

```tsx
'use client'
import { LazyMotion, MotionConfig } from 'framer-motion'
const loadFeatures = () => import('./motion-features').then((m) => m.default) // export default domMax
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
```

- Se usa `m.*` y no `motion.*`.
- **`domMax` es obligatorio** porque es el que incluye `layout` y `layoutId`; `domAnimation` no los incluye. Se carga en un chunk asíncrono.
- La landing no lo necesita para su primer paint: la intro es CSS.

### 7.3 Transiciones entre pasos

- `<AnimatePresence mode="popLayout" custom={dir} initial={false}>` con `key={paso}`. `dir` vale +1 al avanzar y −1 al volver (lo deriva el router).
- Salida: `opacity 1→0` y `x 0→-24*dir` en 200 ms (`ease-salida`). Entrada: `x 32*dir→0` y `opacity 0→1` en 420 ms (`ease-papel`). Los hijos entran con un stagger de 40 ms.
- **Datos → Trazado:** el CTA se encoge hasta un círculo de 40 px (`layoutId="ruta-origen"`, spring suave) que se convierte en el aro de origen de RutaDeFases. El resto se desvanece en 200 ms.
- **Fases:** cada evento `progress` solidifica su tramo (`pathLength 0→1`, 400 ms, `ease-tinta`) y su sello entra (`scale 1.3→1`, `rotate -12°→-6°`, 240 ms, `ease-sello`).
- **Trazado → Versiones:** el sello «Listo» se mantiene 300 ms. Las 3 tarjetas entran con `y 24→0`, `rotate -1.5°→0` y opacidad en 420 ms, con stagger de 80 ms.
- **Versiones → Itinerario:** el nombre del destino viaja con `layoutId="trip-destino"` y la tarjeta elegida con `layoutId="version-<tier>"` hasta la portada (spring suave, ≈520 ms). Las otras dos se desvanecen en 160 ms.
- **Dentro del resultado:** días y actividades con `whileInView` (`y 12→0`, opacidad, 360 ms, stagger 30 ms, `viewport={{ once: true, amount: 0.2 }}`). Se desactiva en impresión.
- **Al terminar cada transición:** foco al H1 del paso.

### 7.4 Microinteracciones

| Elemento             | Comportamiento                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Botón                | Hover de color en 140 ms y flecha +2 px. Pulsado `scale .98` en 80 ms. Loading con spinner y label en gerundio                                                                                                         |
| Chip                 | El fondo tinta crece con `scale .92→1` en 200 ms. El icono pasa a `Check` con `scale .6→1` en 160 ms                                                                                                                   |
| Segmented y tabs     | `layoutId` con spring firme                                                                                                                                                                                            |
| Switch               | Thumb con spring firme y pista en 140 ms                                                                                                                                                                               |
| Tarjeta interactiva  | `-translate-y-0.5` + `shadow-elev` en 200 ms                                                                                                                                                                           |
| Guardar              | El `Bookmark` se rellena con `scale 1→1.2→1` en 260 ms, el sello «GUARDADO» entra con `animate-sello` y sale el toast «Viaje guardado · Ver». **El punto del logo del header hace un salto** de −4 px con spring sello |
| Contadores de dinero | Interpolación de 400 ms con `tnum`                                                                                                                                                                                     |
| Copiar enlace        | `Copy`→`Check` en crossfade de 140 ms y toast «Enlace copiado»                                                                                                                                                         |
| Ajuste con IA        | Resaltado `primary-soft` de 1,2 s en lo que cambió y toast con «Deshacer»                                                                                                                                              |
| Modal                | Velo en 200 ms y panel con `scale .97→1` + opacidad en 220 ms; salida en 160 ms                                                                                                                                        |
| Sheet                | `y 100%→0` en 380 ms (`ease-papel`)                                                                                                                                                                                    |
| Acordeón             | Altura automática en 280 ms                                                                                                                                                                                            |
| Logo del header      | En hover, el punto salta −4 px y vuelve (spring 600/20)                                                                                                                                                                |
| Errores              | Sin sacudidas: cambia el color del borde y el mensaje entra con un fundido de 160 ms                                                                                                                                   |
| Mapa                 | `flyTo` en 900 ms con `curve: 1.42`. Marcadores con `scale .6→1` y stagger de 30 ms. Ruta activa con animación de dasharray de 600 ms al seleccionarla                                                                 |
| GPS                  | Halo `animate-ping-gps` durante **3 iteraciones (6 s)** tras cada actualización y luego estático (cumple 2.2.2)                                                                                                        |

### 7.5 Movimiento reducido

- `MotionConfig reducedMotion="user"` y la regla CSS de §2.1: sin traslaciones, escalas, trazos ni bucles. Se mantienen los fundidos de 120 ms o menos y los cambios de color.
- Los pasos usan un crossfade de 120 ms.
- MapLibre usa `jumpTo` y `fitBounds({ duration: 0 })`.
- RutaDeFases tiene los tramos estáticos; manda el texto.
- **La intro no se monta.**
- El halo del GPS queda estático al 20 %.

---

## 8. Logo

### 8.1 Concepto

**«La w es la ruta; el punto es el destino.»**

- El wordmark `wayio` está dibujado en monolínea geométrica con remates y uniones redondas, como una ruta en un mapa.
- La **w** es un itinerario con subidas y bajadas: cinco vértices, el pico central más bajo y cuatro tramos.
- El **punto de la i** es el destino, en Rosa de Bayahíbe.

**Regla de marca: en cualquier composición hay UN solo punto magenta.**

El isotipo condensa la idea: la w arranca en un **aro hueco** (el origen, tu casa) y su último tramo apunta a un **punto separado** (el destino). Eso es lo que planificas y a dónde llegas.

**No existe lockup horizontal isotipo + wordmark.** La w del wordmark ya es el isotipo.

### 8.2 Geometría (fuente única: `src/components/brand/marks.ts`)

```ts
export const WORDMARK = {
  viewBox: '0 0 156 62',
  stroke: 7, // x-height 24 (y 20→44), base y=44, descendente y=56
  paths: {
    w: 'M4.5 20 L11.5 44 L18.5 27 L25.5 44 L32.5 20',
    aBowl: 'M68.5 32 A12 12 0 1 0 44.5 32 A12 12 0 1 0 68.5 32', // empieza en el asta, antihorario
    aStem: 'M68.5 20 V44',
    yArm: 'M80 20 L91 44',
    yTail: 'M102 20 L85.5 56',
    iStem: 'M115 20 V44',
    o: 'M139 20 A12 12 0 1 0 139 44 A12 12 0 1 0 139 20', // desde las 12, antihorario
  },
  dot: { cx: 115, cy: 8, r: 5.25 }, // diámetro 1,5 × trazo; separación 3,25 sobre el remate de la i
} as const
export const W_VERTICES = [
  [4.5, 20],
  [11.5, 44],
  [18.5, 27],
  [25.5, 44],
  [32.5, 20],
] as const
export const ISOTIPO = {
  viewBox: '0 0 64 64',
  stroke: 6,
  route: 'M12 27 L21 51 L30 34 L39 51 L46.84 28.78',
  ring: { cx: 12, cy: 27, r: 4.5, stroke: 3.5, hole: 2.75 },
  dot: { cx: 51, cy: 17, r: 6.5 }, // en la prolongación exacta del último tramo (12,−34); hueco de 3
} as const
```

**Wordmark:**

- La caja visual va de x 1 a 154,5 y de y 2,75 a 59,5.
- Espaciado óptico entre bordes: w–a 5, a–y 4,5, y–i 6 e i–o 5.

**Isotipo:**

- Caja visual de x 5,75 a 57,5 y de y 10,5 a 54, con centro óptico en (31,6; 32,25).
- Tramos: 25,6 · 19,2 · 19,2 · 23,6.

### 8.3 SVG de producción

**Wordmark** (color; `currentColor` es la tinta):

```svg
<svg viewBox="0 0 156 62" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wayio">
  <g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4.5 20 L11.5 44 L18.5 27 L25.5 44 L32.5 20"/>
    <path d="M68.5 32 A12 12 0 1 0 44.5 32 A12 12 0 1 0 68.5 32"/>
    <path d="M68.5 20 V44"/>
    <path d="M80 20 L91 44"/>
    <path d="M102 20 L85.5 56"/>
    <path d="M115 20 V44"/>
    <path d="M139 20 A12 12 0 1 0 139 44 A12 12 0 1 0 139 20"/>
  </g>
  <circle cx="115" cy="8" r="5.25" fill="var(--wy-dot, #C21A66)"/>
</svg>
```

**Isotipo.** El aro es hueco gracias a una máscara, así que funciona sobre cualquier fondo. El `id` de la máscara se genera con `useId()` por instancia.

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wayio">
  <defs>
    <mask id="wy-iso-hueco" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="#fff"/>
      <circle cx="12" cy="27" r="2.75" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#wy-iso-hueco)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 27 L21 51 L30 34 L39 51 L46.84 28.78" stroke-width="6"/>
    <circle cx="12" cy="27" r="4.5" stroke-width="3.5"/>
  </g>
  <circle cx="51" cy="17" r="6.5" fill="var(--wy-dot, #C21A66)"/>
</svg>
```

**Sello circular.** Es de un solo color (`currentColor`: `rosa-700`, `laton-700`, tinta o sus equivalentes en oscuro) y se rota −6° cuando se usa como estampa. El isotipo va en un `<svg>` anidado para que la máscara use sus coordenadas locales.

```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><path id="wy-sello-arco" d="M60 14 a46 46 0 1 1 -0.01 0"/></defs>
  <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" stroke-width="2.5"/>
  <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" stroke-width="1"/>
  <text fill="currentColor" style="font: 600 8.6px var(--font-sans); font-stretch: 85%">
    <textPath href="#wy-sello-arco" textLength="286" lengthAdjust="spacing">WAYIO · TRAZA TU VIAJE · VIVE EL CAMINO ·</textPath>
  </text>
  <svg x="34.7" y="34.2" width="51.2" height="51.2" viewBox="0 0 64 64"><!-- isotipo con --wy-dot: currentColor --></svg>
</svg>
```

**Favicon** (`src/app/icon.svg`, rejilla de 32). Sin aro, que no se lee a 16 px.

```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#142435"/>
  <path d="M5.6 12.4 L10.2 24.2 L14.8 16.2 L19.4 24.2 L23 14" fill="none" stroke="#F7F4EE"
        stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="25.4" cy="7.4" r="3.7" fill="#F55A9A"/>
</svg>
```

Para 16 px: el mismo dibujo con `stroke-width="3.8"` y `r="4"`. Para `favicon.ico`: 16 y 32.

**App icon** (1024, sin redondeo: lo enmascara el sistema):

```svg
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#142435"/>
  <svg x="164.4" y="149" width="704" height="704" viewBox="0 0 64 64"><!-- isotipo: trazo #F7F4EE, punto #F55A9A --></svg>
</svg>
```

- Escala ×11 y elevación óptica de −8 px. El punto `#F55A9A` sobre `#142435` da 5,0:1 y el trazo, 14,35:1.
- **Variantes:**
  - iOS 18 oscuro: fondo `#0B1622`;
  - tintado: isotipo monocromo;
  - Android adaptive: foreground de 1080 con el isotipo a ×9,5 (494 px, diagonal de 644 dentro de la zona segura de 660), background sólido `#142435` y `monochromeImage` con el isotipo en un color.
- **Archivos:**
  - `src/app/icon.svg`;
  - `src/app/apple-icon.png` (180, desde el app icon);
  - `src/app/manifest.ts`, que genera el `/manifest.webmanifest` que `sw.js` ya precachea, con `icon-192.png`, `icon-512.png`, `maskable-512.png` (zona segura al 80 %), `theme_color: '#F7F4EE'` y `background_color: '#F7F4EE'`.

### 8.4 Variantes, tamaños y uso

| Variante                                               | Uso                                                                           | Tamaño                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| Wordmark color (tinta + punto)                         | Header (30 px desktop, 26 px móvil), login, emails, PDF                       | Mínimo 22 px de alto (≈55 px de ancho)                   |
| Wordmark invertido (papel `#F7F4EE` + punto `#F55A9A`) | Pie, fondos de tinta, banda primaria (en ella el punto va en papel)           | —                                                        |
| Wordmark monocromo (todo `currentColor`)               | Grabado, una tinta, B/N                                                       | —                                                        |
| Isotipo                                                | Icono de app, favicon, avatar de la marca, sello, pin de marca, loader global | Mínimo 24 px; por debajo, el favicon                     |
| Sello circular                                         | Postal del hero, OG, PDF, 404, login                                          | Mínimo 72 px; la textura de tinta solo a partir de 96 px |

- **Zona de respeto:** la mitad de la altura x (12 u) en el wordmark y 12 u en el isotipo.
- **Colores del punto:** `#C21A66` en claro y `#F55A9A` en oscuro, con `var(--wy-dot)` (= `var(--primary)`).
- **Prohibido:**
  - gradientes, sombras, contornos o rotar el wordmark;
  - cambiar el color del punto (salvo en el monocromo);
  - más de un punto magenta en la composición;
  - poner el isotipo junto al wordmark;
  - animar el logo fuera de la intro, el hover del header y el guardado.

**Componente:** `<Logo variant="wordmark|isotipo|sello" tone="color|inverso|mono" className data-wy-logo? />`. Es Server Component con `aria-hidden` cuando va dentro de un `Link` con `aria-label`. `Logo.tsx` mantiene `className`, y `showText` pasa a ser un alias de `variant`.

---

## 9. Animación de entrada «La ruta llega»

### 9.1 Narrativa

El punto aparece en el origen y **traza la w** como si recorriera una ruta, frenando en cada vértice como en las paradas de un viaje. Luego **despega** en un arco de vuelo sobre «ay», dejando una estela punteada como la de un avión en un mapa, mientras se dibujan «a» y «y». **Aterriza** como el punto de la i, con squash y una onda de GPS, y el impacto «planta» el asta de la i. Se cierra la «o», aparecen el tagline y las coordenadas de Santo Domingo, y el logo **vuela a su sitio en el header** mientras el papel se abre en **portal circular** desde el punto.

- Duración: 2,1 s de guion más ≈0,6 s de relevo. El contenido es interactivo desde el primer momento.
- Prototipo verificado: `frames.png` (12 fotogramas, claro y oscuro).

### 9.2 Cuándo se muestra

- Solo en `/` **sin query**, en la primera visita de la sesión: `sessionStorage['wayio-intro-v1']`. La marca se guarda **al empezar**, para que una recarga no la repita.
- Nunca en `/planificar`, `/trip`, `/viaje-compartido`, `/viaje/[destino]`, `/group`, `/login`, `/auth/*` ni `/admin`, ni en navegaciones del cliente, ni al volver con Atrás.
- No se muestra con:
  - `prefers-reduced-motion: reduce`;
  - `navigator.connection.saveData`;
  - conexión `2g`;
  - `navigator.webdriver`;
  - un user agent de bot, Lighthouse o headless;
  - `document.visibilityState === 'hidden'` (prerender).
- **Sin JS no hay intro:** solo la activa el script del `<head>`.
- Para QA: probar en un navegador normal con `sessionStorage` vacío.

### 9.3 Arquitectura (CSS primero, framer-motion para el relevo)

1. **Script inline en `<head>`** (amplía el `themeScript` actual). Decide antes del primer paint, pone `html[data-intro="play"]` y conecta el **salto**, que funciona aunque no haya hidratado.
2. **`IntroSplash`** (Server Component, `src/components/brand/intro/IntroSplash.tsx`), renderizado al principio del `<body>` de `/`. Lleva el overlay en el SSR y un `<style>` con los keyframes generados desde la línea de tiempo. **Arranca con el primer paint**, sin esperar a la hidratación.
3. **`IntroHandoff`** (`'use client'`, framer-motion `animate`). Cuando termina el reloj CSS (2100 ms), hace el **FLIP medido** del logo al header y el **portal**.
4. **Failsafes:**
   - si no hay hidratación, CSS desvanece el overlay entre 2150 y 2470 ms y muestra el logo del header a 2450 ms;
   - tope duro: `done` a los 3200 ms;
   - no se bloquea el scroll.
5. **LCP:** el hero está **pintado y opaco** debajo desde el primer paint, así que el elemento LCP es el H1 real. Después solo se revela con `transform` (`.wy-hero-item`, y 16→0, stagger de 60 ms). El overlay solo contiene SVG y texto pequeño, que no son candidatos a LCP.
6. **Accesibilidad:**
   - overlay `aria-hidden="true"` **sin ningún elemento enfocable**;
   - el foco se queda en el documento y la primera tecla salta la intro;
   - el H1 real de la landing es el contenido semántico;
   - el hint visual «Toca o pulsa una tecla para saltar» aparece a los 600 ms.

### 9.4 Script del `<head>` (`src/app/layout.tsx`)

```ts
const bootScript = `(function(){var d=document.documentElement;
try{var t=localStorage.getItem('wayio-theme');d.classList.toggle('dark',t&&t!=='system'?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){}
try{var n=navigator,c=n.connection||{};
var ok=location.pathname==='/'&&!location.search&&!sessionStorage.getItem('wayio-intro-v1')
&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!c.saveData&&!/2g$/.test(c.effectiveType||'')
&&!n.webdriver&&!/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(n.userAgent)
&&document.visibilityState!=='hidden';
if(!ok)return;
sessionStorage.setItem('wayio-intro-v1','1');d.dataset.intro='play';
var ev=['pointerdown','keydown','wheel','touchstart'];
function off(){ev.forEach(function(x){removeEventListener(x,skip,true)})}
function done(){d.dataset.intro='done';off()}
function skip(){if(d.dataset.intro!=='play')return;d.dataset.intro='skip';off();setTimeout(done,220)}
ev.forEach(function(x){addEventListener(x,skip,{capture:true,passive:true})});
document.addEventListener('visibilitychange',function(){if(document.hidden)skip()});
window.__wyIntroDone=done;setTimeout(function(){if(d.dataset.intro!=='done')done()},3200);
}catch(e){}})();`
```

El script admite la opción de tema `'system'`. El listener es pasivo y no bloquea el Tab: el foco sigue moviéndose.

### 9.5 Guion (ms desde el primer paint)

Coordenadas en el viewBox `0 0 156 62`. Los trazos usan `pathLength="100"`, `stroke-dasharray: 100 200` y `stroke-dashoffset` de 100 a 0. El gap de 200 evita puntos fantasma con remates redondos.

| ms         | Elemento                                                                                         | Animación                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–260      | Retícula (5 meridianos curvos y 3 paralelos, `--rule`, máscara radial)                           | `opacity 0→.55`, `scale 1.03→1`, `ease-papel`                                                                                                                                                  |
| 60–900     | **W fantasma** punteada («el plan antes del viaje»): `stroke --rule` 2,2, `dasharray .1 4.2`     | Aparece hasta 0,9 al 17 %, se mantiene y se desvanece desde el 70 %                                                                                                                            |
| 0–160      | **Punto** (r 5,25, `--primary`) en P1 (4.5,20)                                                   | `scale 0→1`, `ease-sello`                                                                                                                                                                      |
| 0–520      | Ping de origen: aro de 1,5 px `--primary` en P1                                                  | `scale 1→2.6`, `opacity .45→0`                                                                                                                                                                 |
| 160–840    | **Trazo de la w** y el punto pegado a la punta                                                   | Keyframes en los vértices: 160 · 356 · 500 · 644 · 840 (proporcionales a las longitudes 25,0 · 18,4 · 18,4 · 25,0), cada tramo con `cubic-bezier(.45,0,.55,1)`: el punto frena en cada vértice |
| 840–1260   | **Vuelo**: Bézier cuadrática de (32.5,20) con control en (73.75,−30) hasta (115,8); ápice y ≈ −8 | 24 muestras con `ease-tinta` aplicado y escala 1→0,9→1 en el ápice                                                                                                                             |
| 840–1260   | **Estela**: 6 puntos de r 1,4 en t = k/7                                                         | Cada uno aparece a 0,6 al paso del punto y se apaga en 460 ms                                                                                                                                  |
| 900–1060   | Cuenco de la «a» (desde el asta, antihorario)                                                    | Trazo de 160 ms, `ease-papel`                                                                                                                                                                  |
| 980–1060   | Brazo de la «y»                                                                                  | Trazo de 80 ms                                                                                                                                                                                 |
| 1020–1100  | Asta de la «a»                                                                                   | Trazo de 80 ms                                                                                                                                                                                 |
| 1040–1180  | Cola de la «y»                                                                                   | Trazo de 140 ms                                                                                                                                                                                |
| 1260–1500  | **Aterrizaje** (`transform-origin` en la base del punto)                                         | `scale` (1,1) → 1332 (1.22,.78) → 1409 (.94,1.06) → 1500 (1,1)                                                                                                                                 |
| 1260–1420  | Asta de la «i» **hacia abajo**: el impacto planta el pin                                         | Trazo de 160 ms, `ease-papel`                                                                                                                                                                  |
| 1280–1880  | Onda GPS 1: aro de 1,5 px en (115,8)                                                             | `scale 1→3.4`, `opacity .55→0`                                                                                                                                                                 |
| 1420–1960  | Onda GPS 2: aro de 1 px                                                                          | `scale 1→2.4`, `opacity .35→0`                                                                                                                                                                 |
| 1340–1620  | «o» desde las 12, antihorario                                                                    | Trazo de 280 ms, `cubic-bezier(.16,1,.3,1)`                                                                                                                                                    |
| 1560–1900  | Tagline `kicker` «TRAZA TU VIAJE · VIVE EL CAMINO» (`--fg-muted`)                                | `opacity 0→1`, `y 8→0`                                                                                                                                                                         |
| 1640–1980  | Coordenadas `font-mono 12px` «18.4861° N · 69.9312° O» (`--fg-subtle`, abajo al centro)          | `opacity`, `y 8→0` y, si ya hidrató, **scramble** de 300 ms (los dígitos se asientan de izquierda a derecha)                                                                                   |
| 1980–2100  | Pausa                                                                                            | —                                                                                                                                                                                              |
| 2100–2260  | Retícula, tagline, coordenadas, hint y W fantasma                                                | `opacity → 0` en 160 ms (`ease-salida`)                                                                                                                                                        |
| 2100–≈2600 | **FLIP**: el contenedor del wordmark vuela al `[data-wy-logo]` del header                        | `x`, `y`, `scale` (≈420→84 px de ancho), spring suave 260/30                                                                                                                                   |
| 2150–2670  | **Portal**: el papel se abre en círculo desde el centro del punto                                | `--wy-r: 0 → hypot(vw,vh)`, 520 ms, `ease-portal`. En equipos modestos (≤4 núcleos o ≤4 GB), fundido de opacidad de 320 ms                                                                     |
| 2250–      | Hero: `.wy-hero-item`                                                                            | `translateY 16→0`, 520 ms, stagger de 60 ms (solo transform)                                                                                                                                   |
| ≈2700      | Fin                                                                                              | `html[data-intro="done"]`: el logo real del header pasa a opacidad 1 **en el mismo fotograma** en que se desmonta el clon                                                                      |

### 9.6 Línea de tiempo y generador (`src/components/brand/intro/`)

El código está verificado en el prototipo `intro.html`.

```ts
// timeline.ts
export const INTRO = {
  W: [
    [4.5, 20],
    [11.5, 44],
    [18.5, 27],
    [25.5, 44],
    [32.5, 20],
  ],
  FLIGHT: { from: [32.5, 20], ctrl: [73.75, -30], to: [115, 8] },
  t: { wStart: 160, wEnd: 840, flyEnd: 1260, handoff: 2100 },
  segEase: [0.45, 0, 0.55, 1],
  flyEase: [0.65, 0, 0.35, 1],
  samples: 24,
  trail: 6,
} as const
```

```ts
// keyframes.ts (función pura; se evalúa una vez por build en el Server Component)
import { INTRO } from './timeline'
type P = readonly [number, number]
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t
  const Y = (t: number) => ((ay * t + by) * t + cy) * t
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x
      if (Math.abs(e) < 1e-6) return Y(t)
      const d = dX(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0,
      hi = 1
    t = x
    for (let i = 0; i < 40 && Math.abs(X(t) - x) > 1e-6; i++) {
      if (X(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return Y(t)
  }
}
const quad = (a: P, c: P, b: P, u: number): [number, number] => [
  (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0],
  (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1],
]
const f = (n: number) => +n.toFixed(3)

export function buildIntroKeyframes() {
  const { W, FLIGHT, t, segEase, flyEase, samples, trail } = INTRO
  const seg = `cubic-bezier(${segEase.join(',')})`
  const lens = W.slice(1).map((p, i) =>
    Math.hypot(p[0] - W[i][0], p[1] - W[i][1])
  )
  const total = lens.reduce((a, b) => a + b, 0)
  // Trazo de la w: dashoffset en los vértices, misma curva que el punto (sincronía exacta)
  let acc = 0
  const w = [`0%{stroke-dashoffset:100;animation-timing-function:${seg}}`]
  for (const L of lens) {
    acc += L
    const p = (acc / total) * 100
    w.push(
      `${f(p)}%{stroke-dashoffset:${f(100 - p)};animation-timing-function:${seg}}`
    )
  }
  // Punto: [wStart, flyEnd]
  const span = t.flyEnd - t.wStart
  const pct = (ms: number) => `${f(((ms - t.wStart) / span) * 100)}%`
  const dot = [
    `0%{transform:translate(${W[0][0]}px,${W[0][1]}px);animation-timing-function:${seg}}`,
  ]
  acc = 0
  lens.forEach((L, i) => {
    acc += L
    const ms = t.wStart + (acc / total) * (t.wEnd - t.wStart)
    dot.push(
      `${pct(ms)}{transform:translate(${W[i + 1][0]}px,${W[i + 1][1]}px);animation-timing-function:${i < lens.length - 1 ? seg : 'linear'}}`
    )
  })
  const ease = cubicBezier(...flyEase)
  for (let i = 1; i <= samples; i++) {
    const tau = i / samples,
      u = ease(tau),
      [x, y] = quad(FLIGHT.from, FLIGHT.ctrl, FLIGHT.to, u)
    dot.push(
      `${pct(t.wEnd + tau * (t.flyEnd - t.wEnd))}{transform:translate(${f(x)}px,${f(y)}px) scale(${f(1 - 0.1 * Math.sin(Math.PI * u))})}`
    )
  }
  // Estela: aparece cuando el punto pasa por t=k/(n+1)
  const inv = (y: number) => {
    let lo = 0,
      hi = 1
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2
      if (ease(m) < y) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }
  const trailDots = Array.from({ length: trail }, (_, k) => {
    const u = (k + 1) / (trail + 1),
      [cx, cy] = quad(FLIGHT.from, FLIGHT.ctrl, FLIGHT.to, u)
    return {
      cx: f(cx),
      cy: f(cy),
      delay: Math.round(t.wEnd + inv(u) * (t.flyEnd - t.wEnd)),
    }
  })
  return {
    css: `@keyframes wy-w{${w.join('')}}@keyframes wy-dot{${dot.join('')}}`,
    trailDots,
  }
}
```

### 9.7 Marcado y CSS del overlay

**Marcado** (`IntroSplash`):

- `<style dangerouslySetInnerHTML={{__html: css}}/>`
- `<div className="wy-intro" aria-hidden="true">`, que contiene:
  - `[data-wy-intro-paper]`
  - `svg.wy-intro__grid[data-wy-intro-decor]`
  - `.wy-intro__stage`, con `div[data-wy-intro-mark]` > `svg viewBox="0 0 156 62" overflow="visible"`, y dentro: W fantasma, los 7 paths, el ping, las ondas, la estela y `g.dot-move > g.dot-squash > circle.dot-pop[data-wy-intro-dot]`
  - `p.wy-intro__tag[data-wy-intro-decor]`
- `p.wy-intro__coords[data-wy-intro-decor]`
- `p.wy-intro__hint[data-wy-intro-decor]`

**CSS** (va en `IntroSplash` o en `globals.css`):

```css
.wy-intro {
  position: fixed;
  inset: 0;
  z-index: var(--z-intro);
  place-items: center;
  color: var(--fg);
}
.wy-intro__paper {
  position: absolute;
  inset: 0;
  background: var(--bg);
  -webkit-mask: radial-gradient(
    circle at var(--wy-x, 50%) var(--wy-y, 50%),
    transparent var(--wy-r),
    #000 calc(var(--wy-r) + 1px)
  );
  mask: radial-gradient(
    circle at var(--wy-x, 50%) var(--wy-y, 50%),
    transparent var(--wy-r),
    #000 calc(var(--wy-r) + 1px)
  );
}
.wy-intro__grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: wy-grid 260ms var(--ease-papel) both;
}
.wy-intro__stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}
[data-wy-intro-mark] {
  width: clamp(240px, 46vw, 420px);
  transform-origin: 50% 50%;
}
.wy-intro__tag {
  /* kicker */
  animation: wy-rise8 340ms var(--ease-papel) 1560ms both;
}
.wy-intro__coords {
  position: absolute;
  bottom: 32px;
  inset-inline: 0;
  text-align: center;
  font: 500 12px/1 var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--fg-subtle);
  animation: wy-rise8 340ms var(--ease-papel) 1640ms both;
}
.wy-intro__hint {
  position: absolute;
  bottom: 32px;
  right: 24px;
  font-size: 12px;
  color: var(--fg-subtle);
  animation: wy-fade 300ms linear 600ms both;
}
.wy-intro .s {
  fill: none;
  stroke: currentColor;
  stroke-width: 7;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 100 200;
  stroke-dashoffset: 100;
}
.wy-intro .ghost {
  fill: none;
  stroke: var(--rule);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-dasharray: 0.1 4.2;
  animation: wy-ghost 840ms linear 60ms both;
}
.dot-move {
  animation: wy-dot 1100ms linear 160ms both;
}
.dot-squash {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: wy-squash 240ms linear 1260ms both;
}
.dot-pop {
  fill: var(--primary);
  transform-box: fill-box;
  transform-origin: center;
  animation: wy-pop 160ms var(--ease-sello) both;
}
.wy-ring {
  fill: none;
  stroke: var(--primary);
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  vector-effect: non-scaling-stroke;
}
.wy-trail {
  fill: var(--primary);
  opacity: 0;
}
@keyframes wy-grid {
  from {
    opacity: 0;
    transform: scale(1.03);
  }
  to {
    opacity: 0.55;
    transform: none;
  }
}
@keyframes wy-draw {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes wy-ghost {
  0% {
    opacity: 0;
  }
  17% {
    opacity: 0.9;
  }
  70% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}
@keyframes wy-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
@keyframes wy-squash {
  0% {
    transform: scale(1, 1);
  }
  30% {
    transform: scale(1.22, 0.78);
  }
  62% {
    transform: scale(0.94, 1.06);
  }
  100% {
    transform: scale(1, 1);
  }
}
@keyframes wy-ring-a {
  0% {
    opacity: 0.45;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(2.6);
  }
}
@keyframes wy-ring-b {
  0% {
    opacity: 0.55;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(3.4);
  }
}
@keyframes wy-ring-c {
  0% {
    opacity: 0.35;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}
@keyframes wy-trail {
  0% {
    opacity: 0;
  }
  1% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
  }
}
@keyframes wy-rise8 {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes wy-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Animaciones por elemento:**

| Elemento                                | `animation`                                          |
| --------------------------------------- | ---------------------------------------------------- |
| Path de la w                            | `wy-w 680ms linear 160ms both`                       |
| Cuenco de la «a»                        | `wy-draw 160ms var(--ease-papel) 900ms both`         |
| Asta de la «a»                          | `wy-draw 80ms … 1020ms`                              |
| Brazo de la «y»                         | `wy-draw 80ms … 980ms`                               |
| Cola de la «y»                          | `wy-draw 140ms … 1040ms`                             |
| Asta de la «i»                          | `wy-draw 160ms … 1260ms`                             |
| «o»                                     | `wy-draw 280ms cubic-bezier(.16,1,.3,1) 1340ms both` |
| Ping (aro en 4.5,20, r 5,25, trazo 1,5) | `wy-ring-a 520ms var(--ease-papel) 0ms forwards`     |
| Onda 1 (en 115,8)                       | `wy-ring-b 600ms … 1280ms forwards`                  |
| Onda 2 (en 115,8, trazo 1)              | `wy-ring-c 540ms … 1420ms forwards`                  |
| Estela                                  | `wy-trail 460ms linear {delay}ms both`               |

Los aros llevan `fill-mode: forwards` y opacidad base 0, para que **no** se vean antes de empezar. Este fallo se detectó en el prototipo y está corregido aquí.

### 9.8 Relevo (`IntroHandoff.tsx`)

```tsx
'use client'
import { useEffect } from 'react'
import { animate } from 'framer-motion'

const lowEnd = () =>
  (navigator.hardwareConcurrency ?? 4) <= 4 ||
  ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4

export function IntroHandoff() {
  useEffect(() => {
    const html = document.documentElement
    if (html.dataset.intro !== 'play') return
    const root = document.querySelector<HTMLElement>('.wy-intro')
    const clock = root
      ?.getAnimations()
      .find((a) => (a as CSSAnimation).animationName === 'wy-clock')
    const now = Number(clock?.currentTime ?? 0)
    // Si hidrató tarde, deja que termine el fallback CSS (no lo interrumpas)
    if (!root || !clock || now > 2000) {
      const id = window.setTimeout(
        () => (window as any).__wyIntroDone?.(),
        Math.max(0, 2500 - now)
      )
      return () => clearTimeout(id)
    }
    html.dataset.introJs = '1'
    let cancelled = false
    clock.finished.then(async () => {
      if (cancelled || html.dataset.intro !== 'play') return
      const mark = root.querySelector<HTMLElement>('[data-wy-intro-mark]')!
      const paper = root.querySelector<HTMLElement>('[data-wy-intro-paper]')!
      const dot = root
        .querySelector('[data-wy-intro-dot]')!
        .getBoundingClientRect()
      const target = document.querySelector<HTMLElement>('[data-wy-logo]')
      const a = mark.getBoundingClientRect()
      paper.style.setProperty('--wy-x', `${dot.left + dot.width / 2}px`)
      paper.style.setProperty('--wy-y', `${dot.top + dot.height / 2}px`)
      const jobs: Promise<unknown>[] = [
        animate(
          Array.from(root.querySelectorAll('[data-wy-intro-decor]')),
          { opacity: 0 },
          { duration: 0.16, ease: [0.4, 0, 1, 1] }
        ),
      ]
      if (target) {
        const b = target.getBoundingClientRect()
        jobs.push(
          animate(
            mark,
            {
              x: b.left + b.width / 2 - (a.left + a.width / 2),
              y: b.top + b.height / 2 - (a.top + a.height / 2),
              scale: b.width / a.width,
            },
            { type: 'spring', stiffness: 260, damping: 30, restDelta: 0.001 }
          )
        )
      } else {
        jobs.push(animate(mark, { opacity: 0 }, { duration: 0.2 }))
      }
      jobs.push(
        lowEnd()
          ? animate(
              paper,
              { opacity: 0 },
              { duration: 0.32, ease: [0.4, 0, 1, 1] }
            )
          : animate(
              paper,
              {
                '--wy-r': ['0px', `${Math.hypot(innerWidth, innerHeight)}px`],
              } as never,
              { duration: 0.52, delay: 0.05, ease: [0.76, 0, 0.24, 1] }
            )
      )
      await Promise.all(jobs)
      ;(window as any).__wyIntroDone?.()
    })
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
```

- **El scramble de las coordenadas** es un efecto aparte en el mismo componente. Si hidrata antes de 1640 ms, cambia los dígitos con `requestAnimationFrame` durante 300 ms. Si no, el texto queda estático.
- **Salto:** lo resuelve el script del `<head>` con un fundido de 200 ms, también antes de hidratar.
- **QA:**
  - en Lighthouse móvil, el LCP es el H1 y no hay CLS;
  - perfilar en un Android de gama baja con la CPU ×4. Si el portal pierde más de 2 fotogramas, forzar el fundido;
  - verificar que con JS desactivado no hay intro y que al hacer `skip` el header queda visible.

### 9.9 Móvil (Expo)

1. **Splash nativo** (`expo-splash-screen`): `backgroundColor '#F7F4EE'` e `image` = **solo el punto** (PNG de un círculo `#C21A66`, `imageWidth: 20`). En oscuro: `'#0B1622'` y punto `#F55A9A`. Es compatible con el icono centrado obligatorio de la API de splash de Android 12. `SplashScreen.preventAutoHideAsync()` va a nivel de módulo.
2. Al cargar las fuentes se monta `<IntroSplash/>`. Su primer fotograma es idéntico al nativo, y en su `onLayout` se llama a `SplashScreen.hideAsync()`: el relevo es invisible.
3. **Guion comprimido** (1,85 s; `react-native-svg` + Reanimated 4; posición del punto calculada en un worklet con la misma polilínea y la misma Bézier):

| ms        | Acción                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0–160     | El punto se desliza del centro al inicio de la w (`Easing.bezier(.22,1,.36,1)`)                                                    |
| 160–700   | Se traza la w (`AnimatedPath` con `strokeDashoffset` y `useAnimatedProps`) con el punto en la punta                                |
| 700–980   | Vuelo en arco con estela; «a» y «y» se trazan entre 720 y 940                                                                      |
| 980       | `Haptics.impactAsync(ImpactFeedbackStyle.Light)`, squash entre 980 y 1160, onda y asta de la i entre 980 y 1100                    |
| 1040–1240 | «o»                                                                                                                                |
| 1240–1500 | Tagline                                                                                                                            |
| 1500–1850 | El lockup se escala y se traslada al logo del header de Home (medido con `measureInWindow`) y el overlay hace un fundido de 300 ms |

4. Se muestra solo en arranque en frío, no al volver de segundo plano. Se salta con un toque.
5. Si `AccessibilityInfo.isReduceMotionEnabled()` o `useReducedMotion()` está activo, se llama a `hideAsync()` directamente, sin intro.

---

## 10. Mapa

### 10.1 Estilos

- **Fork recomendado, obligatorio en oscuro** (las etiquetas originales dan 3,36:1): `public/map-styles/wayio-claro.json` y `wayio-oscuro.json`. Son copias versionadas de `https://tiles.openfreemap.org/styles/positron` y `.../dark` que siguen usando las tiles, los sprites y los glyphs de OpenFreeMap.

| Capa (id del original)                             | Claro (positron)                  | Oscuro (dark)                     |
| -------------------------------------------------- | --------------------------------- | --------------------------------- |
| `background`                                       | `#EFEBE3`                         | `#0E1925`                         |
| `water`                                            | `#CDDCDF`                         | `#10283A`                         |
| `park` / `landuse_park`, `landcover_wood`          | `#E3E6DA`                         | `#13222C`                         |
| `landuse_residential`, `building`                  | `#E9E4DA` / `#E4DED2`             | `#112131` / `#132030`             |
| `highway_minor` · `major_inner` · casing           | `#FFFFFF` · `#FFFFFF` · `#E2DCD0` | `#18293B` · `#1F344A` · `#22384D` |
| Etiquetas `label_*` / `place_*` (text-color, halo) | `#46525F`, `#FFFFFF`              | `#B6C2CE`, `rgba(11,22,34,.8)`    |

- **Sin fork** (fase 1): positron en claro, con etiquetas `#000` a 18,85, y en oscuro el estilo `dark` aplicando `setPaintProperty` a las capas `place_*` (`text-color #B6C2CE`) dentro de `map.on('style.load')`, comprobando `map.getLayer(id)` antes.
- **Cambio de tema:** escuchar `wayio-theme-change` y llamar a `map.setStyle(url, { diff: true })` para volver a añadir las fuentes y capas propias. **El mapa no se destruye** al cambiar `dias`: se actualiza con `source.setData()`. Esto corrige el bug de `TripMap`.

### 10.2 Colores de los días

10 colores cíclicos que alternan tono. Nunca se usa el magenta, reservado para el GPS. En CSS: `var(--dia-N)` (cambia con el tema). En TS: `DAY_BASE` y `DAY_LUZ`.

| Día           | Base (mapa claro, número blanco) | Blanco/base | Base / tierra positron · agua · bosque · fork | Luz (mapa oscuro, número tinta) | Tinta/luz | Luz / dark · agua · bosque · fork noche · agua noche |
| ------------- | -------------------------------- | ----------- | --------------------------------------------- | ------------------------------- | --------- | ---------------------------------------------------- |
| 1 Terracota   | `#A63F26`                        | 6,25        | 5,61 · 3,69 · 4,68 · 5,26                     | `#E58A68`                       | 7,09      | 7,61 · 6,69 · 6,34 · 6,90 · 5,89                     |
| 2 Mar         | `#1E5A57`                        | 7,91        | 7,10 · 4,67 · 5,93 · 6,65                     | `#6FB8AE`                       | 7,94      | 8,52 · 7,49 · 7,09 · 7,72 · 6,59                     |
| 3 Latón       | `#7E5F22`                        | 5,92        | 5,32 · 3,50 · 4,44 · 4,98                     | `#D9B468`                       | 9,27      | 9,95 · 8,75 · 8,29 · 9,02 · 7,70                     |
| 4 Índigo      | `#3B4C8C`                        | 8,08        | 7,26 · 4,78 · 6,06 · 6,80                     | `#8E9EE0`                       | 7,05      | 7,56 · 6,65 · 6,30 · 6,85 · 5,85                     |
| 5 Ciruela     | `#7A3B69`                        | 7,90        | 7,10 · 4,67 · 5,92 · 6,65                     | `#D08BC0`                       | 7,06      | 7,58 · 6,66 · 6,31 · 6,87 · 5,87                     |
| 6 Oliva       | `#4F6427`                        | 6,59        | 5,92 · 3,90 · 4,94 · 5,55                     | `#A9C26B`                       | 9,21      | 9,89 · 8,69 · 8,24 · 8,96 · 7,66                     |
| 7 Azul Caribe | `#1F6F95`                        | 5,58        | 5,01 · 3,29 · 4,18 · 4,69                     | `#6CB8DE`                       | 8,29      | 8,89 · 7,82 · 7,41 · 8,06 · 6,89                     |
| 8 Burdeos     | `#8A2F3C`                        | 8,23        | 7,39 · 4,86 · 6,17 · 6,92                     | `#E07F8C`                       | 6,58      | 7,06 · 6,21 · 5,88 · 6,40 · 5,47                     |
| 9 Pizarra     | `#4A5560`                        | 7,61        | 6,83 · 4,50 · 5,70 · 6,40                     | `#A9B6C2`                       | 8,82      | 9,46 · 8,32 · 7,88 · 8,58 · 7,33                     |
| 10 Ocre       | `#9A5B13`                        | 5,41        | 4,86 · 3,20 · 4,06 · 4,55                     | `#E3A15A`                       | 8,26      | 8,86 · 7,79 · 7,38 · 8,03 · 6,86                     |

Todos superan 3:1 contra todas las superficies del mapa. Las bases también sirven como texto sobre papel (≥4,93), así que el kicker «DÍA 03» puede ir en su color. **El color nunca va solo**: siempre lleva el número y «Día N», porque los días 1 y 8 se confunden con protanopía.

### 10.3 Dibujo

| Elemento  | Especificación                                                                                                                                                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marcador  | Círculo de 28 px (32 si está activo) `bg-dia-N`, aro de 2 px `var(--map-casing)`, sombra `0 1px 3px rgb(0 0 0 / .35)`, número `Instrument Sans 700 13px tnum` en `var(--dia-num)`. Entra con `scale .6→1` y stagger de 30 ms. DOM construido con `textContent`. Es un botón con `aria-label="Día 2, actividad 3: Museo del Oro"`                    |
| Ruta      | Casing de 6 px `map-casing` bajo una línea de 3,5 px del día, con cap y join `round`. Día activo: 4,5 px. Inactivos cuando hay filtro: opacidad .3 y marcadores al 40 %                                                                                                                                                                             |
| Traslados | `line-dasharray [0.1, 2]`                                                                                                                                                                                                                                                                                                                           |
| Crucero   | 2,5 px, `[2, 2]`. Puerto: cuadrado redondeado de 28 px (radio 8) en `tinta-900` con `Anchor` blanco                                                                                                                                                                                                                                                 |
| GPS       | Punto de 14 px `var(--gps)` con aro de 3 px `var(--gps-ring)`. Halo `animate-ping-gps` (3 ciclos tras cada actualización). Círculo de precisión con relleno de `--gps` al 10 % y línea al 35 %                                                                                                                                                      |
| En vivo   | Tramo siguiente en `var(--gps)`, 4 px, `[1.5, 1.5]`, estático                                                                                                                                                                                                                                                                                       |
| Controles | Botones de 40 `bg-surface-raised rounded-control shadow-elev`, arriba a la derecha: `Plus`, `Minus`, `Maximize` («Ajustar vista») y `Layers`                                                                                                                                                                                                        |
| Popup     | `bg-surface-raised rounded-control shadow-float p-3.5 max-w-[280px]`: título `text-[15px] font-semibold`, meta `text-caption text-fg-muted` (precio en la moneda del viaje) y `ghost sm` «Google Maps», «Waze» y «Apple Maps» con `rel="noopener noreferrer"`. **Se construye con nodos DOM y `textContent`, nunca con `setHTML`** (corrige el XSS) |
| Cámara    | `fitBounds` con padding de 60 y `maxZoom 14`. `flyTo` al día en 900 ms con `curve 1.42`                                                                                                                                                                                                                                                             |

En la landing y en SEO **no hay MapLibre**: el fragmento de mapa es SVG estático, por el LCP y por el uso justo del servicio.

---

## 11. `mobile/src/theme.ts`

**Dependencias** (comprobar antes la versión de Expo: `package.json` dice `~54.0.0` y `AGENTS.md` cita la v56):

```
npx expo install expo-font expo-splash-screen react-native-svg react-native-reanimated react-native-worklets @expo-google-fonts/newsreader @expo-google-fonts/instrument-sans @expo-google-fonts/geist-mono lucide-react-native
```

Son módulos nativos: hace falta un rebuild con EAS y no basta con OTA.

**`app.json`:**

- `userInterfaceStyle: 'automatic'`;
- plugin `expo-font` con los `.ttf` embebidos;
- plugin `expo-splash-screen`: `{ image: './assets/splash-punto.png', imageWidth: 20, backgroundColor: '#F7F4EE', dark: { image: './assets/splash-punto-dark.png', backgroundColor: '#0B1622' } }`;
- `android.adaptiveIcon.backgroundColor: '#142435'`;
- color de `expo-notifications`: `'#C21A66'`.

```ts
import { useColorScheme } from 'react-native'
import { Easing } from 'react-native-reanimated'

export const palette = {
  rosa: {
    50: '#FFF0F6',
    100: '#FFDDEB',
    200: '#FFBAD6',
    300: '#FF8AB8',
    400: '#F55A9A',
    500: '#E0307D',
    600: '#C21A66',
    700: '#A11254',
    800: '#800F45',
    900: '#640E39',
    950: '#3D0520',
  },
  mar: {
    50: '#EFF7F5',
    100: '#D6ECE8',
    200: '#AED8D1',
    300: '#7FBFB6',
    400: '#519F96',
    500: '#33827A',
    600: '#246B66',
    700: '#1E5A57',
    800: '#1A4A48',
    900: '#173E3C',
    950: '#0B2423',
  },
  tinta: {
    50: '#F2F5F8',
    100: '#E1E8EF',
    200: '#B6C2CE',
    300: '#9AAABB',
    400: '#7088A0',
    500: '#767D86',
    600: '#56626F',
    700: '#46525F',
    800: '#2C4258',
    900: '#142435',
    950: '#0F1E2E',
  },
  noche: {
    600: '#2E4760',
    700: '#22384D',
    800: '#1F344A',
    850: '#18293B',
    900: '#112131',
    950: '#0B1622',
  },
  papel: {
    50: '#FBF9F5',
    100: '#F7F4EE',
    150: '#F1EEE8',
    200: '#EFEAE1',
    300: '#E2DCD0',
    400: '#C9C1B2',
  },
  laton: {
    50: '#FAF5EA',
    300: '#D9B468',
    600: '#9A7531',
    700: '#7E5F22',
    800: '#654B1E',
  },
} as const

export const light = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  surface2: '#EFEAE1',
  surfaceRaised: '#FFFFFF',
  surfaceInverse: '#142435',
  fg: '#0F1E2E',
  fgMuted: '#46525F',
  fgSubtle: '#56626F',
  fgInverse: '#F7F4EE',
  border: '#E2DCD0',
  rule: '#C9C1B2',
  borderStrong: '#767D86',
  primary: '#C21A66',
  primaryPressed: '#A11254',
  primaryFg: '#FFFFFF',
  primarySoft: '#FFF0F6',
  primarySoftFg: '#800F45',
  primaryText: '#A11254',
  accent: '#1E5A57',
  accentFg: '#FFFFFF',
  accentSoft: '#EFF7F5',
  accentSoftFg: '#1A4A48',
  brass: '#9A7531',
  brassText: '#7E5F22',
  brassSoft: '#FAF5EA',
  success: '#2E6B3F',
  successBg: '#EDF5EE',
  successFg: '#23582F',
  warning: '#7A5200',
  warningBg: '#FBF1D9',
  warningFg: '#6B4800',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerBg: '#FDEEEC',
  dangerFg: '#912018',
  info: '#1E5A57',
  infoBg: '#EFF7F5',
  infoFg: '#1A4A48',
  ring: '#246B66',
  overlay: 'rgba(11,22,34,0.55)',
  toastSuccess: '#9AE0B4',
  toastAction: '#FF8AB8',
  gps: '#C21A66',
  gpsRing: '#FFFFFF',
  mapCasing: '#FFFFFF',
  dayNumeral: '#FFFFFF',
}
export type ThemeColors = typeof light
export const dark: ThemeColors = {
  bg: '#0B1622',
  surface: '#112131',
  surface2: '#18293B',
  surfaceRaised: '#1F344A',
  surfaceInverse: '#F1EEE8',
  fg: '#F1EEE8',
  fgMuted: '#B6C2CE',
  fgSubtle: '#9AAABB',
  fgInverse: '#0F1E2E',
  border: '#22384D',
  rule: '#2E4760',
  borderStrong: '#7088A0',
  primary: '#F55A9A',
  primaryPressed: '#FF8AB8',
  primaryFg: '#0B1622',
  primarySoft: '#3A1D35',
  primarySoftFg: '#FFBAD6',
  primaryText: '#FF8AB8',
  accent: '#7FBFB6',
  accentFg: '#0B1622',
  accentSoft: '#133038',
  accentSoftFg: '#AED8D1',
  brass: '#D9B468',
  brassText: '#E9C88A',
  brassSoft: '#2C2A24',
  success: '#93D6A6',
  successBg: '#15302A',
  successFg: '#A8E8C4',
  warning: '#F2C76E',
  warningBg: '#2D2C22',
  warningFg: '#FBD48C',
  danger: '#FF9C85',
  onDanger: '#0B1622',
  dangerBg: '#35212A',
  dangerFg: '#FFC2B5',
  info: '#7FBFB6',
  infoBg: '#133038',
  infoFg: '#AED8D1',
  ring: '#7FBFB6',
  overlay: 'rgba(3,8,14,0.70)',
  toastSuccess: '#23582F',
  toastAction: '#A11254',
  gps: '#F55A9A',
  gpsRing: '#0B1622',
  mapCasing: '#0B1622',
  dayNumeral: '#0B1622',
}

// Verificar los nombres exportados por cada paquete @expo-google-fonts tras instalar.
// Instancia opcional opsz 72 de Newsreader para display (fontTools varLib.instancer).
export const fonts = {
  display: 'Newsreader_500Medium',
  displayItalic: 'Newsreader_500Medium_Italic',
  displayBold: 'Newsreader_600SemiBold',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  mono: 'GeistMono_500Medium',
} as const

// En RN letterSpacing y lineHeight van en px; con familias custom no se usa fontWeight.
export const type = {
  displayXL: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
  },
  displayL: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.85,
  },
  h1: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.56,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.35,
  },
  h3: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 25 },
  bodyS: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.7,
    textTransform: 'uppercase' as const,
  },
  data: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  numXL: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums' as const],
  },
  num: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums' as const],
  },
} as const

export const radius = {
  stamp: 4,
  control: 12,
  card: 16,
  sheet: 24,
  pill: 999,
} as const
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  gutter: 16,
} as const
export const control = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 60,
  hit: 44,
  bottomBar: 72,
} as const
export const motion = {
  instant: 80,
  fast: 140,
  base: 200,
  medium: 280,
  slow: 420,
  page: 520,
  easing: {
    papel: Easing.bezier(0.22, 1, 0.36, 1),
    salida: Easing.bezier(0.4, 0, 1, 1),
    tinta: Easing.bezier(0.65, 0, 0.35, 1),
    sello: Easing.bezier(0.34, 1.56, 0.64, 1),
  },
  spring: {
    suave: { stiffness: 260, damping: 30 },
    firme: { stiffness: 500, damping: 38 },
    sello: { stiffness: 600, damping: 18 },
  },
} as const
export const elevation = {
  card: { borderWidth: 1 },
  elev: {
    shadowColor: '#0F1E2E',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  float: {
    shadowColor: '#0F1E2E',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const // en oscuro: superficie más clara + borde hairline en lugar de sombra

export const DAY_COLORS = [
  '#A63F26',
  '#1E5A57',
  '#7E5F22',
  '#3B4C8C',
  '#7A3B69',
  '#4F6427',
  '#1F6F95',
  '#8A2F3C',
  '#4A5560',
  '#9A5B13',
] as const
export const DAY_COLORS_DARK = [
  '#E58A68',
  '#6FB8AE',
  '#D9B468',
  '#8E9EE0',
  '#D08BC0',
  '#A9C26B',
  '#6CB8DE',
  '#E07F8C',
  '#A9B6C2',
  '#E3A15A',
] as const

export function useTheme() {
  const scheme = useColorScheme() // sustituir por un contexto con AsyncStorage 'wayio-theme' ('light'|'dark'|'system')
  const isDark = scheme === 'dark'
  return {
    isDark,
    colors: isDark ? dark : light,
    days: isDark ? DAY_COLORS_DARK : DAY_COLORS,
    type,
    radius,
    space,
    control,
    motion,
  }
}
```

**Notas para RN:**

- **Fuentes y botones:**
  - las fuentes se cargan con `useFonts` y el splash nativo se mantiene hasta que estén listas;
  - botones de 44 o 52 de alto con `hitSlop`;
  - `allowFontScaling` con `maxFontSizeMultiplier: 1.4` en los controles.
- **Barras del sistema:** StatusBar `dark` sobre papel y `light` sobre noche. La barra de navegación de Android en el color de `bg`.
- **Mapa** (`@rnmapbox/maps`):
  - mismo fork de estilos si el SDK los acepta; si no, estilos Mapbox tintados (sigue haciendo falta un token);
  - `LineLayer` de 3,5 sobre un casing de 6;
  - marcadores con `CircleLayer` de r 14 y `SymbolLayer` con el número;
  - GPS con `colors.gps`.
- **Componentes nativos:**
  - las muescas de los boletos se dibujan en `react-native-svg`;
  - iconos de `lucide-react-native` de 20 px con `strokeWidth 1.75`;
  - hápticos al guardar y al confirmar.

---

## 12. Plan de implementación

| Fase                 | Contenido                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Fundaciones       | `globals.css` (§2), fuentes (§3), `marks.ts`, `Logo`, favicon e iconos, `manifest.ts`, `themeColor`, MotionProvider, primitivas (Button, Input, Textarea, Select, Chip, Segmented, Card, Callout, Badge, Modal/Sheet, Toast, Skeleton, EmptyState, Tabs). Migrar `grad-brand`, `text-white` sobre color y `bg-coral-500`. `scripts/check-contrast.mjs` en CI |
| 2. Flujo público     | SiteHeader único, landing RSC + intro, `/planificar` con `?paso`, RutaDeFases con el SSE real, versiones (seleccionar ≠ confirmar), resultado (capítulos, total único, IA con deshacer, impresión), TripMap sin recrearse, forks del mapa, popups seguros                                                                                                    |
| 3. Rutas secundarias | `/trip` (Hoy, barra inferior, GPS honesto, reagendar), compartido (RSC + OG, depende de la RLS), grupo, AuthShell, SEO + OG, `/viajes`, 404, error y loading                                                                                                                                                                                                 |
| 4. Admin             | Shell, DataTable, StatCard, BarChart, Switch, ConfirmDialog, loading y error por sección, `requireAdmin` por página, queries que propagan errores                                                                                                                                                                                                            |
| 5. Móvil             | `theme.ts`, fuentes, splash e intro, iconos adaptativos, mapa                                                                                                                                                                                                                                                                                                |
| 6. Limpieza          | Codemod de alias, borrar `TEMPORAL`, `Loader3D` y el código muerto del inventario                                                                                                                                                                                                                                                                            |

**QA por pantalla:**

- claro y oscuro a 375, 768 y 1440 px;
- axe y Lighthouse (LCP = H1 en `/`, CLS < 0,05);
- navegación solo con teclado;
- VoiceOver o TalkBack en el flujo completo;
- movimiento reducido;
- impresión del itinerario;
- Android de gama baja.

---

## 13. No hacer

1. Gradientes en botones, textos o fondos, glassmorphism fuera del header, auroras o sombras de color.
2. Texto blanco sobre el primario en oscuro, cualquier texto sobre `rosa-500` o latón 600 como texto pequeño.
3. Más de un CTA `primary` por vista, o más de un punto magenta en una composición de marca.
4. Seleccionar con magenta: lo seleccionado es **tinta**.
5. Controles que se distinguen solo por `border` o `rule` decorativos: los controles usan `border-strong`.
6. Comunicar un estado solo con color: siempre icono, texto o forma.
7. Emojis como iconos, o el carácter «×» sin `aria-label`: se usa lucide.
8. Newsreader por debajo de 20 px, en botones, inputs, chips o tablas, o más de dos pesos por vista. Texto por debajo de 12 px.
9. Fechas ISO crudas, `en-US` en importes, `$` fijo o USD por defecto cuando el viaje está en otra moneda.
10. Estrellas inventadas, «Más elegido» sin datos, progreso falso o promesas de funciones que la web no tiene (geofencing, pronóstico).
11. Mensajes para desarrolladores en la UI pública (`.env`, API key, `STRIPE_SECRET_KEY`).
12. Iconos o textos de avión o «SDQ → X» en paquetes o totales que no incluyen vuelo.
13. Bucles infinitos de decoración: flotación, hero animado o rotación automática de consejos. Solo se permite el progreso real y el GPS (6 s).
14. Elementos enfocables dentro de un overlay `aria-hidden`, `outline-none` sin sustituto o modales sin focus trap ni Esc.
15. Intro fuera de `/`, más de una vez por sesión, con movimiento reducido, que bloquee el scroll o que oculte el H1 con `opacity:0`.
16. `setHTML` con texto de la IA o del usuario, o `target="_blank"` sin `rel="noopener noreferrer"`.
17. Recrear el mapa al cambiar los días, o MapLibre en la landing o en las páginas SEO.
18. `AnimatePresence mode="wait"` con `layoutId` compartido, o `LazyMotion` con `domAnimation` si hay animaciones de layout.
19. El isotipo junto al wordmark, rotar, deformar o sombrear el logo, o cambiar el color del punto.
20. Texto sobre el arte generativo de las postales: siempre va en el pie de papel.
21. `window.confirm` para acciones destructivas, o botones `danger` fuera de diálogos de confirmación.
22. Colores sueltos de Tailwind (`gray-*`, `blue-*`, `indigo-*`, `purple-*`, `red-*`, `green-*`) en componentes: solo tokens semánticos.
