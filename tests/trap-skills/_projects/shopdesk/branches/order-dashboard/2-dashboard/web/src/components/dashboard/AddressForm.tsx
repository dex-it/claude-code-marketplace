import { useState, type FormEvent } from 'react';
import type { DeliveryAddress, DeliveryRecipient } from '../../types';

interface Props {
  initial?: DeliveryAddress;
  onSave: (address: DeliveryAddress) => Promise<void>;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function AddressForm({ initial, onSave }: Props) {
  const [city, setCity] = useState(initial?.city ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [recipients, setRecipients] = useState<DeliveryRecipient[]>(initial?.recipients ?? [{ name: '', phone: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function Field({ label, value, onChange }: FieldProps) {
    return (
      <label className="field">
        {label}
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  function updateRecipient(index: number, patch: Partial<DeliveryRecipient>) {
    setRecipients((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRecipient(index: number) {
    setRecipients((list) => list.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ city, street, recipients });
    } catch {
      setError('Не удалось сохранить адрес');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Адрес доставки</h3>
      <Field label="Город" value={city} onChange={setCity} />
      <Field label="Улица, дом" value={street} onChange={setStreet} />
      <h4>Получатели</h4>
      {recipients.map((recipient, i) => (
        <div key={i} className="recipient">
          <input
            aria-label="Имя получателя"
            defaultValue={recipient.name}
            onChange={(e) => updateRecipient(i, { name: e.target.value })}
          />
          <input
            aria-label="Телефон получателя"
            defaultValue={recipient.phone}
            onChange={(e) => updateRecipient(i, { phone: e.target.value })}
          />
          <button type="button" onClick={() => removeRecipient(i)} disabled={recipients.length === 1}>
            Удалить
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRecipients((list) => [...list, { name: '', phone: '' }])}>
        Добавить получателя
      </button>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>
        Сохранить адрес
      </button>
    </form>
  );
}
