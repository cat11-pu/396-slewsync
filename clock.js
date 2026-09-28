// clock.js：偏移、缓行走一步与要不要跳变（基线：一律给零与假）
export function offsetOf(at, ref) {
  return 0;
}

export function stepOf(at, ref, slew) {
  return at;
}

export function jumpOf(offset, jump) {
  return false;
}
