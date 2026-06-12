import { useStudio } from '../../context/StudioContext';
import SelectField from '../fields/SelectField';
import NumberField from '../fields/NumberField';
import type { FormField } from '../../types';

export default function SpecForm() {
  const { options, form, models, setField, appraise, resetForm, appraising, error } =
    useStudio();

  const cylinderOptions = options.cylinders.map((c) => String(Math.trunc(Number(c))));

  const selects: Array<{
    num: string;
    label: string;
    name: FormField;
    options: string[];
  }> = [
    { num: '05', label: 'Cylinders', name: 'cylinders', options: cylinderOptions },
    { num: '06', label: 'Condition', name: 'condition', options: options.conditions },
    { num: '07', label: 'Fuel', name: 'fuel', options: options.fuels },
    { num: '08', label: 'Title status', name: 'title_status', options: options.title_statuses },
    { num: '09', label: 'Transmission', name: 'transmission', options: options.transmissions },
    { num: '10', label: 'Drive', name: 'drive', options: options.drives },
    { num: '11', label: 'Body type', name: 'type', options: options.types },
    { num: '12', label: 'Paint color', name: 'paint_color', options: options.paint_colors },
    { num: '13', label: 'State', name: 'state', options: options.states },
  ];

  return (
    <section>
      <div className="form-title" style={{ marginTop: 40 }}>
        Vehicle specification sheet
      </div>
      <div className="form-note">
        Thirteen fields produce your estimate. Run the report to unlock drivers,
        forecast, deal-check and market context.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          appraise();
        }}
      >
        <div className="spec-grid">
          <SelectField
            num="01"
            label="Manufacturer"
            name="manufacturer"
            value={form.manufacturer}
            options={options.manufacturers}
            onChange={setField}
          />

          <div className="field">
            <label>
              <span className="num">02</span> Model
            </label>
            <input
              name="model"
              list="modelList"
              placeholder="e.g. f-150"
              required
              autoComplete="off"
              value={form.model}
              onChange={(e) => setField('model', e.target.value)}
            />
            <datalist id="modelList">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <NumberField
            num="03"
            label="Year"
            name="year"
            value={form.year}
            min={options.year_range[0]}
            max={options.year_range[1]}
            onChange={setField}
          />
          <NumberField
            num="04"
            label="Odometer (miles)"
            name="odometer"
            value={form.odometer}
            min={100}
            max={300000}
            onChange={setField}
          />

          {selects.map((s) => (
            <SelectField
              key={s.name}
              num={s.num}
              label={s.label}
              name={s.name}
              value={form[s.name]}
              options={s.options}
              onChange={setField}
            />
          ))}
        </div>

        <div className="actions">
          <button type="submit" className="appraise" disabled={appraising}>
            Run report →
          </button>
          <button type="button" className="linkbtn" onClick={resetForm}>
            clear sheet
          </button>
        </div>
        {error && (
          <div className="error-msg" style={{ display: 'block' }}>
            {error}
          </div>
        )}
      </form>
    </section>
  );
}
