import assert from "node:assert";
import { offsetOf, stepOf, jumpOf } from "../clock.js";
import { step, close } from "../clockrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, jump: 5, slew: 2,
  state: { nodes: [], syncs: [], jumps: 0, slews: 0, ledger: [], applied: [] },
  events: [{ id: 1, kind: "add", name: "a", at: 0 }],
  bad_name_code: "E_BAD_NAME", bad_at_code: "E_BAD_AT",
  bad_ref_code: "E_BAD_REF", dup_code: "E_DUP_NAME",
  no_node_code: "E_NO_NODE", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("offsetOf returns a number", () => {
  assert.strictEqual(typeof offsetOf(3, 10), "number");
});

check("stepOf returns a number", () => {
  assert.strictEqual(typeof stepOf(0, 3, 2), "number");
});

check("jumpOf returns a boolean", () => {
  assert.strictEqual(typeof jumpOf(-7, 5), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
