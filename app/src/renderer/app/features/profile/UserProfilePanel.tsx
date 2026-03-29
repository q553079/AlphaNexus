import type { UserProfile } from '@shared/contracts/evaluation'

type UserProfilePanelProps = {
  profile: UserProfile | null
}

const renderGroup = (label: string, items: UserProfile['strengths']) => (
  <article className="compact-list__item">
    <strong>{label}</strong>
    {items.length > 0 ? (
      <div className="compact-list">
        {items.map((item) => (
          <div className="compact-list__item" key={item.id}>
            <strong>{item.label}</strong>
            <p>{item.summary}</p>
            <div className="action-row">
              <span className="status-pill">次数 {item.count}</span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p>暂无。</p>
    )}
  </article>
)

export const UserProfilePanel = ({ profile }: UserProfilePanelProps) => {
  if (!profile) {
    return <div className="empty-state">当前还没有可用的用户画像快照。</div>
  }

  return (
    <div className="compact-list">
      {renderGroup('强项', profile.strengths)}
      {renderGroup('弱项', profile.weaknesses)}
      {renderGroup('执行风格', profile.execution_style)}
      {renderGroup('AI 协同倾向', profile.ai_collaboration)}
    </div>
  )
}
