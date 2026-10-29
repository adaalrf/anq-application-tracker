import type { View } from '../types.js';
import { activeStages, stageLabels, type Activity, type Application } from '../../shared/model.js';
import { date } from '../lib/presentation.js';
import { Icon } from '../components/Icon.js';
import { Empty } from '../components/Empty.js';
import { ApplicationCard } from '../components/ApplicationCard.js';
import { History } from '../components/History.js';
export function Applications({
  view,
  filter,
  setFilter,
  query,
  setQuery,
  visible,
  activities,
  setSelectedId,
  loading,
  reload,
}: {
  view: View;
  filter: string;
  setFilter: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  visible: Application[];
  activities: Activity[];
  setSelectedId: (value: string | null) => void;
  loading: boolean;
  reload: () => Promise<void>;
}) {
  return (
    <>
      <div className="board-toolbar">
        <div className="tabs" role="group" aria-label="Application collection">
          {view === 'applications' &&
            [
              ['active', 'In progress'],
              ['closed', 'Closed'],
              ['archived', 'Archived'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                className={filter === id ? 'selected' : ''}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          {view === 'followups' && (
            <h2>
              Follow-ups due <span>{visible.length}</span>
            </h2>
          )}
          {view === 'activity' && <h2>Recent activity</h2>}
        </div>
        <label className="search">
          <Icon name="search" size={17} />
          <input
            aria-label="Search applications"
            placeholder="Search company or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {loading && (
        <p className="subtle" role="status">
          Refreshing workspace…
        </p>
      )}
      {view === 'activity' ? (
        <section className="inventory-panel">
          <History
            records={activities.filter((a) =>
              `${a.company} ${a.role} ${a.body}`.toLowerCase().includes(query.toLowerCase()),
            )}
            onOpen={(id) => {
              setSelectedId(id);
            }}
          />
        </section>
      ) : query.trim() && !visible.length ? (
        <section className="inventory-panel">
          <Empty text="No applications match this search. Try another company or role." />
          <button className="text-button" onClick={() => setQuery('')}>
            Clear search
          </button>
        </section>
      ) : view === 'applications' && filter === 'active' ? (
        <div className="board-scroll" aria-label="Application pipeline">
          <div className="board">
            {activeStages.map((stage) => (
              <section
                className={`board-column column-${stage}`}
                key={stage}
                aria-label={`${stageLabels[stage]} applications`}
              >
                <div className="column-title">
                  <h2>
                    <span aria-hidden="true" />
                    {stageLabels[stage]}
                  </h2>
                  <span>{visible.filter((a) => a.stage === stage).length}</span>
                </div>
                {visible
                  .filter((a) => a.stage === stage)
                  .map((a) => (
                    <ApplicationCard key={a.id} application={a} onOpen={setSelectedId} />
                  ))}
                {!visible.some((a) => a.stage === stage) && (
                  <p className="column-empty">No applications here yet.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : visible.length ? (
        <section className="application-list">
          {visible
            .sort((a, b) => (a.followUpOn || '9999').localeCompare(b.followUpOn || '9999'))
            .map((a) => (
              <ApplicationCard key={a.id} application={a} onOpen={setSelectedId} showStage />
            ))}
        </section>
      ) : (
        <section className="inventory-panel">
          <Empty
            text={
              view === 'followups'
                ? 'No follow-ups are due. Set a date on an active application to keep it in view.'
                : 'Try another search or collection, or add an application to get started.'
            }
          />
        </section>
      )}
      <div className="list-footer">
        <span>
          {view === 'activity'
            ? 'Most recent 500 records · export includes all history'
            : 'Your notes, your pace. No applications are submitted automatically.'}
        </span>
        <button className="text-button" onClick={reload} disabled={loading}>
          Refresh workspace
        </button>
      </div>
    </>
  );
}
