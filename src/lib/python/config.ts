import { version } from 'pyodide/package.json';

/** Pinned by package.json: the loader we bundle and the runtime we fetch must match exactly. */
export const PYODIDE_VERSION: string = version;

/** Pyodide's full distribution (runtime and packages such as numpy and scipy). */
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
