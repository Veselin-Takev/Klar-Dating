export class DiditCanonicalJsonError extends Error {
  constructor() { super('invalid_didit_json'); }
}

type JsonNode =
  | null | boolean | string
  | { kind: 'number'; source: string }
  | JsonNode[]
  | { kind: 'object'; entries: Array<[string, JsonNode]> };

class Parser {
  private index = 0;
  constructor(private readonly source: string) {}

  parse(): JsonNode {
    this.whitespace();
    const value = this.value(0);
    this.whitespace();
    if (this.index !== this.source.length) throw new DiditCanonicalJsonError();
    return value;
  }

  private whitespace() {
    while (/[\t\n\r ]/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private value(depth: number): JsonNode {
    if (depth > 64) throw new DiditCanonicalJsonError();
    this.whitespace();
    const char = this.source[this.index];
    if (char === '"') return this.string();
    if (char === '{') return this.object(depth + 1);
    if (char === '[') return this.array(depth + 1);
    if (this.source.startsWith('true', this.index)) { this.index += 4; return true; }
    if (this.source.startsWith('false', this.index)) { this.index += 5; return false; }
    if (this.source.startsWith('null', this.index)) { this.index += 4; return null; }
    return this.number();
  }

  private string(): string {
    const start = this.index++;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (!escaped && code < 0x20) throw new DiditCanonicalJsonError();
      const char = this.source[this.index++];
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '"') {
        try { return JSON.parse(this.source.slice(start, this.index)) as string; }
        catch { throw new DiditCanonicalJsonError(); }
      }
    }
    throw new DiditCanonicalJsonError();
  }

  private number(): JsonNode {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index));
    if (!match) throw new DiditCanonicalJsonError();
    this.index += match[0].length;
    return { kind: 'number', source: match[0] };
  }

  private array(depth: number): JsonNode[] {
    this.index += 1; this.whitespace();
    const out: JsonNode[] = [];
    if (this.source[this.index] === ']') { this.index += 1; return out; }
    while (true) {
      out.push(this.value(depth)); this.whitespace();
      const char = this.source[this.index++];
      if (char === ']') return out;
      if (char !== ',') throw new DiditCanonicalJsonError();
      this.whitespace();
    }
  }

  private object(depth: number): JsonNode {
    this.index += 1; this.whitespace();
    const entries: Array<[string, JsonNode]> = [];
    const keys = new Set<string>();
    if (this.source[this.index] === '}') { this.index += 1; return { kind: 'object', entries }; }
    while (true) {
      if (this.source[this.index] !== '"') throw new DiditCanonicalJsonError();
      const key = this.string();
      if (keys.has(key)) throw new DiditCanonicalJsonError();
      keys.add(key); this.whitespace();
      if (this.source[this.index++] !== ':') throw new DiditCanonicalJsonError();
      entries.push([key, this.value(depth)]); this.whitespace();
      const char = this.source[this.index++];
      if (char === '}') return { kind: 'object', entries };
      if (char !== ',') throw new DiditCanonicalJsonError();
      this.whitespace();
    }
  }
}

function compareCodePoints(left: string, right: string): number {
  const a = [...left]; const b = [...right];
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const ac = a[index]!.codePointAt(0)!; const bc = b[index]!.codePointAt(0)!;
    if (ac !== bc) return ac - bc;
  }
  return a.length - b.length;
}

function exactWholeNumber(source: string): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) return null;
  const [, sign, whole, fraction = '', exponentText = '0'] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) throw new DiditCanonicalJsonError();
  let digits = whole + fraction;
  let shift = exponent - fraction.length;
  if (shift < 0) {
    const cut = -shift;
    if (cut > digits.length || !digits.slice(digits.length - cut).match(/^0+$/)) return null;
    digits = digits.slice(0, digits.length - cut) || '0';
    shift = 0;
  }
  if (shift > 0) digits += '0'.repeat(shift);
  digits = digits.replace(/^0+(?=\d)/, '');
  if (/^0+$/.test(digits)) return '0';
  return (sign ? '-' : '') + digits;
}

function decimalFromScientific(mantissa: string, exponent: number): string {
  const negative = mantissa.startsWith('-');
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const digits = unsigned.replace('.', '');
  const point = exponent + 1;
  const body = point <= 0
    ? '0.' + '0'.repeat(-point) + digits
    : point >= digits.length
      ? digits + '0'.repeat(point - digits.length)
      : digits.slice(0, point) + '.' + digits.slice(point);
  return (negative ? '-' : '') + body;
}

function pythonFloatRepresentation(source: string): string {
  const whole = exactWholeNumber(source);
  if (whole !== null) return whole;
  const value = Number(source);
  if (!Number.isFinite(value)) throw new DiditCanonicalJsonError();
  const [mantissa, exponentText] = value.toExponential().toLowerCase().split('e');
  const exponent = Number(exponentText);
  if (exponent >= -4 && exponent < 16) return decimalFromScientific(mantissa!, exponent);
  const sign = exponent >= 0 ? '+' : '-';
  return mantissa + 'e' + sign + String(Math.abs(exponent)).padStart(2, '0');
}

function canonical(node: JsonNode): string {
  if (node === null) return 'null';
  if (typeof node === 'boolean') return node ? 'true' : 'false';
  if (typeof node === 'string') return JSON.stringify(node);
  if (Array.isArray(node)) return '[' + node.map(canonical).join(',') + ']';
  if (node.kind === 'number') return pythonFloatRepresentation(node.source);
  return '{' + [...node.entries].sort(([a], [b]) => compareCodePoints(a, b))
    .map(([key, value]) => JSON.stringify(key) + ':' + canonical(value)).join(',') + '}';
}

export function canonicalizeDiditJsonText(source: string): string {
  if (!source || Buffer.byteLength(source, 'utf8') > 256 * 1024) throw new DiditCanonicalJsonError();
  return canonical(new Parser(source).parse());
}
