import"./disclose-version.xihTtKlq.js";import{A as e,B as t,E as n,F as r,G as i,H as a,K as o,L as s,M as c,S as l,U as u,W as d,Y as f,g as p,k as m,m as h,s as g,v as _,w as v,z as y}from"./client.GbVTl06e.js";var b=n(`<li><button type="button" class="stop svelte-9z7aia"><span class="stop__n svelte-9z7aia"> </span> <span class="stop__name"> </span> <span class="stop__lib svelte-9z7aia"> </span></button></li>`),x=n(`<p class="idea svelte-9z7aia">The idea underneath: <a> </a></p>`),S=n(`<div class="library-route svelte-9z7aia"><ol class="route svelte-9z7aia"></ol> <div class="panel svelte-9z7aia" aria-live="polite"><p class="panel__head svelte-9z7aia"><span class="lib svelte-9z7aia"> </span> </p> <p class="svelte-9z7aia"> </p>  <pre class="code svelte-9z7aia" tabindex="0"><code> </code></pre> <p class="trap svelte-9z7aia"><b>The trap.</b> </p> <!></div></div>`);function C(n,m){o(m,!0);let C=[{id:`find`,name:`Find the data`,lib:`gwosc`,does:`A thin client over the public archive: which events exist, when they arrived, and which match a physical filter. Everything is indexed by GPS time, seconds since 6 January 1980.`,code:`from gwosc.datasets import event_gps, query_events

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
result.plot_corner(prior=True)`,trap:`Fixing a parameter is an infinitely strong prior. And nlive=250 is for a tutorial: a published run uses far more and takes days.`,idea:[`Found, then measured`,`articles/from-strain-to-source/`]}],w=u(`template`),T=u(!1);_(()=>{a(T,!0)});let E=d(()=>C.find(e=>e.id===c(w))??C[0]),D=e=>e.startsWith(`#`)?e:`${m.base}${e}`;var O=S(),k=s(O);h(k,23,()=>C,e=>e.id,(n,i,o)=>{var u=b(),d=s(u),p=s(d),m=y(p,!0),h=t(p,2),_=y(h,!0),x=t(h,2),S=y(x,!0);f(d),f(u),r(()=>{g(d,`data-lib`,c(i).lib),g(d,`aria-pressed`,c(w)===c(i).id),l(m,c(o)+1),l(_,c(i).name),l(S,c(i).lib)}),e(`click`,d,()=>a(w,c(i).id,!0)),v(n,u)}),f(k);var A=t(k,2),j=s(A),M=s(j),N=y(M,!0),P=t(M);f(j);var F=t(j,2),I=y(F,!0),L=t(F,2),R=s(L),z=y(R,!0);f(L);var B=t(L,2),V=t(s(B));f(B);var H=t(B,2),U=e=>{var n=x(),i=t(s(n)),a=y(i);f(n),r(e=>{g(i,`href`,e),l(a,`${c(E).idea[0]??``} →`)},[()=>D(c(E).idea[1])]),v(e,n)};p(H,e=>{c(E).idea&&e(U)}),f(A),f(O),r(()=>{g(O,`data-hydrated`,c(T)),g(O,`data-selected`,c(w)),g(O,`data-lib`,c(E).lib),g(M,`data-lib`,c(E).lib),l(N,c(E).lib),l(P,` ${c(E).name??``}`),l(I,c(E).does),g(L,`aria-label`,`Code: ${c(E).name}`),l(z,c(E).code),l(V,` ${c(E).trap??``}`)}),v(n,O),i()}m([`click`]);export{C as default};