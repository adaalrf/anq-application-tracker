import type { Application } from '../shared/model.js';
export type Session = {
  demo: boolean;
  relativeDates?: boolean;
  authenticated: boolean;
  username?: string;
};
export type View = 'applications' | 'followups' | 'activity';
export type Modal =
  | { kind: 'application'; application?: Application }
  | { kind: 'note'; application: Application }
  | { kind: 'followup'; application: Application }
  | null;
