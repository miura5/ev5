import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Workspace } from './Workspace';
import { Story } from './Workspace.story';

afterEach(cleanup);

test('the workspace line shows E.V. with her mark', () => {
  render(createElement(Workspace));
  expect(screen.getByText('E.V.')).toBeTruthy();
  expect(document.querySelector('.kit-workspace-mark')).toBeTruthy();
});

test('the story renders', () => {
  render(createElement(Story));
  expect(document.querySelector("[data-ui='workspace']")).toBeTruthy();
});
