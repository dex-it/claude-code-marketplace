import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { fakeServer, order, pause, renderPage } from './server';

it('M1: четыре символа подряд без пауз - поисковых запросов меньше четырёх', async () => {
  const server = fakeServer({ auto: () => [order(2001, 'Кружка')] });
  const { input } = await renderPage();
  const user = userEvent.setup();
  await user.type(input, 'круж');
  await pause(1500);
  expect(server.searches.length, `запросы: ${JSON.stringify(server.searches)}`).toBeGreaterThan(0);
  expect(server.searches.length, `запросы: ${JSON.stringify(server.searches)}`).toBeLessThan(4);
});
