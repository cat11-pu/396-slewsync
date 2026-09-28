// clock.js：偏移、缓行走一步与要不要跳变
export function offsetOf(at, ref) {
  return ref - at;
}

export function stepOf(at, ref, slew) {
  const step = Math.abs(slew);
  if (ref === at) return at;
  if (ref > at) return Math.min(ref, at + step);
  return Math.max(ref, at - step);
}

export function jumpOf(offset, jump) {
  return Math.abs(offset) >= jump;
}
