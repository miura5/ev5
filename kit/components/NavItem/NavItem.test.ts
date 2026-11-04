import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NavItem } from './NavItem';
import { Story } from './NavItem.story';

afterEach(cleanup);

test('a nav item shows its count and opens on click', () => {
  const onOpen = vi.fn();
  render(createElement(NavItem, { label: 'Today', count: 4, onOpen }));
  expect(screen.getByText('4')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Today/ }));
  expect(onOpen).toHaveBeenCalledOnce();
});

test('a zero or missing count shows nothing, and the selected item is the current page', () => {
  render(createElement(NavItem, { label: 'Activity', count: 0, selected: true }));
  expect(screen.getByRole('button').getAttribute('aria-current')).toBe('page');
  expect(document.querySelector('.kit-nav-count')).toBeNull();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getByRole('button', { name: /Ask E.V./ })).toBeTruthy();
});
