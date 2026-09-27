# 4. Shipping strain as scaled float32 with a meta.json

- Status: accepted
- Date: 2026-09-27

## Context

Articles analyse real detector data in the browser. GWOSC distributes strain as HDF5,
which browsers cannot read without a large library. Strain values are of order 1e-21; in
float32 their squares (about 1e-42) fall below float32's normal range, which matters for
WebGPU, where compute is f32.

## Decision

The data pipeline (`pipeline/`, Python managed by uv) converts each dataset into a folder
under `public/data/` with:

- one raw file per channel, `<channel>.f32`: little-endian float32 samples stored as
  `physical / scale`, with `scale = 1e-21`, so values sit near 1;
- one `meta.json` with the sample rate, GPS start, number of samples, the scale, a SHA-256
  per file, the source URLs, and the licence and attribution (CC BY 4.0 for GWOSC data).

Real data is fetched by the `Data` GitHub Actions workflow, because gwosc.org is not
reachable from every development environment. A synthetic dataset (a known toy chirp in
Advanced-LIGO-like noise) is generated offline and serves as a test signal with a known
answer.

Reference outputs from numpy/scipy are written to `tests/fixtures/`; the TypeScript DSP is
tested against them.

## Consequences

- A 32 s, 4096 Hz channel is 512 KB and loads with a single `fetch` into a `Float32Array`.
- Browser code multiplies by `scale` (in float64) or keeps the scaled values for f32 GPU work.
- Checksums let the site and tests detect stale or corrupted files.
- Tests fail if the committed synthetic data or fixtures drift from the generator.
