// clockrun.js：按处理预算处理事件，用尽压账，收尾清账
import { offsetOf, stepOf, jumpOf } from "./clock.js";

const JUMP_TAG = "跳变";
const SLEW_TAG = "缓行";

function isNonNegInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isName(value) {
  return typeof value === "string" && value.length > 0;
}

function codeOf(spec, key, fallback) {
  const value = spec[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function fail(spec, key, fallback) {
  const code = codeOf(spec, key, fallback);
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  state = state || {};
  return {
    nodes: (state.nodes || []).map((row) => [row[0], row[1]]),
    syncs: (state.syncs || []).map((row) => [row[0], row[1], row[2]]),
    jumps: state.jumps || 0,
    slews: state.slews || 0,
    ledger: (state.ledger || []).map((event) => Object.assign({}, event)),
    applied: (state.applied || []).slice()
  };
}

function findNode(nodes, name) {
  for (const node of nodes) {
    if (node[0] === name) {
      return node;
    }
  }
  return null;
}

function insertNode(nodes, name, at) {
  let lo = 0;
  let hi = nodes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nodes[mid][0] < name) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  nodes.splice(lo, 0, [name, at]);
}

function validate(event, spec) {
  if (!event || typeof event !== "object" || Array.isArray(event)
      || (event.kind !== "add" && event.kind !== "sync")) {
    fail(spec, "event_error_code", "E_BAD_EVENT");
  }
  if (!isName(event.name)) {
    fail(spec, "bad_name_code", "E_BAD_NAME");
  }
  if (event.kind === "add") {
    if (!isNonNegInt(event.at)) {
      fail(spec, "bad_at_code", "E_BAD_AT");
    }
  } else if (!isNonNegInt(event.ref)) {
    fail(spec, "bad_ref_code", "E_BAD_REF");
  }
}

function alreadyApplied(state, event) {
  return event && event.id !== undefined && event.id !== null
    && state.applied.indexOf(event.id) !== -1;
}

function markApplied(state, event) {
  if (event && event.id !== undefined && event.id !== null) {
    state.applied.push(event.id);
  }
}

function applyOne(state, event, spec) {
  validate(event, spec);
  if (event.kind === "add") {
    if (findNode(state.nodes, event.name)) {
      fail(spec, "dup_code", "E_DUP_NAME");
    }
    insertNode(state.nodes, event.name, event.at);
    markApplied(state, event);
    return;
  }
  const node = findNode(state.nodes, event.name);
  if (!node) {
    fail(spec, "no_node_code", "E_NO_NODE");
  }
  const offset = offsetOf(node[1], event.ref);
  if (jumpOf(offset, spec.jump)) {
    node[1] = event.ref;
    state.jumps += 1;
    state.syncs.push([event.name, offset, JUMP_TAG]);
  } else {
    node[1] = stepOf(node[1], event.ref, spec.slew);
    state.slews += 1;
    state.syncs.push([event.name, offset, SLEW_TAG]);
  }
  markApplied(state, event);
}

function capacityOf(spec) {
  const budget = Number(spec && spec.budget);
  if (!Number.isFinite(budget)) {
    return 0;
  }
  return Math.max(0, Math.trunc(budget));
}

function project(event) {
  return event.kind === "add"
    ? ["add", event.name, event.at]
    : [event.kind, event.name, event.ref];
}

export function step(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const events = (spec.events || []).map((event) => Object.assign({}, event));
  const bound = state.ledger.length + events.length;
  const queue = state.ledger.concat(events);
  state.ledger = [];
  let capacity = capacityOf(spec);
  let served = 0;
  let judged = 0;
  for (const event of queue) {
    if (alreadyApplied(state, event)) {
      continue;
    }
    if (capacity <= 0) {
      state.ledger.push(event);
      continue;
    }
    capacity -= 1;
    judged += 1;
    applyOne(state, event, spec);
    served += 1;
  }
  return {
    state,
    served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(project),
    judged,
    judged_bound: bound
  };
}

export function close(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const event of pending) {
    if (alreadyApplied(state, event)) {
      continue;
    }
    applyOne(state, event, spec);
    catchup += 1;
  }
  return { state, catchup };
}
