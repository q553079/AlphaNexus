import { useEffect } from 'react'
import type { ReactNode } from 'react'

type SessionImageLightboxProps = {
  actions?: ReactNode
  children?: ReactNode
  editable?: boolean
  imageAlt: string
  imageSrc: string | null
  onClose: () => void
  open: boolean
  title: string
}

export const SessionImageLightbox = ({
  actions,
  children,
  editable = false,
  imageAlt,
  imageSrc,
  onClose,
  open,
  title,
}: SessionImageLightboxProps) => {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || !imageSrc) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="session-image-lightbox"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="session-image-lightbox__dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="session-image-lightbox__header">
          <div>
            <p className="session-image-lightbox__eyebrow">{editable ? '全屏绘图' : '全屏查看'}</p>
            <h2>{title}</h2>
          </div>
          <div className="action-row">
            {actions}
            {editable ? <span className="status-pill">直接在全屏里改标注</span> : null}
            <button className="button is-secondary" onClick={onClose} type="button">
              退出全屏
            </button>
          </div>
        </div>
        <div className={`session-image-lightbox__body ${editable ? 'is-editor' : ''}`.trim()}>
          {children ?? <img alt={imageAlt} className="session-image-lightbox__image" src={imageSrc} />}
        </div>
      </div>
    </div>
  )
}
