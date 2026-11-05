import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Banknote,
  Boxes,
  ClipboardList,
  FileAudio,
  FileText,
  FileVideo,
  Gavel,
  HardDrive,
  Image as ImageIcon,
  MessageSquareQuote,
  Package,
  Plus,
  Search,
} from 'lucide-react'
import { db } from '@/domain/db'
import { standardQuestionLabel } from '@/domain/bapStandard'
import { sprintState, SPRINT_STATE_META } from '@/domain/access'
import type {
  BapStatus,
  EvidenceKind,
  EvidenceStatus,
  GelarStatus,
  IntervieweeKind,
  ReportSource,
  SprintPosition,
} from '@/domain/types'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { Badge, Button, EmptyState, Input, tone } from '@/components/ui/primitives'
import { useBlobPreview } from '@/components/ui/BlobPreview'
import { Modal } from '@/components/ui/Modal'

/**
 * Pulls the case's own record into a Challenge Session slide: what the
 * registration, the case conferences, the interviews and the evidence
 * register already say, so a deck is built from the case rather than
 * retyped from it.
 */

export type InsertSource = 'registration' | 'gelar' | 'interview' | 'evidence'

/** One ready-to-place piece of case information. */
export interface InsertBlock {
  id: string
  source: InsertSource
  /** Shown in the picker. */
  title: string
  subtitle?: string
  /** Placed on the slide: a heading line and the text beneath it. */
  heading: string
  body: string
  /** An image that goes on the slide beside the text. */
  imageBlobId?: string
  /** Evidence only — drives the small card in the picker. */
  evidence?: { kind: EvidenceKind; status: EvidenceStatus; ref: string; name: string }
}

const SOURCES: { id: InsertSource; label: string; icon: typeof Boxes }[] = [
  { id: 'registration', label: 'Case Registration', icon: ClipboardList },
  { id: 'gelar', label: 'Gelar Perkara', icon: Gavel },
  { id: 'interview', label: 'Interview', icon: MessageSquareQuote },
  { id: 'evidence', label: 'Evidence', icon: Boxes },
]

const SOURCE_LABEL: Record<ReportSource['kind'], string> = {
  wbs: 'Whistle Blower System (WBS)',
  management: 'Management Report',
  internal: 'Internal Report',
}
const POSITION_LABEL: Record<SprintPosition, string> = { ketua: 'Ketua Tim', sekretaris: 'Sekretaris', anggota: 'Anggota' }
const GELAR_LABEL: Record<GelarStatus, string> = {
  'lanjut-sprint': 'Lanjut SPRINT',
  'gelar-lanjutan': 'Gelar Perkara Lanjutan',
  close: 'Close',
}
const PERSON_LABEL: Record<IntervieweeKind, string> = { terlapor: 'Terlapor', saksi: 'Saksi', pelapor: 'Pelapor', ahli: 'Ahli' }
const BAP_LABEL: Record<BapStatus, string> = {
  draft: 'Draft',
  in_progress: 'Berlangsung',
  completed: 'Selesai',
  signed: 'Ditandatangani',
}
const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  collected: 'Collected',
  analyzing: 'Analyzing',
  verified: 'Verified',
  rejected: 'Out of scope',
}
const EVIDENCE_COLOR: Record<EvidenceStatus, string> = {
  collected: '#38BDF8',
  analyzing: '#F59E0B',
  verified: '#10B981',
  rejected: '#6A7FA3',
}
const EVIDENCE_KIND: Record<EvidenceKind, { icon: typeof FileText; color: string }> = {
  document: { icon: FileText, color: '#3B82F6' },
  image: { icon: ImageIcon, color: '#A855F7' },
  video: { icon: FileVideo, color: '#F43F5E' },
  audio: { icon: FileAudio, color: '#22D3EE' },
  physical: { icon: Package, color: '#F59E0B' },
  digital: { icon: HardDrive, color: '#10B981' },
  financial: { icon: Banknote, color: '#EAB308' },
}

const lines = (...xs: (string | false | undefined | null)[]) => xs.filter(Boolean).join('\n')

/** Everything on the case that can go onto a slide, newest material last. */
function useInsertBlocks(caseId: string): InsertBlock[] | undefined {
  return useLiveQuery(async () => {
    const [c, users, sprints, gelar, people, baps, questions, evidence] = await Promise.all([
      db.cases.get(caseId),
      db.users.toArray(),
      db.sprints.where('caseId').equals(caseId).toArray(),
      db.gelarPerkara.where('caseId').equals(caseId).toArray(),
      db.interviewees.where('caseId').equals(caseId).toArray(),
      db.baps.where('caseId').equals(caseId).toArray(),
      db.questions.toArray(),
      db.evidence.where('caseId').equals(caseId).toArray(),
    ])
    if (!c) return []
    const name = (id: string) => users.find((u) => u.id === id)?.name ?? id
    const out: InsertBlock[] = []

    /* Case Registration */
    out.push({
      id: `reg-case`,
      source: 'registration',
      title: 'Ringkasan perkara',
      subtitle: `${c.code} · ${c.title}`,
      heading: `${c.code} — ${c.title}`,
      body: lines(
        c.summary,
        '',
        c.caseType && `Jenis: ${c.caseType}`,
        `Dibuka: ${formatDate(c.openedAt)}`,
        `Penyidik utama: ${name(c.assigneeId)}`,
      ),
    })
    for (const [i, src] of (c.reportSources ?? []).entries()) {
      out.push({
        id: `reg-src-${src.id}`,
        source: 'registration',
        title: `Sumber laporan ${i + 1} — ${SOURCE_LABEL[src.kind]}`,
        subtitle: src.wbsNumber ?? src.notaDinasNumber ?? src.notes?.slice(0, 80),
        heading: `Sumber Laporan — ${SOURCE_LABEL[src.kind]}`,
        body:
          src.kind === 'wbs'
            ? `Nomor WBS: ${src.wbsNumber}\nDicatat ${formatDate(src.recordedAt)}`
            : src.kind === 'management'
              ? `Nota Dinas Nomor ${src.notaDinasNumber}\nDicatat ${formatDate(src.recordedAt)}`
              : `Investigation Notes:\n${src.notes ?? ''}`,
      })
    }
    for (const sp of sprints) {
      const team = [...sp.members].map((m) => `• ${name(m.userId)} — ${POSITION_LABEL[m.position]}`)
      out.push({
        id: `reg-sprint-${sp.id}`,
        source: 'registration',
        title: `SPRINT ${sp.number}`,
        subtitle: `${SPRINT_STATE_META[sprintState(sp)].label} · ${sp.subject}`,
        heading: `Surat Perintah ${sp.number}`,
        body: lines(
          `Perihal: ${sp.subject}`,
          `Diterbitkan: ${sp.issuedBy}, ${formatDate(sp.issuedAt)}`,
          `Berlaku: ${formatDate(sp.validFrom)}${sp.validUntil ? ` – ${formatDate(sp.validUntil)}` : ' sampai dicabut'}`,
        ),
      })
      out.push({
        id: `reg-team-${sp.id}`,
        source: 'registration',
        title: 'Investigators',
        subtitle: `${sp.members.length} investigator pada ${sp.number}`,
        heading: 'Tim Investigasi',
        body: team.join('\n') || 'Belum ada investigator.',
      })
    }
    for (const d of c.documents ?? []) {
      out.push({
        id: `reg-doc-${d.id}`,
        source: 'registration',
        title: d.name,
        subtitle: d.category ? `Dokumen pendukung · ${d.category}` : 'Dokumen pendukung',
        heading: d.name,
        body: lines(d.category && `Kategori: ${d.category}`, d.note, `Diunggah ${formatDate(d.uploadedAt)}${d.uploadedBy ? ` oleh ${d.uploadedBy}` : ''}`),
        imageBlobId: d.mime?.startsWith('image/') && d.mime !== 'image/svg+xml' ? d.blobId : undefined,
      })
    }

    /* Gelar Perkara */
    for (const g of [...gelar].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
      out.push({
        id: `gelar-${g.id}`,
        source: 'gelar',
        title: `${g.number} — ${g.title}`,
        subtitle: `${formatDate(g.scheduledAt)} · ${GELAR_LABEL[g.status]}`,
        heading: `Gelar Perkara ${g.number} — ${g.title}`,
        body: lines(
          `Waktu: ${formatDateTime(g.scheduledAt)}${g.location ? ` · ${g.location}` : ''}`,
          `Keputusan: ${GELAR_LABEL[g.status]}`,
          g.participants.length > 0 && `Peserta: ${g.participants.join(', ')}`,
          g.conclusion && `\nKesimpulan:\n${g.conclusion}`,
        ),
      })
    }

    /* Interview */
    for (const p of people) {
      const theirs = baps.filter((b) => b.intervieweeId === p.id)
      if (theirs.length === 0) {
        out.push({
          id: `int-person-${p.id}`,
          source: 'interview',
          title: p.name,
          subtitle: `${PERSON_LABEL[p.kind]} · ${p.position} · belum diperiksa`,
          heading: `${p.name} (${PERSON_LABEL[p.kind]})`,
          body: lines(`Jabatan: ${p.position}`, 'Belum ada BAP.'),
        })
        continue
      }
      for (const b of theirs) {
        // The first few answered questions carry the substance of the BAP.
        const answered = b.answers
          .filter((a) => (a.value ?? '').trim() || a.values?.length)
          .slice(0, 3)
          .map((a) => {
            const q = questions.find((x) => x.id === a.questionId) ?? b.extraQuestions?.find((x) => x.id === a.questionId)
            const label = q?.label ?? standardQuestionLabel(a.questionId) ?? 'Pertanyaan'
            return `• ${label}: ${a.values?.length ? a.values.join(', ') : a.value}`
          })
        out.push({
          id: `int-bap-${b.id}`,
          source: 'interview',
          title: `${b.number} — ${p.name}`,
          subtitle: `${PERSON_LABEL[p.kind]} · ${BAP_LABEL[b.status]} · ${formatDate(b.startedAt)}`,
          heading: `BAP ${b.number} — ${p.name} (${PERSON_LABEL[p.kind]})`,
          body: lines(
            `Jabatan: ${p.position}`,
            `Diperiksa ${formatDate(b.startedAt)} di ${b.location} · ${BAP_LABEL[b.status]}`,
            `Pemeriksa: ${b.investigatorIds.map(name).join(', ')}`,
            answered.length > 0 && `\n${answered.join('\n')}`,
          ),
        })
      }
    }

    /* Evidence */
    for (const e of [...evidence].sort((a, b) => a.ref.localeCompare(b.ref))) {
      out.push({
        id: `ev-${e.id}`,
        source: 'evidence',
        title: `${e.ref} — ${e.name}`,
        subtitle: `${EVIDENCE_LABEL[e.status]} · ${e.collectedBy}`,
        heading: `${e.ref} — ${e.name}`,
        body: lines(
          e.description,
          '',
          `Status: ${EVIDENCE_LABEL[e.status]}`,
          `Dikumpulkan: ${e.collectedBy}, ${formatDate(e.collectedAt)}`,
          e.location && `Lokasi: ${e.location}`,
        ),
        imageBlobId: e.mime?.startsWith('image/') ? e.blobId : undefined,
        evidence: { kind: e.kind, status: e.status, ref: e.ref, name: e.name },
      })
    }

    return out
  }, [caseId])
}

export function CaseInsertPicker({
  caseId,
  onInsert,
  onClose,
}: {
  caseId: string
  onInsert: (block: InsertBlock) => void
  onClose: () => void
}) {
  const blocks = useInsertBlocks(caseId)
  const [source, setSource] = useState<InsertSource>('registration')
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (blocks ?? []).filter(
      (b) => b.source === source && (!q || `${b.title} ${b.subtitle ?? ''} ${b.body}`.toLowerCase().includes(q)),
    )
  }, [blocks, source, query])

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Sisipkan informasi perkara"
      description="Pilih apa yang mau ditampilkan. Teksnya diletakkan di slide dan tetap bisa diedit langsung di sana."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map((s) => {
            const n = (blocks ?? []).filter((b) => b.source === s.id).length
            return (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                  source === s.id ? 'border-brand/50 bg-brand/12 text-brand-bright' : 'border-line-soft text-ink-3 hover:border-line-strong hover:text-ink-2',
                )}
              >
                <s.icon size={13} />
                {s.label}
                <span className="rounded bg-tint/8 px-1 text-[10px] tnum">{n}</span>
              </button>
            )
          })}
        </div>

        <Input icon={<Search size={13} />} placeholder="Cari…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-[12px]" />

        <div className="max-h-[52dvh] space-y-1.5 overflow-y-auto pr-1">
          {blocks === undefined ? (
            <p className="py-6 text-center text-[12px] text-ink-4">Memuat…</p>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<Search size={20} />}
              title="Tidak ada data"
              description={query ? 'Tidak ada yang cocok dengan pencarian.' : 'Bagian ini belum berisi data pada perkara ini.'}
            />
          ) : source === 'evidence' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {shown.map((b) => (
                <EvidenceCard key={b.id} block={b} onInsert={() => onInsert(b)} />
              ))}
            </div>
          ) : (
            shown.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-lg border border-line-soft bg-abyss/30 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <span className="truncate">{b.title}</span>
                    {b.imageBlobId && (
                      <span className="flex shrink-0 items-center gap-1 rounded bg-tint/8 px-1 text-[9.5px] text-ink-3">
                        <ImageIcon size={9} /> gambar
                      </span>
                    )}
                  </p>
                  {b.subtitle && <p className="truncate text-[10.5px] text-ink-4">{b.subtitle}</p>}
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-snug text-ink-3">{b.body}</p>
                </div>
                <Button size="xs" variant="outline" icon={<Plus size={11} />} onClick={() => onInsert(b)}>
                  Sisipkan
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

/** A piece of evidence as a small card: its picture (or type icon), reference,
    name and status. Clicking the card puts it on the slide. */
function EvidenceCard({ block, onInsert }: { block: InsertBlock; onInsert: () => void }) {
  const ev = block.evidence!
  const kind = EVIDENCE_KIND[ev.kind]
  const { url } = useBlobPreview(block.imageBlobId, block.imageBlobId ? 'image/*' : undefined)
  const color = EVIDENCE_COLOR[ev.status]

  return (
    <button
      onClick={onInsert}
      title={`Sisipkan ${ev.ref} ke slide`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line-soft bg-abyss/30 text-left transition-all hover:-translate-y-0.5 hover:border-brand/50"
    >
      <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line-soft bg-abyss/50">
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="tone flex size-9 items-center justify-center rounded-lg border" style={tone(kind.color)}>
            <kind.icon size={17} />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-void/60 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[10.5px] font-medium text-white">
            <Plus size={11} /> Sisipkan
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <span className="text-[10px] text-ink-4 tnum">{ev.ref}</span>
        <span className="line-clamp-2 text-[11.5px] font-medium leading-snug text-ink">{ev.name}</span>
        <span className="mt-auto">
          <Badge color={color} size="sm" dot>
            {EVIDENCE_LABEL[ev.status]}
          </Badge>
        </span>
      </span>
    </button>
  )
}
