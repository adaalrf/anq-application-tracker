import { useEffect, useRef, type FormEvent } from 'react';
import type { Modal } from '../types.js';
import { stageLabels, stages, type Application } from '../../shared/model.js';
import { date } from '../lib/presentation.js';
import { Field } from '../components/Field.js';
import { Stage } from '../components/Stage.js';
import { Dialog } from '../components/Dialog.js';
export function RecordDialog({
  modal,
  busy,
  setModal,
  setError,
  save,
  error,
}: {
  modal: Modal;
  busy: boolean;
  setModal: (value: Modal) => void;
  setError: (value: string) => void;
  save: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  error: string;
}) {
  const dirty = useRef(false);
  useEffect(() => {
    dirty.current = false;
  }, [modal]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (modal && dirty.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [modal]);
  const close = () => {
    if (busy) return;
    if (dirty.current && !window.confirm('Discard these unsaved changes?')) return;
    dirty.current = false;
    setModal(null);
    setError('');
  };
  return (
    <>
      {modal && (
        <Dialog
          title={
            modal.kind === 'note'
              ? `Add a note · ${modal.application.company}`
              : modal.kind === 'followup'
                ? `Record follow-up · ${modal.application.company}`
                : modal.application
                  ? 'Edit application'
                  : 'Add an application'
          }
          close={close}
        >
          <form
            onChange={() => {
              dirty.current = true;
            }}
            onSubmit={async (event) => {
              await save(event);
              // Failed saves keep the dialog and draft intact.
            }}
          >
            {modal.kind === 'followup' ? (
              <>
                <p className="form-help">
                  Record what happened and choose the next follow-up date. Leave the date empty to
                  mark this follow-up complete.
                </p>
                <Field label="What happened / next action">
                  <textarea name="body" rows={5} maxLength={7800} required />
                </Field>
                <Field label="Next action">
                  <input
                    name="nextAction"
                    maxLength={500}
                    defaultValue={modal.application.nextAction}
                    placeholder="What will you do next?"
                  />
                </Field>
                <Field label="Next follow-up on (optional)">
                  <input name="followUpOn" type="date" />
                </Field>
              </>
            ) : modal.kind === 'note' ? (
              <>
                <p className="form-help">
                  Record a conversation, preparation, or the next action. Notes stay in the history;
                  add a new note to clarify a previous one.
                </p>
                <Field label="Note">
                  <textarea name="body" rows={7} maxLength={8000} required />
                </Field>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <Field label="Company">
                    <input
                      name="company"
                      required
                      maxLength={120}
                      defaultValue={modal.application?.company}
                    />
                  </Field>
                  <Field label="Role">
                    <input
                      name="role"
                      required
                      maxLength={160}
                      defaultValue={modal.application?.role}
                    />
                  </Field>
                  <Field label="Location / working arrangement">
                    <input
                      name="location"
                      maxLength={160}
                      defaultValue={modal.application?.location}
                    />
                  </Field>
                  <Field label="Stage">
                    <select name="stage" defaultValue={modal.application?.stage || 'saved'}>
                      {stages.map((s) => (
                        <option key={s} value={s}>
                          {stageLabels[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Applied on">
                    <input
                      name="appliedOn"
                      type="date"
                      defaultValue={modal.application?.appliedOn || ''}
                    />
                  </Field>
                  <Field label="Follow up on">
                    <input
                      name="followUpOn"
                      type="date"
                      defaultValue={modal.application?.followUpOn || ''}
                    />
                  </Field>
                  <Field label="Contact">
                    <input
                      name="contact"
                      maxLength={200}
                      defaultValue={modal.application?.contact}
                    />
                  </Field>
                  <Field label="Salary / terms">
                    <input name="salary" maxLength={160} defaultValue={modal.application?.salary} />
                  </Field>
                </div>
                <Field label="Job listing URL">
                  <input
                    name="jobUrl"
                    type="url"
                    maxLength={2000}
                    defaultValue={modal.application?.jobUrl}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Application address / email">
                  <textarea
                    name="applicationAddress"
                    rows={2}
                    maxLength={2000}
                    defaultValue={modal.application?.applicationAddress}
                    placeholder="Email, postal address, or instructions for submitting"
                  />
                </Field>
                <Field label="Cover letter">
                  <textarea
                    name="coverLetter"
                    rows={12}
                    maxLength={20000}
                    defaultValue={modal.application?.coverLetter}
                    placeholder="Paste the letter you plan to send, or the exact text you submitted."
                  />
                </Field>
                <p className="form-help">
                  Save the application to keep your letter and details. Submitting to the employer
                  happens outside Tracker; then set the stage to Applied and record the date.
                </p>
                <Field label="Next action">
                  <input
                    name="nextAction"
                    maxLength={500}
                    defaultValue={modal.application?.nextAction}
                    placeholder="For example: tailor the letter, submit, or call the recruiter"
                  />
                </Field>
                <Field label="Application notes">
                  <textarea
                    name="notes"
                    rows={4}
                    maxLength={4000}
                    defaultValue={modal.application?.notes}
                  />
                </Field>
                {modal.application && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="archived"
                      defaultChecked={modal.application.archived}
                    />
                    Archive this application (keeps its history)
                  </label>
                )}
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Saving…'
                  : modal.kind === 'note'
                    ? 'Save note'
                    : modal.kind === 'followup'
                      ? 'Save follow-up'
                      : 'Save application'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
