import type { PropsWithChildren, ReactNode } from 'react'

type SectionCardProps = PropsWithChildren<{
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}>

export const SectionCard = ({ title, subtitle, actions, className, children }: SectionCardProps) => (
  <section className={`section-card ${className ?? ''}`.trim()}>
    <header className="section-card__header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-card__actions">{actions}</div> : null}
    </header>
    <div className="section-card__body">{children}</div>
  </section>
)
