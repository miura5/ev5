import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { AreaIcon } from './AreaIcon';
import { Story } from './AreaIcon.story';

afterEach(cleanup);

test('a known area and an unknown one both draw a path', () => {
  const { container } = render(
    createElement('div', null, createElement(AreaIcon, { name: 'today' }), createElement(AreaIcon, { name: 'zzz' })),
  );
  const paths = container.querySelectorAll('svg path');
  expect(paths).toHaveLength(2);
  expect(paths[0]?.getAttribute('d')).not.toBe(paths[1]?.getAttribute('d'));
});

test('the story renders every icon', () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll('[data-ui="area-icon"]')).toHaveLength(8);
});
