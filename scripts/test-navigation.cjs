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

test("haptics use supported Android effects and tolerate an unavailable native module", async () => {
  const calls = [];
  const platform = { OS: "android", Version: 29 };
  const { playHaptic } = sourceModule("../src/haptics.ts", {
    "react-native": { Platform: platform },
    "expo-haptics": {
      AndroidHaptics: {
        Context_Click: "click",
        Confirm: "confirm",
        Long_Press: "long-press",
      },
      ImpactFeedbackStyle: { Light: "light-impact" },
      NotificationFeedbackType: { Success: "success" },
      impactAsync: async (effect) => calls.push(effect),
      notificationAsync: async (effect) => calls.push(effect),
      performAndroidHapticsAsync: async (effect) => {
        calls.push(effect);
        if (effect === "confirm") throw new Error("Unavailable");
      },
    },
  });
  await playHaptic("selection");
  await playHaptic("confirmation");
  platform.Version = 30;
  await playHaptic("confirmation");
  platform.OS = "ios";
  await playHaptic("selection");
  await playHaptic("confirmation");
  platform.OS = "web";
  await playHaptic("selection");
  assert.deepEqual(calls, [
    "click",
    "long-press",
    "confirm",
    "light-impact",
    "success",
  ]);
});

test("web radios use a single Tab stop, Space activation and wrapping arrow navigation", () => {
  const { webRadioProps } = sourceModule("../src/radio-keyboard.ts", {
    "react-native": { Platform: { OS: "web" } },
  });
  const calls = [];
  const group = { querySelectorAll: () => options };
  const options = ["all", "breathe", "reflect"].map((name) => ({
    closest: () => group,
    getAttribute: () => null,
    focus: () => calls.push(["focus", name]),
    click: () => calls.push(["click", name]),
  }));
  const selected = webRadioProps(true);
  assert.equal(selected.tabIndex, 0);
  assert.equal(webRadioProps(false).tabIndex, -1);
  const press = (key, repeat = false) =>
    selected.onKeyDown({
      currentTarget: options[0],
      key,
      repeat,
      preventDefault: () => calls.push(["prevent", key]),
    });
  press(" ");
  press(" ", true);
  press("ArrowLeft");
  assert.deepEqual(calls, [
    ["prevent", " "],
    ["click", "all"],
    ["prevent", " "],
    ["prevent", "ArrowLeft"],
    ["focus", "reflect"],
    ["click", "reflect"],
  ]);
  const native = sourceModule("../src/radio-keyboard.ts", {
    "react-native": { Platform: { OS: "android" } },
  });
  assert.deepEqual(native.webRadioProps(true), {});
});

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

test("Companion overflow offers only conversation actions and stays within native safe areas", () => {
  const cases = [
    {
      platform: "ios",
      width: 320,
      height: 568,
      top: 44,
      bottom: 34,
      left: 0,
      right: 0,
    },
    {
      platform: "android",
      width: 260,
      height: 260,
      top: 24,
      bottom: 24,
      left: 18,
      right: 22,
    },
  ];
  const gutter = 12;
  for (const { platform, width, height, ...insets } of cases) {
    const native = {
      ...hosts("Modal", "ScrollView", "View"),
      Platform: { OS: platform },
      StyleSheet: { create: (styles) => styles, absoluteFill: {} },
      useWindowDimensions: () => ({ width, height }),
    };
    for (const resolved of ["light", "dark"]) {
      const colors = {
        surface: resolved === "dark" ? "#231D36" : "#FFF8F2",
        border: resolved === "dark" ? "#524261" : "#E6DACE",
        overlay: "#00000070",
      };
      const { CompanionConversationMenu } = sourceModule(
        "../src/screens/CompanionConversationMenu.tsx",
        {
          react: renderReact,
          "react-native": native,
          "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
          "../layout": sourceModule("../src/layout.ts", {
            "react-native": native,
          }),
          "../theme": { useTheme: () => ({ resolved, colors }) },
          "../ui": hosts("AppText", "Icon", "Row"),
          "./ChatDetails": hosts("ChatHeaderButton", "CompanionAction"),
        },
      );
      const calls = [];
      const props = {
        open: true,
        gutter,
        reducedMotion: platform === "ios",
        disabled: false,
        onClose: () => calls.push("close"),
        onNewConversation: () => calls.push("new"),
        onHistory: () => calls.push("history"),
      };
      const tree = flatten(CompanionConversationMenu(props));
      const modal = tree.find(({ type }) => type === "Modal");
      assert.equal(modal.props.visible, true);
      assert.equal(
        modal.props.animationType,
        props.reducedMotion ? "none" : "fade",
      );
      const menu = tree.find(({ props }) => props.accessibilityViewIsModal);
      const geometry = Object.assign({}, ...menu.props.style);
      assert.equal(geometry.backgroundColor, colors.surface);
      assert.equal(geometry.borderColor, colors.border);
      assert.ok(geometry.top >= insets.top);
      assert.ok(geometry.top + geometry.maxHeight <= height - insets.bottom);
      assert.ok(geometry.right >= gutter + insets.right);
      assert.ok(
        width - geometry.right - geometry.width >= gutter + insets.left,
      );
      assert.ok(
        tree.some(
          ({ props }) =>
            props.accessibilityRole === "header" &&
            props.children.includes("Conversations"),
        ),
      );
      const actions = tree.filter(({ type }) => type === "CompanionAction");
      assert.deepEqual(
        actions.map(({ props }) => props.label),
        ["New Conversation", "Conversation History"],
      );
      assert.ok(actions.every(({ props }) => props.style.minHeight >= 48));
      actions.forEach(({ props }) => props.onPress());
      const backdrop = tree.find(({ props }) => props.onResponderRelease);
      assert.ok(backdrop.props.accessibilityElementsHidden);
      backdrop.props.onResponderRelease();
      modal.props.onRequestClose();
      tree.find(({ type }) => type === "ChatHeaderButton").props.onPress();
      assert.deepEqual(calls, [
        "close",
        "new",
        "close",
        "history",
        "close",
        "close",
        "close",
      ]);
      const inactive = flatten(
        CompanionConversationMenu({ ...props, open: false, disabled: true }),
      );
      assert.equal(
        inactive.find(({ type }) => type === "Modal").props.visible,
        false,
      );
      assert.ok(
        inactive
          .filter(({ type }) => type === "CompanionAction")
          .every(({ props }) => props.disabled),
      );
    }
  }
});

test("the iOS Companion docks to keyboard frames and reverses without duplicate motion", () => {
  const listeners = new Map();
  const animations = [];
  const positions = [];
  let cleanup;
  let stopped = 0;
  const identity = (value) => value;
  const { useChatKeyboard, chatKeyboardLift } = sourceModule(
    "../src/chat-keyboard.ts",
    {
      react: {
        useState: (initial) => [
          typeof initial === "function" ? initial() : initial,
          () => {},
        ],
        useEffect: (effect) => {
          cleanup = effect();
        },
      },
      "react-native": {
        Platform: { OS: "ios" },
        Keyboard: {
          metrics: () => undefined,
          addListener: (name, callback) => {
            listeners.set(name, callback);
            return { remove: () => listeners.delete(name) };
          },
        },
        Easing: { linear: identity },
        Animated: {
          Value: class {
            setValue(value) {
              positions.push(value);
            }
            stopAnimation() {
              stopped++;
            }
          },
          timing: (_, config) => ({
            start: () => animations.push(config),
          }),
        },
      },
    },
  );
  const docked = { screenX: 0, screenY: 602, width: 430, height: 330 };
  const hidden = { ...docked, screenY: 932 };
  const floating = { ...docked, screenY: 500, height: 180 };
  assert.equal(chatKeyboardLift(932, 100, docked), 230);
  assert.equal(chatKeyboardLift(932, 100, hidden), 0);
  assert.equal(chatKeyboardLift(932, 100, floating), 0);

  useChatKeyboard(932, 100, false);
  const frame = (coordinates, duration = 250) =>
    listeners.get("keyboardWillChangeFrame")({
      endCoordinates: coordinates,
      duration,
      easing: "linear",
    });
  frame(docked);
  frame(docked);
  frame(hidden);
  listeners.get("keyboardWillHide")({ duration: 250, easing: "linear" });
  frame(docked);
  listeners.get("keyboardDidHide")();
  assert.deepEqual(
    animations.map(({ toValue, duration, useNativeDriver }) => [
      toValue,
      duration,
      useNativeDriver,
    ]),
    [
      [-230, 250, true],
      [0, 250, true],
      [-230, 250, true],
    ],
  );
  assert.equal(
    positions.length,
    1,
    "a late hide must not snap a reopening dock",
  );
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(stopped, 1);

  useChatKeyboard(932, 100, true);
  frame(docked);
  assert.equal(positions.at(-1), -230);
  assert.equal(
    animations.length,
    3,
    "Reduce Motion should use no extra animation",
  );
  frame(floating, 0);
  assert.equal(positions.at(-1), 0);
  cleanup();
});

test("Companion keeps conversation actions and attaches playback to the latest reply", () => {
  const messages = [
    {
      id: "reply-one",
      role: "assistant",
      content: "Earlier",
      provider: "offline",
    },
    { id: "message", role: "user", content: "My message" },
    { id: "reply-two", role: "assistant", content: "Latest", provider: "live" },
  ];
  const calls = [];
  const app = {
    params: { id: "conversation-id" },
    data: {
      conversations: [{ id: "conversation-id", messages }],
      checkins: [],
    },
    user: { id: "account-id" },
    chatDrafts: {},
    chatPending: {},
    back: () => calls.push(["back"]),
    navigate: (...params) => calls.push(["navigate", ...params]),
    setParams: (params) => calls.push(["params", params]),
  };
  const react = {
    ...renderReact,
    memo: (component) => component,
    useCallback: (callback) => callback,
  };
  const native = {
    ...hosts(
      "Image",
      "Pressable",
      "View",
      "ScrollView",
      "KeyboardAvoidingView",
      "FlatList",
    ),
    Platform: { OS: "android" },
    Animated: { View: "AnimatedView", Value: class {} },
    Keyboard: { dismiss: () => calls.push(["dismiss keyboard"]) },
    StyleSheet: {
      create: (styles) => styles,
      absoluteFill: {},
      hairlineWidth: 1,
    },
    useWindowDimensions: () => ({ width: 320, height: 568 }),
  };
  const layout = sourceModule("../src/layout.ts", { "react-native": native });
  const theme = {
    darkColors: { bg: "#000000" },
    useTheme: () => ({ resolved: "dark", colors: {} }),
  };
  const ui = {
    ...hosts("AppText", "Button", "Icon", "Row"),
    useNavigationInset: () => 0,
  };
  const chatDetails = sourceModule("../src/screens/ChatDetails.tsx", {
    react,
    "react-native": native,
    "../Companion": hosts("Companion"),
    "../layout": layout,
    "../theme": theme,
    "../ui": ui,
  });
  const playback = react.createElement("Playback", {
    accessibilityLabel: "Read reply aloud",
  });
  const { ChatScreen } = sourceModule("../src/screens/Core.tsx", {
    react,
    "react-native": native,
    "react-native-safe-area-context": {
      SafeAreaView: "SafeAreaView",
      useSafeAreaInsets: () => ({ bottom: 0 }),
    },
    "expo-status-bar": hosts("StatusBar"),
    "../store": { useApp: () => app },
    "../routes": sourceModule("../src/routes.ts"),
    "../chat-keyboard": sourceModule("../src/chat-keyboard.ts", {
      react,
      "react-native": native,
    }),
    "../realtime-timing": { beginVoiceTiming() {} },
    "../google-auth": {},
    "../Companion": { useReducedMotion: () => true },
    "../content": { localDay: () => "2026-11-07" },
    "../layout": layout,
    "../VoiceControls": {
      VoiceControls: ({ reply, renderComposer }) => {
        assert.equal(reply.id, "reply-two");
        assert.equal(reply.conversationId, "conversation-id");
        assert.equal(reply.provider, "live");
        return renderComposer(react.createElement("Microphone"), playback);
      },
    },
    "../ChatComposer": {
      ...hosts("ChatComposerControl", "ChatComposerInput"),
      chatControlSize: 48,
    },
    "../theme": theme,
    "../chat-practices": {},
    "../techniques": {},
    "../technique-artwork": {},
    "../../server/src/chat-evidence": {},
    "../../server/src/chat-practice": { isChatPracticeId: () => false },
    "./ChatDetails": chatDetails,
    "./CompanionConversationMenu": hosts("CompanionConversationMenu"),
    "./CompanionAppActions": {
      useCompanionActions: () => ({ busy: false, close() {} }),
    },
    "./RecommendationExplanation": {},
    "./SolaceRecommendationCard": {},
    "./HabitAssistant": { habitIntention: () => undefined },
    "./GoogleAuthAction": {},
    "./PasswordRecovery": {},
    "./Discover": {},
    "./Explore": {},
    "../ui": ui,
  });
  const screen = flatten(ChatScreen({ scrollMemory: new Map() }));
  assert.equal(
    screen.find(({ type }) => type === "KeyboardAvoidingView").props.behavior,
    "padding",
  );
  const composer = screen.find(
    ({ props }) => props.testID === "floating-chat-composer",
  );
  const composerControls = flatten(composer).map(({ type }) => type);
  assert.equal(composer.type, "AnimatedView");
  assert.ok(composerControls.includes("ChatComposerInput"));
  assert.ok(composerControls.includes("Microphone"));
  assert.equal(
    composerControls.filter((type) => type === "ChatComposerControl").length,
    2,
  );
  const menu = screen.find(({ type }) => type === "CompanionConversationMenu");
  const back = screen.find(
    ({ props }) => props.accessibilityLabel === "Back to Solace",
  );
  assert.ok(back);
  back.props.onPress();
  menu.props.onHistory();
  menu.props.onNewConversation();
  assert.deepEqual(calls, [
    ["dismiss keyboard"],
    ["back"],
    ["navigate", "history"],
    ["dismiss keyboard"],
    ["params", { id: undefined, context: "" }],
  ]);
  assert.ok(!screen.some(({ type }) => type === "Playback"));
  const list = screen.find(({ type }) => type === "FlatList");
  for (const item of messages) {
    const bubble = flatten(list.props.renderItem({ item }));
    assert.equal(
      bubble.filter(({ type }) => type === "Playback").length,
      item.id === "reply-two" ? 1 : 0,
    );
    if (item.id === "reply-two") {
      const metadata = bubble.find(
        ({ type, props }) =>
          type === "Row" && props.children.includes(playback),
      );
      assert.ok(metadata);
      assert.ok(
        flatten(metadata).some(({ props }) =>
          props.children.includes("Live AI reply"),
        ),
      );
    }
  }
  native.Platform.OS = "ios";
  const ios = flatten(ChatScreen({ scrollMemory: new Map() }));
  assert.ok(!ios.some(({ type }) => type === "KeyboardAvoidingView"));
  const iosComposer = ios.find(
    ({ props }) => props.testID === "floating-chat-composer",
  );
  const translateY = iosComposer.props.style.find((style) => style?.transform)
    .transform[0].translateY;
  assert.equal(
    ios.filter(
      ({ type, props }) =>
        type === "AnimatedView" &&
        props.style.some(
          (style) => style?.transform?.[0].translateY === translateY,
        ),
    ).length,
    2,
    "The transcript and complete composer should share one native translation",
  );
});

test("Journal word count handles paragraphs and Unicode, and the bullet tool keeps the selected text", () => {
  const { countJournalWords, toggleJournalBullet } = sourceModule(
    "../src/journal-writing.ts",
  );
  assert.equal(countJournalWords("Café, hello!\n\nI’m okay 🙂"), 4);
  assert.equal(countJournalWords("— 🪷 …"), 0);
  assert.equal(countJournalWords("Hello Solace.\n".repeat(3000)), 6000);
  const original = "First 🙂\nSecond line";
  const selection = {
    start: original.indexOf("Second"),
    end: original.indexOf(" line"),
  };
  const added = toggleJournalBullet(original, selection);
  assert.equal(added.text, "First 🙂\n• Second line");
  assert.equal(
    added.text.slice(added.selection.start, added.selection.end),
    "Second",
  );
  assert.deepEqual(toggleJournalBullet(added.text, added.selection), {
    text: original,
    selection,
  });
});

test("Journal keeps the body scrollable and reduces its height for the keyboard in both themes", () => {
  const reveals = [];
  let keyboardVisible = false;
  let resolved = "dark";
  const { JournalWritingSurface } = sourceModule(
    "../src/screens/JournalEditorSurface.tsx",
    {
      react: { ...renderReact, useDeferredValue: (value) => value },
      "react-native": {
        ...hosts("View"),
        Keyboard: { isVisible: () => keyboardVisible },
        StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
        useWindowDimensions: () => ({ width: 320, height: 640 }),
      },
      "react-native-safe-area-context": {},
      "../journal-writing": sourceModule("../src/journal-writing.ts"),
      "../layout": sourceModule("../src/layout.ts", { "react-native": {} }),
      "../navigation-reset": {},
      "../theme": {
        useTheme: () => ({
          resolved,
          colors: {
            surface2: "#F3EDF8",
            text: "#2B2038",
            muted: "#65586E",
            accent: "#634579",
            lavender: "#C5A4DA",
          },
        }),
      },
      "../ui": hosts(
        "AppText",
        "BotanicalBackdrop",
        "IconButton",
        "Input",
        "Row",
      ),
    },
  );
  const text = "First paragraph.\n\nSecond paragraph. 🪷";
  for (const appearance of ["dark", "light"]) {
    resolved = appearance;
    let idleHeight;
    for (const visible of [false, true]) {
      keyboardVisible = visible;
      const tree = flatten(
        JournalWritingSurface({
          title: "",
          text,
          disabled: false,
          onReveal: (y) => reveals.push(y),
        }),
      );
      const body = tree.find(
        ({ props }) => props.accessibilityLabel === "Journal entry",
      ).props;
      assert.equal(body.value, text);
      assert.equal(body.multiline, true);
      assert.equal(body.scrollEnabled, true);
      assert.ok(
        tree.some(({ props }) => props.children.join("") === "4 words"),
      );
      const height = body.style.at(-1).height;
      if (visible) {
        assert.ok(height < idleHeight);
        tree[0].props.onLayout({ nativeEvent: { layout: { y: 220 } } });
        body.onFocus();
      } else {
        idleHeight = height;
      }
    }
  }
  assert.deepEqual(reveals, [220, 220]);
});

const journalCalendarContent = sourceModule("../src/content.ts");
const journalCalendarDates = sourceModule("../src/journal-calendar.ts", {
  "./content": journalCalendarContent,
  "./journal-record": sourceModule("../src/journal-record.ts"),
});

test("Journal calendar handles leap February, month rollover and Sunday alignment", () => {
  const { journalCalendarDate, journalCalendarDays, journalCalendarMonth } =
    journalCalendarDates;
  const feb = journalCalendarDate("2024-02-29");
  const grid = journalCalendarDays(feb);
  assert.equal(grid.length, 35);
  assert.equal(grid.indexOf("2024-02-01"), 4);
  assert.equal(grid.filter(Boolean).length, 29);
  assert.equal(grid[32], "2024-02-29");
  assert.equal(
    journalCalendarDays(journalCalendarDate("2026-02-01")).length,
    28,
  );
  assert.equal(
    journalCalendarDays(journalCalendarDate("2023-02-28")).includes(
      "2023-02-29",
    ),
    false,
  );
  assert.equal(
    journalCalendarContent.localDay(
      journalCalendarMonth(journalCalendarDate("2025-12-31"), 1),
    ),
    "2026-01-01",
  );
  assert.equal(
    journalCalendarContent.localDay(
      journalCalendarMonth(journalCalendarDate("2026-01-31"), -1),
    ),
    "2025-12-01",
  );
});

test("Journal calendar dots group saved entries by stored local day and exclude queued entries", () => {
  const { savedJournalByDay, journalCalendarDate } = journalCalendarDates;
  const records = [
    {
      id: "one",
      kind: "journal",
      day: "2026-11-08",
      createdAt: "2026-11-09T21:00:00Z",
    },
    { id: "two", kind: "journal", day: "2026-11-08" },
    {
      id: "legacy",
      text: "My entry",
      createdAt: journalCalendarDate("2026-11-09").toISOString(),
    },
    { id: "pending", kind: "journal", day: "2026-11-10", localOnly: true },
    {
      id: "weekly",
      text: "Weekly story",
      day: "2026-11-10",
      weeklyPeriod: { start: "2026-11-03" },
    },
    { id: "invalid", kind: "journal", day: "2026-02-30" },
  ];
  const byDay = savedJournalByDay(records);
  assert.deepEqual([...byDay.keys()], ["2026-11-08", "2026-11-09"]);
  assert.deepEqual(
    byDay.get("2026-11-08").map(({ id }) => id),
    ["one", "two"],
  );
  assert.equal(byDay.get("2026-11-09")[0].id, "legacy");
  assert.equal(savedJournalByDay(records.slice(1)).get("2026-11-08").length, 1);
});

test("Journal editor keeps a dated draft through failure and reopen, and opens reflection only on request", async () => {
  const slots = [];
  const submissions = [];
  const routes = [];
  let cursor = 0;
  let failSave = true;
  const app = {
    params: {},
    data: { reflections: [] },
    editorDrafts: {},
    editorDraftPersistence: {},
    draftProtection: "device",
    pendingWrites: [],
    back() {},
    setEditorDraft(key, value) {
      if (value) this.editorDrafts[key] = value;
      else delete this.editorDrafts[key];
    },
    async flushEditorDrafts() {},
    async save(collection, record) {
      submissions.push([collection, record]);
      if (failSave) throw Error("Test connection failure");
      this.data.reflections = [record];
      return record;
    },
    navigate: (...args) => routes.push(args),
  };
  const { JournalScreen } = sourceModule("../src/screens/Journal.tsx", {
    react: {
      ...renderReact,
      useCallback: (callback) => callback,
      useRef(value) {
        return (slots[cursor++] ??= { current: value });
      },
      useState(value) {
        const index = cursor++;
        if (!(index in slots))
          slots[index] = typeof value === "function" ? value() : value;
        return [
          slots[index],
          (next) => {
            slots[index] = next;
          },
        ];
      },
    },
    "react-native": {
      ...hosts(
        "ActivityIndicator",
        "Image",
        "Pressable",
        "ScrollView",
        "Switch",
        "View",
      ),
      Keyboard: { dismiss() {} },
      StyleSheet: { create: (styles) => styles },
    },
    "react-native-safe-area-context": {},
    "../../server/src/journal-contract": sourceModule(
      "../server/src/journal-contract.ts",
    ),
    "../content": journalCalendarContent,
    "../journal-calendar": journalCalendarDates,
    "../layout": { spacing: {}, useScreenGutter: () => 16 },
    "../list-scroll": {},
    "../routes": sourceModule("../src/routes.ts"),
    "../journal-record": sourceModule("../src/journal-record.ts"),
    "../store": { useApp: () => app },
    "../theme": { useTheme: () => ({ colors: {} }) },
    "../ui": {
      ...hosts(
        "AppText",
        "Button",
        "Icon",
        "IconButton",
        "LotusMark",
        "NestedHeader",
        "Row",
        "Screen",
      ),
      moodPetals: [{ mood: "Calm" }],
    },
    "./SolaceModeSwitcher": {},
    "./JournalCalendar": hosts("JournalCalendar"),
    "./JournalEditorMetadata": hosts("JournalEditorMetadata"),
    "./JournalEditorSurface": hosts(
      "JournalEditorHeader",
      "JournalWritingSurface",
    ),
  });
  const render = () => {
    cursor = 0;
    return flatten(JournalScreen({ name: "journal-editor" }));
  };
  const field = (type) => render().find((node) => node.type === type).props;
  const save = (label) =>
    render().find(({ props }) => props.accessibilityLabel === label).props;
  const body = "Café 🙂\n\nA second paragraph.\n".repeat(80);
  field("JournalEditorHeader").onOpenCalendar();
  field("JournalCalendar").onWrite("2024-02-29");
  field("JournalWritingSurface").onTitleChange("Evening");
  field("JournalWritingSurface").onTextChange(body);
  field("JournalEditorMetadata").onMoodChange("Calm");
  field("JournalEditorMetadata").onTagsChange(["rest", "gratitude"]);
  field("JournalEditorHeader").onOpenCalendar();
  assert.equal(field("JournalCalendar").day, "2024-02-29");
  field("JournalCalendar").onWrite("2024-02-28");
  assert.equal(app.editorDrafts["journal:new"].day, "2024-02-29");
  field("JournalCalendar").onOpenEntry("older-entry");
  assert.deepEqual(routes.splice(0), [
    ["journal-entry", { id: "older-entry" }],
  ]);
  slots.length = 0;
  assert.equal(field("JournalWritingSurface").text, body);
  field("JournalEditorMetadata").onEditingTagChange(true);
  assert.equal(save("Save entry").disabled, true);
  field("JournalEditorMetadata").onEditingTagChange(false);
  field("Switch").onValueChange(true);
  save("Save entry").onPress();
  await new Promise(setImmediate);
  assert.equal(field("JournalWritingSurface").text, body);
  failSave = false;
  save("Retry save").onPress();
  await new Promise(setImmediate);
  assert.equal(submissions.length, 2);
  assert.deepEqual(submissions[0], submissions[1]);
  const saved = submissions[1][1];
  assert.equal(saved.title, "Evening");
  assert.equal(saved.text, body);
  assert.equal(saved.mood, "Calm");
  assert.equal(saved.day, "2024-02-29");
  assert.deepEqual(saved.tags, ["rest", "gratitude"]);
  assert.deepEqual(routes, []);
  render()
    .find(({ props }) => props.title === "Choose an excerpt")
    .props.onPress();
  assert.deepEqual(routes, [["journal-reflect", { id: saved.id }]]);
  app.params.id = saved.id;
  slots.length = 0;
  field("JournalWritingSurface").onTextChange("Edited entry");
  save("Save entry").onPress();
  await new Promise(setImmediate);
  assert.equal(submissions[2][1].id, saved.id);
  assert.equal(app.data.reflections.length, 1);
});

function journalMetadataFixture(initialTags = []) {
  let edit;
  let mood = "";
  let tags = initialTags;
  const editing = [];
  const native = {
    ...hosts("Pressable", "ScrollView", "View"),
    StyleSheet: { create: (styles) => styles },
  };
  const contract = sourceModule("../server/src/journal-contract.ts");
  const moods = ["Okay", "Calm", "Low", "Stressed", "Great"];
  const { JournalEditorMetadata } = sourceModule(
    "../src/screens/JournalEditorMetadata.tsx",
    {
      react: {
        ...renderReact,
        useState: () => [edit, (next) => (edit = next)],
      },
      "react-native": native,
      "../../server/src/journal-contract": contract,
      "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
      "../theme": { useTheme: () => ({ colors: {} }) },
      "../ui": {
        ...hosts("AppText", "Icon", "IconButton", "Input", "MoodPetal", "Row"),
        moodPetals: moods.map((mood) => ({ mood, image: mood })),
      },
    },
  );
  function render(disabled = false) {
    return flatten(
      JournalEditorMetadata({
        mood,
        tags,
        disabled,
        onMoodChange: (value) => (mood = value),
        onTagsChange: (value) => (tags = value),
        onEditingTagChange: (value) => editing.push(value),
      }),
    );
  }
  const control = (label, disabled) =>
    render(disabled).find(
      ({ props }) =>
        props.accessibilityLabel === label || props.label === label,
    )?.props;
  const press = (label) => {
    const target = control(label);
    assert.ok(target && !target.disabled, label);
    target.onPress();
  };
  const alert = () =>
    render()
      .find(({ props }) => props.accessibilityRole === "alert")
      ?.props.children.join("");
  return { contract, moods, control, press, alert, editing, tags: () => tags };
}

test("journal mood is optional and tag actions commit or release the editing gate", () => {
  const fixture = journalMetadataFixture();
  const { moods, control, press, editing } = fixture;
  const selected = () =>
    moods.filter((mood) => control(mood).accessibilityState.selected);
  assert.deepEqual(selected(), []);
  press("Calm");
  assert.deepEqual(selected(), ["Calm"]);
  press("Great");
  assert.deepEqual(selected(), ["Great"]);
  press("Great");
  assert.deepEqual(selected(), []);
  assert.ok(control("Calm", true).disabled);
  assert.ok(control("Add tag", true).disabled);

  press("Add tag");
  assert.deepEqual(editing, [true]);
  control("New tag name").onChangeText("  work , rest, work ");
  control("New tag name").onSubmitEditing();
  assert.deepEqual(fixture.tags(), ["work", "rest"]);
  assert.deepEqual(editing, [true, false]);

  press("Rename tag work");
  assert.equal(control("Edit tag name").value, "work");
  control("Edit tag name").onChangeText("rest");
  press("Apply tag");
  assert.match(fixture.alert(), /already in this entry/);
  assert.equal(editing.at(-1), true);
  assert.deepEqual(fixture.tags(), ["work", "rest"]);
  control("Edit tag name").onChangeText("focus");
  press("Apply tag");
  assert.deepEqual(fixture.tags(), ["focus", "rest"]);
  assert.equal(editing.at(-1), false);

  press("Rename tag focus");
  press("Cancel tag editing");
  assert.deepEqual(fixture.tags(), ["focus", "rest"]);
  assert.equal(editing.at(-1), false);
  press("Remove tag focus");
  assert.deepEqual(fixture.tags(), ["rest"]);
});

test("invalid journal tags leave the saved chips and editing gate intact", () => {
  const fixture = journalMetadataFixture();
  const { contract, control, press, editing } = fixture;
  press("Add tag");
  control("New tag name").onChangeText(
    "x".repeat(contract.MAX_JOURNAL_TAG_LENGTH + 1),
  );
  press("Apply tag");
  assert.match(
    fixture.alert(),
    new RegExp(String(contract.MAX_JOURNAL_TAG_LENGTH)),
  );
  assert.deepEqual(fixture.tags(), []);
  assert.deepEqual(editing, [true]);

  const names = Array.from(
    { length: contract.MAX_JOURNAL_TAGS + 1 },
    (_, index) => `tag ${index}`,
  );
  control("New tag name").onChangeText(names.join(","));
  press("Apply tag");
  assert.match(fixture.alert(), new RegExp(String(contract.MAX_JOURNAL_TAGS)));
  assert.deepEqual(fixture.tags(), []);
  assert.deepEqual(editing, [true]);
  control("New tag name").onChangeText(names.slice(1).join(","));
  press("Apply tag");
  assert.equal(fixture.tags().length, contract.MAX_JOURNAL_TAGS);
  assert.equal(editing.at(-1), false);
  assert.ok(control("Add tag").disabled);
});

function recommendationFixture({ width, fontScale, resolved, platform }) {
  let cursor = 0;
  const slots = [];
  const native = {
    ...hosts("Image", "Pressable", "View"),
    Platform: { OS: platform },
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width, fontScale }),
  };
  const { SolaceRecommendationCard } = sourceModule(
    "../src/screens/SolaceRecommendationCard.tsx",
    {
      react: {
        ...renderReact,
        memo: (component) => component,
        useState(initial) {
          const index = cursor++;
          if (!(index in slots))
            slots[index] = typeof initial === "function" ? initial() : initial;
          return [
            slots[index],
            (next) => {
              slots[index] =
                typeof next === "function" ? next(slots[index]) : next;
            },
          ];
        },
      },
      "react-native": native,
      "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
      "../theme": { useTheme: () => ({ colors: {}, resolved }) },
      "../ui": hosts("AppText", "Button", "Icon", "Row"),
    },
  );
  return (props) => {
    cursor = 0;
    return flatten(SolaceRecommendationCard(props));
  };
}

const recommendationControl = (screen, title) =>
  screen.filter(
    ({ props }) => props.title === title || props.accessibilityLabel === title,
  );

test("Companion practice cards display the supplied reason and expose each action once", () => {
  const calls = [];
  const render = recommendationFixture({
    width: 390,
    fontScale: 1,
    resolved: "dark",
    platform: "ios",
  });
  const props = {
    title: "Slow breathing",
    description: "Settle into an easy rhythm.",
    durationSec: 420,
    artwork: 17,
    reason: "This follows what you shared in this conversation.",
    onStart: () => calls.push("start"),
    onDismiss: () => calls.push("dismiss"),
    onExplain: () => calls.push("explain"),
  };
  const screen = render(props);
  const copy = screen
    .filter(({ type }) => type === "AppText")
    .flatMap(({ props }) => props.children)
    .join(" ");
  assert.match(copy, /Picked for you/);
  assert.match(copy, /\b7 min\b/);
  for (const text of [props.title, props.description, props.reason])
    assert.ok(copy.includes(text));
  assert.equal(screen.find(({ type }) => type === "Image").props.source, 17);
  for (const label of [
    "Start practice",
    "Not now",
    "Why Solace suggested this",
  ]) {
    const controls = recommendationControl(screen, label);
    assert.equal(controls.length, 1, label);
    controls[0].props.onPress();
  }
  assert.deepEqual(calls, ["start", "dismiss", "explain"]);
  const [start] = recommendationControl(
    render({ ...props, disabled: true }),
    "Start practice",
  );
  assert.ok(start.props.disabled || start.props.accessibilityState?.disabled);
});

test("Companion practice cards keep full copy and actions when artwork is unavailable", () => {
  const props = {
    title: "Five-senses grounding for a moment of difficult emotions",
    description:
      "Notice what is around you, one sense at a time, and return to any detail that feels comfortable without rushing to the next step.",
    durationSec: 180,
    selfPaced: true,
    reason: "This is a general practice you can try if it feels useful.",
    onStart: () => {},
    onDismiss: () => {},
    onExplain: () => {},
  };
  const render = recommendationFixture({
    width: 320,
    fontScale: 1.5,
    resolved: "light",
    platform: "android",
  });
  const screen = render(props);
  assert.ok(!screen.some(({ type }) => type === "Image"));
  const withLargeType = render({ ...props, artwork: 17 });
  assert.ok(!withLargeType.some(({ type }) => type === "Image"));
  assert.ok(
    screen.some(
      ({ type, props }) =>
        type === "AppText" && /about 3 min/i.test(props.children.join("")),
    ),
  );
  for (const text of [props.title, props.description, props.reason]) {
    const line = screen.find(
      ({ type, props }) => type === "AppText" && props.children.includes(text),
    );
    assert.ok(line, text);
    assert.ok(!line.props.numberOfLines, text);
  }
  assert.equal(recommendationControl(screen, "Start practice").length, 1);

  const withArtwork = recommendationFixture({
    width: 390,
    fontScale: 1,
    resolved: "light",
    platform: "ios",
  });
  const image = withArtwork({ ...props, artwork: 17 }).find(
    ({ type }) => type === "Image",
  );
  image.props.onError();
  const fallback = withArtwork({ ...props, artwork: 17 });
  assert.ok(!fallback.some(({ type }) => type === "Image"));
  assert.equal(recommendationControl(fallback, "Start practice").length, 1);
  const nextArtwork = withArtwork({ ...props, artwork: 18 }).find(
    ({ type }) => type === "Image",
  );
  assert.equal(nextArtwork.props.source, 18);
});

function checkinRecommendationFixture() {
  const routes = sourceModule("../src/routes.ts");
  const practiceTypes = {
    grounding: "grounding",
    focus: "grounding",
    reflection: "reflection",
    gratitude: "reflection",
    "wind-down": "rest",
  };
  return sourceModule("../src/checkin-recommendation.ts", {
    "./routes": routes,
    "./explore-practices": sourceModule("../src/explore-practices.ts", {
      "./routes": routes,
    }),
    "./progress": sourceModule("../src/progress.ts", {
      "./content": sourceModule("../src/content.ts"),
    }),
    "./routine": {
      pickDailyRoutine: () => ({
        source: "curated",
        suggestion: { activity: "breathing" },
      }),
    },
    "./techniques": {
      getTechnique: (id) => ({
        id,
        title: id,
        artwork: "ground",
        activity: {
          id: `chat-${id}`,
          durationSec: 180,
          type: practiceTypes[id],
        },
      }),
    },
    "./wellness-recommendations": {
      wellnessGoalPriority: (goals) => goals ?? [],
    },
  });
}

test("a mood suggestion uses a real one-minute Moment, respects selected goals, and varies recent repeats", () => {
  const { checkinRecommendation } = checkinRecommendationFixture();
  const now = new Date("2026-11-09T12:00:00Z");
  const reset = checkinRecommendation("Stressed", {}, null, now);
  assert.equal(reset.durationSec, 60);
  assert.equal(reset.route, "moment-player");
  assert.equal(
    reset.params.activity.steps.reduce(
      (total, step) => total + step.durationSec,
      0,
    ),
    60,
  );
  assert.match(reset.reason, /checked in as stressed/i);
  assert.equal(
    checkinRecommendation("Calm", {}, { wellnessGoals: ["focus"] }, now).id,
    "focus",
  );
  assert.equal(
    checkinRecommendation(
      "Stressed",
      {
        sessions: [
          {
            id: "completed-one-minute",
            practiceId: reset.practiceId,
            type: "breathing",
            createdAt: "2026-11-09T11:00:00Z",
            completed: true,
          },
        ],
      },
      null,
      now,
    ).id,
    "grounding",
  );
  const rechecks = {
    sessions: ["05", "06"].map((day) => ({
      id: `focus-${day}`,
      practiceId: "focus",
      type: "grounding",
      completed: true,
      createdAt: `2026-11-${day}T11:00:00Z`,
      emotionalRecheck: { response: "more-settled" },
    })),
  };
  assert.equal(
    checkinRecommendation("Calm", rechecks, null, now).id,
    "gratitude",
  );
  assert.equal(
    checkinRecommendation("Calm", rechecks, { personalization: true }, now).id,
    "focus",
  );
});

test("a saved mood offers one dismissible practice and retains the originating check-in", () => {
  const navigations = [];
  const drafts = [];
  const slots = [];
  let cursor = 0;
  const { CheckinNextStep } = sourceModule(
    "../src/screens/CheckinNextStep.tsx",
    {
      react: {
        ...renderReact,
        useRef(value) {
          return (slots[cursor++] ??= { current: value });
        },
        useState(value) {
          const index = cursor++;
          slots[index] ??= typeof value === "function" ? value() : value;
          return [
            slots[index],
            (next) => {
              slots[index] = next;
            },
          ];
        },
      },
      "react-native": {
        ...hosts("View", "Switch"),
        Platform: { OS: "android" },
        StyleSheet: { create: (styles) => styles },
      },
      "../layout": { spacing: {} },
      "../routes": sourceModule("../src/routes.ts"),
      "../store": {
        useApp: () => ({
          data: {},
          user: null,
          chatDrafts: { new: "Existing draft" },
          chatPending: {},
          setChatDraft: (...args) => drafts.push(args),
          navigate: (...args) => navigations.push(args),
        }),
      },
      "../checkin-recommendation": checkinRecommendationFixture(),
      "../technique-artwork": { techniqueArtwork: {} },
      "../theme": { useTheme: () => ({ colors: {} }) },
      "../ui": {
        ...hosts("AppText", "Button", "Card", "Row"),
        moodPetals: [{ mood: "Low" }],
      },
      "./SolaceRecommendationCard": hosts("SolaceRecommendationCard"),
    },
  );
  const render = () => {
    cursor = 0;
    return flatten(
      CheckinNextStep({
        checkin: { id: "checkin-low", mood: "Low", note: "Private note" },
      }),
    );
  };
  const controls = render().filter(
    (node) => node.type === "SolaceRecommendationCard",
  );
  assert.equal(controls.length, 1);
  controls[0].props.onStart();
  controls[0].props.onStart();
  assert.deepEqual(navigations, [
    [
      "moment-player",
      {
        techniqueId: "grounding",
        source: "today",
        originCheckinId: "checkin-low",
        startOnArrival: true,
      },
    ],
  ]);
  assert.ok(!render().some((node) => node.type === "SolaceRecommendationCard"));
  slots.length = 0;
  render()
    .find((node) => node.type === "SolaceRecommendationCard")
    .props.onDismiss();
  assert.ok(!render().some((node) => node.type === "SolaceRecommendationCard"));
  assert.equal(navigations.length, 1);
  const press = (title) =>
    render()
      .find(({ props }) => props.title === title)
      .props.onPress();
  press("Talk with Solace");
  assert.equal(drafts.length, 0);
  press("Add to my draft");
  assert.deepEqual(drafts, [
    ["new", "Existing draft\n\nI’m feeling low today."],
  ]);
  assert.deepEqual(navigations.at(-1), [
    "chat",
    { originCheckinId: "checkin-low" },
  ]);
});

test("practice recheck is optional and retries update the same completed session", async () => {
  const slots = [];
  const session = {
    id: "moment-session-demo",
    title: "Five Senses",
    durationSec: 128,
    completed: true,
  };
  const records = [session];
  const writes = [];
  let cursor = 0;
  const app = {
    data: { sessions: records },
    async save(collection, record) {
      assert.equal(collection, "sessions");
      writes.push(record);
      if (writes.length === 1) throw new Error("connection dropped");
      records[0] = { ...session, ...record };
      return records[0];
    },
  };
  const idHelper = sourceModule("../src/practice-follow-up.ts", {
    "./routes": sourceModule("../src/routes.ts"),
  });
  const { PracticeCompletion } = sourceModule(
    "../src/screens/PracticeFollowUp.tsx",
    {
      react: {
        ...renderReact,
        useRef(value) {
          return (slots[cursor++] ??= { current: value });
        },
        useState(value) {
          const index = cursor++;
          slots[index] ??= value;
          return [
            slots[index],
            (next) => {
              slots[index] = next;
            },
          ];
        },
      },
      "react-native": {
        ...hosts("View", "Pressable", "Image"),
        StyleSheet: { create: (styles) => styles },
      },
      "../Companion": hosts("Companion"),
      "../layout": { spacing: {} },
      "../practice-follow-up": idHelper,
      "../radio-keyboard": { webRadioProps: () => ({}) },
      "../routes": sourceModule("../src/routes.ts"),
      "../store": { useApp: () => app },
      "../theme": { useTheme: () => ({ colors: {} }) },
      "../ui": {
        ...hosts("AppText", "Button", "Card", "Icon"),
      },
    },
  );
  const render = () => {
    cursor = 0;
    return flatten(PracticeCompletion({ session }));
  };
  const press = (title) =>
    render()
      .find(({ props }) => props.title === title)
      .props.onPress();
  press("Skip");
  assert.ok(!render().some(({ props }) => props.title === "Continue"));
  assert.equal(writes.length, 0);
  slots.length = 0;
  render()
    .find(({ props }) => props.accessibilityRole === "radio")
    .props.onPress();
  press("Continue");
  await new Promise(setImmediate);
  press("Retry response");
  await new Promise(setImmediate);
  assert.equal(writes.length, 2);
  assert.equal(writes[0], writes[1]);
  assert.equal(writes[0].id, session.id);
  assert.equal(writes[0].emotionalRecheck.response, "more-settled");
  assert.ok(Number.isFinite(Date.parse(writes[0].emotionalRecheck.recordedAt)));
  assert.ok(
    render().some(({ props }) => props.children.includes("Response saved · ")),
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].completed, true);
  assert.equal(records[0].durationSec, 128);
  records[0] = { ...session, durationSec: 0 };
  slots.length = 0;
  assert.ok(!render().some(({ props }) => props.accessibilityRole === "radio"));
});

function brandHeaderModule(native, insets = { top: 24, left: 0, right: 0 }) {
  return sourceModule("../src/SolaceBrandHeader.tsx", {
    react: renderReact,
    "react-native": native,
    "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
    "./layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "./ui": hosts("AppText", "LotusMark", "Row"),
  });
}

test("a retained Moment pauses its active clock when the route is hidden", () => {
  const slots = [];
  const onHide = [];
  const pauses = [];
  let index = 0;
  const step = { title: "Arrive", instruction: "Settle in", durationSec: 60 };
  const activity = {
    id: "test",
    type: "grounding",
    title: "Grounding",
    steps: [step],
    durationSec: 60,
    environment: "forest",
    reflectionPrompts: [],
  };
  const app = { params: { activity }, data: { plans: [], preferences: [] } };
  const { MomentPlayerScreen } = sourceModule("../src/screens/Moments.tsx", {
    react: {
      ...renderReact,
      useCallback: (value) => value,
      useRef(value) {
        return (slots[index++] ??= { current: value });
      },
      useState(value) {
        const slot = index++;
        if (!(slot in slots))
          slots[slot] = typeof value === "function" ? value() : value;
        return [
          slots[slot],
          (next) => {
            slots[slot] = next;
          },
        ];
      },
      useLayoutEffect: (setup) => onHide.push(setup()),
    },
    "react-native": {
      ...hosts("View", "Pressable", "ScrollView", "TextInput"),
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      useWindowDimensions: () => ({ width: 360, fontScale: 1 }),
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ bottom: 0 }),
    },
    "../AmbientSound": hosts("AmbientSound"),
    "../haptics": { playHaptic: async () => {} },
    "../store": { useApp: () => app },
    "./PracticeFollowUp": {},
    "../practice-follow-up": { practiceOrigins: () => ({}) },
    "../NestedDesign": hosts("SceneIntro"),
    "../theme": { useTheme: () => ({ colors: {} }) },
    "../routes": sourceModule("../src/routes.ts"),
    "../techniques": { getTechnique: () => undefined },
    "../ui": hosts(
      "AppText",
      "BotanicalBackdrop",
      "Button",
      "Card",
      "Icon",
      "IconButton",
      "Input",
      "NestedState",
      "Row",
      "Screen",
    ),
    "../Companion": { ...hosts("Companion"), useReducedMotion: () => true },
    "../layout": { spacing: {} },
    "../Environment": {
      ...hosts("EnvironmentScene"),
      ENVIRONMENTS: [{ id: "forest" }],
    },
    "../content": { localDay: () => "2026-11-08" },
    "../moments": {
      emptyClock: () => ({ elapsedMs: 0, runningSince: null }),
      isPlayableMoment: (value) => value === activity,
      momentPosition: () => ({ step, index: 0, stepRemaining: 60 }),
      momentBreathingPosition: () => null,
      momentClockText: () => "0:00",
      newMomentSessionId: () => "moment-session-test",
      resumeMoment: (clock, now) => ({ ...clock, runningSince: now }),
      pauseMoment: (clock) => {
        pauses.push(clock.runningSince);
        return { elapsedMs: 2000, runningSince: null };
      },
    },
    "../../server/src/wellness-plans": {},
    "./RecommendationExplanation": {},
    "./GuidedBreathingPlayer": {},
    "./MomentEnvironmentPicker": hosts("EnvironmentPicker"),
    "../breathing-motion": { useBreathingMotion: () => undefined },
  });
  const render = () => {
    index = 0;
    onHide.length = 0;
    return flatten(MomentPlayerScreen());
  };
  const button = (tree, title) =>
    tree.find(({ props }) => props.title === title);
  button(render(), "Begin Moment").props.onPress();
  assert.ok(button(render(), "Pause Moment"));
  onHide.forEach((cleanup) => cleanup());
  assert.equal(pauses.length, 1);
  assert.equal(typeof pauses[0], "number");
  assert.ok(button(render(), "Continue Moment"));
  assert.ok(
    render().some(({ props }) =>
      props.children
        .flat(Infinity)
        .includes(
          "Paused while you were away. Continue whenever you're ready.",
        ),
    ),
  );
});

test("the Solace brand lockup uses the original Today metrics", () => {
  const { SolaceBrandHeader } = brandHeaderModule({
    StyleSheet: { create: (styles) => styles },
  });
  const [row, mark, text] = flatten(SolaceBrandHeader({ color: "#FFF8F2" }));
  assert.deepEqual(row.props.style[0], { gap: 6, flexShrink: 1 });
  assert.equal(mark.type, "LotusMark");
  assert.equal(mark.props.size, 30);
  assert.equal(text.type, "AppText");
  assert.deepEqual(text.props.children, ["Solace"]);
  assert.equal(text.props.variant, "heading");
  assert.equal(text.props.color, "#FFF8F2");
  assert.deepEqual(text.props.style, {
    fontSize: 24,
    lineHeight: 28,
    flexShrink: 1,
  });
  assert.equal(text.props.numberOfLines, 1);
  assert.equal(text.props.maxFontSizeMultiplier, 1.5);
});

const { lightGlass } = sourceModule("../src/theme.tsx", {
  react: { ...renderReact, createContext: () => ({}) },
  "react-native": {},
  "@react-native-async-storage/async-storage": {},
});

function renderTabRail(platform, callbacks, habitRail = false) {
  const slots = [];
  let cursor = 0;
  const useSlot = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial();
    return index;
  };
  const react = {
    ...renderReact,
    memo: (component) => component,
    useCallback: (callback) => callback,
    useRef: (current) => slots[useSlot(() => ({ current }))],
    useState(initial) {
      const index = useSlot(() =>
        typeof initial === "function" ? initial() : initial,
      );
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
  };
  const { TabBar, TabRail } = sourceModule("../src/Navigation.tsx", {
    react,
    "react-native": {
      ...hosts("Pressable", "View"),
      Animated: {
        Value: class {
          constructor(value) {
            this.value = value;
          }
          setValue(value) {
            this.value = value;
          }
        },
        View: "AnimatedView",
      },
      I18nManager: { isRTL: false },
      PanResponder: { create: (panHandlers) => ({ panHandlers }) },
      Platform: { OS: platform },
      StyleSheet: { create: (styles) => styles },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ bottom: 20 }),
    },
    "expo-blur": hosts("BlurView"),
    "expo-glass-effect": {
      ...hosts("GlassView"),
      isGlassEffectAPIAvailable: () => false,
      isLiquidGlassAvailable: () => false,
    },
    "./navigation-motion": sourceModule("../src/navigation-motion.ts"),
    "./theme": {
      lightGlass,
      useTheme: () => ({
        colors: { surface: "#FFF8F2", border: "#E6DACE" },
        resolved: "light",
      }),
    },
    "./ui": hosts("AppText", "Icon"),
  });
  const habitNames = ["today", "my-habits", "insights", "garden"];
  const habitDestinations = habitNames.map((name) => ({
    name,
    title: name,
    icon: "leaf-outline",
    active: "leaf",
  }));
  const render = () => {
    cursor = 0;
    const nodes = flatten(
      habitRail
        ? TabRail({
            activeTab: "today",
            route: "habits",
            reducedMotion: true,
            destinations: habitDestinations,
            accessibilityLabel: "Habits sections",
            ...callbacks,
          })
        : TabBar({
            activeTab: "explore",
            route: "wellness-tools",
            reducedMotion: true,
            onHeight: () => {},
            ...callbacks,
          }),
    );
    return {
      rail: nodes.find(({ props }) => props.accessibilityRole === "tablist")
        .props,
      tabs: nodes
        .filter(({ props }) => props.accessibilityRole === "tab")
        .map(({ props }) => props),
      spotlight: nodes.find(({ props }) => props.testID === "tab-spotlight")
        ?.props,
      material: nodes.find(({ props }) =>
        props.children.some(
          (child) => child?.props?.accessibilityRole === "tablist",
        ),
      )?.props.style,
    };
  };
  const { rail, tabs } = render();
  rail.ref.current = {
    measure: (callback) => callback(0, 0, 330, 62, 0, 700),
  };
  rail.onLayout({ nativeEvent: { layout: { width: 330 } } });
  for (const [index, tab] of tabs.entries()) {
    tab.onLayout({
      nativeEvent: {
        layout: habitRail
          ? { x: 5 + index * 80, width: 80 }
          : frames.get(names[index]),
      },
    });
  }
  return render();
}

test("main and Habits rail use the shared light material with a defined edge", () => {
  for (const habits of [false, true]) {
    const { material } = renderTabRail(
      "android",
      { twilight: true, onSelect() {} },
      habits,
    );
    assert.equal(material.at(-1).backgroundColor, "#FBF7FDF8");
    assert.equal(material.at(-1).borderColor, "#B8A6C7");
  }
});

for (const platform of ["ios", "android"]) {
  test(`${platform} Habits rail handles four stops, reversals, cancellation and guarded selection`, () => {
    const calls = [];
    const { rail, tabs, spotlight } = renderTabRail(
      platform,
      { onSelect: (...args) => calls.push(args), waitForSelection: true },
      true,
    );
    const x = spotlight.style.at(-1).transform[0].translateX;
    assert.equal(rail.accessibilityLabel, "Habits sections");
    assert.equal(tabs.length, 4);
    assert.equal(x.value, 27);
    for (const tab of tabs) tab.onPress({ nativeEvent: {} });
    assert.deepEqual(calls, [
      ["today", "reselect"],
      ["my-habits", "switch"],
      ["insights", "switch"],
      ["garden", "switch"],
    ]);
    assert.equal(x.value, 27);
    const move = (pageX, pageY = 720) => ({ nativeEvent: { pageX, pageY } });
    const start = (dx = 20, dy = 0) => {
      rail.onStartShouldSetPanResponderCapture({
        nativeEvent: { touches: [move(45).nativeEvent] },
      });
      assert.equal(
        rail.onMoveShouldSetPanResponderCapture(null, {
          dx,
          dy,
          numberActiveTouches: 1,
        }),
        true,
      );
      rail.onPanResponderGrant(move(65));
    };
    start();
    rail.onPanResponderMove(move(280), { numberActiveTouches: 1 });
    assert.equal(x.value, 262);
    rail.onPanResponderMove(move(105), { numberActiveTouches: 1 });
    assert.equal(x.value, 87);
    rail.onPanResponderRelease(move(125));
    assert.deepEqual(calls.at(-1), ["my-habits", "switch"]);
    assert.equal(x.value, 27);
    start();
    rail.onPanResponderTerminate();
    assert.equal(x.value, 27);
    start(4, 25);
    rail.onPanResponderRelease(move(285));
    start();
    rail.onPanResponderRelease(move(285, 900));
    assert.equal(calls.length, 5);
    assert.equal(x.value, 27);
  });
}

for (const platform of ["android", "ios"]) {
  test(`${platform} rail separates active presses from swipe switches and settles the spotlight`, () => {
    const actions = [];
    const { rail, tabs, spotlight } = renderTabRail(platform, {
      onSelect: (...action) => actions.push(action),
    });
    assert.equal(tabs.length, 5);
    for (const tab of tabs) {
      assert.equal(tab.android_ripple, undefined);
      const pressed = Object.assign({}, ...tab.style({ pressed: true }));
      assert.equal(pressed.backgroundColor, "transparent");
      assert.ok(pressed.opacity < 1);
    }
    assert.equal(spotlight.style[0].borderRadius * 2, spotlight.style[0].width);
    const press = (index) => tabs[index].onPress({ nativeEvent: {} });
    const x = spotlight.style.at(-1).transform[0].translateX;
    const center = (tab) => stops.find(({ name }) => name === tab).center;
    const expectedX = (tab) => center(tab) - 18;
    const swipe = (destination) => {
      const start = { pageX: center("explore"), pageY: 720 };
      const pastThreshold = { pageX: center("explore") + 22, pageY: 720 };
      rail.onStartShouldSetPanResponderCapture({
        nativeEvent: { touches: [start] },
      });
      assert.equal(
        rail.onMoveShouldSetPanResponderCapture(null, {
          dx: 22,
          dy: 0,
          numberActiveTouches: 1,
        }),
        true,
      );
      rail.onPanResponderGrant({ nativeEvent: pastThreshold });
      rail.onPanResponderRelease({
        nativeEvent: { pageX: center(destination), pageY: 720 },
      });
    };

    assert.equal(x.value, expectedX("explore"));
    press(2);
    assert.deepEqual(actions, [["explore", "reselect"]]);
    assert.equal(x.value, expectedX("explore"));
    press(0);
    assert.equal(x.value, expectedX("today"));
    swipe("explore");
    assert.equal(x.value, expectedX("explore"));
    swipe("journey");
    assert.equal(x.value, expectedX("journey"));
    assert.deepEqual(actions, [
      ["explore", "reselect"],
      ["today", "switch"],
      ["journey", "switch"],
    ]);
  });
}

test("one web touch and its synthetic click dispatch a single active tab reselection", () => {
  const actions = [];
  const { tabs } = renderTabRail("web", {
    onSelect: (...action) => actions.push(action),
  });
  const tab = tabs[2];
  const touch = { identifier: 1, pageX: 165, pageY: 720 };
  let prevented = false;
  tab.onTouchStart({ nativeEvent: { touches: [touch] } });
  tab.onTouchEnd({
    nativeEvent: { changedTouches: [touch] },
    preventDefault: () => {
      prevented = true;
    },
  });
  tab.onPress({ nativeEvent: { ...touch, detail: 1, pointerType: "touch" } });
  assert.equal(prevented, true);
  assert.deepEqual(actions, [["explore", "reselect"]]);

  tab.onPress({ nativeEvent: { detail: 0 } });
  assert.deepEqual(actions, [
    ["explore", "reselect"],
    ["explore", "reselect"],
  ]);
});

const exploreRoutes = sourceModule("../src/routes.ts");
const explorePractices = sourceModule("../src/explore-practices.ts", {
  "./routes": exploreRoutes,
});

function renderExplore(app, resolved = "light") {
  const practices = explorePractices;
  const routes = exploreRoutes;
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
    "../DaylightScenicFade": sourceModule("../src/DaylightScenicFade.tsx", {
      react: renderReact,
      "react-native": native,
    }),
    "../DaylightScenicScrim": sourceModule("../src/DaylightScenicScrim.tsx", {
      react: renderReact,
      "react-native": native,
      "./theme": { artGradient: (backgroundImage) => ({ backgroundImage }) },
    }),
    "../explore-practices": practices,
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../radio-keyboard": sourceModule("../src/radio-keyboard.ts", {
      "react-native": native,
    }),
    "../routes": routes,
    "../SolaceBrandHeader": brandHeaderModule(native),
    "../store": { useApp: () => app },
    "../theme": {
      artGradient: (backgroundImage) => ({ backgroundImage }),
      useTheme: () => ({ colors: {}, resolved }),
    },
    "../ui": hosts(
      "AppText",
      "Button",
      "Icon",
      "IconButton",
      "LotusMark",
      "NestedState",
      "Row",
      "Screen",
    ),
    "../wellness-tools": sourceModule("../src/wellness-tools.ts", {
      "./explore-practices": practices,
      "./routes": routes,
    }),
    "../wellness-recommendations": sourceModule(
      "../src/wellness-recommendations.ts",
      {
        "../server/src/wellness-goals": sourceModule(
          "../server/src/wellness-goals.ts",
        ),
        "./explore-practices": practices,
        "./routes": routes,
      },
    ),
  });

  return flatten(ExploreScreen());
}

test("Explore applies the native reading treatment only to light artwork", () => {
  const readingWidths = (screen) =>
    screen.flatMap(({ type, props }) => {
      if (type !== "View" || !Array.isArray(props.style)) return [];
      const [base, dimensions] = props.style;
      return base?.position === "absolute" &&
        base.backgroundColor &&
        ["38%", "65%", "70%"].includes(dimensions?.width)
        ? [dimensions.width]
        : [];
    });
  assert.deepEqual(readingWidths(renderExplore({})), ["38%", "70%"]);
  assert.deepEqual(readingWidths(renderExplore({}, "dark")), []);
});

test("Explore puts chosen goals first and keeps the usual practice recommendations", () => {
  const screen = renderExplore({
    user: { wellnessGoals: ["sleep", "explore"] },
    navigate() {},
  });
  const recommendations = screen.findIndex(
    ({ props }) =>
      props.accessibilityRole === "header" &&
      props.children.includes("Recommended for You"),
  );
  const later = screen.slice(recommendations);
  const sleep = later.findIndex(
    ({ props }) => props.accessibilityLabel === "Sleep Wind Down",
  );
  const breath = later.findIndex(
    ({ props }) => props.accessibilityLabel === "Breath Reset",
  );
  assert.ok(sleep >= 0 && breath > sleep);
});

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

test("Explore filters keep illustrated cards and open the original destinations", () => {
  for (const [category, label, destination] of [
    ["breathe", "Breath Reset", "breathing"],
    ["reflect", "Quick Reflection", "reflection"],
    ["sleep", "Sleep Wind Down", "moment-player"],
    ["focus", "Five Senses", "moment-player"],
    ["move", "Gentle Movement", "moment-player"],
  ]) {
    const calls = [];
    const screen = renderExplore({
      params: { exploreView: { category, query: "", searchOpen: false } },
      navigate: (route) => calls.push(route),
    });
    const card = screen.find(({ props }) => props.accessibilityLabel === label);
    assert.ok(card, label);
    assert.ok(
      flatten(card.props.children).some(({ type }) => type === "Image"),
      label,
    );
    assert.ok(
      !screen.some(
        ({ props }) => props.accessibilityLabel === "Create Your Wellness Plan",
      ),
    );
    card.props.onPress();
    assert.deepEqual(calls, [destination]);
  }
  const empty = renderExplore({
    params: {
      exploreView: {
        category: "all",
        query: "no match expected",
        searchOpen: true,
      },
    },
  });
  assert.ok(empty.some(({ props }) => props.title === "No practices found"));
});

test("Wellness Tools groups every legacy destination and gives reference shortcuts real routes", () => {
  const { exploreWellnessTools, wellnessToolGroups } = sourceModule(
    "../src/wellness-tools.ts",
    {
      "./explore-practices": explorePractices,
      "./routes": exploreRoutes,
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
  assert.equal(allTools.length, 13);
  assert.equal(new Set(allTools.map(({ title }) => title)).size, 13);
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
  assert.equal(destination("Quick Reflection").route, "reflection");
  assert.match(destination("Gratitude Journal").params.prompt, /appreciated/i);
});

test("Explore recommendations and shortcuts are single accessible actions with their existing destinations", () => {
  const destinations = [];
  const screen = renderExplore({
    navigate: (route, params) => destinations.push([route, params]),
  });
  const { createExplorePractice } = explorePractices;
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
      ["guided-programs", undefined],
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
      ["assessments", undefined],
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

test("the illustrated Wellness Plan banner and Guided Programs stay in place and open distinct flows", () => {
  const destinations = [];
  const screen = renderExplore({
    navigate: (route) => destinations.push(route),
  });
  const indexOf = (label) =>
    screen.findIndex(
      ({ props }) =>
        props.accessibilityLabel === label ||
        (props.accessibilityRole === "header" &&
          props.children.includes(label)),
    );
  const order = [
    "Recommended for You",
    "Create Your Wellness Plan",
    "Explore More",
    "Guided Programs",
    "Wellness Toolkit",
    "Reflective Check-ins",
    "Wellness Tools",
    "Build a Timed Practice",
  ].map(indexOf);
  assert.ok(
    order.every((index, position) => index > (order[position - 1] ?? -1)),
  );

  const banner = screen[order[1]];
  const children = flatten(banner.props.children);
  assert.equal(banner.type, "Pressable");
  assert.equal(banner.props.accessibilityRole, "button");
  assert.equal(
    banner.props.accessibilityHint,
    "Opens your editable three-day plan",
  );
  assert.ok(
    children.some(
      ({ type, props }) =>
        type === "Image" &&
        props.source.endsWith("redesign-explore-feature-light.jpg"),
    ),
  );
  const darkBanner = renderExplore({}, "dark").find(
    ({ props }) => props.accessibilityLabel === "Create Your Wellness Plan",
  );
  assert.ok(
    flatten(darkBanner.props.children).some(
      ({ type, props }) =>
        type === "Image" && props.source.endsWith("today-explore-guided.jpg"),
    ),
  );
  assert.ok(
    children.some(({ props }) =>
      props.children.includes("Choose a goal and build a three-day routine."),
    ),
  );
  for (const index of [order[1], order[3], order[7]])
    screen[index].props.onPress();
  assert.deepEqual(destinations, ["plan", "guided-programs", "timed-practice"]);
});

function wellnessModule(app, { react = renderReact, guard, suggestion } = {}) {
  return sourceModule("../src/screens/Wellness.tsx", {
    react,
    "react-native": {
      ...hosts("View", "Text", "TextInput", "Pressable"),
      StyleSheet: { create: (styles) => styles },
      useWindowDimensions: () => ({ width: 360, fontScale: 1 }),
    },
    "@expo/vector-icons/Ionicons": {},
    "../../server/src/weekly-facts": {},
    "../store": { useApp: () => app },
    "../navigation-reset": {
      useTabResetGuard: guard,
      useGuardedBack: (back) => back,
    },
    "../radio-keyboard": { webRadioProps: () => ({}) },
    "../layout": { spacing: {} },
    "../NestedDesign": hosts("SceneIntro", "EditorialSection"),
    "../habits-ui": { starterHabits: [suggestion] },
    "../routes": sourceModule("../src/routes.ts"),
    "../theme": { useTheme: () => ({ colors: {} }) },
    "../Companion": {},
    "../journey-analytics": {},
    "../journey-goals": {},
    "../weekly-story": {},
    "../moments": {},
    "../breathing-motion": {},
    "./WeeklyStory": {},
    "./CheckinNextStep": {},
    "../haptics": { playHaptic: async () => {} },
    "./PracticeFollowUp": hosts("PracticeCompletion"),
    "../practice-follow-up": { practiceFollowUpId: () => undefined },
    "../ui": hosts("Button", "Card", "NestedHeader", "NestedState", "Screen"),
    "../content": sourceModule("../src/content.ts"),
  }).default;
}

test("wellness routes recover from missing records and send habit suggestions to the habit editor", () => {
  const navigations = [];
  const suggestion = { activity: "breathing" };
  const app = {
    params: {},
    data: { assessments: [] },
    navigate: (route, params) => navigations.push([route, params]),
  };
  const WellnessScreen = wellnessModule(app, { suggestion });
  const render = (name) => flatten(WellnessScreen({ name }));
  const press = (screen, label) =>
    screen
      .find(
        ({ props }) =>
          props.title === label || props.accessibilityLabel === label,
      )
      .props.onPress();
  for (const [name, empty, label, destination] of [
    ["resource", "Guide unavailable", "Browse resources", "resources"],
    ["assessment", "Check-in unavailable", "View check-ins", "assessments"],
    [
      "assessment-result",
      "Reflection unavailable",
      "View check-ins",
      "assessments",
    ],
  ]) {
    app.params = { id: "missing" };
    const screen = render(name);
    assert.ok(
      screen.some(
        ({ type, props }) => type === "NestedState" && props.title === empty,
      ),
    );
    press(screen, label);
    assert.deepEqual(navigations.pop(), [destination, undefined]);
  }
  app.params = {
    result: { summary: { title: "A reflection", text: "Saved." } },
  };
  press(render("assessment-result"), "Add a calming habit");
  assert.deepEqual(navigations.pop(), ["habit-create", { suggestion }]);
});

test("a completed classic practice survives leaving without feedback, and a retry keeps its identity", async () => {
  const session = { id: "grounding-run", type: "grounding", completed: true };
  const writes = [];
  const guards = [];
  const slots = [];
  const effects = [];
  let index = 0;
  const app = {
    params: { session },
    editorDrafts: {},
    data: { sessions: [] },
    setEditorDraft: () => {},
    save: async (collection, record) => {
      assert.equal(collection, "sessions");
      writes.push(record);
      if (writes.length === 1) throw Error("Network unavailable");
      app.data.sessions = [record];
      return record;
    },
  };
  const WellnessScreen = wellnessModule(app, {
    guard: (...value) => guards.push(value),
    react: {
      ...renderReact,
      useState(initial) {
        const slot = index++;
        if (!(slot in slots))
          slots[slot] = typeof initial === "function" ? initial() : initial;
        return [slots[slot], (value) => (slots[slot] = value)];
      },
      useRef(initial) {
        const slot = index++;
        return (slots[slot] ??= { current: initial });
      },
      useEffect: (effect) => effects.push(effect),
    },
  });
  function render() {
    index = 0;
    const screen = flatten(WellnessScreen({ name: "feedback" }));
    for (const effect of effects.splice(0)) effect();
    return screen;
  }
  function button(screen, title) {
    return screen.find((node) => node.props.title === title).props;
  }
  assert.equal(button(render(), "Saving practice…").disabled, true);
  assert.deepEqual(guards.at(-1), [true, "saving"]);
  await new Promise(setImmediate);
  const retry = button(render(), "Retry saving practice");
  assert.equal(retry.disabled, false);
  assert.deepEqual(guards.at(-1), [true, "dirty"]);
  await retry.onPress();
  assert.ok(button(render(), "View my Journey").onPress);
  assert.deepEqual(guards.at(-1), [false, "dirty"]);
  assert.deepEqual(writes, [session, session]);
  assert.deepEqual(app.data.sessions, [session]);
});

function profileView(app, theme = {}, fixture = {}) {
  const native = {
    ...hosts("Image", "Modal", "Pressable", "ScrollView", "Switch", "View"),
    Platform: { OS: fixture.platform || "android" },
    Share: fixture.share,
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 320, fontScale: 1.5 }),
  };
  const themeTokens = sourceModule("../src/theme.tsx", {
    react: require("react"),
    "react-native": native,
    "@react-native-async-storage/async-storage": {},
  });
  const shared = {
    react: renderReact,
    "react-native": native,
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24 }),
    },
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../routes": sourceModule("../src/routes.ts"),
    "../SolaceBrandHeader": brandHeaderModule(native),
    "../store": { useApp: () => app },
    "../useReminderPermission": {
      useReminderDelivery: () => [
        fixture.delivery ?? { permission: "checking", scheduled: new Set() },
        () => {},
      ],
    },
    "../reminder-time": sourceModule("../src/reminder-time.ts"),
    "../switch-colors": sourceModule("../src/switch-colors.ts", {
      "react-native": native,
    }),
    "../radio-keyboard": { webRadioProps: () => ({}) },
    "../habit-reminders": {},
    "../NestedDesign": hosts("EditorialSection", "SceneIntro"),
    "../theme": {
      lightColors: themeTokens.lightColors,
      darkColors: themeTokens.darkColors,
      artGradient: (backgroundImage) => ({ backgroundImage }),
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
      "NestedHeader",
      "NestedState",
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
      "../haptics": { playHaptic: async () => {} },
      "../Companion": { useReducedMotion: () => true },
      "../navigation-reset": { useTabResetGuard: () => {} },
      "../photos": {},
      "../notifications": {},
      "../save-reminder": {},
      "expo-file-system/legacy": fixture.storage ?? {},
      "./DeviceLock": hosts("DeviceLockSettingsCard"),
      "./GoogleAccountLink": hosts("GoogleAccountLink"),
      "./ReminderTimePicker": sourceModule(
        "../src/screens/ReminderTimePicker.tsx",
        shared,
      ),
      "./ProfileHome": sourceModule("../src/screens/ProfileHome.tsx", shared)
        .default,
    },
  );
  return (name) => flatten(ProfileScreen({ name }));
}

test("Profile separates account editing and sign-out from privacy and sync", () => {
  const destinations = [];
  const app = {
    user: { id: "profile-fixture", name: "Test User" },
    data: { reminders: [], memories: [] },
    pendingWrites: [
      { id: "draft", collection: "reflections", createdAt: "2026-11-09" },
    ],
    navigate: (...destination) => destinations.push(destination),
  };
  const render = profileView(app);
  const account = render("account");
  assert.ok(account.some(({ type }) => type === "GoogleAccountLink"));
  assert.ok(account.some(({ props }) => props.title === "Log out"));
  assert.ok(!account.some(({ props }) => props.title === "Export my data"));
  assert.ok(!account.some(({ props }) => props.title === "Delete my account…"));
  account
    .find(({ props }) => props.accessibilityLabel === "Privacy & data")
    .props.onPress();
  assert.deepEqual(destinations, [["account", { section: "privacy" }]]);
  app.params = destinations[0][1];
  const privacy = render("account");
  assert.ok(privacy.some(({ props }) => props.title === "Export my data"));
  assert.ok(privacy.some(({ props }) => props.title === "Delete my account…"));
  assert.ok(privacy.some(({ props }) => props.title === "Retry sync"));
  assert.ok(!privacy.some(({ props }) => props.title === "Log out"));
  assert.ok(
    !privacy.some(({ props }) => props.accessibilityLabel === "Your name"),
  );
});

test("Profile shows saved reminders as blocked when device delivery is disabled", () => {
  const app = {
    route: "profile",
    data: {
      reminders: [
        {
          id: "r1",
          title: "Check-in",
          hour: 8,
          minute: 30,
          days: [1],
          enabled: true,
        },
      ],
      memories: [],
    },
    pendingWrites: [],
  };
  const render = profileView(
    app,
    {},
    { delivery: { permission: "blocked", scheduled: new Set() } },
  );
  assert.ok(
    render("profile").some(
      ({ props }) =>
        props.accessibilityLabel === "Gentle reminders" &&
        props.accessibilityValue?.text === "Blocked",
    ),
  );
  const reminders = render("reminders");
  assert.ok(
    reminders.some(({ props }) => props.title === "Open notification settings"),
  );
  assert.ok(
    reminders.some(({ props }) =>
      JSON.stringify(props.children)?.includes("Saved · Notifications blocked"),
    ),
  );
  assert.ok(
    reminders.some(
      ({ props }) =>
        props.accessibilityLabel === "Reminder time" &&
        props.accessibilityValue?.text === "08:00 PM",
    ),
  );
  assert.ok(
    reminders.some(
      ({ props }) => props.title === "Schedule a test notification",
    ),
  );
});

test("Gentle Reminders adjusts AM/PM wheel values and only commits after Set time", () => {
  let index = 0;
  const state = [];
  const dismissals = [];
  const committed = [];
  const native = {
    ...hosts("Modal", "Pressable", "ScrollView", "View"),
    Keyboard: { dismiss: () => dismissals.push("dismiss") },
    Platform: { OS: "android" },
    StyleSheet: { create: (styles) => styles },
    useWindowDimensions: () => ({ width: 320, fontScale: 2 }),
  };
  const { ReminderTimePicker } = sourceModule(
    "../src/screens/ReminderTimePicker.tsx",
    {
      react: {
        ...renderReact,
        useState(initial) {
          const slot = index++;
          if (!(slot in state))
            state[slot] = typeof initial === "function" ? initial() : initial;
          return [
            state[slot],
            (next) => {
              state[slot] =
                typeof next === "function" ? next(state[slot]) : next;
            },
          ];
        },
      },
      "react-native": native,
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }),
      },
      "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
      "../radio-keyboard": { webRadioProps: () => ({}) },
      "../reminder-time": sourceModule("../src/reminder-time.ts"),
      "../theme": { useTheme: () => ({ colors: {}, resolved: "dark" }) },
      "../ui": hosts("AppText", "Button", "Icon", "Row"),
    },
  );
  function render() {
    index = 0;
    return flatten(
      ReminderTimePicker({
        value: committed.at(-1) ?? { hour: 12, minute: 59 },
        onChange: (time) => committed.push(time),
        disabled: false,
        reducedMotion: true,
      }),
    );
  }
  const find = (nodes, label) =>
    nodes.find(({ props }) => props.accessibilityLabel === label).props;
  const act = (nodes, label, actionName) =>
    find(nodes, label).onAccessibilityAction({ nativeEvent: { actionName } });
  const modal = (nodes) => nodes.find(({ type }) => type === "Modal").props;
  const trigger = (nodes) => find(nodes, "Reminder time");
  assert.equal(trigger(render()).accessibilityValue.text, "12:59 PM");

  trigger(render()).onPress();
  let nodes = render();
  assert.equal(modal(nodes).visible, true);
  assert.equal(modal(nodes).animationType, "none");
  assert.equal(find(nodes, "Hour").accessibilityValue.now, 12);
  assert.equal(find(nodes, "Minute").accessibilityValue.text, "59");
  act(nodes, "AM/PM", "decrement");
  nodes = render();
  assert.equal(find(nodes, "AM/PM").accessibilityValue.text, "AM");
  modal(nodes).onRequestClose();
  assert.equal(modal(render()).visible, false);
  assert.deepEqual(committed, []);
  assert.equal(trigger(render()).accessibilityValue.text, "12:59 PM");

  trigger(render()).onPress();
  nodes = render();
  assert.equal(find(nodes, "AM/PM").accessibilityValue.text, "PM");
  act(nodes, "AM/PM", "decrement");
  const minuteWheel = render().filter(
    ({ type, props }) => type === "ScrollView" && props.snapToInterval,
  )[1].props;
  assert.ok(minuteWheel.snapToInterval >= 48);
  minuteWheel.onScroll({
    nativeEvent: { contentOffset: { y: 30 * minuteWheel.snapToInterval } },
  });
  render()
    .find(({ props }) => props.title === "Set time")
    .props.onPress();
  assert.deepEqual(committed, [{ hour: 0, minute: 30 }]);
  assert.equal(trigger(render()).accessibilityValue.text, "12:30 AM");
  assert.equal(modal(render()).visible, false);
  assert.equal(dismissals.length, 2);
});

test("native Profile export writes JSON files instead of sharing their contents as text", async () => {
  const payload = { records: [{ id: "synthetic" }] };
  const app = {
    data: { reminders: [], memories: [] },
    pendingWrites: [],
    params: { section: "privacy" },
    exportData: async () => payload,
  };
  const calls = [];
  const exportPress = (render) =>
    render("account")
      .find(({ props }) => props.title === "Export my data")
      .props.onPress();
  const android = profileView(
    app,
    {},
    {
      storage: {
        StorageAccessFramework: {
          requestDirectoryPermissionsAsync: async () => ({
            granted: true,
            directoryUri: "content://folder",
          }),
          createFileAsync: async (...args) => {
            calls.push(["create", ...args]);
            return "content://file";
          },
          writeAsStringAsync: async (uri, json) =>
            calls.push(["write", uri, JSON.parse(json)]),
        },
      },
    },
  );
  await exportPress(android);
  assert.deepEqual(calls, [
    ["create", "content://folder", "solace-data.json", "application/json"],
    ["write", "content://file", payload],
  ]);

  calls.length = 0;
  const ios = profileView(
    app,
    {},
    {
      platform: "ios",
      storage: {
        cacheDirectory: "file:///cache/",
        makeDirectoryAsync: async (path) => calls.push(["create", path]),
        writeAsStringAsync: async (path, json) =>
          calls.push(["write", path, JSON.parse(json)]),
        deleteAsync: async (path) => calls.push(["delete", path]),
      },
      share: {
        sharedAction: "sharedAction",
        share: async (options) => {
          calls.push(["share", options]);
          return { action: "sharedAction" };
        },
      },
    },
  );
  await exportPress(ios);
  const folder = calls[0][1];
  assert.match(folder, /^file:\/\/\/cache\/solace-export-/);
  assert.deepEqual(calls, [
    ["create", folder],
    ["write", folder + "solace-data.json", payload],
    ["share", { url: folder + "solace-data.json" }],
    ["delete", folder],
  ]);
});

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
  const theme = {
    mode: "system",
    setMode(mode) {
      changes.push(mode);
      theme.mode = mode;
    },
  };
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
  const themeGroups = screen.filter(
    ({ props }) => props.accessibilityRole === "radiogroup",
  );
  assert.equal(themeGroups.length, 1);
  assert.equal(themeGroups[0].props.style[1].flexDirection, "column");
  const previewCanvases = (option) => {
    const graphic = flatten(option).find(
      ({ props }) => props["aria-hidden"] && props.pointerEvents === "none",
    );
    return flatten(graphic.props.children)
      .filter(
        ({ props }) => Array.isArray(props.style) && props.style[0]?.flex === 1,
      )
      .map(({ props }) => props.style[1].backgroundColor);
  };
  const optionFor = (mode) =>
    screen.find(
      ({ props }) => props.accessibilityLabel === `${mode} appearance`,
    );
  const [light] = previewCanvases(optionFor("Light"));
  const [dark] = previewCanvases(optionFor("Dark"));
  assert.notEqual(light, dark);
  assert.deepEqual(previewCanvases(optionFor("System")), [light, dark]);
  for (const mode of ["Light", "Dark", "System"]) {
    const option = render("settings").find(
      ({ props }) => props.accessibilityLabel === `${mode} appearance`,
    );
    assert.equal(option.props.accessibilityRole, "radio");
    option.props.onPress();
    const selected = render("settings").filter(
      ({ props }) =>
        props.accessibilityRole === "radio" && props.accessibilityState.checked,
    );
    assert.deepEqual(
      selected.map(({ props }) => props.accessibilityLabel),
      [`${mode} appearance`],
    );
  }
  assert.ok(screen.some(({ type }) => type === "DeviceLockSettingsCard"));
  assert.ok(
    screen.some(({ props }) =>
      props.children.includes("Sound and accessibility"),
    ),
  );
  const ambient = screen.find(
    ({ props }) =>
      props.accessibilityLabel === "Open Ambient sound preferences",
  );
  ambient.props.onPress();
  assert.deepEqual(destinations, ["ambient-sound-preferences"]);

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

test("Profile links open a single nested destination with Back", () => {
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
  for (const [title, destination, header = title] of [
    ["What Solace remembers", ["memory", undefined]],
    ["Gentle reminders", ["reminders", undefined]],
    ["Privacy & data", ["account", { section: "privacy" }]],
    ["About Solace", ["about", undefined]],
    ["Appearance & preferences", ["settings", undefined]],
    ["Find human support", ["support", undefined], "Find support"],
    ["Edit Profile", ["account"], "Your account"],
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
    const nodes = render(name);
    assert.equal(
      nodes.find(({ type }) => type === "Screen").props.variant,
      "nested",
    );
    const headings = nodes.filter(({ type }) => type === "NestedHeader");
    assert.equal(headings.length, 1);
    assert.equal(headings[0].props.title, header);
    headings[0].props.onBack();
  }
  assert.equal(returns, 7);
});

test("Profile exposes urgent guidance and both support links ahead of the location field", () => {
  const support = profileView({ data: { reminders: [], memories: [] } })(
    "support",
  );
  const urgent = support.findIndex(({ props }) =>
    props.children.includes("If you are in immediate danger"),
  );
  const local = support.findIndex(
    ({ props }) => props.accessibilityLabel === "Find local support resources",
  );
  const professional = support.findIndex(
    ({ props }) => props.accessibilityLabel === "Find professional care",
  );
  const location = support.findIndex(
    ({ props }) => props.accessibilityLabel === "Country or region",
  );
  assert.ok(
    urgent >= 0 &&
      urgent < local &&
      local < professional &&
      professional < location,
  );
  assert.equal(support[local].props.accessibilityRole, "link");
  assert.equal(support[professional].props.accessibilityRole, "link");
});

function deviceLockView(app, resolved) {
  const slots = [];
  let cursor = 0;
  const colors = { bg: resolved === "dark" ? "#16131b" : "#faf6ef" };
  const { DeviceLockSettingsCard, DeviceUnlockScreen, DevicePrivacyCover } =
    sourceModule("../src/screens/DeviceLock.tsx", {
      react: {
        ...renderReact,
        useState(initial) {
          const index = cursor++;
          if (index >= slots.length) slots.push(initial);
          return [slots[index], (next) => (slots[index] = next)];
        },
      },
      "react-native": {
        ...hosts("View", "Switch", "Pressable"),
        Platform: { OS: "android" },
        StyleSheet: {
          create: (styles) => styles,
          absoluteFill: { position: "absolute" },
        },
      },
      "expo-status-bar": hosts("StatusBar"),
      "../device-lock": { deviceLockDelays: [0, 60, 300] },
      "../layout": { spacing: { compact: 8, row: 12, card: 16 } },
      "../switch-colors": { switchColors: () => ({}) },
      "../radio-keyboard": { webRadioProps: () => ({}) },
      "../store": { useApp: () => app },
      "../theme": { useTheme: () => ({ colors, resolved }) },
      "../ui": hosts("AppText", "Button", "Card", "Icon", "Row", "Screen"),
    });
  return {
    settings() {
      cursor = 0;
      return flatten(DeviceLockSettingsCard());
    },
    unlock() {
      cursor = 0;
      return flatten(DeviceUnlockScreen({ scope: "app" }));
    },
    cover: () => flatten(DevicePrivacyCover()),
    colors,
  };
}

test("biometric settings expose the selected delay and preserve the other lock scope", () => {
  const updates = [];
  const app = {
    deviceLock: { appDelay: 60, journal: true },
    updateDeviceLock: async (settings) => updates.push(settings),
  };
  const view = deviceLockView(app, "dark");
  const screen = view.settings();
  const choices = screen.filter(
    ({ props }) => props.accessibilityRole === "radio",
  );
  assert.deepEqual(
    choices.map(({ props }) => props.accessibilityState.checked),
    [false, true, false],
  );
  choices[1].props.onPress();
  choices[2].props.onPress();
  const journal = screen.find(
    ({ props }) => props.accessibilityLabel === "Lock My Journal",
  );
  journal.props.onValueChange(false);
  assert.deepEqual(updates, [
    { appDelay: 300, journal: true },
    { appDelay: 60, journal: false },
  ]);
  app.deviceLockBusy = true;
  assert.ok(
    view
      .settings()
      .filter(({ props }) => props.accessibilityRole === "radio")
      .every(({ props }) => props.disabled),
  );
});

const button = (screen, title) =>
  screen.find(({ type, props }) => type === "Button" && props.title === title);

test("biometric fallback keeps manual retry and sign-in recovery in both themes", () => {
  for (const theme of ["light", "dark"]) {
    const actions = [];
    const app = {
      appUnlock: {
        phase: "fallback",
        message: "Biometric confirmation did not finish.",
        canRetry: true,
      },
      unlockDeviceLock: async (scope) => actions.push(scope),
      signOut: async () => actions.push("sign-out"),
    };
    const view = deviceLockView(app, theme);
    const fallback = view.unlock();
    assert.ok(
      fallback.some(
        ({ props }) =>
          props.accessibilityRole === "header" &&
          props.children.includes("Unlock Solace"),
      ),
    );
    assert.equal(
      fallback.find(({ type }) => type === "StatusBar").props.style,
      theme === "dark" ? "light" : "dark",
    );
    assert.ok(
      fallback.some(
        ({ props }) =>
          props.accessibilityRole === "alert" &&
          props.children.includes(app.appUnlock.message),
      ),
    );
    assert.deepEqual(actions, []);
    button(fallback, "Unlock with biometrics").props.onPress();
    button(fallback, "Sign in again instead").props.onPress();
    let recovery = view.unlock();
    assert.equal(
      button(recovery, "Unlock with biometrics").props.disabled,
      true,
    );
    button(recovery, "Keep this session").props.onPress();
    assert.ok(button(view.unlock(), "Sign in again instead"));
    button(view.unlock(), "Sign in again instead").props.onPress();
    recovery = view.unlock();
    button(recovery, "Sign out and sign in again").props.onPress();
    assert.deepEqual(actions, ["app", "sign-out"]);
  }
});

test("the neutral biometric cover has no unlock actions and unavailable proof still offers recovery", () => {
  for (const theme of ["light", "dark"]) {
    const app = {
      appUnlock: { phase: "prompting" },
      deviceLock: { appDelay: 0, journal: false },
    };
    const view = deviceLockView(app, theme);
    const cover = view.cover();
    const [surface] = cover;
    assert.equal(surface.props.accessibilityViewIsModal, true);
    assert.equal(surface.props.style.at(-1).backgroundColor, view.colors.bg);
    assert.deepEqual(
      cover
        .filter(({ type }) => type === "AppText")
        .flatMap(({ props }) => props.children),
      ["Solace"],
    );
    assert.equal(
      cover.some(({ type }) => type === "Button"),
      false,
    );

    app.appUnlock = { phase: "fallback", canRetry: false };
    const fallback = view.unlock();
    assert.equal(button(fallback, "Unlock with biometrics"), undefined);
    assert.ok(button(fallback, "Sign in again instead"));
  }
});
