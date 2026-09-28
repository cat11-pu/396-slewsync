// clockrun.js：按处理预算处理事件，用尽压账，收尾把账做完
import { offsetOf, stepOf, jumpOf } from "./clock.js";

const JUMP_TAG = "跳变";
const SLEW_TAG = "缓行";

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNonEmptyName(value) {
  return typeof value === "string" && value.length > 0;
}

function code(spec, key, fallback) {
  return typeof spec[key] === "string" && spec[key].length > 0 ? spec[key] : fallback;
}

function cloneState(state) {
  const source = state || {};
  return {
    nodes: Array.isArray(source.nodes) ? source.nodes.map(function (row) { return [row[0], row[1]]; }) : [],
    syncs: Array.isArray(source.syncs) ? source.syncs.map(function (row) { return [row[0], row[1], row[2]]; }) : [],
    jumps: source.jumps || 0,
    slews: source.slews || 0,
    ledger: Array.isArray(source.ledger) ? source.ledger.map(function (row) { return row.slice(); }) : [],
    applied: Array.isArray(source.applied) ? source.applied.map(function (row) { return row.slice(); }) : []
  };
}

function appliedIds(state) {
  const ids = new Set();
  for (const row of state.applied) {
    if (row[3] !== undefined && row[3] !== null) ids.add(row[3]);
  }
  return ids;
}

// 校验并落一条请求 [kind, name, stamp, id]；不合法直接抛码。
function serveEntry(state, entry, spec) {
  const kind = entry[0];
  if (kind !== "add" && kind !== "sync") {
    fail(code(spec, "event_error_code", "E_BAD_EVENT"));
  }
  const name = entry[1];
  const stamp = entry[2];
  if (!isNonEmptyName(name)) {
    fail(code(spec, "bad_name_code", "E_BAD_NAME"));
  }
  if (!isNonNegInt(stamp)) {
    fail(kind === "add"
      ? code(spec, "bad_at_code", "E_BAD_AT")
      : code(spec, "bad_ref_code", "E_BAD_REF"));
  }
  const index = nodeIndex(state, name);
  if (kind === "add") {
    if (index >= 0) fail(code(spec, "dup_code", "E_DUP_NAME"));
    state.nodes.push([name, stamp]);
    state.nodes.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  } else {
    if (index < 0) fail(code(spec, "no_node_code", "E_NO_NODE"));
    const at = state.nodes[index][1];
    const offset = offsetOf(at, stamp);
    if (jumpOf(offset, spec.jump)) {
      state.nodes[index][1] = stamp;
      state.syncs.push([name, offset, JUMP_TAG]);
      state.jumps += 1;
    } else {
      state.nodes[index][1] = stepOf(at, stamp, spec.slew);
      state.syncs.push([name, offset, SLEW_TAG]);
      state.slews += 1;
    }
  }
  state.applied.push([kind, name, stamp, entry[3] === undefined ? null : entry[3]]);
}

function nodeIndex(state, name) {
  for (let i = 0; i < state.nodes.length; i += 1) {
    if (state.nodes[i][0] === name) return i;
  }
  return -1;
}

function normalizeEvents(events) {
  return (Array.isArray(events) ? events : []).map(function (event) {
    if (!event || typeof event !== "object"
      || (event.kind !== "add" && event.kind !== "sync")) {
      return { tuple: null, id: null };
    }
    return {
      tuple: event.kind === "add"
        ? ["add", event.name, event.at]
        : ["sync", event.name, event.ref],
      id: event.id === undefined ? null : event.id
    };
  });
}

export function step(spec) {
  const source = spec || {};
  const state = cloneState(source.state);
  const ledgerBefore = state.ledger.length;
  const events = normalizeEvents(source.events);
  const queue = [];
  for (const row of state.ledger) {
    queue.push({ tuple: row, id: row[3] === undefined ? null : row[3] });
  }
  for (const item of events) {
    queue.push({ tuple: item.tuple, id: item.id });
  }
  state.ledger = [];
  const seen = appliedIds(state);
  let remaining = Number.isInteger(source.budget) ? source.budget : 0;
  let served = 0;

  for (const item of queue) {
    const tuple = item.tuple;
    const id = item.id;
    if (id !== null && seen.has(id)) continue;
    if (remaining > 0) {
      remaining -= 1;
      if (tuple === null) {
        fail(code(source, "event_error_code", "E_BAD_EVENT"));
      }
      const entry = [tuple[0], tuple[1], tuple[2], id];
      serveEntry(state, entry, source);
      if (id !== null) seen.add(id);
      served += 1;
    } else {
      state.ledger.push(tuple === null
        ? [null, null, null, id]
        : [tuple[0], tuple[1], tuple[2], id]);
    }
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(0, 3); }),
    judged: served,
    judged_bound: ledgerBefore + events.length
  };
}

export function close(spec) {
  const source = spec || {};
  const state = cloneState(source.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const entry = state.ledger.shift();
    if (entry[0] === null) {
      fail(code(source, "event_error_code", "E_BAD_EVENT"));
    }
    serveEntry(state, entry, source);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
