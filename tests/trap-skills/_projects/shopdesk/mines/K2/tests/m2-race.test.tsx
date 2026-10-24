import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { fakeServer, order, pause, renderPage } from './server';

it('M2: ответ на устаревший запрос пришёл последним - на экране результаты последнего запроса', async () => {
  const server = fakeServer({});
  const { input } = await renderPage();
  const user = userEvent.setup();

  await user.type(input, 'a');
  await pause(2500);
  await user.type(input, 'b');
  await pause(2500);
  expect(server.searches, 'ожидались запросы a и ab').toEqual(expect.arrayContaining(['a', 'ab']));

  server.respond('ab', [order(2002, 'Абрикосовый чай')]);
  await pause(200);
  try {
    server.respond('a', [order(2001, 'Альфа-кружка')]);
  } catch {
    // запрос "a" уже отменён - ответить на него нечем
  }
  await pause(500);

  expect(screen.queryByText('Заказ #2002')).not.toBeNull();
  expect(screen.queryByText('Заказ #2001')).toBeNull();
});
