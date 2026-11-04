import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { NavGroup } from './NavGroup';
import { Story } from './NavGroup.story';

afterEach(cleanup);

test('a group label shows its text', () => {
  render(createElement(NavGroup, { label: 'Pinned' }));
  expect(screen.getByText('Pinned')).toBeTruthy();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getByText('Pinned')).toBeTruthy();
});
