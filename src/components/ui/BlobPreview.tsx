import { useEffect, useState } from 'react'
import { Clock, Download, FileText } from 'lucide-react'
import { db } from '@/domain/db'
import { formatBytes } from '@/lib/utils'
import { Button } from './primitives'
import { toast } from '@/stores/toast'

/** Loads a stored blob as an object URL (media/pdf) or decoded text. */
export function useBlobPreview(blobId: string | undefined, mime: string | undefined) {
  const [state, setState] = useState<{ url: string | null; text: string | null; loading: boolean }>({
    url: null,
    text: null,
    loading: true,
  })

  useEffect(() => {
    if (!blobId) {
      setState({ url: null, text: null, loading: false })
      return
    }
    let url: string | null = null
    let cancelled = false
    setState({ url: null, text: null, loading: true })

    db.blobs.get(blobId).then(async (rec) => {
      if (cancelled) return
      if (!rec) {
        setState({ url: null, text: null, loading: false })
        return
      }
      const type = mime ?? rec.data.type
      if (type.startsWith('text/')) {
        const text = await rec.data.text()
        if (!cancelled) setState({ url: null, text, loading: false })
      } else {
        url = URL.createObjectURL(rec.data)
        if (cancelled) URL.revokeObjectURL(url)
        else setState({ url, text: null, loading: false })
      }
    })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [blobId, mime])

  return state
}

export async function downloadBlob(blobId: string | undefined, name: string) {
  const rec = blobId ? await db.blobs.get(blobId) : undefined
  if (!rec) {
    toast.error('Berkas hilang', 'Dokumen tidak ditemukan di browser ini.')
    return
  }
  const url = URL.createObjectURL(rec.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** The preview surface for an uploaded file: image, video, PDF or text. */
export function BlobPreview({
  blobId,
  mime,
  name,
  size,
}: {
  blobId?: string
  mime?: string
  name: string
  size?: number
}) {
  const { url, text, loading } = useBlobPreview(blobId, mime)
  const type = mime ?? ''

  if (loading) return <div className="flex h-full items-center justify-center text-[12px] text-ink-4">Memuat pratinjau…</div>
  if (type.startsWith('image/') && url)
    return (
      <div className="flex min-h-full items-center justify-center">
        <img src={url} alt={name} className="max-w-full rounded-lg border border-line shadow-lg" />
      </div>
    )
  if (type.startsWith('video/') && url)
    return (
      <div className="flex min-h-full items-center justify-center">
        <video src={url} controls className="max-h-full max-w-full rounded-lg" />
      </div>
    )
  if (type === 'application/pdf' && url)
    return <iframe src={url} title={name} className="size-full min-h-[70vh] rounded-lg border border-line bg-white" />
  if (text !== null)
    return (
      <div className="mx-auto max-w-[820px] rounded-lg border border-line bg-surface-1 p-6 shadow-sm">
        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink-2">{text}</pre>
      </div>
    )
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <FileText size={40} className="mx-auto text-ink-3" />
        <p className="mt-3 text-[12.5px] text-ink-3">Tidak ada pratinjau untuk jenis berkas ini.</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-ink-4">
          <Clock size={11} /> {type || 'berkas'} · {size !== undefined ? formatBytes(size) : '—'}
        </p>
        {blobId && (
          <Button className="mt-4" variant="primary" icon={<Download size={13} />} onClick={() => downloadBlob(blobId, name)}>
            Unduh berkas
          </Button>
        )}
      </div>
    </div>
  )
}
