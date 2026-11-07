const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function sourceModule(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    if (name in dependencies) return dependencies[name];
    if (/\.(jpg|png|webp)$/.test(name)) return name;
    throw Error(`Unexpected dependency: ${name}`);
  }, exports);
  return exports;
}

const {
  measuredTabStops,
  dragIntent,
  clampTabCenter,
  nearestTab,
  edgeBackStart,
  edgeBackIntent,
  edgeBackComplete,
} = sourceModule("../src/navigation-motion.ts");

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

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node?.type === "function") return flatten(node.type(node.props));
  if (!node?.props) return [];
  return [node, ...flatten(node.props.children)];
}

const hosts = (...names) =>
  Object.fromEntries(names.map((name) => [name, name]));
const renderReact = {
  Fragment: "Fragment",
  createElement: (type, props, ...children) => ({
    type,
    props: { ...props, children },
  }),
  useEffect: () => {},
  useLayoutEffect: (effect) => effect(),
  useMemo: (factory) => factory(),
  useRef: (current) => ({ current }),
  useState: (initial) => [
    typeof initial === "function" ? initial() : initial,
    () => {},
  ],
};

function renderExplore(app) {
  const practices = sourceModule("../src/explore-practices.ts");
  const routes = sourceModule("../src/routes.ts");
  const native = {
    ...hosts("Image", "Pressable", "ScrollView", "TextInput", "View"),
    Animated: { Value: class {}, View: "AnimatedView" },
    Platform: { OS: "android" },
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 320, fontScale: 1.5 }),
  };
  const { ExploreScreen } = sourceModule("../src/screens/Explore.tsx", {
    react: renderReact,
    "react-native": native,
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24 }),
    },
    "../Companion": { useReducedMotion: () => true },
    "../explore-practices": practices,
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../routes": routes,
    "../store": { useApp: () => app },
    "../theme": { useTheme: () => ({ colors: {}, resolved: "light" }) },
    "../ui": hosts("AppText", "Button", "Icon", "LotusMark", "Row", "Screen"),
    "../wellness-tools": sourceModule("../src/wellness-tools.ts", {
      "./explore-practices": practices,
      "./routes": routes,
    }),
  });

  return flatten(ExploreScreen());
}

test("Explore shows both wellness tools as single accessible buttons below the featured Moment", () => {
  const destinations = [];
  const screen = renderExplore({
    navigate: (route) => destinations.push(route),
  });
  const headingIndex = (label) =>
    screen.findIndex(
      ({ props }) =>
        props.accessibilityRole === "header" && props.children.includes(label),
    );
  const featuredIndex = headingIndex("Calm Your Mind");
  const wellnessIndex = headingIndex("Your wellness tools");
  const recommendedIndex = headingIndex("Recommended for You");
  assert.ok(featuredIndex >= 0 && featuredIndex < wellnessIndex);
  assert.ok(wellnessIndex < recommendedIndex);

  for (const [label, subtitle] of [
    ["Guided Techniques", "Breathe, ground, and reset."],
    ["Healthy Habit Builder", "Small habits, lasting growth."],
  ]) {
    const cards = screen.filter(
      ({ props }) => props.accessibilityLabel === label,
    );
    assert.equal(cards.length, 1, `${label} is exposed once`);
    const [card] = cards;
    assert.equal(card.props.accessibilityRole, "button");
    assert.equal(card.props.accessibilityHint, subtitle);
    assert.ok(screen.indexOf(card) > wellnessIndex);
    assert.ok(screen.indexOf(card) < recommendedIndex);
    card.props.onPress();
  }
  assert.deepEqual(destinations, ["techniques", "habits"]);
});

test("Explore ends with two dedicated page links and keeps inline accordions closed out of the tree", () => {
  const destinations = [];
  const screen = renderExplore({
    navigate: (route) => destinations.push(route),
  });
  const shortcutIndex = screen.findIndex(
    ({ props }) => props.accessibilityLabel === "Reflective Check-ins",
  );
  assert.ok(shortcutIndex >= 0);
  let previousIndex = shortcutIndex;
  for (const label of ["Wellness Tools", "Build a Timed Practice"]) {
    const cards = screen.filter(
      ({ props }) => props.accessibilityLabel === label,
    );
    assert.equal(cards.length, 1, `${label} is exposed once`);
    const [card] = cards;
    assert.equal(card.props.accessibilityRole, "button");
    assert.equal(card.props.accessibilityState?.expanded, undefined);
    assert.equal(card.props["aria-expanded"], undefined);
    assert.ok(
      screen.indexOf(card) > previousIndex,
      `${label} follows Explore More`,
    );
    previousIndex = screen.indexOf(card);
    assert.equal(
      flatten(card.props.children).filter(
        ({ props }) => props.accessibilityRole === "button",
      ).length,
      0,
      `${label} has one navigation handler`,
    );
    card.props.onPress();
  }
  assert.equal(
    screen.some(({ props }) => props.children.includes("Choose your focus")),
    false,
  );
  assert.deepEqual(destinations, ["wellness-tools", "timed-practice"]);
});

test("Wellness Tools groups every legacy destination and gives reference shortcuts real routes", () => {
  const { exploreWellnessTools, wellnessToolGroups } = sourceModule(
    "../src/wellness-tools.ts",
    {
      "./explore-practices": sourceModule("../src/explore-practices.ts"),
      "./routes": sourceModule("../src/routes.ts"),
    },
  );
  const originals = [
    ["Ambient Sound Mixer", "ambient-mixer"],
    ["Solace Moments", "moments"],
    ["Gentle Movement", "moment-player"],
    ["Guides & Resources", "resources"],
    ["Sleep Wind-Down Guide", "sleep"],
    ["Five-Senses Exercise", "grounding"],
    ["Reflective Check-Ins", "assessments"],
    ["Daily Affirmation", "affirmation"],
    ["Daily Challenge", "challenge"],
  ];
  assert.deepEqual(
    exploreWellnessTools.map(({ title, destination }) => [
      title,
      destination.route,
    ]),
    originals,
  );
  const allTools = wellnessToolGroups.flatMap(({ tools }) => tools);
  for (const original of exploreWellnessTools)
    assert.equal(allTools.filter((tool) => tool === original).length, 1);
  assert.deepEqual(
    wellnessToolGroups.map(({ title, filter }) => [title, filter]),
    [
      ["Relax & Unwind", "relax"],
      ["Calm & Restore", "relax"],
      ["Move & Energize", "move"],
      ["Grow & Reflect", "grow"],
      ["Keep the Momentum", "grow"],
    ],
  );
  assert.equal(allTools.length, 12);
  assert.equal(new Set(allTools.map(({ title }) => title)).size, 12);
  assert.equal(
    allTools.some(({ title }) => title === "Sleep Stories"),
    false,
  );
  const destination = (title) =>
    allTools.find((tool) => tool.title === title).destination;
  assert.equal(destination("Gentle Movement").params.activity.durationSec, 180);
  assert.equal(destination("Breathing Exercise").route, "technique-detail");
  assert.equal(destination("Mood Check-in").route, "checkin");
  assert.equal(destination("Gratitude Journal").route, "journal-editor");
  assert.match(destination("Gratitude Journal").params.prompt, /appreciated/i);
});

test("Explore recommendations and shortcuts are single accessible actions with their existing destinations", () => {
  const destinations = [];
  const screen = renderExplore({
    navigate: (route, params) => destinations.push([route, params]),
  });
  const { createExplorePractice } = sourceModule("../src/explore-practices.ts");
  const moment = (focus, minutes, title) => [
    "moment-player",
    {
      activity: { ...createExplorePractice(focus, minutes), title },
      provider: "offline",
      source: "explore",
    },
  ];
  const expected = [
    [
      "Breath Reset",
      /3 min.*Breathing/,
      /^play/,
      ["breathing", { durationSec: 180 }],
    ],
    [
      "Five Senses",
      /5 min.*Grounding/,
      /^play/,
      moment("ground", 5, "Five Senses"),
    ],
    [
      "Quick Reflection",
      /4 min.*Journaling/,
      /^pencil/,
      ["reflection", undefined],
    ],
    [
      "Sleep Wind Down",
      /10 min.*Relaxation/,
      /^play/,
      moment("rest", 10, "Sleep Wind Down"),
    ],
    [
      "Guided Programs",
      /Gentle multi-day plans\./,
      /^chevron-forward$/,
      ["plan", undefined],
    ],
    [
      "Wellness Toolkit",
      /Your saved practices\./,
      /^chevron-forward$/,
      ["toolkit", undefined],
    ],
    [
      "Reflective Check-ins",
      /Understand how you feel\./,
      /^chevron-forward$/,
      ["checkin", undefined],
    ],
  ];

  for (const [title, detail, icon, destination] of expected) {
    const cards = screen.filter(
      ({ props }) => props.accessibilityLabel === title,
    );
    assert.equal(cards.length, 1, `${title} has one accessible control`);
    const [card] = cards;
    assert.equal(card.type, "Pressable");
    assert.equal(card.props.accessibilityRole, "button");
    assert.match(card.props.accessibilityHint, detail);

    const children = flatten(card.props.children);
    const visibleCopy = children
      .filter(({ type }) => type === "AppText")
      .map(({ props }) => props.children.join(""))
      .join(" ");
    assert.ok(visibleCopy.includes(title));
    assert.match(visibleCopy, detail);
    assert.ok(
      children.some(
        ({ type, props }) => type === "Icon" && icon.test(props.name),
      ),
    );
    assert.ok(children.every(({ type }) => type !== "Pressable"));

    card.props.onPress();
    const calls = destinations.splice(0);
    assert.deepEqual(calls, [destination], title);
    if (destination[0] === "moment-player") {
      card.props.onPress();
      const repeated = destinations.splice(0);
      assert.equal(repeated.length, 1);
      assert.equal(
        repeated[0][1].activity,
        calls[0][1].activity,
        `${title} keeps the same activity identity for navigation deduplication`,
      );
    }
  }
});

function profileView(app, theme = {}) {
  const native = {
    ...hosts("Image", "Pressable", "ScrollView", "Switch", "View"),
    Platform: { OS: "android" },
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 320, fontScale: 1.5 }),
  };
  const shared = {
    react: renderReact,
    "react-native": native,
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24 }),
    },
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../routes": sourceModule("../src/routes.ts"),
    "../store": { useApp: () => app },
    "../theme": {
      useTheme: () => ({
        colors: {},
        resolved: "light",
        mode: "system",
        ...theme,
      }),
    },
    "../ui": hosts(
      "AppText",
      "BotanicalBackdrop",
      "Button",
      "Card",
      "Icon",
      "Input",
      "LotusMark",
      "Row",
      "Screen",
      "SectionTitle",
    ),
  };
  const { default: ProfileScreen } = sourceModule(
    "../src/screens/Profile.tsx",
    {
      ...shared,
      "expo-constants": {},
      "../Companion": { useReducedMotion: () => true },
      "../photos": {},
      "../notifications": {},
      "./DeviceLock": hosts("DeviceLockSettingsCard"),
      "./GoogleAccountLink": hosts("GoogleAccountLink"),
      "./ProfileHome": sourceModule("../src/screens/ProfileHome.tsx", shared)
        .default,
    },
  );
  return (name) => flatten(ProfileScreen({ name }));
}

test("Appearance & Preferences keeps its controls and omits the four Profile links", async () => {
  const changes = [];
  const destinations = [];
  const user = { id: "profile-qa", personalization: false };
  const app = {
    user,
    navigate: (route) => destinations.push(route),
    updateUser: async (update) => {
      changes.push(update);
      Object.assign(user, update);
    },
  };
  const theme = { setMode: (mode) => changes.push(mode) };
  const render = profileView(app, theme);
  const screen = render("settings");
  for (const title of [
    "Manage memories",
    "Reminders",
    "Privacy & data",
    "About Solace",
  ]) {
    assert.ok(
      !screen.some(({ props }) =>
        [props.title, props.accessibilityLabel, ...props.children].includes(
          title,
        ),
      ),
      `${title} belongs on Profile`,
    );
  }
  for (const mode of ["Light", "Dark", "System"]) {
    const option = screen.find(
      ({ props }) => props.accessibilityLabel === `${mode} appearance`,
    );
    assert.equal(option.props.accessibilityRole, "radio");
    option.props.onPress();
  }
  assert.ok(screen.some(({ type }) => type === "DeviceLockSettingsCard"));
  assert.ok(
    screen.some(({ props }) =>
      props.children.includes("Sound and accessibility"),
    ),
  );
  const moments = screen.find(
    ({ props }) => props.title === "Open Solace Moments",
  );
  moments.props.onPress();
  assert.deepEqual(destinations, ["moments"]);

  const approved = (nodes) =>
    nodes.find(
      ({ type, props }) =>
        type === "Switch" &&
        props.accessibilityLabel === "Use approved preferences",
    ).props;
  assert.equal(approved(screen).value, false);
  await approved(screen).onValueChange(true);
  assert.equal(approved(render("settings")).value, true);
  await approved(render("settings")).onValueChange(false);
  assert.equal(approved(render("settings")).value, false);
  assert.deepEqual(changes, [
    "light",
    "dark",
    "system",
    { personalization: true },
    { personalization: false },
  ]);
});

test("Profile links still open memory, reminders, privacy, and about with Back", () => {
  const destinations = [];
  let returns = 0;
  const app = {
    data: { reminders: [], memories: [] },
    pendingWrites: [],
    navigate: (...destination) => destinations.push(destination),
    back: () => returns++,
  };
  const render = profileView(app);
  const home = render("profile");
  for (const [title, destination] of [
    ["What Solace remembers", ["memory", undefined]],
    ["Gentle reminders", ["reminders", undefined]],
    ["Privacy & data", ["account", { section: "privacy" }]],
    ["About Solace", ["about", undefined]],
  ]) {
    const links = home.filter(
      ({ props }) => props.accessibilityLabel === title,
    );
    assert.equal(links.length, 1, title);
    assert.equal(links[0].props.accessibilityRole, "button");
    links[0].props.onPress();
    assert.deepEqual(destinations.splice(0), [destination]);
    const [name, params] = destination;
    app.params = params;
    const screen = render(name).find(({ type }) => type === "Screen");
    assert.equal(screen.props.title, title);
    screen.props.back();
  }
  assert.equal(returns, 4);
});
