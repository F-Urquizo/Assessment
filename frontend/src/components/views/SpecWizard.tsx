import { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import type { FormField } from '../../types';

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
 * Appraise as a one-question-at-a-time card wizard. Picking a choice on a select
 * step advances automatically; text/number steps advance on Next. The final step
 * runs the appraisal on its own — no separate "Run report" button. Drives the
 * same StudioContext form the rest of the Studio reads, so downstream views are
 * unchanged.
 */
export default function SpecWizard() {
  const { options, form, models, setField, appraise, appraising, appraised, error } =
    useStudio();
  const [step, setStep] = useState(0);

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
  const isLast = step === total - 1;
  const current = steps[step];

  const advance = () => {
    if (isLast) appraise();
    else setStep((s) => Math.min(s + 1, total - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const choose = (value: string) => {
    setField(current.name, value);
    advance();
  };

  return (
    <section className="wizard">
      <div className="form-title">Vehicle spec sheet</div>
      <div className="form-note">
        Answer one at a time — your appraisal runs automatically at the end.
      </div>

      <div
        className="wiz-progress"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div className="wiz-bar" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <div className="wiz-meta">
        Step {step + 1} of {total}
        {appraised ? ' · ✓ appraised' : ''}
      </div>

      <div className="card wiz-card">
        <div className="wiz-q">
          <span className="num">{current.num}</span> {current.label}
        </div>

        {current.kind === 'select' && (
          <div className="wiz-options">
            {current.getOptions().map((opt) => (
              <button
                key={opt}
                type="button"
                className={'wiz-opt' + (form[current.name] === opt ? ' sel' : '')}
                aria-pressed={form[current.name] === opt}
                onClick={() => choose(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {current.kind === 'model' && (
          <>
            <input
              className="wiz-input"
              list="wizModels"
              placeholder="e.g. f-150"
              value={form.model}
              autoFocus
              onChange={(e) => setField('model', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') advance();
              }}
            />
            <datalist id="wizModels">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </>
        )}

        {current.kind === 'number' && (
          <input
            className="wiz-input"
            type="number"
            value={form[current.name]}
            min={current.min}
            max={current.max}
            autoFocus
            onChange={(e) => setField(current.name, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') advance();
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
          {current.kind !== 'select' ? (
            <button
              type="button"
              className="appraise"
              onClick={advance}
              disabled={appraising}
            >
              {isLast ? 'Appraise →' : 'Next →'}
            </button>
          ) : (
            isLast && <span className="wiz-hint">pick an option to appraise</span>
          )}
        </div>
        {error && (
          <div className="error-msg" style={{ display: 'block' }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
