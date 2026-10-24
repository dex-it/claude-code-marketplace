import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { fakeServer, renderPage } from './server';

it('M4: пустой результат поиска - «Ничего не найдено»', async () => {
  fakeServer({ auto: () => [] });
  const { input } = await renderPage();
  await userEvent.setup().type(input, 'zzz');
  expect(await screen.findByText('Ничего не найдено', undefined, { timeout: 4000 })).not.toBeNull();
});
