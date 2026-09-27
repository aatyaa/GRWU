import"./disclose-version.xihTtKlq.js";import{C as e,G as t,H as n,I as r,J as i,O as a,P as o,R as s,T as c,U as l,V as u,W as d,_ as f,h as p,j as m,k as h,p as g,s as _,x as v,z as y}from"./client.8b2Qjhjl.js";var b=c(`<li><button type="button" class="stop svelte-9z7aia"><span class="stop__n svelte-9z7aia"> </span> <span class="stop__name"> </span> <span class="stop__lib svelte-9z7aia"> </span></button></li>`),x=c(`<p class="idea svelte-9z7aia">The idea underneath: <a> </a></p>`),S=c(`<div class="library-route svelte-9z7aia"><ol class="route svelte-9z7aia"></ol> <div class="panel svelte-9z7aia" aria-live="polite"><p class="panel__head svelte-9z7aia"><span class="lib svelte-9z7aia"> </span> </p> <p class="svelte-9z7aia"> </p>  <pre class="code svelte-9z7aia" tabindex="0"><code> </code></pre> <p class="trap svelte-9z7aia"><b>The trap.</b> </p> <!></div></div>`);function C(a,c){t(c,!0);let C=[{id:`find`,name:`Find the data`,lib:`gwosc`,does:`A thin client over the public archive: which events exist, when they arrived, and which match a physical filter. Everything is indexed by GPS time, seconds since 6 January 1980.`,code:`from gwosc.datasets import event_gps, query_events

event_gps("GW170817")        # 1187008882.43
# every event with a component below 3 solar masses
query_events(select=["mass-1-source <= 3.0"])`,trap:`GPS time has no leap seconds. You will convert to it constantly; let the library do it.`},{id:`fetch`,name:`Fetch it and look`,lib:`gwpy`,does:`Downloads calibrated strain as a TimeSeries with plotting and spectral methods attached. The first plot worth making is the amplitude spectral density, not the trace.`,code:`from gwpy.timeseries import TimeSeries

gps = event_gps("GW190412")
data = TimeSeries.fetch_open_data(
    "L1", int(gps) - 5, int(gps) + 5, cache=True)
asd = data.asd(fftlength=4, method="median")`,trap:`cache=True, or you re-download a 4096-second file every run. method="median", so one glitch cannot redefine the spectrum.`,idea:[`The noise spectrum`,`articles/hidden-in-the-noise/`]},{id:`see`,name:`See a transient`,lib:`gwpy`,does:`A Q-transform: a time–frequency map with windows that adapt to frequency, which is exactly the shape of a chirp. It is how every press image of a merger is made.`,code:`hq = hdata.q_transform(frange=(30, 500))
plot = hq.plot()
plot.gca().set_yscale("log")`,trap:`A bright arc is a picture, not a detection. Nothing here has established significance.`},{id:`condition`,name:`Condition the data`,lib:`PyCBC`,does:`High-pass away the seismic wall, resample to what the signal needs, and crop the edges where the filter was still filling up.`,code:`from pycbc.catalog import Merger
from pycbc.filter import resample_to_delta_t, highpass

strain = Merger("GW150914").strain("H1")
strain = highpass(strain, 15.0)
strain = resample_to_delta_t(strain, 1.0 / 2048)
conditioned = strain.crop(2, 2)`,trap:`Skip the crop and you will find a magnificent signal that is entirely your own high-pass filter.`},{id:`psd`,name:`Measure the noise`,lib:`PyCBC`,does:`Estimates the noise spectrum, matches its resolution to the data, and bounds how long 1/PSD acts as a filter. This is whitening, in code.`,code:`from pycbc.psd import interpolate, inverse_spectrum_truncation

psd = conditioned.psd(4)
psd = interpolate(psd, conditioned.delta_f)
psd = inverse_spectrum_truncation(
    psd, int(4 * conditioned.sample_rate),
    low_frequency_cutoff=15)`,trap:`Without the truncation, 1/PSD can smear one glitch across the whole stretch of data.`,idea:[`Whitening is a change of ruler`,`articles/hidden-in-the-noise/#m-whiten`]},{id:`template`,name:`Build the template`,lib:`PyCBC`,does:`Asks LALSuite, the C library underneath, for a waveform model: the approximant names which one. The template must share the data’s length and sample rate.`,code:`from pycbc.waveform import get_td_waveform

hp, hc = get_td_waveform(approximant="SEOBNRv4_opt",
    mass1=36, mass2=36,
    delta_t=conditioned.delta_t, f_lower=20)
hp.resize(len(conditioned))
template = hp.cyclic_time_shift(hp.start_time)`,trap:`The approximant is not a detail. It is the strongest assumption in the analysis.`,idea:[`Waveform models`,`#waveform-models`]},{id:`search`,name:`Slide it along`,lib:`PyCBC`,does:`The matched filter, in one call. On GW150914 in Hanford it peaks at SNR 19.6 at the moment of the event.`,code:`from pycbc.filter import matched_filter

snr = matched_filter(template, conditioned,
    psd=psd, low_frequency_cutoff=20)
snr = snr.crop(4 + 4, 4)
peak = abs(snr).numpy().argmax()`,trap:`A peak is a candidate. A χ² test, a second detector and time slides make it a detection.`,idea:[`The matched filter`,`articles/hidden-in-the-noise/`]},{id:`measure`,name:`Measure the source`,lib:`Bilby`,does:`Sets up priors, a waveform generator and a likelihood, then hands them to a sampler (dynesty) that returns a posterior over every parameter at once.`,code:`result = bilby.run_sampler(
    likelihood, prior, sampler="dynesty",
    nlive=250, dlogz=1.)   # demonstration settings
result.plot_corner(prior=True)`,trap:`Fixing a parameter is an infinitely strong prior. And nlive=250 is for a tutorial: a published run uses far more and takes days.`,idea:[`Found, then measured`,`articles/from-strain-to-source/`]}],w=n(`template`),T=n(!1);f(()=>{u(T,!0)});let E=l(()=>C.find(e=>e.id===m(w))??C[0]),D=e=>e.startsWith(`#`)?e:`${c.base}${e}`;var O=S(),k=r(O);g(k,23,()=>C,e=>e.id,(t,n,a)=>{var c=b(),l=r(c),d=r(l),f=s(d,!0),p=y(d,2),g=s(p,!0),x=y(p,2),S=s(x,!0);i(l),i(c),o(()=>{_(l,`data-lib`,m(n).lib),_(l,`aria-pressed`,m(w)===m(n).id),v(f,m(a)+1),v(g,m(n).name),v(S,m(n).lib)}),h(`click`,l,()=>u(w,m(n).id,!0)),e(t,c)}),i(k);var A=y(k,2),j=r(A),M=r(j),N=s(M,!0),P=y(M);i(j);var F=y(j,2),I=s(F,!0),L=y(F,2),R=r(L),z=s(R,!0);i(L);var B=y(L,2),V=y(r(B));i(B);var H=y(B,2),U=t=>{var n=x(),a=y(r(n)),c=s(a);i(n),o(e=>{_(a,`href`,e),v(c,`${m(E).idea[0]??``} →`)},[()=>D(m(E).idea[1])]),e(t,n)};p(H,e=>{m(E).idea&&e(U)}),i(A),i(O),o(()=>{_(O,`data-hydrated`,m(T)),_(O,`data-selected`,m(w)),_(O,`data-lib`,m(E).lib),_(M,`data-lib`,m(E).lib),v(N,m(E).lib),v(P,` ${m(E).name??``}`),v(I,m(E).does),_(L,`aria-label`,`Code: ${m(E).name}`),v(z,m(E).code),v(V,` ${m(E).trap??``}`)}),e(a,O),d()}a([`click`]);export{C as default};