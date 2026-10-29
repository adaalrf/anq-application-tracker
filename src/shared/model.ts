import { z } from 'zod';
export const stages = [
  'saved',
  'applied',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
export const stageLabels: Record<(typeof stages)[number], string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interviewing',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
export const activeStages = ['saved', 'applied', 'interview', 'offer'] as const;
export const isActive = (stage: string) =>
  activeStages.includes(stage as (typeof activeStages)[number]);
const text = (max: number) => z.string().trim().max(max);
const webUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2000)
    .refine(
      (value) => ['https:', 'http:'].includes(new URL(value).protocol),
      'Use an HTTP or HTTPS URL',
    ),
]);
export const applicationInput = z
  .object({
    company: text(120).min(1),
    role: text(160).min(1),
    location: text(160),
    jobUrl: webUrl,
    contact: text(200),
    salary: text(160),
    notes: text(4000),
    coverLetter: text(20000).default(''),
    applicationAddress: text(2000).default(''),
    nextAction: text(500).default(''),
    stage: z.enum(stages),
    appliedOn: z.iso.date().nullable(),
    followUpOn: z.iso.date().nullable(),
  })
  .strict();
export const applicationUpdate = applicationInput.extend({
  version: z.number().int().positive(),
  archived: z.boolean(),
  coverLetter: text(20000).optional(),
  applicationAddress: text(2000).optional(),
  nextAction: text(500).optional(),
});
export const noteInput = z.object({ body: text(8000).min(1) }).strict();
export const followUpInput = z
  .object({
    version: z.number().int().positive(),
    followUpOn: z.iso.date().nullable(),
    body: text(7800).min(1),
    nextAction: text(500).optional(),
  })
  .strict()
  .refine((input) => input.body.length + (input.nextAction?.length || 0) <= 7900, {
    path: ['body'],
    message: 'Shorten the follow-up note or next action (7,900 characters combined).',
  });
export type ApplicationInput = z.infer<typeof applicationInput>;
export type Application = ApplicationInput & {
  id: string;
  version: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Activity = {
  id: string;
  applicationId: string;
  company: string;
  role: string;
  kind: 'created' | 'stage' | 'note';
  body: string;
  fromStage: (typeof stages)[number] | null;
  toStage: (typeof stages)[number] | null;
  createdAt: string;
};
export function localToday(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
export function needsFollowUp(
  app: Pick<Application, 'archived' | 'stage' | 'followUpOn'>,
  today = localToday(),
) {
  return !app.archived && isActive(app.stage) && app.followUpOn !== null && app.followUpOn <= today;
}
