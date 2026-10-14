/**
 * Compatibilidad: los formatos viven en `./formatters` (es-DO, sin Intl,
 * seguros en Hermes). `formatCurrency(amount, currency)` mantiene su firma
 * («US$1,840» en vez del antiguo «$1,840» en-US).
 */
export * from './formatters'
