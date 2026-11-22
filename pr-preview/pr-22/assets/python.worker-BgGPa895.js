(function(){
/**
* @license
* Copyright 2019 Google LLC
* SPDX-License-Identifier: Apache-2.0
*/
let e=Symbol(`Comlink.proxy`),t=Symbol(`Comlink.endpoint`),n=Symbol(`Comlink.releaseProxy`),r=Symbol(`Comlink.finalizer`),i=Symbol(`Comlink.thrown`),a=e=>typeof e==`object`&&!!e||typeof e==`function`,o=/* @__PURE__ */ new Map([[`proxy`,{canHandle:t=>a(t)&&t[e],serialize(e){let{port1:t,port2:n}=new MessageChannel;return c(e,t),[n,[n]]},deserialize(e){return e.start(),d(e)}}],[`throw`,{canHandle:e=>a(e)&&i in e,serialize({value:e}){let t;return t=e instanceof Error?{isError:!0,value:{message:e.message,name:e.name,stack:e.stack}}:{isError:!1,value:e},[t,[]]},deserialize(e){throw e.isError?Object.assign(Error(e.value.message),e.value):e.value}}]]);function s(e,t){for(let n of e)if(t===n||n===`*`||n instanceof RegExp&&n.test(t))return!0;return!1}function c(e,t=globalThis,n=[`*`]){t.addEventListener(`message`,function a(o){if(!o||!o.data)return;if(!s(n,o.origin)){console.warn(`Invalid origin '${o.origin}' for comlink proxy`);return}let{id:l,type:d,path:f}=Object.assign({path:[]},o.data),p=(o.data.argumentList||[]).map(T),m;try{let t=f.slice(0,-1).reduce((e,t)=>e[t],e),n=f.reduce((e,t)=>e[t],e);switch(d){case`GET`:m=n;break;case`SET`:t[f.slice(-1)[0]]=T(o.data.value),m=!0;break;case`APPLY`:m=n.apply(t,p);break;case`CONSTRUCT`:m=C(new n(...p));break;case`ENDPOINT`:{let{port1:t,port2:n}=new MessageChannel;c(e,n),m=S(t,[t])}break;case`RELEASE`:m=void 0;break;default:return}}catch(e){m={value:e,[i]:0}}Promise.resolve(m).catch(e=>({value:e,[i]:0})).then(n=>{let[i,o]=w(n);t.postMessage(Object.assign(Object.assign({},i),{id:l}),o),d===`RELEASE`&&(t.removeEventListener(`message`,a),u(t),r in e&&typeof e[r]==`function`&&e[r]())}).catch(e=>{let[n,r]=w({value:/* @__PURE__ */ TypeError(`Unserializable return value`),[i]:0});t.postMessage(Object.assign(Object.assign({},n),{id:l}),r)})}),t.start&&t.start()}function l(e){return e.constructor.name===`MessagePort`}function u(e){l(e)&&e.close()}function d(e,t){let n=/* @__PURE__ */ new Map;return e.addEventListener(`message`,function(e){let{data:t}=e;if(!t||!t.id)return;let r=n.get(t.id);if(r)try{r(t)}finally{n.delete(t.id)}}),v(e,n,[],t)}function f(e){if(e)throw Error(`Proxy has been released and is not useable`)}function p(e){return E(e,/* @__PURE__ */ new Map,{type:`RELEASE`}).then(()=>{u(e)})}let m=/* @__PURE__ */ new WeakMap,h=`FinalizationRegistry`in globalThis&&new FinalizationRegistry(e=>{let t=(m.get(e)||0)-1;m.set(e,t),t===0&&p(e)});function g(e,t){let n=(m.get(t)||0)+1;m.set(t,n),h&&h.register(e,t,e)}function _(e){h&&h.unregister(e)}function v(e,r,i=[],a=function(){}){let o=!1,s=new Proxy(a,{get(t,a){if(f(o),a===n)return()=>{_(s),p(e),r.clear(),o=!0};if(a===`then`){if(i.length===0)return{then:()=>s};let t=E(e,r,{type:`GET`,path:i.map(e=>e.toString())}).then(T);return t.then.bind(t)}return v(e,r,[...i,a])},set(t,n,a){f(o);let[s,c]=w(a);return E(e,r,{type:`SET`,path:[...i,n].map(e=>e.toString()),value:s},c).then(T)},apply(n,a,s){f(o);let c=i[i.length-1];if(c===t)return E(e,r,{type:`ENDPOINT`}).then(T);if(c===`bind`)return v(e,r,i.slice(0,-1));let[l,u]=b(s);return E(e,r,{type:`APPLY`,path:i.map(e=>e.toString()),argumentList:l},u).then(T)},construct(t,n){f(o);let[a,s]=b(n);return E(e,r,{type:`CONSTRUCT`,path:i.map(e=>e.toString()),argumentList:a},s).then(T)}});return g(s,e),s}function y(e){return Array.prototype.concat.apply([],e)}function b(e){let t=e.map(w);return[t.map(e=>e[0]),y(t.map(e=>e[1]))]}let x=/* @__PURE__ */ new WeakMap;function S(e,t){return x.set(e,t),e}function C(t){return Object.assign(t,{[e]:!0})}function w(e){for(let[t,n]of o)if(n.canHandle(e)){let[r,i]=n.serialize(e);return[{type:`HANDLER`,name:t,value:r},i]}return[{type:`RAW`,value:e},x.get(e)||[]]}function T(e){switch(e.type){case`HANDLER`:return o.get(e.name).deserialize(e.value);case`RAW`:return e.value}}function E(e,t,n,r){return new Promise(i=>{let a=D();t.set(a,i),e.start&&e.start(),e.postMessage(Object.assign({id:a},n),r)})}function D(){return[,,,,].fill(0).map(()=>Math.floor(Math.random()*(2**53-1)).toString(16)).join(`-`)}var O=`"""Runs a reader's exercise code inside Pyodide (ADR 0010).

The code runs as a real file, so tracebacks and the step-through tracer can show its lines.
Output, errors, figures and the checker's verdict come back as one JSON string.
"""

import base64
import contextlib
import io
import json
import linecache
import os
import sys
import textwrap
import traceback
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
FILE = "/home/pyodide/exercise.py"
MAX_OUTPUT = 20_000

# matplotlib's Pyodide build warns about float pixel positions on every draw; not the reader's.
warnings.filterwarnings("ignore", message="The [xy] parameter as float")


class Feedback(Exception):
    """Raised by a checker to tell the reader what is still wrong."""


def _remember(source):
    linecache.cache[FILE] = (len(source), None, source.splitlines(True), FILE)


def _reader_traceback(error):
    """The traceback with only the reader's own frames, as CPython would print it."""
    tb = traceback.TracebackException.from_exception(error)
    tb.stack = traceback.StackSummary.from_list([f for f in tb.stack if f.filename == FILE])
    return "".join(tb.format())


def _figures():
    if "matplotlib.pyplot" not in sys.modules:
        return []
    plt = sys.modules["matplotlib.pyplot"]
    images = []
    for number in plt.get_fignums():
        buffer = io.BytesIO()
        plt.figure(number).savefig(buffer, format="png", dpi=110, bbox_inches="tight")
        images.append(base64.b64encode(buffer.getvalue()).decode())
    plt.close("all")
    return images


def run(setup, code, check, trace):
    out = io.StringIO()
    namespace = {"__name__": "__main__", "__file__": FILE}
    result = {"stdout": "", "error": None, "passed": None, "message": None, "trace": None, "figures": []}
    tracer_output = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            if setup:
                exec(compile(setup, "<setup>", "exec"), namespace)
            if trace:
                import snoop

                snoop.install(out=tracer_output, color=False, columns=())
                source = "with snoop:\\n" + textwrap.indent(code, "    ") + "\\n"
                namespace["snoop"] = snoop
            else:
                source = code
            _remember(source)
            exec(compile(source, FILE, "exec"), namespace)
        except BaseException as error:  # the reader's code may raise anything, even SystemExit
            result["error"] = _reader_traceback(error)
        result["figures"] = _figures()

    if result["error"] is None and check:
        checker = {"Feedback": Feedback}
        try:
            exec(compile(check, "<check>", "exec"), checker)
            verdict = checker["check"](namespace, out.getvalue())
            result["passed"] = True
            result["message"] = verdict if isinstance(verdict, str) else None
        except (Feedback, AssertionError) as feedback:
            result["passed"] = False
            result["message"] = str(feedback) or "Not yet: the result is not what was asked for."
        except Exception as error:
            result["passed"] = False
            result["message"] = f"Your code ran, but the checker could not use it ({type(error).__name__}: {error})."

    result["stdout"] = out.getvalue()[:MAX_OUTPUT]
    if trace:
        # The tracer ran the code inside \`with snoop:\`, one indent deeper; show the reader's lines.
        result["trace"] = tracer_output.getvalue()[:MAX_OUTPUT]
    return json.dumps(result)
`;let k={numpy:`numpy`,scipy:`scipy`,matplotlib:`matplotlib`},A=[`executing`,`asttokens`,`pygments`,`six`],j=[`extra/cheap_repr-0.5.2-py2.py3-none-any.whl`,`extra/snoop-0.6.1-py3-none-any.whl`];function M(e){e.FS.writeFile(`/home/pyodide/grwu_runner.py`,O),e.runPython(`import sys
if "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")`)}function N(e,t){e.globals.set(`_grwu_source`,t);try{let t=e.runPython(`from pyodide.code import find_imports
find_imports(_grwu_source)`),n=t.toJs();return t.destroy(),n}catch{return[]}}async function P(e,t,{setup:n=``,code:r,check:i=``,trace:a=!1,packages:o=[]}){let s=new Set(o);for(let t of N(e,`${n}\n${r}\n${i}`))k[t]&&s.add(k[t]);if(a)for(let e of A)s.add(e);let c=[...s,...a?j.map(e=>t+e):[]];c.length&&await e.loadPackage(c,{messageCallback:()=>{},errorCallback:()=>{}});let l=e.pyimport(`grwu_runner`).run;try{return JSON.parse(l(n,r,i,a))}finally{l.destroy()}}let F,I=``;c({async init(e){if(!F){I=e;let{loadPyodide:t}=await import(
/* @vite-ignore */
`${e}pyodide.mjs`);F=await t({indexURL:e}),M(F)}return F.version},run(e){if(!F)throw Error(`Python is not started`);return P(F,I,e)}})})();