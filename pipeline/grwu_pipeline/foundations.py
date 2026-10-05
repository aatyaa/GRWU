"""Reference outputs for the foundations series' statistics, sampling and oscillator code.

Every value comes from an implementation independent of the site's TypeScript: numpy and
scipy for quantiles, correlations, windows, spectra and the oscillator's equation of motion,
emcee for the integrated autocorrelation time, and closed forms where one exists.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import emcee
import numpy as np
import scipy
from scipy import integrate, optimize, signal, stats

SEED = 20250114


def _floats(values: np.ndarray) -> list[float]:
    return [float(v) for v in np.asarray(values).ravel()]


def _hdi_brute_force(values: np.ndarray, mass: float) -> tuple[float, float]:
    """The shortest interval holding floor(mass * n) + 1 of the sorted samples, by trying all."""
    x = np.sort(values)
    n = len(x)
    inc = int(np.floor(mass * n))
    best = (np.inf, 0.0, 0.0)
    for i in range(n - inc):
        width = x[i + inc] - x[i]
        if width < best[0]:
            best = (width, x[i], x[i + inc])
    return float(best[1]), float(best[2])


def _gamma_hdi(shape: float, mass: float) -> tuple[float, float]:
    """The exact highest-density interval of a Gamma(shape, 1) density."""
    dist = stats.gamma(shape)

    def gap(lo: float) -> float:
        hi = dist.ppf(dist.cdf(lo) + mass)
        return dist.pdf(hi) - dist.pdf(lo)

    lo = optimize.brentq(gap, 1e-9, dist.ppf(1 - mass) - 1e-9, xtol=1e-14)
    return float(lo), float(dist.ppf(dist.cdf(lo) + mass))


def _oscillator(mass: float, stiffness: float, damping: float, x0: float, v0: float) -> dict:
    t = np.linspace(0.0, 4.0, 81)
    solution = integrate.solve_ivp(
        lambda _, y: [y[1], -(damping * y[1] + stiffness * y[0]) / mass],
        (0.0, 4.0),
        [x0, v0],
        t_eval=t,
        rtol=1e-11,
        atol=1e-13,
        method="DOP853",
    )
    return {
        "mass": mass,
        "stiffness": stiffness,
        "damping": damping,
        "x0": x0,
        "v0": v0,
        "t": _floats(t),
        "x": _floats(solution.y[0]),
    }


def _ringfit() -> dict:
    """One damped tone in white noise of known spread, fitted by scipy.optimize.curve_fit.

    With the noise spread given (absolute_sigma) the covariance is the inverse Fisher matrix,
    so its diagonal holds the one-sigma error bars a fit reports.
    """
    rng = np.random.default_rng(SEED + 1)
    fs = 4096.0
    sigma = 0.15
    t = np.arange(120) / fs
    truth = {"f": 250.0, "tau": 0.004, "amplitude": 1.0, "phase": 0.3}

    def model(t, f, tau, amplitude, phase):
        return amplitude * np.exp(-t / tau) * np.cos(2 * np.pi * f * t + phase)

    y = model(t, **truth) + sigma * rng.standard_normal(t.size)
    popt, pcov = optimize.curve_fit(
        model,
        t,
        y,
        p0=[240.0, 0.0035, 0.9, 0.2],
        sigma=np.full(t.size, sigma),
        absolute_sigma=True,
        maxfev=20000,
        ftol=1e-15,
        xtol=1e-15,
        gtol=1e-15,
    )
    assert popt[2] > 0
    errors = np.sqrt(np.diag(pcov))
    residual = y - model(t, *popt)
    names = ("f", "tau", "amplitude", "phase")
    fit = dict(zip(names, map(float, popt), strict=True))
    fit["phase"] = float(np.angle(np.exp(1j * popt[3])))
    return {
        "t": _floats(t),
        "y": _floats(y),
        "sigma": sigma,
        "truth": truth,
        "fit": fit,
        "errors": dict(zip(names, map(float, errors), strict=True)),
        "rss": float(residual @ residual),
    }


def build() -> dict[str, Any]:
    rng = np.random.default_rng(SEED)

    # Quantiles and credible intervals on a skewed sample.
    skewed = rng.gamma(2.0, 1.0, 401)
    probs = [0.0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1.0]
    hdi_lo, hdi_hi = _hdi_brute_force(skewed, 0.9)
    exact_lo, exact_hi = _gamma_hdi(2.0, 0.9)

    # Correlations, with ties for Spearman's average ranks.
    x = rng.standard_normal(60)
    y = 0.6 * x + 0.8 * rng.standard_normal(60)
    xt = np.round(x, 1)
    yt = np.round(y, 1)

    # An AR(1) chain: the integrated autocorrelation time is (1 + phi) / (1 - phi).
    phi = 0.8
    ar = np.empty(4000)
    ar[0] = rng.standard_normal() / np.sqrt(1 - phi**2)
    for i in range(1, len(ar)):
        ar[i] = phi * ar[i - 1] + rng.standard_normal()
    acf = emcee.autocorr.function_1d(ar)

    # Windows and aliasing.
    tukey = {
        f"{alpha}": {
            "periodic": _floats(signal.get_window(("tukey", alpha), 32, fftbins=True)),
            "symmetric": _floats(signal.windows.tukey(32, alpha, sym=True)),
        }
        for alpha in (0.0, 0.1, 0.5, 1.0)
    }
    fs = 64.0
    n = 256
    tones = [3.0, 20.0, 31.0, 45.0, 70.0, 100.0, 130.0]
    t = np.arange(n) / fs
    apparent = [
        float(np.fft.rfftfreq(n, 1 / fs)[np.argmax(np.abs(np.fft.rfft(np.cos(2 * np.pi * f * t))))])
        for f in tones
    ]

    return {
        "generator": (
            f"numpy {np.__version__}, scipy {scipy.__version__}, emcee {emcee.__version__}"
        ),
        "quantiles": {
            "input": _floats(skewed),
            "probs": probs,
            "values": _floats(np.quantile(skewed, probs)),
            "equal_tailed_90": _floats(np.quantile(skewed, [0.05, 0.95])),
            "hdi_90": [hdi_lo, hdi_hi],
            "gamma2_exact_hdi_90": [exact_lo, exact_hi],
        },
        "correlation": {
            "x": _floats(x),
            "y": _floats(y),
            "pearson": float(stats.pearsonr(x, y).statistic),
            "spearman": float(stats.spearmanr(x, y).statistic),
            "x_ties": _floats(xt),
            "y_ties": _floats(yt),
            "spearman_ties": float(stats.spearmanr(xt, yt).statistic),
            "ranks_ties": _floats(stats.rankdata(xt)),
        },
        "autocorrelation": {
            "phi": phi,
            "chain": _floats(ar),
            "acf_first_20": _floats(acf[:20]),
            "integrated_time": float(emcee.autocorr.integrated_time(ar, c=5, quiet=True)[0]),
            "exact_integrated_time": (1 + phi) / (1 - phi),
        },
        "tukey": {"n": 32, "windows": tukey},
        "aliasing": {"sample_rate": fs, "n": n, "tones": tones, "apparent": apparent},
        "ringfit": _ringfit(),
        "oscillator": {
            "released": _oscillator(1.0, 40.0, 0.8, 1.0, 0.0),
            "struck": _oscillator(0.5, 200.0, 2.0, 0.0, 3.0),
        },
    }


def write(path: Path) -> dict[str, Any]:
    fixtures = build()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixtures) + "\n")
    return fixtures
