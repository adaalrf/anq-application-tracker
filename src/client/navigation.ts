import { useEffect, useState } from 'react';
import type { View } from './types.js';
export type Navigation = { view: View; applicationId: string | null };
export function readNavigation(search: string): Navigation {
  const params = new URLSearchParams(search);
  const raw = params.get('view');
  const view: View = raw === 'followups' || raw === 'activity' ? raw : 'applications';
  return {
    view,
    applicationId: view === 'applications' ? params.get('application') || null : null,
  };
}
export function navigationUrl(href: string, next: Navigation) {
  const url = new URL(href);
  url.searchParams.delete('view');
  url.searchParams.delete('application');
  if (next.view !== 'applications') url.searchParams.set('view', next.view);
  if (next.view === 'applications' && next.applicationId)
    url.searchParams.set('application', next.applicationId);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function useNavigation() {
  const [state, setState] = useState(() => readNavigation(location.search));
  useEffect(() => {
    const pop = () => setState(readNavigation(location.search));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  function navigate(view: View, applicationId: string | null = null) {
    const next = {
      view,
      applicationId: view === 'applications' ? applicationId : null,
    };
    const url = navigationUrl(location.href, next);
    if (url !== `${location.pathname}${location.search}${location.hash}`)
      history.pushState(null, '', url);
    setState(next);
  }
  return { ...state, navigate };
}
