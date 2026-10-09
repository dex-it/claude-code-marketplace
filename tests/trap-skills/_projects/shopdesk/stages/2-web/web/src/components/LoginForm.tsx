import { useState, type FormEvent } from 'react';
import { ApiError, login } from '../api';

interface Props {
  onLoggedIn: () => void;
}

export function LoginForm({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Неверный email или пароль' : 'Сервис недоступен, попробуйте позже');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Вход в Shopdesk</h1>
      <p>
        <label htmlFor="login-email">Email</label>
        <br />
        <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </p>
      <p>
        <label htmlFor="login-password">Пароль</label>
        <br />
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        Войти
      </button>
    </form>
  );
}
