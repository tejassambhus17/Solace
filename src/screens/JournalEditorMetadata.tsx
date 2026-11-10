import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  journalTagLimitMessage,
  journalTagsFromText,
  MAX_JOURNAL_TAG_LENGTH,
  MAX_JOURNAL_TAGS,
} from "../../server/src/journal-contract";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import {
  AppText,
  Icon,
  IconButton,
  Input,
  MoodPetal,
  moodPetals,
  Row,
} from "../ui";

type TagEdit = { original?: string; value: string; error?: string };

export function JournalEditorMetadata({
  mood,
  tags,
  disabled,
  onMoodChange,
  onTagsChange,
  onEditingTagChange,
}: {
  mood: string;
  tags: string[];
  disabled: boolean;
  onMoodChange: (mood: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEditingTagChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const [edit, setEdit] = useState<TagEdit>();
  const tagLimit = journalTagLimitMessage(tags);
  const atTagLimit = tags.length >= MAX_JOURNAL_TAGS;
  const panel = [
    styles.panel,
    { backgroundColor: colors.surface, borderColor: colors.border },
  ];

  function changeTagEditor(next?: TagEdit) {
    setEdit(next);
    onEditingTagChange?.(next !== undefined);
  }

  function commitTag() {
    if (!edit || disabled) return;
    const names = journalTagsFromText(edit.value);
    if (!names.length) {
      setEdit({ ...edit, error: "Enter a tag name." });
      return;
    }
    const original = edit.original;
    const invalidLength = names.some(
      (tag) => tag.length > MAX_JOURNAL_TAG_LENGTH,
    );
    if (invalidLength) {
      setEdit({
        ...edit,
        error: `Use ${MAX_JOURNAL_TAG_LENGTH} characters or fewer per tag.`,
      });
      return;
    }
    if (original !== undefined) {
      if (edit.value.includes(",")) {
        setEdit({ ...edit, error: "Enter one tag name at a time." });
        return;
      }
      if (names[0] !== original && tags.includes(names[0])) {
        setEdit({ ...edit, error: "That tag is already in this entry." });
        return;
      }
      if (names[0] !== original)
        onTagsChange(tags.map((tag) => (tag === original ? names[0] : tag)));
    } else {
      const next = [...new Set([...tags, ...names])];
      if (next.length > MAX_JOURNAL_TAGS) {
        setEdit({
          ...edit,
          error: `An entry can have up to ${MAX_JOURNAL_TAGS} tags.`,
        });
        return;
      }
      if (next.length === tags.length) {
        setEdit({ ...edit, error: "That tag is already in this entry." });
        return;
      }
      onTagsChange(next);
    }
    changeTagEditor();
  }

  return (
    <>
      <View style={panel}>
        <Row style={styles.heading}>
          <Icon name="happy-outline" size={17} color={colors.peachText} />
          <AppText variant="label" style={styles.shrink}>
            Mood
          </AppText>
        </Row>
        <ScrollView
          horizontal
          directionalLockEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.moods}
        >
          {moodPetals.map((choice) => {
            const selected = mood === choice.mood;
            return (
              <Pressable
                key={choice.mood}
                accessibilityRole="button"
                accessibilityLabel={choice.mood}
                accessibilityState={{ selected, disabled }}
                aria-pressed={selected}
                disabled={disabled}
                onPress={() => onMoodChange(selected ? "" : choice.mood)}
                style={({ pressed }) => [
                  styles.mood,
                  styles.moodChoice,
                  {
                    backgroundColor: selected
                      ? colors.lavenderSurface
                      : colors.surface,
                    borderColor: selected ? colors.lavender : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <MoodPetal source={choice.image} style={styles.petal} />
                <AppText
                  variant="caption"
                  color={selected ? colors.lavenderText : colors.text}
                  style={styles.shrink}
                >
                  {choice.mood}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={panel}>
        <Row style={styles.heading}>
          <Icon name="pricetag-outline" size={16} color={colors.lavenderText} />
          <AppText variant="label" style={styles.shrink}>
            Tags
          </AppText>
        </Row>
        <View style={styles.chips}>
          {tags.map((tag) => {
            const tooLong = tag.length > MAX_JOURNAL_TAG_LENGTH;
            const ink = tooLong ? colors.danger : colors.lavenderText;
            return (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: colors.lavenderSurface,
                    borderColor: tooLong ? colors.danger : colors.border,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename tag ${tag}`}
                  accessibilityState={{ disabled: disabled || !!edit }}
                  disabled={disabled || !!edit}
                  onPress={() => changeTagEditor({ original: tag, value: tag })}
                  style={({ pressed }) => [
                    styles.tagName,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={ink}
                    numberOfLines={1}
                    style={styles.shrink}
                  >
                    {tag}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag ${tag}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (edit?.original === tag) changeTagEditor();
                    onTagsChange(tags.filter((item) => item !== tag));
                  }}
                  style={({ pressed }) => [
                    styles.remove,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Icon name="close" size={16} color={ink} />
                </Pressable>
              </View>
            );
          })}
          {!edit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add tag"
              accessibilityState={{ disabled: disabled || atTagLimit }}
              disabled={disabled || atTagLimit}
              onPress={() => changeTagEditor({ value: "" })}
              style={({ pressed }) => [
                styles.mood,
                {
                  borderColor: colors.border,
                  opacity: atTagLimit ? 0.45 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Icon name="add" size={16} color={colors.lavenderText} />
              <AppText variant="caption" color={colors.lavenderText}>
                Add tag
              </AppText>
            </Pressable>
          )}
        </View>
        {!!edit && (
          <Row style={styles.tagEdit}>
            <Input
              key={edit.original ?? "add"}
              accessibilityLabel={
                edit.original === undefined ? "New tag name" : "Edit tag name"
              }
              placeholder={
                edit.original === undefined ? "Add a tag" : "Rename tag"
              }
              value={edit.value}
              onChangeText={(value) =>
                setEdit({ original: edit.original, value })
              }
              editable={!disabled}
              autoFocus
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={commitTag}
              aria-invalid={!!edit.error}
              style={styles.tagInput}
            />
            <IconButton
              name="checkmark"
              label="Apply tag"
              onPress={commitTag}
              disabled={disabled || !edit.value.trim()}
            />
            <IconButton
              name="close"
              label="Cancel tag editing"
              onPress={() => changeTagEditor()}
              disabled={disabled}
            />
          </Row>
        )}
        {(edit?.error || tagLimit) && (
          <AppText
            accessibilityRole="alert"
            variant="caption"
            color={colors.danger}
          >
            {edit?.error || tagLimit}
          </AppText>
        )}
        {atTagLimit && !tagLimit && !edit?.error && (
          <AppText variant="caption" color={colors.muted}>
            Tag limit reached.
          </AppText>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    gap: spacing.compact,
  },
  heading: { gap: spacing.compact },
  shrink: { flexShrink: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  moods: { flexDirection: "row", gap: spacing.compact },
  moodChoice: { flexShrink: 0, minHeight: 48 },
  mood: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 22,
    gap: 5,
  },
  petal: { width: 18, height: 18, flexShrink: 0 },
  tag: {
    flexDirection: "row",
    maxWidth: "100%",
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 22,
  },
  tagName: {
    minWidth: 44,
    minHeight: 44,
    flexShrink: 1,
    paddingLeft: 10,
    justifyContent: "center",
  },
  remove: {
    width: 44,
    minHeight: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tagEdit: { gap: 3 },
  tagInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
});
