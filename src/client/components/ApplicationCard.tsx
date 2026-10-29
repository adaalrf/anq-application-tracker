import type { View } from '../types.js';
import { isActive, needsFollowUp, type Application } from '../../shared/model.js';
import { date } from '../lib/presentation.js';
import { Icon } from '../components/Icon.js';
import { Stage } from '../components/Stage.js';
export function ApplicationCard({
  application: a,
  onOpen,
  showStage,
}: {
  application: Application;
  onOpen: (id: string) => void;
  showStage?: boolean;
}) {
  return (
    <button
      className="application-card"
      onClick={() => onOpen(a.id)}
      aria-label={`View ${a.role} at ${a.company}`}
    >
      <span className="company-monogram" aria-hidden="true">
        {a.company.slice(0, 1)}
      </span>
      <span className="card-company">{a.company}</span>
      <strong>{a.role}</strong>
      <span className="card-location">{a.location || 'Location not recorded'}</span>
      {showStage && <Stage value={a.stage} />}
      {a.nextAction && <span className="card-next-action">Next: {a.nextAction}</span>}
      <span className="card-divider" />
      <span className={`card-followup ${needsFollowUp(a) ? 'is-due' : ''}`}>
        <Icon name="clock" size={13} />
        {a.followUpOn && isActive(a.stage)
          ? `Follow up ${date(a.followUpOn)}`
          : a.appliedOn
            ? `Applied ${date(a.appliedOn)}`
            : 'Ready when you are'}
        {needsFollowUp(a) && <span className="due-tag">Due</span>}
      </span>
    </button>
  );
}
