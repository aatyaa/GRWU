<script lang="ts">
  import { onMount } from 'svelte';
  import { sha256Hex } from '~/lib/data/dataset';
  import { powerOfTen, scientific } from '~/lib/format';
  import { withBase } from '~/lib/url';

  /**
   * From Data File to Claim: break one link of the trail and see what happens to the claim,
   * and what would have caught it. Every wrong claim is computed at build time from the same
   * GW150914 file (lib/articles/claim.ts), not estimated. The changed byte is real: the island
   * downloads the published file, changes one byte of a copy, and fingerprints both.
   */
  interface Props {
    claim: {
      file: string;
      sha256: string;
      sampleRate: number;
      scale: number;
      event: number;
      quietest: { f: number; asd: number };
      variants: {
        rate: { f: number; asd: number; sampleRate: number };
        scale: { f: number; asd: number };
        segments: { f: number; asd: number; segments: number; segmentSeconds: number };
      };
    };
  }
  let { claim }: Props = $props();

  type Mistake = 'none' | 'rate' | 'scale' | 'byte' | 'segments';
  const OPTIONS: { id: Mistake; label: string }[] = [
    { id: 'none', label: 'Nothing: the claim as computed' },
    { id: 'rate', label: 'Assume 16,384 samples a second' },
    { id: 'scale', label: 'Forget to multiply by the scale' },
    { id: 'byte', label: 'One byte changes on the way' },
    { id: 'segments', label: 'Average 4-second segments instead' },
  ];

  let mistake = $state<Mistake>('none');
  let hydrated = $state(false);
  let hash = $state<{
    phase: 'idle' | 'loading' | 'ready' | 'error';
    original?: string;
    flipped?: string;
    before?: number;
    after?: number;
  }>({ phase: 'idle' });
  onMount(() => {
    hydrated = true;
  });

  // The sample at the moment of the event; flipping the lowest bit of its first byte changes
  // it by about one part in ten million.
  const index = $derived(Math.round(claim.event * claim.sampleRate));
  async function fingerprint() {
    if (hash.phase === 'loading' || hash.phase === 'ready') return;
    hash = { phase: 'loading' };
    try {
      const response = await fetch(withBase(`data/events/GW150914/${claim.file}`));
      if (!response.ok) throw new Error(String(response.status));
      const buffer = await response.arrayBuffer();
      const copy = buffer.slice(0);
      const view = new DataView(copy);
      const before = view.getFloat32(index * 4, true) * claim.scale;
      view.setUint8(index * 4, view.getUint8(index * 4) ^ 1);
      const after = view.getFloat32(index * 4, true) * claim.scale;
      hash = {
        phase: 'ready',
        original: await sha256Hex(buffer),
        flipped: await sha256Hex(copy),
        before,
        after,
      };
    } catch {
      hash = { phase: 'error' };
    }
  }
  $effect(() => {
    if (mistake === 'byte') void fingerprint();
  });

  const result = $derived.by(() => {
    const q = claim.quietest;
    const v = claim.variants;
    switch (mistake) {
      case 'rate':
        return { f: v.rate.f, asd: v.rate.asd, wrong: true };
      case 'scale':
        return { f: v.scale.f, asd: v.scale.asd, wrong: true };
      case 'segments':
        return { f: v.segments.f, asd: v.segments.asd, wrong: false };
      case 'byte':
        return null;
      default:
        return { f: q.f, asd: q.asd, wrong: false };
    }
  });
  const short = (h?: string) => (h ? `${h.slice(0, 16)}…` : '…');
</script>

<div
  class="break-link"
  data-hydrated={hydrated}
  data-mistake={mistake}
  data-claim-f={result ? String(result.f) : ''}
  data-hash={hash.phase}
  data-original-ok={hash.original ? String(hash.original === claim.sha256) : ''}
  data-flipped-ok={hash.flipped ? String(hash.flipped === claim.sha256) : ''}
>
  <fieldset class="options">
    <legend>Break one link</legend>
    {#each OPTIONS as o (o.id)}
      <label>
        <input type="radio" name="break-link" value={o.id} bind:group={mistake} />
        {o.label}
      </label>
    {/each}
  </fieldset>

  <div class="panel" aria-live="polite">
    {#if result}
      <p class="claim" class:wrong={result.wrong}>
        “Quietest near <b>{result.f} Hz</b>, at <b>{scientific(result.asd)}</b> per √Hz.”
      </p>
      {#if result.wrong}
        <p class="tag bias">wrong</p>
      {/if}
    {/if}

    {#if mistake === 'none'}
      <p>Every link holds. This is the claim the trail above arrived at.</p>
    {:else if mistake === 'rate'}
      <p>
        Read at the wrong rate, every frequency comes out four times too high, and the noise per √Hz
        half as large. The numbers look perfectly reasonable, which is the danger.
      </p>
      <p class="caught">
        <span>Caught by</span> reading the rate from the file’s own description, never from memory:
        it says {claim.sampleRate.toLocaleString('en-US')}.
      </p>
    {:else if mistake === 'scale'}
      <p>
        The file stores each number divided by {powerOfTen(claim.scale)}. Forget to multiply it back
        and the noise comes out {powerOfTen(1 / claim.scale)} times too large.
      </p>
      <p class="caught">
        <span>Caught by</span> a sanity check on size: LIGO measures changes in its arms a thousand
        times smaller than a proton, so strain noise near {scientific(result?.asd ?? 0, 0)} per √Hz is
        impossible.
      </p>
    {:else if mistake === 'byte'}
      {#if hash.phase === 'ready'}
        <p>
          Your browser just downloaded the file and changed one byte of a copy. The sample at the
          moment of the event went from {scientific(hash.before ?? 0, 7)} to
          {scientific(hash.after ?? 0, 7)}: a change of one part in ten million.
        </p>
        <dl class="hashes">
          <div>
            <dt>fingerprint of the file as published</dt>
            <dd>
              <code>{short(hash.original)}</code>
              {#if hash.original === claim.sha256}<span class="ok">matches</span>{/if}
            </dd>
          </div>
          <div>
            <dt>fingerprint after changing one byte</dt>
            <dd>
              <code>{short(hash.flipped)}</code>
              {#if hash.flipped !== claim.sha256}<span class="tag bias">does not match</span>{/if}
            </dd>
          </div>
        </dl>
        <p class="caught">
          <span>Caught by</span> the fingerprint: the loader refuses a file whose SHA-256 differs from
          the published one, so no claim is made from it at all.
        </p>
      {:else if hash.phase === 'error'}
        <p>The file could not be downloaded just now, so the fingerprint could not be computed.</p>
      {:else}
        <p>Downloading the file and fingerprinting it…</p>
      {/if}
    {:else if mistake === 'segments'}
      <p>
        Not a mistake but a choice. With {claim.variants.segments.segmentSeconds}-second segments
        the spectrum is finer, but only {claim.variants.segments.segments} segments are averaged, so each
        point is noisier, and the lowest of thousands of noisy points is low partly by luck.
      </p>
      <p class="caught">
        <span>Nothing to catch</span>, but the claim moved. A claim that names one frequency must
        name the method too, or claim something that does not depend on it.
      </p>
    {/if}
  </div>
</div>

<style>
  .break-link {
    width: 100%;
  }

  .options {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .options legend {
    margin-bottom: 0.4rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .options label {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
  }

  input {
    accent-color: var(--ink);
  }

  .panel {
    min-height: 13rem;
    margin-top: 1rem;
    padding: 1rem 1.1rem;
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius-1);
    background: var(--surface);
    font-size: 0.95rem;
    color: var(--ink-soft);
  }

  .panel p {
    margin: 0 0 0.6rem;
  }

  .claim {
    font-size: 1.2rem;
    color: var(--ink);
  }

  .claim.wrong {
    padding-left: 0.6rem;
    border-left: 3px solid var(--bias);
  }

  .claim b {
    font-weight: 600;
    color: var(--ink);
  }

  .tag {
    display: inline-block;
    padding: 0.05rem 0.45rem;
    border: 1px solid var(--bias);
    border-radius: 999px;
    font-family: var(--f-mono);
    font-size: 0.72rem;
    color: var(--bias);
  }

  .caught span {
    font-weight: 600;
    color: var(--ink);
  }

  .hashes {
    display: grid;
    gap: 0.5rem;
    margin: 0 0 0.8rem;
  }

  .hashes dt {
    font-size: 0.8rem;
  }

  .hashes dd {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0;
  }

  .hashes code {
    font-size: 0.85rem;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .ok {
    font-family: var(--f-mono);
    font-size: 0.72rem;
    color: var(--ok);
  }
</style>
