import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { deleteCase } from '@/domain/deleteCase'
import { Button, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/stores/toast'

/**
 * Deleting a case takes everything filed under it, so the code has to be typed
 * back — a stray click on the bin cannot do it.
 */
export function DeleteCaseModal({ caseId, code, title, onClose }: { caseId: string; code: string; title: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = typed.trim().toUpperCase() === code.toUpperCase()

  const remove = async () => {
    if (!ok) return
    setBusy(true)
    try {
      await deleteCase(caseId)
      toast.success('Case deleted', `${code} and everything filed under it were removed.`)
      navigate('/cases', { replace: true })
    } catch {
      toast.error('Case not deleted', 'Something went wrong; nothing was removed.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Delete ${code}?`}
      description="This permanently removes the case with its board, SPRINT, interviews, evidence, reports, decks and files. It cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" icon={<Trash2 size={13} />} onClick={remove} disabled={!ok} loading={busy}>
            Delete case
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[12.5px] leading-relaxed text-ink-3">
        <span className="font-medium text-ink-2">{title}</span>. Type <span className="font-semibold text-ink tnum">{code}</span> to
        confirm.
      </p>
      <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={code} aria-label="Case code" />
    </Modal>
  )
}
