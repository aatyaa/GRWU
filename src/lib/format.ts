const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function superscript(n: number): string {
  return String(n).replace(/[-0-9]/g, (c) => SUPERSCRIPT[c] ?? c);
}

/** 8.04e-24 -> "8.0 × 10⁻²⁴" */
export function scientific(value: number, digits = 1): string {
  if (value === 0 || !Number.isFinite(value)) return String(value);
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = Number((value / 10 ** exponent).toFixed(digits));
  // Rounding can carry into the next power: 9.96e-24 is 1.0 × 10⁻²³, not 10.0 × 10⁻²⁴.
  if (Math.abs(mantissa) >= 10) {
    exponent += 1;
    mantissa /= 10;
  }
  return `${mantissa.toFixed(digits)} × 10${superscript(exponent)}`;
}

/** 1e-23 -> "10⁻²³" (for decade tick labels). */
export function powerOfTen(value: number): string {
  return `10${superscript(Math.round(Math.log10(value)))}`;
}
