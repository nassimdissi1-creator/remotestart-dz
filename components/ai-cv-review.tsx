'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'

export function AiCvReview({ accessToken, remaining }: { accessToken: string; remaining: number }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState<any>(null)
  const [credits, setCredits] = useState(remaining)

  async function submit() {
    if (!file) return
    setBusy(true); setError(''); setReview(null)
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/talent/ai-cv-review', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI CV review failed')
      setReview(data.review); setCredits(data.remaining)
    } catch (e) { setError(e instanceof Error ? e.message : 'AI CV review failed') }
    finally { setBusy(false) }
  }

  return <section className="rounded-2xl border p-5 space-y-4">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold">AI CV Review</h2><p className="text-sm opacity-70">Included with Talent Pro Plus · {credits} of 5 reviews remaining</p></div>
      <FileText className="h-6 w-6" />
    </div>
    <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
    <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl border border-dashed p-6 text-sm">
      <Upload className="mx-auto mb-2 h-5 w-5" />{file ? file.name : 'Upload your CV (PDF, max 5MB)'}
    </button>
    <button type="button" disabled={!file || busy || credits <= 0} onClick={submit} className="w-full rounded-xl px-4 py-3 font-medium disabled:opacity-50">
      {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Analyzing…</> : 'Analyze My CV'}
    </button>
    {error && <p className="rounded-lg p-3 text-sm" role="alert">{error}</p>}
    {review && <div className="space-y-4 rounded-xl border p-4"><div className="text-2xl font-bold">Score: {review.overall_score}/100</div><p>{review.summary}</p><div><h3 className="font-semibold">Strengths</h3><ul className="list-disc pl-5">{(review.strengths ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div><div><h3 className="font-semibold">Recommended changes</h3><ul className="list-disc pl-5">{(review.recommended_changes ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div></div>}
  </section>
}
