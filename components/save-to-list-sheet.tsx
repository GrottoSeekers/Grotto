import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { savedLists, savedListItems } from '@/db/schema';
import type { SavedList } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Config ───────────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = ['🏡', '🌊', '🌿', '🏔️', '🌸', '⭐', '🗺️', '✈️', '☀️', '🐾'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  listingId: number;
  listingTitle: string;
  onSavedChange?: (isSaved: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SaveToListSheet({
  visible,
  onClose,
  listingId,
  listingTitle,
  onSavedChange,
}: Props) {
  const { currentUser } = useSessionStore();
  const [lists, setLists]               = useState<SavedList[]>([]);
  const [savedInListIds, setSavedInListIds] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState('');
  const [newEmoji, setNewEmoji]         = useState('🏡');
  const [saving, setSaving]             = useState(false);
  const inputRef                        = useRef<TextInput>(null);

  useEffect(() => {
    if (visible && currentUser) {
      loadLists();
    }
    if (!visible) {
      setShowCreate(false);
      setNewName('');
      setNewEmoji('🏡');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function loadLists() {
    if (!currentUser) return;
    const [listRows, itemRows] = await Promise.all([
      db.select().from(savedLists).where(eq(savedLists.sitterId, currentUser.id)),
      db.select().from(savedListItems).where(eq(savedListItems.listingId, listingId)),
    ]);
    setLists(listRows);
    setSavedInListIds(new Set(itemRows.map((i) => i.listId)));
  }

  async function toggleList(listId: number) {
    if (!currentUser) return;
    if (savedInListIds.has(listId)) {
      await db
        .delete(savedListItems)
        .where(and(
          eq(savedListItems.listId, listId),
          eq(savedListItems.listingId, listingId),
        ));
      setSavedInListIds((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        onSavedChange?.(next.size > 0);
        return next;
      });
    } else {
      await db.insert(savedListItems).values({ listId, listingId });
      setSavedInListIds((prev) => {
        const next = new Set([...prev, listId]);
        onSavedChange?.(true);
        return next;
      });
    }
  }

  async function handleCreate() {
    if (!currentUser || !newName.trim() || saving) return;
    setSaving(true);
    await db.insert(savedLists).values({
      sitterId: currentUser.id,
      name:     newName.trim(),
      emoji:    newEmoji,
    });
    // Fetch the newly created list (last inserted for this user)
    const freshLists = await db
      .select()
      .from(savedLists)
      .where(eq(savedLists.sitterId, currentUser.id));
    const newList = freshLists[freshLists.length - 1];
    if (newList) {
      await db.insert(savedListItems).values({ listId: newList.id, listingId });
      setLists(freshLists);
      setSavedInListIds((prev) => {
        const next = new Set([...prev, newList.id]);
        onSavedChange?.(true);
        return next;
      });
    }
    setShowCreate(false);
    setNewName('');
    setNewEmoji('🏡');
    setSaving(false);
  }

  // Not signed in — show inline sign-in prompt
  if (!currentUser) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.noAuthContent}>
              <Ionicons name="heart-outline" size={40} color={GrottoTokens.goldMuted} />
              <Text style={styles.noAuthTitle}>Sign in to save sits</Text>
              <Text style={styles.noAuthBody}>
                Create an account to build lists of your favourite sits and plan your adventures.
              </Text>
              <Pressable style={styles.noAuthBtn} onPress={onClose}>
                <Text style={styles.noAuthBtnText}>Got it</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Save to a list</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={GrottoTokens.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.listingLabel} numberOfLines={1}>{listingTitle}</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Existing lists */}
            {lists.map((list) => {
              const isSaved = savedInListIds.has(list.id);
              return (
                <Pressable
                  key={list.id}
                  style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
                  onPress={() => toggleList(list.id)}
                >
                  <View style={styles.listEmoji}>
                    <Text style={styles.emojiText}>{list.emoji ?? '🏡'}</Text>
                  </View>
                  <Text style={styles.listName}>{list.name}</Text>
                  <View style={[styles.checkbox, isSaved && styles.checkboxActive]}>
                    {isSaved && <Ionicons name="checkmark" size={14} color={GrottoTokens.white} />}
                  </View>
                </Pressable>
              );
            })}

            {/* Create new list */}
            {!showCreate ? (
              <Pressable
                style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
                onPress={() => {
                  setShowCreate(true);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
              >
                <View style={[styles.listEmoji, styles.listEmojiAdd]}>
                  <Ionicons name="add" size={20} color={GrottoTokens.textSecondary} />
                </View>
                <Text style={styles.listName}>Create new list</Text>
              </Pressable>
            ) : (
              <View style={styles.createForm}>
                <Text style={styles.formLabel}>List name</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.nameInput}
                  placeholder="e.g. Summer 2026, Beaches, Europe…"
                  placeholderTextColor={GrottoTokens.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />

                <Text style={[styles.formLabel, { marginTop: Layout.spacing.md }]}>Icon</Text>
                <View style={styles.emojiGrid}>
                  {EMOJI_OPTIONS.map((e) => (
                    <Pressable
                      key={e}
                      style={[styles.emojiOption, newEmoji === e && styles.emojiOptionActive]}
                      onPress={() => setNewEmoji(e)}
                    >
                      <Text style={styles.emojiPickerText}>{e}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.formActions}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => { setShowCreate(false); setNewName(''); setNewEmoji('🏡'); }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.createBtn, (!newName.trim() || saving) && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!newName.trim() || saving}
                  >
                    <Text style={styles.createBtnText}>Create & save</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: GrottoTokens.borderSubtle,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  closeBtn: {
    position: 'absolute',
    right: Layout.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
  },

  // ── List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  listRowPressed: {
    opacity: 0.7,
  },
  listEmoji: {
    width: 44,
    height: 44,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  listEmojiAdd: {
    backgroundColor: GrottoTokens.surface,
  },
  emojiText: {
    fontSize: 22,
  },
  listName: {
    flex: 1,
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.white,
  },
  checkboxActive: {
    backgroundColor: GrottoTokens.textPrimary,
    borderColor: GrottoTokens.textPrimary,
  },

  // ── Create form
  createForm: {
    paddingVertical: Layout.spacing.md,
    gap: 4,
  },
  formLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    marginBottom: Layout.spacing.xs,
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    backgroundColor: GrottoTokens.white,
  },
  emojiGrid: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    flexWrap: 'wrap',
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: Layout.radius.md,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.white,
  },
  emojiOptionActive: {
    borderColor: GrottoTokens.textPrimary,
    backgroundColor: GrottoTokens.surface,
  },
  emojiPickerText: {
    fontSize: 22,
  },
  formActions: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    marginTop: Layout.spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  createBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.textPrimary,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },

  // ── No-auth state
  noAuthContent: {
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  noAuthTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  noAuthBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  noAuthBtn: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    paddingHorizontal: 36,
    marginTop: Layout.spacing.xs,
  },
  noAuthBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});
