import { describe, expect, it } from 'vitest';
import { joinBase } from '~/lib/url';

describe('joinBase', () => {
  it('joins a relative path onto the base', () => {
    expect(joinBase('/GRWU/', 'about/')).toBe('/GRWU/about/');
  });

  it('drops leading slashes so the base is never bypassed', () => {
    expect(joinBase('/GRWU/', '/articles/x/')).toBe('/GRWU/articles/x/');
  });

  it('adds the missing slash between base and path', () => {
    expect(joinBase('/GRWU', 'about/')).toBe('/GRWU/about/');
  });

  it('returns the base itself for an empty path', () => {
    expect(joinBase('/GRWU/pr-preview/pr-3/')).toBe('/GRWU/pr-preview/pr-3/');
  });
});
