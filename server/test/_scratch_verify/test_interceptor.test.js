import { test as originalTest } from "node:test";
const test = (name, fn) => {
  if (name === "run this test") {
    return originalTest(name, fn);
  }
};
import assert from "node:assert/strict";

test("run this test", () => {
  assert.ok(true);
});

test("do not run this test", () => {
  assert.fail("should not run");
});
