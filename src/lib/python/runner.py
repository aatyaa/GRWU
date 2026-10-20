"""Runs a reader's exercise code inside Pyodide (ADR 0010).

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
                source = "with snoop:\n" + textwrap.indent(code, "    ") + "\n"
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
        # The tracer ran the code inside `with snoop:`, one indent deeper; show the reader's lines.
        result["trace"] = tracer_output.getvalue()[:MAX_OUTPUT]
    return json.dumps(result)
