import type { FormField } from '../../types';

interface NumberFieldProps {
  num: string;
  label: string;
  name: FormField;
  value: string;
  min?: number;
  max?: number;
  onChange: (name: FormField, value: string) => void;
}

export default function NumberField({
  num,
  label,
  name,
  value,
  min,
  max,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="field">
      <label>
        <span className="num">{num}</span> {label}
      </label>
      <input
        type="number"
        name={name}
        value={value}
        min={min}
        max={max}
        required
        onChange={(e) => onChange(name, e.target.value)}
      />
    </div>
  );
}
