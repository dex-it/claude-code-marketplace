interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const presets = [
  { label: 'Сегодня', days: 0 },
  { label: '7 дней', days: 6 },
  { label: '30 дней', days: 29 },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function PeriodPicker({ from, to, onChange }: Props) {
  function applyPreset(preset) {
    const today = new Date();
    onChange(toDateInput(daysAgo(today, preset.days)), toDateInput(today));
  }

  return (
    <fieldset className="period">
      <legend>Период</legend>
      <label>
        С
        <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} />
      </label>
      <label>
        По
        <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} />
      </label>
      {presets.map((preset) => (
        <button key={preset.label} type="button" onClick={() => applyPreset(preset)}>
          {preset.label}
        </button>
      ))}
    </fieldset>
  );
}
