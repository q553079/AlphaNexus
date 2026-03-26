import type { ReactNode } from 'react'

type PageHeadingProps = {
  eyebrow: string
  title: string
  summary: string
  actions?: ReactNode
}

export const PageHeading = ({ eyebrow, title, summary, actions }: PageHeadingProps) => (
  <div className="page-heading">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="page-heading__summary">{summary}</p>
    </div>
    {actions ? <div className="page-heading__actions">{actions}</div> : null}
  </div>
)
