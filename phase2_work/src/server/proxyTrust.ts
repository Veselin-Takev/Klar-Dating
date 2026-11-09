/** Numeric hop counts trust attacker-controlled XFF on shorter network paths.
 * Trust only configured ingress CIDRs; default is the direct socket identity. */
export function trustedProxyPolicy(): false | string[] {
  if (process.env.TRUST_PROXY_HOPS && process.env.TRUST_PROXY_HOPS !== '0') throw new Error('numeric_proxy_trust_forbidden');
  const configured = process.env.KLAR_TRUSTED_PROXY_CIDRS?.trim();
  if (!configured) return false;
  const cidrs = configured.split(',').map(value => value.trim());
  if (cidrs.some(value => !/^(?:\d{1,3}\.){3}\d{1,3}\/(?:[1-9]|[12]\d|3[0-2])$/.test(value) || value.startsWith('0.'))) throw new Error('invalid_trusted_proxy_cidr');
  return cidrs;
}
