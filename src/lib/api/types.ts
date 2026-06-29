export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  price?: number
  currency?: string
  url?: string
  provider: 'amadeus' | 'booking' | 'viator'
}

export interface SearchResponse {
  configured: boolean
  results: SearchResult[]
  error?: string
}
