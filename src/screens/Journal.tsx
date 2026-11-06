import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { localDay } from "../content";
import { spacing, useScreenGutter } from "../layout";
import { useListScrollRestore } from "../list-scroll";
import { isRecordId, routes } from "../routes";
import {
  isJournalRecord as isJournal,
  journalWriting as writing,
} from "../journal-record";
import { type EditorDraft, type Item, useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  Button,
  coverImageStyle,
  Icon,
  IconButton,
  Input,
  MoodPetal,
  moodPetals,
  Row,
  Screen,
  useNavigationInset,
} from "../ui";
import { SolaceModeSwitcher } from "./SolaceModeSwitcher";

const notebook = require("../../assets/redesign-explore-reflect.jpg");
const twilightNotebook = require("../../assets/solace-journal-twilight.jpg");
const landscapes = {
  light: require("../../assets/journal-thumbnail-light.jpg"),
  dark: require("../../assets/journal-thumbnail-dark.jpg"),
};

const titleOf = (record: Item) =>
  typeof record.title === "string" && record.title.trim()
    ? record.title
    : "Untitled entry";
const entryDate = (record: Item) => {
  const date = new Date(record.createdAt);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
};
const moodOf = (value: unknown) =>
  moodPetals.find(({ mood }) => mood === value)?.mood;
const tagsOf = (record?: Item) =>
  Array.isArray(record?.tags)
    ? record.tags.filter(
        (tag: unknown): tag is string => typeof tag === "string",
      )
    : [];
const failure = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const enteredTags = (value: string) => [
  ...new Set(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

function JournalHeader({
  title,
  back,
  backLabel = "Go back",
  children,
}: {
  title: string;
  back: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <Row style={styles.header}>
      <IconButton name="chevron-back" label={backLabel} onPress={back} />
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={styles.headerTitle}
      >
        {title}
      </AppText>
      {children}
    </Row>
  );
}

function JournalHeaderAction(props: React.ComponentProps<typeof IconButton>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.headerAction, { backgroundColor: colors.surface }]}>
      <IconButton {...props} />
    </View>
  );
}

function JournalPrivacyMarkers() {
  const { colors } = useTheme();
  return (
    <View style={styles.markers}>
      {(
        [
          ["lock-closed-outline", "Private by default"],
          ["leaf-outline", "Track your mood"],
          ["sparkles-outline", "Optional AI insights"],
        ] as const
      ).map(([icon, label]) => (
        <View key={label} style={styles.marker}>
          <View
            style={[
              styles.markerIcon,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Icon name={icon} size={18} color={colors.lavenderText} />
          </View>
          <AppText variant="caption" style={styles.markerLabel}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function JournalNotice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="caption"
      color={error ? colors.danger : colors.muted}
      accessibilityLiveRegion="polite"
    >
      {children}
    </AppText>
  );
}

function JournalChip({
  label,
  selected,
  onPress,
  petal,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  petal?: (typeof moodPetals)[number]["image"];
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.tabActiveSurface : colors.surface,
          borderColor: selected ? colors.lavender : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {petal && <MoodPetal source={petal} style={styles.petal} />}
      <AppText
        variant="caption"
        color={selected ? colors.tabActiveText : colors.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function EntryMeta({ record }: { record: Item }) {
  const { colors } = useTheme();
  const date = entryDate(record);
  const mood = moodPetals.find((choice) => choice.mood === record.mood);
  return (
    <View style={styles.wrap}>
      {!!date && (
        <Row style={styles.metaItem}>
          <Icon name="calendar-outline" size={13} color={colors.muted} />
          <AppText variant="caption" color={colors.muted}>
            {date}
          </AppText>
        </Row>
      )}
      {mood && (
        <Row
          style={[
            styles.metaItem,
            styles.moodLabel,
            { backgroundColor: colors.lavenderSurface },
          ]}
        >
          <MoodPetal source={mood.image} style={styles.petal} />
          <AppText variant="caption" color={colors.lavenderText}>
            {mood.mood}
          </AppText>
        </Row>
      )}
      {record.localOnly && <JournalNotice>Waiting to sync</JournalNotice>}
    </View>
  );
}

function useBookmark() {
  const app = useApp();
  const locks = useRef(new Set<string>());
  const [working, setWorking] = useState<string[]>([]);
  const [error, setError] = useState("");
  const toggle = async (record: Item) => {
    const id = record.id;
    if (!id || record.localOnly || locks.current.has(id)) return;
    locks.current.add(id);
    setWorking([...locks.current]);
    setError("");
    try {
      // Legacy nonweekly reflections gain the same optional metadata in place.
      await app.save("reflections", {
        id,
        ...(record.kind === "journal"
          ? {}
          : { kind: "journal", text: writing(record) }),
        bookmarked: !record.bookmarked,
      });
    } catch (error) {
      setError(failure(error, "Couldn’t update your bookmark. Try again."));
    } finally {
      locks.current.delete(id);
      setWorking([...locks.current]);
    }
  };
  return { working, error, toggle };
}

function JournalLibrary() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const { bottom } = useSafeAreaInsets();
  const bottomClearance = Math.max(useNavigationInset(), bottom);
  const bookmark = useBookmark();
  const { reflections } = app.data;
  const records = useMemo(() => reflections.filter(isJournal), [reflections]);
  const query = typeof app.params.query === "string" ? app.params.query : "";
  const favorites = app.params.favorites === true;
  const moodOnly = app.params.moodOnly === true;
  const mood = moodOf(app.params.mood);
  const oldest = app.params.oldest === true;
  const [showSearch, setShowSearch] = useState(!!query);
  const focusSearch = useRef(false);
  const [showFilters, setShowFilters] = useState(!!mood || oldest);
  const [showModes, setShowModes] = useState(false);
  const listScroll = useListScrollRestore<Item>(app.params.scrollY);
  const hasDraft = !!app.editorDrafts["journal:new"];
  const needle = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      records
        .filter(
          (record) =>
            (!favorites || record.bookmarked === true) &&
            (!moodOnly || !!moodOf(record.mood)) &&
            (!mood || record.mood === mood) &&
            (!needle ||
              [record.title, writing(record), ...tagsOf(record)].some(
                (value) =>
                  typeof value === "string" &&
                  value.toLocaleLowerCase().includes(needle),
              )),
        )
        .sort((first, second) => {
          const delta =
            (Date.parse(second.createdAt) || 0) -
            (Date.parse(first.createdAt) || 0);
          return oldest ? -delta : delta;
        }),
    [records, favorites, moodOnly, mood, needle, oldest],
  );
  const open = (destination: string, params?: Record<string, string>) => {
    app.setParams({ scrollY: listScroll.offset.current });
    app.navigate(destination, params);
  };
  const write = () => open(routes.journalEditor);
  const hasFilters = !!needle || !!mood || moodOnly;
  const clearFilters = () =>
    app.setParams({ query: "", mood: null, favorites: false, moodOnly: false });
  const header = (
    <JournalHeader
      title="My Journal"
      back={() => app.switchSolaceMode("companion")}
      backLabel="Back to Companion"
    >
      {records.length ? (
        <>
          <JournalHeaderAction
            name={showSearch ? "close" : "search-outline"}
            label={showSearch ? "Close journal search" : "Search journal"}
            onPress={() => {
              if (showSearch) app.setParams({ query: "" });
              focusSearch.current = !showSearch;
              setShowSearch(!showSearch);
            }}
          />
          <JournalHeaderAction
            name={showFilters ? "options" : "options-outline"}
            label={
              showFilters
                ? "Hide mood and date filters"
                : "Show mood and date filters"
            }
            onPress={() => setShowFilters(!showFilters)}
          />
        </>
      ) : (
        <JournalHeaderAction
          name="ellipsis-horizontal"
          label={showModes ? "Close journal options" : "Journal options"}
          onPress={() => setShowModes(!showModes)}
        />
      )}
    </JournalHeader>
  );
  if (!records.length)
    return (
      <Screen style={[styles.screen, styles.library]}>
        {header}
        {showModes && <SolaceModeSwitcher mode="journal" />}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.bg,
              marginHorizontal: -gutter,
            },
          ]}
        >
          {resolved === "dark" ? (
            <>
              <Image
                source={twilightNotebook}
                style={coverImageStyle}
                resizeMode="cover"
                accessible={false}
                fadeDuration={0}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  artGradient(
                    `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg}00 16%, ${colors.bg}00 75%, ${colors.bg} 100%)`,
                  ),
                ]}
              />
            </>
          ) : (
            <View style={styles.heroArt}>
              <Image
                source={notebook}
                style={coverImageStyle}
                resizeMode="cover"
                accessible={false}
                fadeDuration={0}
              />
            </View>
          )}
        </View>
        <View style={styles.welcome}>
          <AppText
            variant="title"
            style={styles.center}
            accessibilityRole="header"
          >
            A space just for you.
          </AppText>
          <AppText color={colors.muted} style={styles.center}>
            Write freely, reflect, vent, or capture anything on your mind.
          </AppText>
        </View>
        <Button
          title={hasDraft ? "Continue your draft" : "Write a new entry"}
          icon="create-outline"
          onPress={write}
          style={[
            styles.welcomeAction,
            resolved === "dark" && { backgroundColor: colors.lavender },
          ]}
        />
        <JournalPrivacyMarkers />
        <AppText
          variant="caption"
          color={colors.muted}
          style={[styles.center, styles.privacyCopy]}
        >
          You choose whether to share an excerpt with Solace.
        </AppText>
      </Screen>
    );
  return (
    <Screen scroll={false} style={styles.listShell}>
      <FlatList<Item>
        {...listScroll.props}
        data={filtered}
        keyExtractor={(record) => record.id!}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        style={styles.flex}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: gutter,
            paddingBottom: spacing.bottom + bottomClearance,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={JournalEntrySeparator}
        ListHeaderComponentStyle={styles.listHeader}
        ListHeaderComponent={
          <View style={styles.group}>
            {header}
            <View style={styles.group}>
              {showSearch && (
                <Input
                  accessibilityLabel="Search journal entries"
                  placeholder="Search your entries"
                  value={query}
                  onChangeText={(value) => app.setParams({ query: value })}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoFocus={focusSearch.current}
                  style={styles.searchInput}
                />
              )}
              <View
                style={[
                  styles.filterRail,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {[
                  {
                    label: "All entries",
                    selected: !favorites && !moodOnly,
                    filters: { favorites: false, moodOnly: false, mood: null },
                  },
                  {
                    label: "By mood",
                    selected: moodOnly,
                    filters: { favorites: false, moodOnly: true, mood: null },
                  },
                  {
                    label: "Favorites",
                    selected: favorites,
                    filters: { favorites: true, moodOnly: false, mood: null },
                  },
                ].map(({ label, selected, filters }) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                    onPress={() => {
                      app.setParams(filters);
                      if (label === "By mood") setShowFilters(true);
                    }}
                    style={({ pressed }) => [
                      styles.filterSegment,
                      selected && { backgroundColor: colors.lavender },
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={styles.center}
                      color={
                        selected
                          ? resolved === "dark"
                            ? "#24182E"
                            : colors.lavenderText
                          : colors.text
                      }
                    >
                      {label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              {showFilters && (
                <View style={styles.group}>
                  <AppText variant="label">Filter by mood</AppText>
                  <View style={styles.wrap}>
                    <JournalChip
                      label="Any mood"
                      selected={!mood}
                      onPress={() => app.setParams({ mood: null })}
                    />
                    {moodPetals.map((choice) => (
                      <JournalChip
                        key={choice.mood}
                        label={choice.mood}
                        petal={choice.image}
                        selected={mood === choice.mood}
                        onPress={() => app.setParams({ mood: choice.mood })}
                      />
                    ))}
                  </View>
                  <View style={styles.wrap}>
                    <JournalChip
                      label="Newest first"
                      selected={!oldest}
                      onPress={() => app.setParams({ oldest: false })}
                    />
                    <JournalChip
                      label="Oldest first"
                      selected={oldest}
                      onPress={() => app.setParams({ oldest: true })}
                    />
                  </View>
                </View>
              )}
            </View>
            {bookmark.error && (
              <JournalNotice error>{bookmark.error}</JournalNotice>
            )}
          </View>
        }
        renderItem={({ item: record }) => (
          <View
            style={[
              styles.entryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[
                titleOf(record),
                entryDate(record),
                record.mood,
              ]
                .filter(Boolean)
                .join(", ")}
              onPress={() => open(routes.journalEntry, { id: record.id! })}
              style={({ pressed }) => [
                styles.entryContent,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Image
                source={landscapes[resolved]}
                style={styles.thumbnail}
                resizeMode="cover"
                accessible={false}
                fadeDuration={0}
              />
              <View style={styles.entryCopy}>
                <AppText
                  variant="heading"
                  numberOfLines={2}
                  style={styles.cardTitle}
                >
                  {titleOf(record)}
                </AppText>
                <AppText
                  variant="caption"
                  numberOfLines={2}
                  color={colors.muted}
                >
                  {writing(record)}
                </AppText>
                <EntryMeta record={record} />
              </View>
            </Pressable>
            <IconButton
              name={record.bookmarked ? "bookmark" : "bookmark-outline"}
              label={`${record.bookmarked ? "Remove bookmark from" : "Bookmark"} ${titleOf(record)}`}
              disabled={
                record.localOnly || bookmark.working.includes(record.id!)
              }
              onPress={() => void bookmark.toggle(record)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText variant="heading">
              {hasFilters ? "No matching entries" : "No favorites yet"}
            </AppText>
            <JournalNotice>
              {hasFilters
                ? "Try a different search or clear your filters."
                : "Bookmark an entry to find it here again."}
            </JournalNotice>
            {hasFilters && (
              <Button
                title="Clear filters"
                variant="secondary"
                onPress={clearFilters}
              />
            )}
          </View>
        }
        ListFooterComponentStyle={styles.listFooter}
        ListFooterComponent={
          <Button
            title={hasDraft ? "Continue your draft" : "Write a new entry"}
            icon="create-outline"
            onPress={write}
            style={styles.libraryAction}
          />
        }
      />
    </Screen>
  );
}

function JournalEntrySeparator() {
  return <View style={styles.entrySeparator} />;
}

const fieldsFrom = (record?: Item): EditorDraft => ({
  title: typeof record?.title === "string" ? record.title : "",
  text: writing(record),
  mood: moodOf(record?.mood) ?? "",
  tags: tagsOf(record).join(", "),
  bookmarked: record?.bookmarked === true ? "yes" : "no",
});

function JournalEditor({ record }: { record?: Item }) {
  const app = useApp();
  const { colors } = useTheme();
  const key = record ? `journal:edit:${record.id}` : "journal:new";
  const draft = app.editorDrafts[key];
  const value = draft ?? fieldsFrom(record);
  const latest = useRef(value);
  latest.current = value;
  const [height, setHeight] = useState(188);
  const [writingFocused, setWritingFocused] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showInsightInfo, setShowInsightInfo] = useState(false);
  const [showDraftInfo, setShowDraftInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const flush = useRef(app.flushEditorDrafts);
  flush.current = app.flushEditorDrafts;
  const draftActive = useRef(!!draft);
  draftActive.current = !!draft;
  const prompt =
    !record && typeof app.params.prompt === "string"
      ? app.params.prompt.trim().slice(0, 500)
      : "";
  const open = useRef(true);
  const tags = enteredTags(value.tags);
  useLayoutEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      if (draftActive.current) void flush.current();
    };
  }, []);
  const change = (field: string, value: string) => {
    if (savingRef.current) return;
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    draftActive.current = true;
    app.setEditorDraft(key, next);
    setError("");
  };
  const save = async () => {
    const current = latest.current;
    if (savingRef.current || !current.text.trim() || record?.localOnly) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    Keyboard.dismiss();
    const createdAt =
      record?.createdAt ?? current.createdAt ?? new Date().toISOString();
    const id =
      record?.id ??
      current.id ??
      `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    const submitted: EditorDraft = record
      ? current
      : { ...current, id, createdAt };
    app.setEditorDraft(key, submitted);
    try {
      await app.flushEditorDrafts();
      await app.save(
        "reflections",
        {
          id,
          ...(record ? {} : { createdAt, day: localDay(new Date(createdAt)) }),
          kind: "journal",
          title: submitted.title.trim(),
          text: submitted.text,
          mood: moodOf(submitted.mood) ?? null,
          tags: enteredTags(submitted.tags),
          bookmarked: submitted.bookmarked === "yes",
        },
        { key, value: submitted },
      );
      app.setEditorDraft(key, null, submitted);
      draftActive.current = false;
      if (open.current) app.back();
    } catch (error) {
      if (open.current)
        setError(
          failure(
            error,
            "Couldn’t save this entry. Your writing is still here.",
          ),
        );
    } finally {
      savingRef.current = false;
      if (open.current) setSaving(false);
    }
  };
  return (
    <Screen style={[styles.screen, styles.editor]}>
      <JournalHeader
        title={record ? "Edit Journal Entry" : "New Journal Entry"}
        back={app.back}
      >
        <JournalHeaderAction
          name="ellipsis-horizontal"
          label={
            showDraftInfo ? "Hide draft information" : "Show draft information"
          }
          onPress={() => setShowDraftInfo(!showDraftInfo)}
        />
      </JournalHeader>
      {!!prompt && (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.lavenderSurface,
              borderColor: colors.border,
            },
          ]}
        >
          <AppText variant="label" color={colors.lavenderText}>
            Writing prompt
          </AppText>
          <AppText>{prompt}</AppText>
        </View>
      )}
      <View
        style={[
          styles.writingPanel,
          {
            backgroundColor: colors.surface,
            borderColor: writingFocused ? colors.primary : colors.border,
          },
        ]}
      >
        <Input
          accessibilityLabel="Entry title, optional"
          placeholder="Title (optional)"
          value={value.title}
          onFocus={() => setWritingFocused(true)}
          onBlur={() => setWritingFocused(false)}
          onChangeText={(text) => change("title", text)}
          maxLength={240}
          editable={!saving}
          style={[styles.titleInput, { backgroundColor: colors.surface }]}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Input
          accessibilityLabel="Journal entry"
          placeholder="What’s on your mind?"
          value={value.text}
          onFocus={() => setWritingFocused(true)}
          onBlur={() => setWritingFocused(false)}
          onChangeText={(text) => change("text", text)}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          editable={!saving}
          onContentSizeChange={({ nativeEvent }) =>
            setHeight(Math.max(188, Math.ceil(nativeEvent.contentSize.height)))
          }
          style={[
            styles.bodyInput,
            { minHeight: height, backgroundColor: colors.surface },
          ]}
        />
      </View>
      <View
        style={[
          styles.metaPanel,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose mood"
          accessibilityState={{ expanded: showMood, disabled: saving }}
          disabled={saving}
          onPress={() => setShowMood(!showMood)}
        >
          <Row style={styles.metaControl}>
            <Icon name="happy-outline" size={18} color={colors.peach} />
            <AppText variant="label" style={styles.flex}>
              Mood (optional)
            </AppText>
            <Row style={[styles.valuePill, { borderColor: colors.border }]}>
              <AppText variant="caption" color={colors.muted}>
                {value.mood || "Choose"}
              </AppText>
              <Icon
                name={showMood ? "chevron-up" : "chevron-down"}
                size={13}
                color={colors.muted}
              />
            </Row>
          </Row>
        </Pressable>
        {showMood && (
          <View style={[styles.wrap, styles.metadataInset]}>
            {moodPetals.map((choice) => (
              <JournalChip
                key={choice.mood}
                label={choice.mood}
                petal={choice.image}
                selected={value.mood === choice.mood}
                onPress={() => {
                  change("mood", value.mood === choice.mood ? "" : choice.mood);
                  setShowMood(false);
                }}
              />
            ))}
          </View>
        )}
      </View>
      <View
        style={[
          styles.metaPanel,
          styles.tagsPanel,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Row>
          <Icon name="pricetag-outline" size={16} color={colors.lavenderText} />
          <AppText variant="label">Tags (optional)</AppText>
        </Row>
        <Input
          accessibilityLabel="Entry tags, separated by commas"
          placeholder="Separate tags with commas"
          value={value.tags}
          onChangeText={(tags) => change("tags", tags)}
          editable={!saving}
          style={styles.tagsInput}
        />
        {!!tags.length && (
          <View style={styles.wrap}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
                disabled={saving}
                onPress={() =>
                  change(
                    "tags",
                    tags.filter((value) => value !== tag).join(", "),
                  )
                }
                style={[
                  styles.removableTag,
                  {
                    backgroundColor: colors.lavenderSurface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={colors.lavenderText}
                  style={styles.flexShrink}
                >
                  {tag}
                </AppText>
                <Icon name="close" size={14} color={colors.lavenderText} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View
        style={[
          styles.metaPanel,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About optional AI insights"
          accessibilityState={{ expanded: showInsightInfo }}
          onPress={() => setShowInsightInfo(!showInsightInfo)}
        >
          <Row style={styles.metaControl}>
            <Icon name="sparkles-outline" size={20} color={colors.peach} />
            <View style={styles.flex}>
              <AppText variant="label">Reflect with Solace</AppText>
              <AppText variant="caption" color={colors.muted}>
                Choose an excerpt after saving.
              </AppText>
            </View>
            <Icon
              name={
                showInsightInfo ? "chevron-up" : "information-circle-outline"
              }
              size={18}
              color={colors.lavenderText}
            />
          </Row>
        </Pressable>
        {showInsightInfo && (
          <View style={styles.metadataInset}>
            <JournalNotice>
              Your writing stays private until you choose an excerpt and confirm
              that you want to share it with the AI service.
            </JournalNotice>
          </View>
        )}
      </View>
      {(showDraftInfo || record?.localOnly) && (
        <JournalNotice>
          {record?.localOnly
            ? "This entry is waiting to sync. You can keep editing the draft while it waits."
            : app.draftProtection === "device"
              ? "Drafts autosave to protected storage on this device."
              : "Drafts stay in this browser tab until you reload or close it."}
        </JournalNotice>
      )}
      {app.offlineError && draft && (
        <JournalNotice error>{app.offlineError}</JournalNotice>
      )}
      {error && <JournalNotice error>{error}</JournalNotice>}
      <Row style={styles.editorAction}>
        <View
          style={[
            styles.bookmarkFrame,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <IconButton
            name={value.bookmarked === "yes" ? "bookmark" : "bookmark-outline"}
            label={
              value.bookmarked === "yes" ? "Remove bookmark" : "Bookmark entry"
            }
            disabled={saving}
            onPress={() =>
              change("bookmarked", value.bookmarked === "yes" ? "no" : "yes")
            }
          />
        </View>
        <Button
          title={saving ? "Saving entry" : "Save entry"}
          icon="checkmark"
          loading={saving}
          disabled={!value.text.trim() || !!record?.localOnly}
          onPress={() => void save()}
          style={styles.flex}
        />
      </Row>
      {!!record?.localOnly && (
        <Button
          title="Sync this entry"
          variant="secondary"
          loading={app.syncingWrites}
          onPress={() => void app.flushPendingWrites().catch(() => {})}
        />
      )}
    </Screen>
  );
}

function JournalDetail({ record }: { record?: Item }) {
  const app = useApp();
  const { colors } = useTheme();
  const bookmark = useBookmark();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const deletingRef = useRef(false);
  const open = useRef(true);
  useLayoutEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const remove = async () => {
    if (!record?.id || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setError("");
    try {
      await app.remove("reflections", record.id);
      app.setEditorDraft(`journal:edit:${record.id}`, null);
      if (open.current) app.back();
    } catch (error) {
      if (open.current)
        setError(failure(error, "Couldn’t delete this entry. Try again."));
    } finally {
      deletingRef.current = false;
      if (open.current) setDeleting(false);
    }
  };
  if (!record)
    return (
      <Screen style={styles.screen}>
        <JournalHeader title="My Journal" back={app.back} />
        <JournalNotice>
          {deleting ? "Deleting entry…" : "This entry is no longer available."}
        </JournalNotice>
      </Screen>
    );
  return (
    <Screen style={styles.screen}>
      <JournalHeader title="My Journal" back={app.back} />
      <View
        style={[
          styles.panel,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Row>
          <AppText
            variant="title"
            accessibilityRole="header"
            style={styles.flex}
          >
            {titleOf(record)}
          </AppText>
          <IconButton
            name={record.bookmarked ? "bookmark" : "bookmark-outline"}
            label={record.bookmarked ? "Remove bookmark" : "Bookmark entry"}
            disabled={
              record.localOnly ||
              deleting ||
              bookmark.working.includes(record.id!)
            }
            onPress={() => void bookmark.toggle(record)}
          />
        </Row>
        <EntryMeta record={record} />
        <AppText selectable style={styles.entryText}>
          {writing(record)}
        </AppText>
        {typeof record.need === "string" && !!record.need.trim() && (
          <View style={styles.group}>
            <AppText variant="label">What I needed</AppText>
            <AppText selectable>{record.need}</AppText>
          </View>
        )}
        {!!tagsOf(record).length && (
          <View style={styles.wrap}>
            {tagsOf(record).map((tag, index) => (
              <AppText
                key={`${tag}-${index}`}
                variant="caption"
                color={colors.lavenderText}
                style={[
                  styles.tag,
                  { backgroundColor: colors.lavenderSurface },
                ]}
              >
                {tag}
              </AppText>
            ))}
          </View>
        )}
      </View>
      {bookmark.error && <JournalNotice error>{bookmark.error}</JournalNotice>}
      {record.localOnly ? (
        <>
          <JournalNotice>
            {app.draftProtection === "device"
              ? "Saved on this device. Sync to use this entry on another device or reflect with Solace."
              : "This entry is waiting to sync in this browser tab. Sync before closing the tab."}
          </JournalNotice>
          <Button
            title="Sync this entry"
            icon="cloud-upload-outline"
            loading={app.syncingWrites}
            onPress={() => void app.flushPendingWrites().catch(() => {})}
          />
          {app.offlineError && (
            <JournalNotice error>{app.offlineError}</JournalNotice>
          )}
        </>
      ) : (
        <>
          <Button
            title="Reflect with Solace"
            icon="sparkles-outline"
            disabled={deleting}
            onPress={() =>
              app.navigate(routes.journalReflect, { id: record.id })
            }
          />
          <Button
            title="Discuss with Solace"
            icon="chatbubble-outline"
            variant="secondary"
            disabled={deleting}
            onPress={() =>
              app.navigate(routes.journalReflect, {
                id: record.id,
                intent: "discuss",
              })
            }
          />
          <JournalNotice>
            Choose an excerpt to share for a reflection or a Companion
            conversation.
          </JournalNotice>
        </>
      )}
      <Button
        title={
          app.editorDrafts[`journal:edit:${record.id}`]
            ? "Continue editing draft"
            : "Edit entry"
        }
        icon="create-outline"
        variant="secondary"
        disabled={deleting}
        onPress={() => app.navigate(routes.journalEditor, { id: record.id })}
      />
      {confirm ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText variant="heading">Delete this entry?</AppText>
          <AppText>
            {record.localOnly
              ? "This permanently removes the unsynced entry and its draft from here."
              : "This permanently removes the entry and its draft. You can manage anything you shared in Companion from the conversation."}
          </AppText>
          {error && <JournalNotice error>{error}</JournalNotice>}
          <Button
            title="Delete entry permanently"
            loading={deleting}
            onPress={() => void remove()}
          />
          <Button
            title="Keep entry"
            variant="ghost"
            disabled={deleting}
            onPress={() => setConfirm(false)}
          />
        </View>
      ) : (
        <Button
          title="Delete entry"
          icon="trash-outline"
          variant="ghost"
          onPress={() => {
            setError("");
            setConfirm(true);
          }}
        />
      )}
    </Screen>
  );
}

export function JournalScreen({ name }: { name: string }) {
  const app = useApp();
  if (name === routes.journal) return <JournalLibrary />;
  const id = app.params.id;
  const record = isRecordId(id)
    ? app.data.reflections.find((entry) => entry.id === id && isJournal(entry))
    : undefined;
  if (name === routes.journalEditor && (id === undefined || record))
    return <JournalEditor key={record?.id ?? "new"} record={record} />;
  if (name === routes.journalEntry && isRecordId(id))
    return <JournalDetail key={id} record={record} />;
  return (
    <Screen title="My Journal" back={app.back}>
      <JournalNotice>This entry is no longer available.</JournalNotice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.row, paddingTop: 10 },
  library: { flexGrow: 1 },
  listShell: {
    flex: 1,
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  listContent: { flexGrow: 1, paddingTop: 10 },
  listHeader: { marginBottom: spacing.row },
  listFooter: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingTop: spacing.row,
  },
  entrySeparator: { height: spacing.row },
  editor: { flexGrow: 1, gap: spacing.compact },
  header: { gap: 4, marginHorizontal: -8, marginBottom: 1 },
  headerTitle: { flex: 1, fontSize: 25, lineHeight: 32 },
  headerAction: { borderRadius: 22 },
  welcome: { gap: 5, marginHorizontal: 10, marginTop: 4 },
  hero: {
    aspectRatio: 1.65,
    overflow: "hidden",
  },
  heroArt: { position: "absolute", top: 0, width: "100%", aspectRatio: 1 },
  center: { textAlign: "center" },
  welcomeAction: { alignSelf: "center", minWidth: "70%", marginTop: 12 },
  privacyCopy: { marginTop: 2 },
  markers: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.compact,
    marginTop: 14,
  },
  marker: { flex: 1, maxWidth: 100, alignItems: "center", gap: 7 },
  markerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markerLabel: { textAlign: "center", maxWidth: 83 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  group: { gap: spacing.row },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.compact,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 24,
  },
  petal: { width: 20, height: 20 },
  metaItem: { gap: 4 },
  moodLabel: { borderRadius: 12, paddingHorizontal: 5, paddingVertical: 1 },
  searchInput: { minHeight: 44, paddingVertical: 8 },
  filterRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 24,
    padding: 3,
  },
  filterSegment: {
    flex: 1,
    minWidth: 70,
    minHeight: 44,
    borderRadius: 22,
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  libraryAction: { marginTop: "auto" },
  entryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 15,
  },
  entryContent: {
    flexDirection: "row",
    flex: 1,
    alignItems: "flex-start",
    minWidth: 0,
    paddingVertical: spacing.compact,
    paddingLeft: spacing.compact,
    gap: spacing.row,
  },
  thumbnail: { width: 65, height: 84, borderRadius: 10 },
  cardTitle: { fontSize: 23, lineHeight: 28 },
  entryCopy: { flex: 1, minWidth: 0, gap: 4 },
  panel: {
    gap: spacing.row,
    padding: spacing.card,
    borderRadius: 20,
    borderWidth: 1,
  },
  writingPanel: { borderRadius: 15, borderWidth: 1, overflow: "hidden" },
  titleInput: {
    borderWidth: 0,
    fontFamily: "CormorantGaramond_600SemiBold",
    fontSize: 25,
    lineHeight: 32,
    minHeight: 48,
    paddingVertical: 7,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.card },
  bodyInput: {
    borderWidth: 0,
    paddingTop: spacing.row,
    paddingBottom: spacing.row,
    lineHeight: 23,
  },
  metaPanel: { borderWidth: 1, borderRadius: 16 },
  metaControl: {
    minHeight: 51,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    gap: spacing.compact,
  },
  metadataInset: { paddingHorizontal: spacing.row, paddingBottom: spacing.row },
  valuePill: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 6,
  },
  tagsPanel: {
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    gap: 5,
  },
  tagsInput: {
    borderWidth: 0,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 5,
    backgroundColor: "transparent",
  },
  removableTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 9,
  },
  bookmarkFrame: { borderWidth: 1, borderRadius: 22 },
  editorAction: { marginTop: "auto", paddingTop: spacing.compact },
  entryText: { marginTop: spacing.compact, lineHeight: 26 },
  tag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 12 },
});
