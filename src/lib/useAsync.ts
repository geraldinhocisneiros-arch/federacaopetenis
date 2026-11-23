import { useCallback, useEffect, useRef, useState } from 'react'
import { msgErro } from './supabase'

/** Carrega dados assíncronos e expõe recarregamento */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(msgErro(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload, setData }
}

/** Lança o erro do Supabase, se houver, e devolve os dados */
export function ok<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
