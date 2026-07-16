/**
 * Smooths streamed text so a reply animates in at a steady pace regardless of
 * how bursty the network delivery is. Locally, Ollama streams small deltas in
 * quick, even succession, so rendering each one as it arrives already looks
 * smooth. Over the internet (e.g. the Anthropic provider on the hosted demo),
 * deltas arrive in fewer, larger, unevenly-timed bursts, which made the reply
 * "jump" instead of animate. This buffers incoming text and reveals it a few
 * characters per animation frame, catching up faster as the backlog grows so
 * a slow burst never adds noticeable end-to-end latency.
 */
export interface TextSmoother {
  /** Feed newly-arrived text into the buffer. */
  push: (chunk: string) => void;
  /** Stop revealing gradually and flush whatever remains immediately. */
  finish: () => void;
}

const MIN_CHARS_PER_FRAME = 1;
const CATCH_UP_DIVISOR = 4;

export function createTextSmoother(onReveal: (chunk: string) => void): TextSmoother {
  let buffer = '';
  let frame: number | null = null;

  const step = () => {
    frame = null;
    if (!buffer) return;
    const take = Math.max(MIN_CHARS_PER_FRAME, Math.ceil(buffer.length / CATCH_UP_DIVISOR));
    const chunk = buffer.slice(0, take);
    buffer = buffer.slice(take);
    onReveal(chunk);
    if (buffer) frame = requestAnimationFrame(step);
  };

  return {
    push: (chunk) => {
      buffer += chunk;
      if (frame === null) frame = requestAnimationFrame(step);
    },
    finish: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (buffer) {
        onReveal(buffer);
        buffer = '';
      }
    },
  };
}
