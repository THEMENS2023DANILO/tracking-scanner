'use client'

import { useState, useRef, useEffect } from 'react'

type ScanResult = {
  found: boolean
  customer_name?: string
  products?: string[]
  error?: string
}

export default function Home() {
  const [tracking, setTracking] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [result])

  async function handleScan(code: string) {
    if (!code.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: code }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ found: false, error: 'Erro de conexão' })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleScan(tracking)
    }
  }

  function handleReset() {
    setTracking('')
    setResult(null)
    inputRef.current?.focus()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start p-6 pt-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white">Rastreio The Mens</h1>
          <p className="text-gray-400 mt-1 text-sm">Escaneie ou digite o código de rastreio</p>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={tracking}
            onChange={e => setTracking(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Ex: AN446826487BR"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-5 py-4 text-xl font-mono tracking-widest text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={() => handleScan(tracking)}
            disabled={loading || !tracking.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-6 rounded-xl text-lg transition-colors"
          >
            {loading ? '...' : 'OK'}
          </button>
        </div>

        {result && (
          <div className="mt-8">
            {result.found ? (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Cliente</p>
                  <p className="text-3xl font-bold text-white">{result.customer_name}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Produtos</p>
                  <div className="flex flex-col gap-2">
                    {result.products?.map((product, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
                        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-lg font-medium text-white">{product}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-500 text-sm mt-3 text-right">
                    {result.products?.length} produto{result.products?.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-600 text-center font-mono">{tracking}</p>
                </div>
              </div>
            ) : (
              <div className="bg-red-950 border border-red-800 rounded-2xl p-6 text-center">
                <p className="text-5xl mb-4">❌</p>
                <p className="text-xl font-bold text-red-400">Código não encontrado</p>
                <p className="text-gray-500 text-sm mt-2 font-mono">{tracking}</p>
              </div>
            )}

            <button
              onClick={handleReset}
              className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors"
            >
              Novo Scan
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
