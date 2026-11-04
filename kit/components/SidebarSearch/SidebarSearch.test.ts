import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SidebarSearch } from './SidebarSearch';
import { Story } from './SidebarSearch.story';

afterEach(cleanup);

test('the search field shows its hint and opens on click', () => {
  const onOpen = vi.fn();
  render(createElement(SidebarSearch, { onOpen }));
  expect(screen.getByText('⌘K')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Search or ask/ }));
  expect(onOpen).toHaveBeenCalledOnce();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getByRole('button', { name: /Search or ask/ })).toBeTruthy();
});
