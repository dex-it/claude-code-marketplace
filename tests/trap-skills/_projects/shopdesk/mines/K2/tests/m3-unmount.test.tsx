import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fakeServer, order, pause, renderPage } from './server';

it('M3: размонтирование до ответа - новых запросов после unmount нет, ошибок React нет', async () => {
  const server = fakeServer({});
  const { view, input } = await renderPage();
  const user = userEvent.setup();
  await user.type(input, 'x');

  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const before = server.searches.length;
  view.unmount();
  await pause(1500);
  const after = server.searches.length;
  server.respondAll([order(2003, 'Икс')]);
  await pause(200);
  const logged = errors.mock.calls.map((args) => String(args[0]));
  errors.mockRestore();

  expect(after, `запросы после unmount: ${JSON.stringify(server.searches.slice(before))}`).toBe(before);
  expect(logged).toEqual([]);
});
