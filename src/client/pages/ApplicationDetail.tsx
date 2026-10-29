import type { Session, Modal } from '../types.js';
import { needsFollowUp, isActive, type Activity, type Application } from '../../shared/model.js';
import { date } from '../lib/presentation.js';
import { Icon } from '../components/Icon.js';
import { Stage } from '../components/Stage.js';
import { History } from '../components/History.js';
export function ApplicationDetail({
  selected,
  session,
  setSelectedId,
  setError,
  setModal,
  today,
  activities,
}: {
  selected: Application;
  session: Session;
  setSelectedId: (value: string | null) => void;
  setError: (value: string) => void;
  setModal: (value: Modal) => void;
  today: string;
  activities: Activity[];
}) {
  return (
    <section className="detail" aria-labelledby="detail-title">
      <button className="back-button" onClick={() => setSelectedId(null)}>
        ← Back to applications
      </button>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{selected.company}</p>
          <h2 id="detail-title">{selected.role}</h2>
          <p className="detail-location">{selected.location || 'Location not recorded'}</p>
        </div>
        <Stage value={selected.stage} />
      </div>
      <div className="detail-actions">
        <button
          disabled={session.demo}
          onClick={() => {
            setError('');
            setModal({ kind: 'application', application: selected });
          }}
        >
          Edit application
        </button>
        <button
          disabled={session.demo || selected.archived}
          onClick={() => {
            setError('');
            setModal({ kind: 'note', application: selected });
          }}
        >
          <Icon name="plus" size={16} />
          Add note
        </button>
        {selected.jobUrl && (
          <a className="job-link" href={selected.jobUrl} target="_blank" rel="noreferrer">
            Original listing ↗
          </a>
        )}
        {!selected.archived && isActive(selected.stage) && (
          <button
            disabled={session.demo}
            onClick={() => {
              setError('');
              setModal({ kind: 'followup', application: selected });
            }}
          >
            Record follow-up
          </button>
        )}
        {selected.archived && <span className="badge">Archived</span>}
      </div>
      <dl className="facts">
        <div>
          <dt>Applied</dt>
          <dd>{date(selected.appliedOn)}</dd>
        </div>
        <div>
          <dt>Follow up</dt>
          <dd>
            {date(selected.followUpOn)}
            {needsFollowUp(selected, today) && <span className="due-tag">Due</span>}
          </dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>{selected.contact || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Salary / terms</dt>
          <dd>{selected.salary || 'Not recorded'}</dd>
        </div>
      </dl>
      {selected.nextAction && (
        <div className="server-notes">
          <h3>Next action</h3>
          <p>{selected.nextAction}</p>
        </div>
      )}
      {selected.applicationAddress && (
        <div className="server-notes">
          <h3>Application address / email</h3>
          <p>{selected.applicationAddress}</p>
        </div>
      )}
      <div className="server-notes">
        <h3>Cover letter</h3>
        <p>
          {selected.coverLetter || 'No cover letter saved yet. Add the letter in Edit application.'}
        </p>
      </div>
      {selected.notes && (
        <div className="server-notes">
          <h3>Application notes</h3>
          <p>{selected.notes}</p>
        </div>
      )}
      <div className="section-title">
        <h3>Application history</h3>
        <span>Notes are append-only</span>
      </div>
      <History records={activities.filter((a) => a.applicationId === selected.id)} />
    </section>
  );
}
