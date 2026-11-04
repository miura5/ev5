import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ThemeButton } from './ThemeButton';
import { Story } from './ThemeButton.story';

afterEach(cleanup);

test('the button names the other theme and toggles on click', () => {
  const onToggle = vi.fn();
  render(createElement(ThemeButton, { theme: 'dark', onToggle }));
  fireEvent.click(screen.getByRole('button', { name: /Light theme/ }));
  expect(onToggle).toHaveBeenCalledOnce();
  cleanup();
  render(createElement(ThemeButton, { theme: 'light' }));
  expect(screen.getByRole('button', { name: /Dark theme/ })).toBeTruthy();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getAllByRole('button')).toHaveLength(2);
});
