# GRWU data pipeline

Prepares the data the site ships and the reference outputs its tests compare against.
Run everything from this directory with [uv](https://docs.astral.sh/uv/).

```sh
uv sync
uv run grwu-pipeline synthetic   # toy chirp in coloured noise -> ../public/data/synthetic/
uv run grwu-pipeline fixtures    # scipy and qnm reference outputs -> ../tests/fixtures/
uv run grwu-pipeline fetch --event GW150914 --detectors H1 L1   # needs gwosc.org
uv run pytest
uv run ruff check && uv run ruff format --check
```

`fetch` needs network access to gwosc.org. When it is not available (as in Claude Code on
the web by default), run the **Data** workflow on GitHub Actions instead; it pushes the
result to a `data/...` branch.

## Data format

Each dataset is a folder with one `meta.json` and one raw file per channel:
little-endian float32 samples, stored divided by `scale` (physical value = stored × scale),
so strain of order 1e-21 sits near 1 and stays precise in float32 and on the GPU.
`meta.json` records the sample rate, GPS start time, a SHA-256 per file, the source and
the licence.
