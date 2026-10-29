import { stageLabels, type Activity, type Application } from '../../shared/model.js';
import { Icon } from '../components/Icon.js';
import { Empty } from '../components/Empty.js';
export function History({
  records,
  onOpen,
}: {
  records: Activity[];
  onOpen?: (id: string) => void;
}) {
  if (!records.length) return <Empty text="Notes and stage changes will appear here." />;
  return (
    <ol className="timeline">
      {records.map((record) => (
        <li key={record.id}>
          <span className="event-icon">
            <Icon name={record.kind === 'note' ? 'journal' : 'arrow'} size={18} />
          </span>
          <div className="event-body">
            {onOpen && (
              <button
                className="text-button history-link"
                onClick={() => onOpen(record.applicationId)}
              >
                {record.company} · {record.role}
              </button>
            )}
            <h3 className="history-title">
              {record.kind === 'created'
                ? 'Application added'
                : record.kind === 'stage'
                  ? `${stageLabels[record.fromStage!]} → ${stageLabels[record.toStage!]}`
                  : 'Note added'}
            </h3>
            <time className="event-meta" dateTime={record.createdAt}>
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(record.createdAt))}
            </time>
            {record.kind === 'note' && <p className="event-notes">{record.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
