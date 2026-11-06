import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { localDay } from "../content";
import { spacing } from "../layout";
import { isRecordId, routes } from "../routes";
import { type EditorDraft, type Item, useApp } from "../store";
import { useTheme } from "../theme";
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
} from "../ui";
import { SolaceModeSwitcher } from "./SolaceModeSwitcher";

const notebook = require("../../assets/redesign-explore-reflect.jpg");
const landscapes = {
  light: require("../../assets/profile-mountains-light.jpg"),
  dark: require("../../assets/profile-mountains-dark.jpg"),
};

const writing = (record?: Item) =>
  [record?.text, record?.content, record?.note].find(
    (value): value is string => typeof value === "string" && !!value.trim(),
  ) ?? "";
const isJournal = (record: Item) =>
  !!record.id &&
  !record.weeklyPeriod &&
  (record.kind === "journal" ||
    (record.kind === undefined && !!writing(record)));
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
  const bookmark = useBookmark();
  const records = app.data.reflections.filter(isJournal);
  const query = typeof app.params.query === "string" ? app.params.query : "";
  const favorites = app.params.favorites === true;
  const mood = moodOf(app.params.mood);
  const oldest = app.params.oldest === true;
  const [showFilters, setShowFilters] = useState(!!mood || oldest);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const restoreScroll = useRef(Number(app.params.scrollY) || 0);
  const hasDraft = !!app.editorDrafts["journal:new"];
  const needle = query.trim().toLocaleLowerCase();
  const filtered = records
    .filter((record) => !favorites || record.bookmarked === true)
    .filter((record) => !mood || record.mood === mood)
    .filter(
      (record) =>
        !needle ||
        [record.title, writing(record), ...tagsOf(record)].some(
          (value) =>
            typeof value === "string" &&
            value.toLocaleLowerCase().includes(needle),
        ),
    )
    .sort((first, second) => {
      const delta =
        (Date.parse(second.createdAt) || 0) -
        (Date.parse(first.createdAt) || 0);
      return oldest ? -delta : delta;
    });
  const open = (destination: string, params?: Record<string, string>) => {
    app.setParams({ scrollY: scrollY.current });
    app.navigate(destination, params);
  };
  const write = () => open(routes.journalEditor);
  return (
    <Screen
      title="My Journal"
      style={styles.screen}
      scrollRef={scroll}
      onScroll={({ nativeEvent }) => {
        scrollY.current = nativeEvent.contentOffset.y;
      }}
      onContentSizeChange={(_width, height) => {
        if (restoreScroll.current > 0 && height > restoreScroll.current) {
          scroll.current?.scrollTo({
            y: restoreScroll.current,
            animated: false,
          });
          restoreScroll.current = 0;
        }
      }}
    >
      <SolaceModeSwitcher mode="journal" />
      {!records.length ? (
        <>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.lavenderSurface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroArt}>
              <Image
                source={notebook}
                style={coverImageStyle}
                resizeMode="cover"
                accessible={false}
                fadeDuration={0}
              />
            </View>
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
          />
          <View style={[styles.privacy, { borderColor: colors.border }]}>
            <Icon
              name="lock-closed-outline"
              size={16}
              color={colors.lavenderText}
            />
            <AppText variant="caption" color={colors.muted} style={styles.flex}>
              Your journal is private. You choose whether to share an excerpt
              with Solace.
            </AppText>
          </View>
        </>
      ) : (
        <>
          <View style={styles.group}>
            <Row>
              <Input
                accessibilityLabel="Search journal entries"
                placeholder="Search your entries"
                value={query}
                onChangeText={(value) => app.setParams({ query: value })}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.flex}
              />
              <IconButton
                name={showFilters ? "options" : "options-outline"}
                label={
                  showFilters
                    ? "Hide mood and date filters"
                    : "Show mood and date filters"
                }
                onPress={() => setShowFilters(!showFilters)}
              />
            </Row>
            <View style={styles.wrap}>
              <JournalChip
                label="All entries"
                selected={!favorites}
                onPress={() => app.setParams({ favorites: false })}
              />
              <JournalChip
                label="Favorites"
                selected={favorites}
                onPress={() => app.setParams({ favorites: true })}
              />
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
          <Button
            title={hasDraft ? "Continue your draft" : "Write a new entry"}
            icon="create-outline"
            onPress={write}
          />
          <View style={styles.group}>
            {filtered.length ? (
              filtered.map((record) => (
                <View
                  key={record.id}
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
                    onPress={() =>
                      open(routes.journalEntry, { id: record.id! })
                    }
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
                      <AppText variant="heading" numberOfLines={2}>
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
              ))
            ) : (
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
                  {needle || mood ? "No matching entries" : "No favorites yet"}
                </AppText>
                <JournalNotice>
                  {needle || mood
                    ? "Try a different search or clear your filters."
                    : "Bookmark an entry to find it here again."}
                </JournalNotice>
                {(needle || mood) && (
                  <Button
                    title="Clear filters"
                    variant="secondary"
                    onPress={() =>
                      app.setParams({ query: "", mood: null, favorites: false })
                    }
                  />
                )}
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
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
  const [height, setHeight] = useState(224);
  const [writingFocused, setWritingFocused] = useState(false);
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
          tags: [
            ...new Set(
              submitted.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ],
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
    <Screen
      title={record ? "Edit journal entry" : "New journal entry"}
      back={app.back}
      style={styles.screen}
    >
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
            setHeight(Math.max(224, Math.ceil(nativeEvent.contentSize.height)))
          }
          style={[
            styles.bodyInput,
            { minHeight: height, backgroundColor: colors.surface },
          ]}
        />
      </View>
      <View style={styles.group}>
        <AppText variant="label">Mood (optional)</AppText>
        <View style={styles.wrap}>
          {moodPetals.map((choice) => (
            <JournalChip
              key={choice.mood}
              label={choice.mood}
              petal={choice.image}
              selected={value.mood === choice.mood}
              onPress={() =>
                change("mood", value.mood === choice.mood ? "" : choice.mood)
              }
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label">Tags (optional)</AppText>
        <Input
          accessibilityLabel="Entry tags, separated by commas"
          placeholder="Work, rest, gratitude"
          value={value.tags}
          onChangeText={(tags) => change("tags", tags)}
          editable={!saving}
        />
        <JournalNotice>Separate tags with commas.</JournalNotice>
      </View>
      <JournalNotice>
        {record?.localOnly
          ? "This entry is waiting to sync. You can keep editing the draft while it waits."
          : app.draftProtection === "device"
            ? "Drafts autosave to protected storage on this device."
            : "Drafts stay in this browser tab until you reload or close it."}
      </JournalNotice>
      {app.offlineError && draft && (
        <JournalNotice error>{app.offlineError}</JournalNotice>
      )}
      {error && <JournalNotice error>{error}</JournalNotice>}
      <Row>
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
      <Screen title="My Journal" back={app.back}>
        <JournalNotice>
          {deleting ? "Deleting entry…" : "This entry is no longer available."}
        </JournalNotice>
      </Screen>
    );
  return (
    <Screen title="My Journal" back={app.back} style={styles.screen}>
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
  screen: { gap: spacing.card },
  welcome: { gap: spacing.compact },
  hero: {
    aspectRatio: 1.52,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroArt: { position: "absolute", top: 0, width: "100%", aspectRatio: 1 },
  center: { textAlign: "center" },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    borderTopWidth: 1,
    paddingTop: spacing.card,
  },
  flex: { flex: 1 },
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
  entryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 18,
  },
  entryContent: {
    flexDirection: "row",
    flex: 1,
    alignItems: "flex-start",
    minWidth: 0,
    paddingVertical: spacing.row,
    paddingLeft: spacing.row,
    gap: spacing.row,
  },
  thumbnail: { width: 54, height: 72, borderRadius: 11 },
  entryCopy: { flex: 1, minWidth: 0, gap: 4 },
  panel: {
    gap: spacing.row,
    padding: spacing.card,
    borderRadius: 20,
    borderWidth: 1,
  },
  writingPanel: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  titleInput: {
    borderWidth: 0,
    fontFamily: "CormorantGaramond_600SemiBold",
    fontSize: 25,
    lineHeight: 32,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.card },
  bodyInput: {
    borderWidth: 0,
    paddingTop: spacing.card,
    paddingBottom: spacing.card,
    lineHeight: 24,
  },
  entryText: { marginTop: spacing.compact, lineHeight: 26 },
  tag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 12 },
});
