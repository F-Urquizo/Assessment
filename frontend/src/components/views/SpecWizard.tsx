import { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import type { FormField, FormValues } from '../../types';

interface BaseStep {
  name: FormField;
  label: string;
  num: string;
}
type Step =
  | (BaseStep & { kind: 'select'; getOptions: () => string[] })
  | (BaseStep & { kind: 'model' })
  | (BaseStep & { kind: 'number'; min: number; max: number });

/**
 * Appraise as a one-question-at-a-time card wizard. After the last question the
 * wizard shows a Review screen summarising every answer — the appraisal runs
 * only when the user explicitly confirms it there (no surprise auto-run). Any
 * answered step is reachable directly via the stepper or a Review "edit" link,
 * so fixing question 2 no longer means backing through eleven cards. Drives the
 * same StudioContext form the rest of the Studio reads, so downstream views are
 * unchanged.
 */
export default function SpecWizard() {
  const { options, form, models, setField, appraise, appraising, appraised, error } =
    useStudio();
  const [step, setStep] = useState(0);
  // Furthest step the user has reached — gates forward jumps in the stepper so
  // they can't skip ahead past unanswered questions. Bumped in the forward
  // handler (never in render/effect) so it's a monotonic high-water mark.
  const [maxStep, setMaxStep] = useState(0);

  const cyl = options.cylinders.map((c) => String(Math.trunc(Number(c))));
  const steps: Step[] = [
    { kind: 'select', name: 'manufacturer', label: 'Manufacturer', num: '01', getOptions: () => options.manufacturers },
    { kind: 'model', name: 'model', label: 'Model', num: '02' },
    { kind: 'number', name: 'year', label: 'Year', num: '03', min: options.year_range[0], max: options.year_range[1] },
    { kind: 'number', name: 'odometer', label: 'Odometer (miles)', num: '04', min: 100, max: 300000 },
    { kind: 'select', name: 'cylinders', label: 'Cylinders', num: '05', getOptions: () => cyl },
    { kind: 'select', name: 'condition', label: 'Condition', num: '06', getOptions: () => options.conditions },
    { kind: 'select', name: 'fuel', label: 'Fuel', num: '07', getOptions: () => options.fuels },
    { kind: 'select', name: 'title_status', label: 'Title status', num: '08', getOptions: () => options.title_statuses },
    { kind: 'select', name: 'transmission', label: 'Transmission', num: '09', getOptions: () => options.transmissions },
    { kind: 'select', name: 'drive', label: 'Drive', num: '10', getOptions: () => options.drives },
    { kind: 'select', name: 'type', label: 'Body type', num: '11', getOptions: () => options.types },
    { kind: 'select', name: 'paint_color', label: 'Paint color', num: '12', getOptions: () => options.paint_colors },
    { kind: 'select', name: 'state', label: 'State', num: '13', getOptions: () => options.states },
  ];

  const total = steps.length;
  const isReview = step === total; // one past the last spec step
  const isLastSpec = step === total - 1;
  const current = isReview ? null : steps[step];

  // A text/number step is only "answered" once it has a value; selects are
  // answered by picking (which auto-advances). This gates Next/Enter so a blank
  // field can't slip through to the appraisal.
  const filled = !current || current.kind === 'select' || form[current.name].trim() !== '';
  const allFilled = steps.every((s) => form[s.name].trim() !== '');

  const advance = () => {
    const next = Math.min(step + 1, total);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const jumpTo = (i: number) => {
    if (i <= maxStep) setStep(i);
  };
  const choose = (value: string) => {
    if (!current) return;
    setField(current.name, value);
    advance();
  };

  return (
    <section className="wizard">
      <div className="form-title">Vehicle spec sheet</div>
      <div className="form-note">
        Answer one at a time, review your answers, then run the appraisal.
      </div>

      <div
        className="wiz-progress"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total + 1}
      >
        <div
          className="wiz-bar"
          style={{ width: `${((step + 1) / (total + 1)) * 100}%` }}
        />
      </div>

      <Stepper
        steps={steps}
        current={step}
        maxStep={maxStep}
        onJump={jumpTo}
      />

      <div className="wiz-meta">
        {isReview ? 'Review · confirm your answers' : `Step ${step + 1} of ${total}`}
        {appraised ? ' · ✓ appraised' : ''}
      </div>

      {isReview ? (
        <ReviewCard
          steps={steps}
          form={form}
          onEdit={setStep}
          onBack={back}
          onAppraise={appraise}
          appraising={appraising}
          canAppraise={allFilled}
          error={error}
        />
      ) : (
        <div className="card wiz-card">
          <div className="wiz-q">
            <span className="num">{current!.num}</span> {current!.label}
          </div>

          {current!.kind === 'select' && (
            <div className="wiz-options">
              {current!.getOptions().map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={'wiz-opt' + (form[current!.name] === opt ? ' sel' : '')}
                  aria-pressed={form[current!.name] === opt}
                  onClick={() => choose(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {current!.kind === 'model' && (
            <>
              <input
                className="wiz-input"
                list="wizModels"
                placeholder="e.g. f-150"
                value={form.model}
                autoFocus
                onChange={(e) => setField('model', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filled) advance();
                }}
              />
              <datalist id="wizModels">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          )}

          {current!.kind === 'number' && (
            <input
              className="wiz-input"
              type="number"
              value={form[current!.name]}
              min={current!.min}
              max={current!.max}
              autoFocus
              onChange={(e) => setField(current!.name, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filled) advance();
              }}
            />
          )}

          <div className="wiz-actions">
            <button
              type="button"
              className="linkbtn"
              onClick={back}
              disabled={step === 0}
            >
              ← back
            </button>
            {current!.kind !== 'select' ? (
              <button
                type="button"
                className="appraise"
                onClick={advance}
                disabled={!filled}
              >
                Next →
              </button>
            ) : (
              <span className="wiz-hint">
                {isLastSpec ? 'pick an option to review' : 'pick an option to continue'}
              </span>
            )}
          </div>
          {error && (
            <div className="error-msg" style={{ display: 'block' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Clickable progress strip — numbered chips for each question plus a Review
 *  chip. A chip is enabled once reached (`i <= maxStep`), so users can jump
 *  straight to any answered question instead of stepping back one at a time. */
function Stepper({
  steps,
  current,
  maxStep,
  onJump,
}: {
  steps: Step[];
  current: number;
  maxStep: number;
  onJump: (i: number) => void;
}) {
  const total = steps.length;
  return (
    <ol className="wiz-steps" aria-label="Spec sheet progress">
      {steps.map((s, i) => (
        <li key={s.name}>
          <button
            type="button"
            className={
              'wiz-step-dot' +
              (i === current ? ' cur' : '') +
              (i <= maxStep && i !== current ? ' done' : '')
            }
            aria-current={i === current ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${s.label}`}
            disabled={i > maxStep}
            onClick={() => onJump(i)}
          >
            {s.num}
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className={'wiz-step-dot' + (current === total ? ' cur' : '')}
          aria-current={current === total ? 'step' : undefined}
          disabled={total > maxStep}
          onClick={() => onJump(total)}
        >
          ✓
        </button>
      </li>
    </ol>
  );
}

/** Final step: a read-back of every answer with per-row edit links, then an
 *  explicit Appraise action. */
function ReviewCard({
  steps,
  form,
  onEdit,
  onBack,
  onAppraise,
  appraising,
  canAppraise,
  error,
}: {
  steps: Step[];
  form: FormValues;
  onEdit: (i: number) => void;
  onBack: () => void;
  onAppraise: () => void;
  appraising: boolean;
  canAppraise: boolean;
  error: string | null;
}) {
  return (
    <div className="card wiz-card">
      <div className="wiz-q">
        <span className="num">✓</span> Review &amp; appraise
      </div>
      <dl className="wiz-review">
        {steps.map((s, i) => (
          <div className="wiz-review-row" key={s.name}>
            <dt>{s.label}</dt>
            <dd>
              <span className="wiz-review-val">{form[s.name] || '—'}</span>
              <button
                type="button"
                className="linkbtn"
                onClick={() => onEdit(i)}
                aria-label={`Edit ${s.label}`}
              >
                edit
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="wiz-actions">
        <button type="button" className="linkbtn" onClick={onBack}>
          ← back
        </button>
        <button
          type="button"
          className="appraise"
          onClick={onAppraise}
          disabled={appraising || !canAppraise}
        >
          {appraising ? 'Appraising…' : 'Appraise →'}
        </button>
      </div>
      {error && (
        <div className="error-msg" style={{ display: 'block' }}>
          {error}
        </div>
      )}
    </div>
  );
}
