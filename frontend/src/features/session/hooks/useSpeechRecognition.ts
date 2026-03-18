import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type SpeechRecognitionCtor = new () => any

export function useSpeechRecognition(opts: {
  onFinalText: (text: string) => void
  lang?: string
}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recRef = useRef<any>(null)
  const wantListeningRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; at: number } | null>(null)

  const lang = opts.lang ?? "en-US"

  useEffect(() => {
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as
      | SpeechRecognitionCtor
      | undefined
    setIsSupported(Boolean(SR))
  }, [])

  const start = useCallback(() => {
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as any
    if (!SR) return
    if (recRef.current) return

    const rec = new SR()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = true

    rec.onresult = (evt: any) => {
      let finalText = ""
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const r = evt.results[i]
        const text = (r?.[0]?.transcript as string | undefined) ?? ""
        if (r.isFinal) finalText += text
      }
      const t = finalText.trim()
      if (t) {
        // Dedupe repeated finals some browsers emit.
        const now = Date.now()
        const last = lastFinalRef.current
        if (!last || last.text !== t || now - last.at > 1500) {
          lastFinalRef.current = { text: t, at: now }
          opts.onFinalText(t)
        }
      }
    }

    rec.onerror = () => {
      setIsListening(false)
    }
    rec.onend = () => {
      setIsListening(false)
      recRef.current = null
      // Keep the experience "hands free": auto-restart unless user explicitly stopped.
      if (wantListeningRef.current) {
        window.setTimeout(() => start(), 250)
      }
    }

    recRef.current = rec
    try {
      wantListeningRef.current = true
      rec.start()
      setIsListening(true)
    } catch {
      recRef.current = null
      setIsListening(false)
    }
  }, [lang, opts])

  const stop = useCallback(() => {
    const rec = recRef.current
    wantListeningRef.current = false
    if (!rec) return
    try {
      rec.stop()
    } catch {
      // ignore
    }
    recRef.current = null
    setIsListening(false)
  }, [])

  // Stable UI label
  const label = useMemo(() => {
    if (!isSupported) return "Speech Not Supported"
    return isListening ? "Mic On" : "Mic Off"
  }, [isSupported, isListening])

  return { isSupported, isListening, start, stop, label }
}
