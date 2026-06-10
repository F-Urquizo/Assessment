import { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { useMyListings, type SellField } from '../../context/MyListingsContext';
import type { ListingStatus } from '../../lib/marketplace-types';

const STATUSES: ListingStatus[] = ['draft', 'active', 'sold'];

/**
 * Sell form (A4). Reuses the Studio's spec-sheet look (`.field`/`.select-wrap`/
 * `.spec-grid`) bound to the MyListings form state. Create or edit, then the
 * model values it on save (server-side / from the garage estimate).
 */
export default function SellForm() {
  const { options } = useStudio();
  const { form, editingId, setField, save, startNew } = useMyListings();
  const [error, setError] = useState<string | null>(null);

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = save();
    setError(r.ok ? null : (r.error ?? 'Could not save'));
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 30 }}>
      <div className="form-title">
        {editingId ? 'Edit listing' : 'List a car for sale'}
      </div>
      <div className="form-note">
        Fill the spec sheet, set an asking price and publish. The model values it
        on save and flags whether it’s a good deal.
      </div>

      <div className="spec-grid">
        <Sel
          label="Manufacturer"
          name="manufacturer"
          value={form.manufacturer}
          opts={options.manufacturers}
          onChange={setField}
        />
        <Txt label="Model" name="model" value={form.model} onChange={setField} placeholder="e.g. f-150" />
        <Txt label="Year" name="year" value={form.year} onChange={setField} type="number" />
        <Txt label="Odometer (miles)" name="odometer" value={form.odometer} onChange={setField} type="number" />
        {selects.slice(1).map((s) => (
          <Sel key={s.name} label={s.label} name={s.name} value={form[s.name]} opts={s.opts} onChange={setField} />
        ))}
      </div>

      <div className="sell-market" >
        <Txt label="Asking price ($)" name="askingPrice" value={form.askingPrice} onChange={setField} type="number" placeholder="0" />
        <Txt label="Contact email" name="contactEmail" value={form.contactEmail} onChange={setField} type="email" />
        <Txt label="Contact phone (optional)" name="contactPhone" value={form.contactPhone} onChange={setField} />
        <Sel label="Status" name="status" value={form.status} opts={STATUSES} onChange={setField} />
      </div>

      <div className="field" style={{ marginTop: 4 }}>
        <label htmlFor="sell-desc">
          <span className="num">＋</span> Description (optional)
        </label>
        <textarea
          id="sell-desc"
          className="sell-desc"
          value={form.description}
          maxLength={2000}
          onChange={(e) => setField('description', e.target.value)}
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
            setError(null);
          }}
        >
          {editingId ? 'cancel edit' : 'clear'}
        </button>
      </div>
      {error && (
        <div className="error-msg" style={{ display: 'block' }}>
          ⚠ {error}
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
}: {
  label: string;
  name: SellField;
  value: string;
  opts: string[];
  onChange: (name: SellField, value: string) => void;
}) {
  const id = `sell-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="select-wrap">
        <select id={id} value={value} onChange={(e) => onChange(name, e.target.value)}>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
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
}: {
  label: string;
  name: SellField;
  value: string;
  onChange: (name: SellField, value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = `sell-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </div>
  );
}
