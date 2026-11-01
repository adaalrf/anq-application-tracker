import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session, View, Modal } from './types.js';
import {
  isActive,
  localToday,
  needsFollowUp,
  type Activity,
  type Application,
  type ApplicationInput,
} from '../shared/model.js';
import { date } from './lib/presentation.js';
import { Icon } from './components/Icon.js';
import { api } from './api.js';
import { SignIn } from './pages/SignIn.js';
import { Applications } from './pages/Applications.js';
import { ApplicationDetail } from './pages/ApplicationDetail.js';
import { Workspace } from './layouts/Workspace.js';
import { RecordDialog } from './components/RecordDialog.js';
import { useNavigation } from './navigation.js';
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recordHistory, setRecordHistory] = useState<Activity[]>([]);
  const [historyError, setHistoryError] = useState('');
  const { view, applicationId: selectedId, navigate: routeNavigate } = useNavigation();
  const setSelectedId = (id: string | null) => routeNavigate('applications', id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const current = await api<Session>('/session');
    if (current.demo || current.authenticated) {
      const [records, history] = await Promise.all([
        api<Application[]>('/applications'),
        api<Activity[]>('/activities?limit=500'),
      ]);
      setApplications(records);
      setActivities(history);
    }
    setSession(current);
  }, []);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  const today = localToday();
  const active = applications.filter((a) => !a.archived && isActive(a.stage));
  const due = active.filter((a) => needsFollowUp(a, today));
  const selected = applications.find((a) => a.id === selectedId);
  useEffect(() => {
    let cancelled = false;
    setRecordHistory([]);
    setHistoryError('');
    if (selectedId && (session?.demo || session?.authenticated)) {
      api<Activity[]>(`/activities?applicationId=${encodeURIComponent(selectedId)}&limit=500`)
        .then((history) => {
          if (!cancelled) setRecordHistory(history);
        })
        .catch((e) => {
          if (!cancelled) setHistoryError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedId, activities, session?.demo, session?.authenticated]);
  const visible = applications.filter(
    (a) =>
      `${a.company} ${a.role} ${a.location}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (view === 'followups'
        ? needsFollowUp(a, today)
        : filter === 'archived'
          ? a.archived
          : !a.archived && (filter === 'active' ? isActive(a.stage) : !isActive(a.stage))),
  );
  useEffect(() => {
    document.title = [
      selected
        ? `${selected.role} at ${selected.company}`
        : view === 'applications'
          ? 'Applications'
          : view === 'followups'
            ? 'Follow-ups'
            : 'Activity',
      'ANQ Next Step',
    ].join(' · ');
  }, [view, selected]);
  async function reload() {
    setError('');
    setLoading(true);
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('/login', {
        username: data.get('username'),
        password: data.get('password'),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (modal.kind === 'followup') {
        await api(`/applications/${modal.application.id}/follow-up`, {
          version: modal.application.version,
          followUpOn: String(data.get('followUpOn') || '') || null,
          body: data.get('body'),
          nextAction: data.get('nextAction'),
        });
        setNotice('Follow-up recorded and next date updated.');
      } else if (modal.kind === 'note') {
        await api(`/applications/${modal.application.id}/notes`, {
          body: data.get('body'),
        });
        setNotice('Note added to the application history.');
      } else {
        const input = Object.fromEntries(
          [
            'company',
            'role',
            'location',
            'jobUrl',
            'applicationAddress',
            'coverLetter',
            'nextAction',
            'contact',
            'salary',
            'notes',
            'stage',
          ].map((key) => [key, data.get(key)]),
        ) as Partial<ApplicationInput>;
        input.appliedOn = String(data.get('appliedOn') || '') || null;
        input.followUpOn = String(data.get('followUpOn') || '') || null;
        const current = modal.application;
        const result = await api<Application>(
          current ? `/applications/${current.id}` : '/applications',
          current
            ? {
                ...input,
                version: current.version,
                archived: data.get('archived') === 'on',
              }
            : input,
          current ? 'PUT' : 'POST',
        );
        setSelectedId(result.id);
        setNotice(current ? 'Application updated.' : 'Application added.');
      }
      setModal(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setError('');
    try {
      await api('/logout', {});
      setApplications([]);
      setActivities([]);
      setSelectedId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function navigate(next: View) {
    routeNavigate(next);
    setQuery('');
  }
  if (!session && loading)
    return (
      <div className="loading" role="status">
        Opening your workspace…
      </div>
    );
  if (!session)
    return (
      <div className="login">
        <h1>Couldn’t open the workspace</h1>
        <p role="alert">{error}</p>
        <button onClick={reload}>Try again</button>
      </div>
    );
  if (!session.demo && !session.authenticated)
    return <SignIn {...{ session, login, error, busy }} />;
  return (
    <>
      <Workspace {...{ session, view, navigate, due, logout }}>
        {session.demo && (
          <div className="demo-banner">
            <span className="demo-tag">DEMO</span>
            {session.relativeDates && <span>Sample dates are relative to today.</span>}
            <span>Fictional companies and applications. Explore freely; changes are disabled.</span>
            <a className="demo-end" href="https://adaalrf.dev/work/anq-next-step/">
              A project by Martin Røed Flyum
            </a>
          </div>
        )}
        <div className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE MORE DIRECTION.</p>
            <h1>
              {view === 'applications'
                ? 'Your next opportunity.'
                : view === 'followups'
                  ? 'Keep the conversation going.'
                  : 'The story so far.'}
            </h1>
            <p>
              {view === 'applications'
                ? 'Applications, conversations, and the next thing to do — all in one place.'
                : view === 'followups'
                  ? 'Active applications with a follow-up date of today or earlier.'
                  : 'Notes and stage changes, recorded as they happen.'}
            </p>
          </div>
          <button
            className="primary"
            disabled={session.demo}
            onClick={() => {
              setError('');
              setModal({ kind: 'application' });
            }}
          >
            <Icon name="plus" size={18} />
            Add application{session.demo && ' · Disabled in demo'}
          </button>
        </div>
        {error && !modal && (
          <div className="error" role="alert">
            {error}{' '}
            <button className="text-button" onClick={reload}>
              Reload
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button className="text-button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="stats">
          <div>
            <span className="stat-icon">
              <Icon name="folder" />
            </span>
            <span>
              In progress
              <strong>
                {active.length}
                <small>applications</small>
              </strong>
            </span>
          </div>
          <div>
            <span className="stat-icon green">
              <Icon name="journal" />
            </span>
            <span>
              Conversations
              <strong>
                {active.filter((a) => a.stage === 'interview').length}
                <small>interviewing</small>
              </strong>
            </span>
          </div>
          <div>
            <span className="stat-icon amber">
              <Icon name="clock" />
            </span>
            <span>
              Follow-ups due
              <strong>
                {due.length}
                <small>today or earlier</small>
              </strong>
            </span>
          </div>
          <div>
            <span className="stat-icon">
              <Icon name="arrow" />
            </span>
            <span>
              Offers to consider
              <strong>
                {active.filter((a) => a.stage === 'offer').length}
                <small>open offers</small>
              </strong>
            </span>
          </div>
        </div>
        {selectedId && !selected ? (
          <section className="inventory-panel">
            <p className="subtle">
              {loading
                ? 'Loading application…'
                : error
                  ? 'Unable to load this application. Use Reload to try again.'
                  : 'Application not found in this workspace.'}
            </p>
            <button onClick={() => setSelectedId(null)}>Back to applications</button>
          </section>
        ) : selected ? (
          <>
            {historyError && (
              <p className="error" role="alert">
                Couldn’t load application history: {historyError}{' '}
                <button onClick={reload}>Try again</button>
              </p>
            )}
            <ApplicationDetail
              {...{
                selected,
                session,
                setSelectedId,
                setError,
                setModal,
                today,
              }}
              activities={recordHistory}
            />
          </>
        ) : (
          <Applications
            {...{
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
            }}
          />
        )}
        <footer>
          <span>
            ANQ Next Step <span className="separator">/</span> A practical little tool by adaalrf
          </span>
          <span>Dates shown in your local time</span>
        </footer>
      </Workspace>
      <RecordDialog {...{ modal, busy, setModal, setError, save, error }} />
    </>
  );
}
