import type { Token } from '../../types/reading';

/** A content word (verb/adjective) plus its trailing run of auxiliaries,
 * e.g. あり+まし+た for ありました. Hovering any member token shows one
 * popover for the whole chain instead of three separate ones. */
export interface InflectionChain {
  /** Index of the content-word head token (e.g. あり). */
  start: number;
  /** Index of the last auxiliary in the chain, inclusive (e.g. た). */
  end: number;
  /** Short English labels for the auxiliaries, in surface order, e.g. ["polite", "past"]. */
  tags: string[];
}

const CHAIN_HEAD_POS = new Set(['verb', 'adjective', 'adjectival noun']);

// Auxiliary lemmas that continue an inflection chain, mapped to the short tag
// shown in the popover. Curated allowlist (mirrors the spirit of
// backend/app/japanese/tokenizer.py's _FUSED_PARTICLES): only auxiliaries
// whose lemma reliably signals one grammatical role are included, so a chain
// never swallows a token that deserves its own explanation.
const AUX_TAGS: Record<string, string> = {
  ます: 'polite',
  です: 'polite',
  た: 'past',
  だ: 'plain',
  ない: 'negative',
  たい: 'desire',
  れる: 'passive',
  られる: 'passive',
  せる: 'causative',
  させる: 'causative',
  そう: 'seeming',
  らしい: 'hearsay',
};

/**
 * Find every inflection chain in `tokens`: a content word followed by one or
 * more auxiliaries whose lemma is in `AUX_TAGS`. Chains never overlap, and a
 * single content word with no recognized auxiliary tail is not a chain.
 */
export function findInflectionChains(tokens: Token[]): InflectionChain[] {
  const chains: InflectionChain[] = [];
  let i = 0;
  while (i < tokens.length) {
    const head = tokens[i];
    if (head.interactive && CHAIN_HEAD_POS.has(head.pos)) {
      const tags: string[] = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].pos === 'auxiliary') {
        const tag = AUX_TAGS[tokens[j].lemma];
        if (!tag) break;
        tags.push(tag);
        j++;
      }
      if (j > i + 1) {
        chains.push({ start: i, end: j - 1, tags: Array.from(new Set(tags)) });
        i = j;
        continue;
      }
    }
    i++;
  }
  return chains;
}

/** Map every token index to the chain it belongs to, for O(1) hover lookup. */
export function indexInflectionChains(chains: InflectionChain[]): Map<number, InflectionChain> {
  const map = new Map<number, InflectionChain>();
  for (const chain of chains) {
    for (let i = chain.start; i <= chain.end; i++) map.set(i, chain);
  }
  return map;
}
