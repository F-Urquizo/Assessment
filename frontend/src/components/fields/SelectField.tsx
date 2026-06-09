import type { FormField } from '../../types';

interface SelectFieldProps {
  num: string;
  label: string;
  name: FormField;
  value: string;
  options: string[];
  onChange: (name: FormField, value: string) => void;
}

export default function SelectField({
  num,
  label,
  name,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <div className="field">
      <label>
        <span className="num">{num}</span> {label}
      </label>
      <div className="select-wrap">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
