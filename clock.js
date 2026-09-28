// clock.js：偏移、缓行走一步与要不要跳变
export function offsetOf(at, ref) {
  return ref - at;
}

export function stepOf(at, ref, slew) {
  if (at < ref) {
    return Math.min(at + slew, ref);
  }
  if (at > ref) {
    return Math.max(at - slew, ref);
  }
  return ref;
}

export function jumpOf(offset, jump) {
  return Math.abs(offset) >= jump;
}
