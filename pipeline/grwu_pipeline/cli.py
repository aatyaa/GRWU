"""Command line: ``grwu-pipeline {synthetic,fetch,fixtures}``."""

from __future__ import annotations

import argparse
from pathlib import Path

from . import fixtures, foundations, gwosc_data, kerr, synthetic
from .paths import (
    find_repo_root,
    fixtures_file,
    foundations_fixtures_file,
    kerr_fixtures_file,
    public_data,
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="grwu-pipeline", description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="GRWU repository root (default: found from the current directory)",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("synthetic", help="write the toy-chirp dataset to public/data/synthetic/")

    fetch = commands.add_parser("fetch", help="download event strain from gwosc.org")
    fetch.add_argument("--event", default="GW150914")
    fetch.add_argument("--detectors", nargs="+", default=["H1", "L1"])
    fetch.add_argument("--sample-rate", type=int, default=4096)
    fetch.add_argument("--duration", type=int, default=32, help="window length in seconds")
    fetch.add_argument(
        "--before", type=int, default=16, help="seconds of data before the event (default 16)"
    )
    fetch.add_argument(
        "--cache-dir",
        type=Path,
        default=Path(".cache"),
        help="where downloaded HDF5 files are kept (default: ./.cache)",
    )

    commands.add_parser(
        "fixtures",
        help="write reference outputs to tests/fixtures/{dsp,kerr,foundations}.json",
    )

    args = parser.parse_args(argv)
    root = args.repo_root or find_repo_root()

    if args.command == "synthetic":
        meta = synthetic.build(public_data(root))
        print(f"toy-chirp: {meta['n_samples']} samples, SNR {meta['injection']['optimal_snr']}")
    elif args.command == "fetch":
        meta = gwosc_data.fetch_event(
            public_data(root),
            args.event,
            args.detectors,
            args.cache_dir,
            sample_rate=args.sample_rate,
            duration=args.duration,
            before=args.before,
        )
        print(f"{args.event}: {', '.join(meta['channels'])} from GPS {meta['gps_start']}")
    elif args.command == "fixtures":
        for path, module in (
            (fixtures_file(root), fixtures),
            (kerr_fixtures_file(root), kerr),
            (foundations_fixtures_file(root), foundations),
        ):
            module.write(path)
            print(f"fixtures: {path.relative_to(root)}")


if __name__ == "__main__":
    main()
