import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTextSmoother } from './textSmoother';

describe('createTextSmoother', () => {
  let frameCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const runFrame = () => {
    const cb = frameCallbacks.shift();
    cb?.(0);
  };

  it('reveals a large burst gradually across frames instead of all at once', () => {
    const revealed: string[] = [];
    const smoother = createTextSmoother((chunk) => revealed.push(chunk));

    smoother.push('a'.repeat(20));
    expect(revealed).toEqual([]); // nothing revealed synchronously

    runFrame();
    expect(revealed.length).toBe(1);
    expect(revealed[0].length).toBeLessThan(20); // partial reveal, not a dump

    while (frameCallbacks.length > 0) runFrame();
    expect(revealed.join('').length).toBe(20); // fully caught up after a few frames
    expect(revealed.length).toBeGreaterThan(1); // revealed across multiple frames, not one
  });

  it('flush on finish emits any remaining buffered text immediately', () => {
    const revealed: string[] = [];
    const smoother = createTextSmoother((chunk) => revealed.push(chunk));

    smoother.push('hello world');
    smoother.finish();

    expect(revealed.join('')).toBe('hello world');
  });

  it('keeps accepting new chunks mid-stream without losing text', () => {
    const revealed: string[] = [];
    const smoother = createTextSmoother((chunk) => revealed.push(chunk));

    smoother.push('foo');
    runFrame();
    smoother.push('bar');
    smoother.finish();

    expect(revealed.join('')).toBe('foobar');
  });
});
