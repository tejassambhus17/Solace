const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/navigation-motion.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const helpers = {};
new Function("exports", compiled)(helpers);
const {
  measuredTabStops,
  dragIntent,
  clampTabCenter,
  nearestTab,
  edgeBackStart,
  edgeBackIntent,
  edgeBackComplete,
} = helpers;

const names = ["today", "chat", "explore", "journey", "profile"];
const frames = new Map(
  names.map((name, index) => [
    name,
    {
      x: 5 + 64 * index,
      width: 64,
    },
  ]),
);
const stops = measuredTabStops(names, frames, 330, 36);

test("the rail uses actual cell centers and waits for every cell", () => {
  const measured = new Map(frames).set("today", { x: 5, width: 53 });
  assert.equal(measuredTabStops(names, measured, 330, 36)[0].center, 31.5);
  assert.deepEqual(measuredTabStops(names, frames, 280, 36), []);
  measured.delete("profile");
  assert.deepEqual(measuredTabStops(names, measured, 330, 36), []);
});

test("physical RTL measurements retain their logical destination", () => {
  const rtl = new Map(
    names.map((name, index) => [
      name,
      {
        x: 5 + 64 * (4 - index),
        width: 64,
      },
    ]),
  );
  const measured = measuredTabStops(names, rtl, 330, 36);
  assert.equal(nearestTab(310, measured, "chat").name, "today");
  assert.equal(nearestTab(17, measured, "chat").name, "profile");
});

test("jitter stays a tap and a dominant vertical move cannot activate tabs", () => {
  assert.equal(dragIntent(6, -2), "pending");
  assert.equal(dragIntent(-8, 3), "horizontal");
  assert.equal(dragIntent(12, 12), "vertical");
  assert.equal(dragIntent(3, -15), "vertical");
});

test("tracking stays continuous and clamps at the first and last centers", () => {
  assert.equal(clampTabCenter(-100, stops), 37);
  assert.equal(clampTabCenter(168.25, stops), 168.25);
  assert.equal(clampTabCenter(500, stops), 293);
});

test("settling follows release position after reversal and resolves midpoint ties", () => {
  assert.equal(nearestTab(274, stops, "today").name, "profile");
  assert.equal(nearestTab(110, stops, "today").name, "chat");
  assert.equal(nearestTab(133, stops, "explore").name, "explore");
  assert.equal(nearestTab(133, stops, "chat").name, "chat");
  assert.equal(nearestTab(133, stops, "profile").name, "chat");
});

test("edge Back only accepts a leading-edge inward horizontal movement", () => {
  assert.equal(edgeBackStart(22, 390, false), true);
  assert.equal(edgeBackStart(50, 390, false), false);
  assert.equal(edgeBackStart(375, 390, true), true);
  assert.equal(edgeBackIntent(-40, 0, false), false);
  assert.equal(edgeBackIntent(-40, 5, true), true);
  assert.equal(edgeBackIntent(30, 28, false), false);
  assert.equal(edgeBackComplete(65, 0, 390, false), false);
  assert.equal(edgeBackComplete(74, 5, 390, false), true);
  assert.equal(edgeBackComplete(-65, 1, 320, true), true);
});
