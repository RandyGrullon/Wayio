/**
 * ¿Está Supabase configurado de verdad? Permite que la app se ejecute en modo
 * demo (sin login ni persistencia) cuando faltan las variables, en vez de
 * lanzar errores. Las NEXT_PUBLIC_* están disponibles en cliente y servidor.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  return Boolean(
    url && key && url.startsWith('http') && key.length > 20 && key !== 'tu_key'
  )
}
