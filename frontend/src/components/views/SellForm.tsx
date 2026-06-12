import { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { useMyListings, type SellField } from '../../context/MyListingsContext';
import type { ListingStatus } from '../../lib/marketplace-types';
import { STATUS_COLOR } from '../../lib/marketplace-types';
import {
  firstErrorField,
  validateSell,
  type SellErrors,
} from '../../lib/sell-validation';

const STATUSES: ListingStatus[] = ['draft', 'active', 'sold'];

/**
 * Sell form (A4). Reuses the Studio's spec-sheet look (`.field`/`.select-wrap`/
 * `.spec-grid`) bound to the MyListings form state. Validation errors render
 * inline next to each field (and focus jumps to the first one) so a single bad
 * value doesn't surface as one pooled message at the bottom of a long form.
 * On save the model values it (server-side / from the garage estimate).
 */
export default function SellForm() {
  const { options } = useStudio();
  const { form, editingId, setField, save, startNew } = useMyListings();
  const [errors, setErrors] = useState<SellErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const cylinderOptions = options.cylinders.map((c) =>
    String(Math.trunc(Number(c))),
  );

  const selects: { label: string; name: SellField; opts: string[] }[] = [
    { label: 'Manufacturer', name: 'manufacturer', opts: options.manufacturers },
    { label: 'Condition', name: 'condition', opts: options.conditions },
    { label: 'Fuel', name: 'fuel', opts: options.fuels },
    { label: 'Title status', name: 'titleStatus', opts: options.title_statuses },
    { label: 'Transmission', name: 'transmission', opts: options.transmissions },
    { label: 'Drive', name: 'drive', opts: options.drives },
    { label: 'Body type', name: 'type', opts: options.types },
    { label: 'Paint color', name: 'paintColor', opts: options.paint_colors },
    { label: 'State', name: 'state', opts: options.states },
    { label: 'Cylinders', name: 'cylinders', opts: cylinderOptions },
  ];

  // Clear a field's inline error as soon as the user edits it.
  const update = (name: SellField, value: string) => {
    setField(name, value);
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateSell(form);
    setErrors(found);
    const first = firstErrorField(found);
    if (first) {
      setFormError(null);
      document.getElementById(`sell-${first}`)?.focus();
      return;
    }
    const r = save();
    setFormError(r.ok ? null : (r.error ?? 'Could not save'));
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 30 }} noValidate>
      <div className="form-title">
        {editingId ? 'Edit listing' : 'List a car for sale'}
      </div>
      <div className="form-note">
        Fill the spec sheet, set an asking price and publish. Bluebook values it
        on save and flags whether it’s a good deal.
      </div>

      <div className="spec-grid">
        <Sel
          label="Manufacturer"
          name="manufacturer"
          value={form.manufacturer}
          opts={options.manufacturers}
          onChange={update}
          placeholder="Select…"
          error={errors.manufacturer}
        />
        <Txt label="Model" name="model" value={form.model} onChange={update} placeholder="e.g. f-150" error={errors.model} />
        <Txt label="Year" name="year" value={form.year} onChange={update} type="number" placeholder="e.g. 2019" error={errors.year} />
        <Txt label="Odometer (miles)" name="odometer" value={form.odometer} onChange={update} type="number" placeholder="e.g. 60000" error={errors.odometer} />
        {selects.slice(1).map((s) => (
          <Sel
            key={s.name}
            label={s.label}
            name={s.name}
            value={form[s.name]}
            opts={s.opts}
            onChange={update}
            placeholder="Select…"
            error={errors[s.name]}
          />
        ))}
      </div>

      <div className="sell-market" >
        <Txt label="Asking price ($)" name="askingPrice" value={form.askingPrice} onChange={update} type="number" placeholder="0" error={errors.askingPrice} />
        <Txt label="Contact email" name="contactEmail" value={form.contactEmail} onChange={update} type="email" error={errors.contactEmail} />
        <Txt label="Contact phone (optional)" name="contactPhone" value={form.contactPhone} onChange={update} />
        <Sel
          label="Status"
          name="status"
          value={form.status}
          opts={STATUSES}
          onChange={update}
          valueColor={STATUS_COLOR[form.status]}
        />
      </div>

      <div className="field" style={{ marginTop: 4 }}>
        <label htmlFor="sell-description">
          <span className="num">＋</span> Description (optional)
        </label>
        <textarea
          id="sell-description"
          className="sell-desc"
          value={form.description}
          maxLength={2000}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div className="actions">
        <button type="submit" className="appraise">
          {editingId ? 'Save changes →' : 'Publish listing →'}
        </button>
        <button
          type="button"
          className="linkbtn"
          onClick={() => {
            startNew();
            setErrors({});
            setFormError(null);
          }}
        >
          {editingId ? 'cancel edit' : 'clear'}
        </button>
      </div>
      {formError && (
        <div className="error-msg" style={{ display: 'block' }}>
          ⚠ {formError}
        </div>
      )}
    </form>
  );
}

function Sel({
  label,
  name,
  value,
  opts,
  onChange,
  placeholder,
  error,
  valueColor,
}: {
  label: string;
  name: SellField;
  value: string;
  opts: string[];
  onChange: (name: SellField, value: string) => void;
  placeholder?: string;
  error?: string;
  /** Colour (+ bold) the displayed value — used to make status state pop. */
  valueColor?: string;
}) {
  const id = `sell-${name}`;
  const errId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="select-wrap">
        <select
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          style={valueColor ? { color: valueColor, fontWeight: 700 } : undefined}
          onChange={(e) => onChange(name, e.target.value)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={errId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Txt({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
}: {
  label: string;
  name: SellField;
  value: string;
  onChange: (name: SellField, value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
}) {
  const id = `sell-${name}`;
  const errId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {error && (
        <p id={errId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
