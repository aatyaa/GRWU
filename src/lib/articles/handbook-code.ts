/**
 * The code in "Run It Yourself", transcribed from the GW Open Data Workshop tutorials
 * (github.com/gw-odw/odw) and the GWOSC Data Guide notebook, as the handbook gives it.
 * Kept here rather than in the MDX so that comparison signs and braces stay plain text.
 */

export const silence = `
import warnings
warnings.filterwarnings("ignore", "Wswiglal-redir-stdio")
`;

export const find = `
from gwosc import datasets

# every dataset name the archive knows
datasets.find_datasets()
# just the observing runs
datasets.find_datasets(type="run")
# events a given detector took part in
datasets.find_datasets(detector="V1")
`;

export const times = `
from gwosc.datasets import event_gps, run_segment, query_events

event_gps("GW170817")    # when did it arrive
run_segment("O1")        # when did a run start and stop
# every event with a component below 3 solar masses
query_events(select=["mass-1-source <= 3.0"])
`;

export const timesOutput = `
1187008882.43
(1126051217, 1137254417)
['GW170817-v3', 'GW190425-v1', ...]
`;

export const fetchGwpy = `
from gwosc.datasets import event_gps
from gwpy.timeseries import TimeSeries

gps = event_gps("GW190412")
segment = (int(gps) - 5, int(gps) + 5)
data = TimeSeries.fetch_open_data("L1", *segment, verbose=True, cache=True)
print(data)
`;

export const fetchPycbc = `
from pycbc.catalog import Merger

merger = Merger("GW150914")
strain = merger.strain("H1")   # fetches and caches for you
`;

export const analysisSegment = `
import bilby
from gwpy.timeseries import TimeSeries

time_of_event = 1126259462.4   # GW150914
H1 = bilby.gw.detector.get_empty_interferometer("H1")
post_trigger_duration = 2
duration = 4
analysis_start = time_of_event + post_trigger_duration - duration

H1_data = TimeSeries.fetch_open_data(
    "H1", analysis_start, analysis_start + duration,
    sample_rate=4096, cache=True)
H1.set_strain_data_from_gwpy_timeseries(H1_data)
`;

export const noiseSegment = `
psd_duration = duration * 32   # 128 seconds
psd_start_time = analysis_start - psd_duration
H1_psd_data = TimeSeries.fetch_open_data(
    "H1", psd_start_time, psd_start_time + psd_duration,
    sample_rate=4096, cache=True)

psd_alpha = 2 * H1.strain_data.roll_off / duration
H1_psd = H1_psd_data.psd(fftlength=duration, overlap=0,
                         window=("tukey", psd_alpha), method="median")
H1.power_spectral_density = bilby.gw.detector.PowerSpectralDensity(
    frequency_array=H1_psd.frequencies.value, psd_array=H1_psd.value)
H1.maximum_frequency = 1024
`;

export const priors = `
import numpy as np
from bilby.core.prior import Uniform, PowerLaw

prior = bilby.core.prior.PriorDict()
prior["chirp_mass"] = Uniform(name="chirp_mass", minimum=30.0, maximum=32.5)
prior["mass_ratio"] = Uniform(name="mass_ratio", minimum=0.5, maximum=1)
prior["phase"] = Uniform(name="phase", minimum=0, maximum=2 * np.pi)
prior["geocent_time"] = Uniform(name="geocent_time",
                                minimum=time_of_event - 0.1,
                                maximum=time_of_event + 0.1)
prior["luminosity_distance"] = PowerLaw(alpha=2, minimum=50, maximum=2000, unit="Mpc")

# fixed, to keep this demonstration fast
prior["a_1"] = 0.0
prior["a_2"] = 0.0
prior["dec"] = -1.2232
prior["ra"] = 2.19432
prior["theta_jn"] = 1.89694
prior["psi"] = 0.532268
`;

export const likelihood = `
likelihood = bilby.gw.likelihood.GravitationalWaveTransient(
    [H1, L1], waveform_generator, priors=prior,
    time_marginalization=True,
    phase_marginalization=True,
    distance_marginalization=True)
`;

export const runAndRead = `
result = bilby.run_sampler(
    likelihood, prior, sampler="dynesty",
    outdir="short", label="GW150914",
    conversion_function=bilby.gw.conversion.generate_all_bbh_parameters,
    nlive=250, dlogz=1.,   # fast, NOT publication settings
    clean=True)

Mc = result.posterior["chirp_mass"].values
median = np.median(Mc)
lower, upper = np.percentile(Mc, [5, 95])
print(f"{median:.2f} (+{upper - median:.2f} / -{median - lower:.2f})")
result.plot_corner(parameters=["chirp_mass", "mass_ratio", "geocent_time", "phase"],
                   prior=True)
`;

export const guideOutput = `
For detector H1, maximum at 1126259462.4602 with SNR = 19.0
For detector L1, maximum at 1126259462.4531 with SNR = 13.4
Phase difference between H1 and L1: -2.92 radians
Time offset between H1 and L1: 0.007080 seconds
Ratio of SNRs (H1_SNR / L1_SNR): 1.4214341186505586
`;
