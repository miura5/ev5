import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { WorkspaceLine } from './WorkspaceLine';
import { Story } from './WorkspaceLine.story';

afterEach(cleanup);

test('the line shows the name, and the mark is decorative', () => {
  const { container } = render(createElement(WorkspaceLine));
  expect(screen.getByText('E.V.')).toBeTruthy();
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(screen.getByText('E.V.')).toBeTruthy();
});
