import { navigationUrl } from '../navigation.js';
import { NavigationShell, BackToTop } from '../components/NavigationControls.js';
import { type ReactNode } from 'react';
import type { Session, View } from '../types.js';
import { type Activity, type Application } from '../../shared/model.js';
import { Icon } from '../components/Icon.js';
export function Workspace({
  session,
  view,
  navigate,
  due,
  logout,
  children,
}: {
  session: Session;
  view: View;
  navigate: (view: View) => void;
  due: Application[];
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="app-shell tracker">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <NavigationShell
        brand={
          <a className="logo" href={import.meta.env.BASE_URL}>
            <span>
              <Icon name="arrow" size={23} />
            </span>
            <strong>
              ANQ Next Step<small>APPLICATION WORKSPACE</small>
            </strong>
          </a>
        }
      >
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Workspace">
          {(
            [
              ['applications', 'folder', 'Applications'],
              ['followups', 'clock', 'Follow-ups'],
              ['activity', 'journal', 'Activity'],
            ] as const
          ).map(([id, icon, label]) => (
            <a
              href={navigationUrl(window.location.href, { view: id, applicationId: null })}
              key={id}
              className={view === id ? 'nav-item active' : 'nav-item'}
              aria-current={view === id ? 'page' : undefined}
              onClick={(event) => {
                if (
                  event.button ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                navigate(id);
              }}
            >
              <Icon name={icon} />
              {label}
              {id === 'followups' && (
                <span className="nav-count" aria-hidden="true">
                  {due.length}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="arrow" />
          <strong>Progress, one step at a time.</strong>
          <p>Keep the details together. Make time for the next conversation.</p>
        </div>
        <div className="workspace-user">
          <span className="avatar">
            {session.demo ? 'D' : (session.username || '').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{session.demo ? 'Demo workspace' : session.username}</strong>
            <small>{session.demo ? 'Fictional data · read-only' : 'Private workspace'}</small>
          </div>
          {!session.demo && (
            <button className="logout" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </NavigationShell>
      <BackToTop />
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>
            <strong>
              {view === 'applications'
                ? 'Applications'
                : view === 'followups'
                  ? 'Follow-ups'
                  : 'Activity'}
            </strong>
          </span>
          <a className="export" href={`${import.meta.env.BASE_URL}api/export`}>
            <Icon name="download" size={16} />
            Export JSON
          </a>
        </header>
        <main id="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
