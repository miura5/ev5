import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { JobLine } from './JobLine';
import { Story } from './JobLine.story';

afterEach(cleanup);

test('the job line shows its text and opens on click', () => {
  const onOpen = vi.fn();
  render(createElement(JobLine, { text: 'Writing practice set', step: { at: 3, of: 4 }, onOpen }));
  fireEvent.click(screen.getByRole('button', { name: /Writing practice set/ }));
  expect(onOpen).toHaveBeenCalledOnce();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getByRole('img', { name: 'Step 3 of 4' })).toBeTruthy();
});
