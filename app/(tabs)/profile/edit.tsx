import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { db } from '@/db/client';
import { users } from '@/db/schema';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GALLERY = 8;
const COLS = 3;
const GAP = Layout.spacing.sm; // 8
const SCREEN_W = Dimensions.get('window').width;
// Section has padding md (16) on each side, outer scroll has padding md (16) on each side
const GRID_W = SCREEN_W - Layout.spacing.md * 4;
const GALLERY_THUMB = (GRID_W - GAP * (COLS - 1)) / COLS;

// Crop modal — 4:3 frame, full-bleed width
const CROP_FRAME_W = SCREEN_W - Layout.spacing.md * 2;
const CROP_FRAME_H = Math.round(CROP_FRAME_W * (3 / 4));

const PET_OPTIONS = [
  { key: 'dogs', label: 'Dogs' },
  { key: 'cats', label: 'Cats' },
  { key: 'birds', label: 'Birds' },
  { key: 'rabbits', label: 'Rabbits' },
  { key: 'fish', label: 'Fish' },
  { key: 'reptiles', label: 'Reptiles' },
  { key: 'small-animals', label: 'Small animals' },
] as const;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

async function requestPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
    return false;
  }
  return true;
}

// ─── PhotoCell ────────────────────────────────────────────────────────────────
// A single draggable photo thumbnail in the grid.
// Tap = re-crop/replace · long-press + drag = reorder · X = remove.
function PhotoCell({
  uri,
  idx,
  activeDragIdx,
  activeTX,
  activeTY,
  activeScale,
  draggingIdx,
  hoverIdx,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onRemove,
  onTap,
}: {
  uri: string;
  idx: number;
  activeDragIdx: SharedValue<number>;
  activeTX: SharedValue<number>;
  activeTY: SharedValue<number>;
  activeScale: SharedValue<number>;
  draggingIdx: number | null;
  hoverIdx: number | null;
  onDragStart: (idx: number, absX: number, absY: number) => void;
  onDragUpdate: (absX: number, absY: number) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onTap: () => void;
}) {
  const isThisDragging = draggingIdx === idx;
  const isHovered = hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
  const isAnyDragging = draggingIdx !== null;

  const animStyle = useAnimatedStyle(() => {
    const active = activeDragIdx.value === idx;
    return {
      transform: [
        { translateX: active ? activeTX.value : 0 },
        { translateY: active ? activeTY.value : 0 },
        { scale: active ? activeScale.value : 1 },
      ],
      zIndex: active ? 100 : 1,
      elevation: active ? 20 : 0,
      opacity: active ? 0.93 : 1,
    };
  });

  const gesture = useMemo(
    () => {
      const tap = Gesture.Tap()
        .onEnd(() => { runOnJS(onTap)(); });

      const pan = Gesture.Pan()
        .activateAfterLongPress(400)
        .onStart((e) => {
          activeTX.value = 0;
          activeTY.value = 0;
          activeScale.value = withSpring(1.08, { damping: 15 });
          activeDragIdx.value = idx;
          runOnJS(onDragStart)(idx, e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => {
          if (activeDragIdx.value === idx) {
            activeTX.value = e.translationX;
            activeTY.value = e.translationY;
            runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY);
          }
        })
        .onFinalize(() => {
          activeTX.value = withSpring(0, { damping: 15 });
          activeTY.value = withSpring(0, { damping: 15 });
          activeScale.value = withSpring(1, { damping: 15 });
          activeDragIdx.value = -1;
          runOnJS(onDragEnd)();
        });

      // Tap fires on a short press; Pan takes over on a long press.
      return Gesture.Exclusive(tap, pan);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, onTap],
  );

  return (
    <View style={styles.thumbSlot}>
      <View
        style={[
          styles.ghostSlot,
          isThisDragging && styles.ghostSlotActive,
          isHovered && styles.ghostSlotHovered,
        ]}
      />

      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.thumbInner, animStyle]}>
          <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
          {!isAnyDragging && (
            <View style={styles.thumbCropHint}>
              <Ionicons name="crop-outline" size={13} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* X button sits outside the GestureDetector so tapping it doesn't fire the crop tap */}
      {!isAnyDragging && (
        <Pressable
          style={styles.thumbRemove}
          onPress={onRemove}
          hitSlop={8}
        >
          <View style={styles.removeCircle}>
            <Ionicons name="close" size={12} color={GrottoTokens.white} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ─── CropModal ────────────────────────────────────────────────────────────────
// Full-screen crop tool for an existing photo URI.
// Pinch to zoom, drag to reposition; no library re-pick needed.
function CropModal({
  visible,
  imageUri,
  aspect = [4, 3],
  onCrop,
  onCancel,
}: {
  visible: boolean;
  imageUri: string | null;
  aspect?: [number, number];
  onCrop: (uri: string) => void;
  onCancel: () => void;
}) {
  const frameH = Math.round(CROP_FRAME_W * aspect[1] / aspect[0]);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [applying, setApplying] = useState(false);

  // Reanimated shared values for pan and scale
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const userScale = useSharedValue(1);
  const savedUserScale = useSharedValue(1);

  // Reset and load image dimensions whenever the modal opens with a new URI
  useEffect(() => {
    if (!imageUri || !visible) return;
    setImgSize(null);
    setApplying(false);
    panX.value = 0;
    panY.value = 0;
    savedPanX.value = 0;
    savedPanY.value = 0;
    userScale.value = 1;
    savedUserScale.value = 1;

    // Use a no-op manipulate call to get the original image dimensions
    manipulateAsync(imageUri, [])
      .then((r) => setImgSize({ w: r.width, h: r.height }))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri, visible]);

  // Scale to cover the crop frame (like contentFit="cover")
  const fitScale = imgSize
    ? Math.max(CROP_FRAME_W / imgSize.w, frameH / imgSize.h)
    : 1;
  const displayW = imgSize ? Math.round(imgSize.w * fitScale) : CROP_FRAME_W;
  const displayH = imgSize ? Math.round(imgSize.h * fitScale) : frameH;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      panX.value = savedPanX.value + e.translationX;
      panY.value = savedPanY.value + e.translationY;
    })
    .onEnd(() => {
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      userScale.value = Math.max(1, savedUserScale.value * e.scale);
    })
    .onEnd(() => {
      savedUserScale.value = userScale.value;
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: userScale.value },
    ],
  }));

  async function handleDone() {
    if (!imageUri || !imgSize) return;
    setApplying(true);
    try {
      const totalScale = fitScale * userScale.value;
      const tx = panX.value;
      const ty = panY.value;

      // Map from screen-space pan/scale back to original image pixel coordinates
      let originX = imgSize.w / 2 - CROP_FRAME_W / (2 * totalScale) - tx / totalScale;
      let originY = imgSize.h / 2 - frameH / (2 * totalScale) - ty / totalScale;
      let cropW = CROP_FRAME_W / totalScale;
      let cropH = frameH / totalScale;

      // Clamp to image bounds
      originX = Math.round(Math.max(0, Math.min(imgSize.w - cropW, originX)));
      originY = Math.round(Math.max(0, Math.min(imgSize.h - cropH, originY)));
      cropW = Math.round(Math.min(cropW, imgSize.w - originX));
      cropH = Math.round(Math.min(cropH, imgSize.h - originY));

      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      onCrop(result.uri);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not apply crop. Please try again.');
    } finally {
      setApplying(false);
    }
  }

  const headerPaddingTop = Platform.OS === 'ios' ? 56 : 32;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={cropStyles.bg}>
        {/* ── Header ── */}
        <View style={[cropStyles.header, { paddingTop: headerPaddingTop }]}>
          <Pressable onPress={onCancel} hitSlop={16} style={cropStyles.headerSideBtn}>
            <Text style={cropStyles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={cropStyles.headerTitle}>Crop photo</Text>
          <Pressable
            onPress={handleDone}
            disabled={!imgSize || applying}
            hitSlop={16}
            style={cropStyles.headerSideBtn}
          >
            <Text style={[cropStyles.doneText, (!imgSize || applying) && cropStyles.doneTextDisabled]}>
              {applying ? 'Saving…' : 'Done'}
            </Text>
          </Pressable>
        </View>

        <Text style={cropStyles.hint}>Pinch to zoom · drag to reposition</Text>

        {/* ── Crop frame ── */}
        <View style={cropStyles.frameWrap}>
          {imgSize ? (
            <View style={[cropStyles.frame, { width: CROP_FRAME_W, height: frameH }]}>
              <GestureDetector gesture={composed}>
                <Animated.View
                  style={[
                    {
                      width: displayW,
                      height: displayH,
                      position: 'absolute',
                      left: (CROP_FRAME_W - displayW) / 2,
                      top: (frameH - displayH) / 2,
                    },
                    imageAnimStyle,
                  ]}
                >
                  <Image
                    source={{ uri: imageUri! }}
                    style={{ width: displayW, height: displayH }}
                    contentFit="fill"
                  />
                </Animated.View>
              </GestureDetector>

              {/* Gold corner guides */}
              <View style={[cropStyles.corner, cropStyles.cornerTL]} pointerEvents="none" />
              <View style={[cropStyles.corner, cropStyles.cornerTR]} pointerEvents="none" />
              <View style={[cropStyles.corner, cropStyles.cornerBL]} pointerEvents="none" />
              <View style={[cropStyles.corner, cropStyles.cornerBR]} pointerEvents="none" />
            </View>
          ) : (
            <View style={[cropStyles.frame, cropStyles.frameLoading, { width: CROP_FRAME_W, height: frameH }]}>
              <ActivityIndicator color={GrottoTokens.gold} size="large" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── EditProfileScreen ────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();
  const { currentUser, setUser } = useSessionStore();

  // ── Form state ──
  const [name, setName] = useState(currentUser?.name ?? '');
  const [location, setLocation] = useState(currentUser?.location ?? '');
  const [occupation, setOccupation] = useState(currentUser?.occupation ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [whyIWantToSit, setWhyIWantToSit] = useState(currentUser?.whyIWantToSit ?? '');
  const [preferredPets, setPreferredPets] = useState<string[]>(
    parseJson<string[]>(currentUser?.preferredPets, []),
  );
  const [avatarUri, setAvatarUri] = useState<string | null>(currentUser?.avatarUrl ?? null);
  const [gallery, setGallery] = useState<string[]>(
    parseJson<string[]>(currentUser?.galleryPhotos, []),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropTargetIdx, setCropTargetIdx] = useState<number | null>(null);
  const [avatarCropUri, setAvatarCropUri] = useState<string | null>(null);

  // ── Drag state ──
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Refs to always-current values (needed inside runOnJS callbacks)
  const draggingIdxRef = useRef<number | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  // Grid container ref for position measurement
  const gridRef = useRef<View>(null);
  const gridPageX = useRef(0);
  const gridPageY = useRef(0);

  // ── Reanimated shared values ──
  const activeDragIdx = useSharedValue(-1);
  const activeTX = useSharedValue(0);
  const activeTY = useSharedValue(0);
  const activeScale = useSharedValue(1);

  // ── Drag handlers (JS thread) ──
  function handleDragStart(idx: number, _absX: number, _absY: number) {
    gridRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      gridPageX.current = pageX;
      gridPageY.current = pageY;
    });
    draggingIdxRef.current = idx;
    hoverIdxRef.current = idx;
    setDraggingIdx(idx);
    setHoverIdx(idx);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleDragUpdate(absX: number, absY: number) {
    const relX = absX - gridPageX.current;
    const relY = absY - gridPageY.current;
    const cellSize = GALLERY_THUMB + GAP;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(relX / cellSize)));
    const row = Math.max(0, Math.floor(relY / cellSize));
    const newHover = Math.min(gallery.length - 1, row * COLS + col);
    hoverIdxRef.current = newHover;
    setHoverIdx(newHover);
  }

  function handleDragEnd() {
    const from = draggingIdxRef.current;
    const to = hoverIdxRef.current;
    if (from !== null && to !== null && from !== to) {
      setGallery((prev) => {
        const result = [...prev];
        const [item] = result.splice(from, 1);
        result.splice(to, 0, item!);
        return result;
      });
    }
    draggingIdxRef.current = null;
    hoverIdxRef.current = null;
    setDraggingIdx(null);
    setHoverIdx(null);
  }

  // ── Photo picker helpers ──
  function togglePet(key: string) {
    setPreferredPets((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function pickAvatar() {
    if (avatarUri) {
      // Already has a photo — open the crop tool on it directly
      setAvatarCropUri(avatarUri);
      return;
    }
    // No photo yet — pick from library first, then crop
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarCropUri(result.assets[0].uri);
    }
  }

  async function addGalleryPhoto() {
    if (gallery.length >= MAX_GALLERY) {
      Alert.alert('Maximum reached', `You can add up to ${MAX_GALLERY} gallery photos.`);
      return;
    }
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setGallery((prev) => [...prev, result.assets[0]!.uri]);
    }
  }

  function removeGalleryPhoto(index: number) {
    Alert.alert('Remove photo', 'Remove this photo from your gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setGallery((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  }

  // ── Save ──
  async function handleSave() {
    if (!currentUser) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }
    setIsSaving(true);
    try {
      const [updated] = await db
        .update(users)
        .set({
          name: trimmedName,
          location: location.trim() || null,
          occupation: occupation.trim() || null,
          bio: bio.trim() || null,
          whyIWantToSit: whyIWantToSit.trim() || null,
          preferredPets: preferredPets.length > 0 ? JSON.stringify(preferredPets) : null,
          avatarUrl: avatarUri ?? null,
          galleryPhotos: gallery.length > 0 ? JSON.stringify(gallery) : null,
        })
        .where(eq(users.id, currentUser.id))
        .returning();
      if (updated) setUser(updated);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const initials = name.trim().slice(0, 2).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Disable scroll while dragging so the photo follows the finger
        scrollEnabled={draggingIdx === null}
      >

        {/* ── Profile photo ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile photo</Text>
          <Text style={styles.sectionHint}>This is the main photo owners see on your profile</Text>

          <View style={styles.avatarRow}>
            <Pressable style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color={GrottoTokens.white} />
              </View>
            </Pressable>

            <View style={styles.avatarMeta}>
              <Text style={styles.avatarMetaTitle}>
                {avatarUri ? 'Tap to crop or change' : 'Add a profile photo'}
              </Text>
              <Text style={styles.avatarMetaBody}>
                A clear photo of your face helps owners feel comfortable choosing you.
              </Text>
              {avatarUri ? (
                <Pressable onPress={() => setAvatarUri(null)}>
                  <Text style={styles.removeText}>Remove photo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Gallery photos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gallery photos</Text>
          <Text style={styles.sectionHint}>
            {gallery.length > 1
              ? 'Tap to crop · hold and drag to reorder · tap × to remove'
              : `Add up to ${MAX_GALLERY} photos — your home, pets, travels`}
          </Text>

          <View ref={gridRef} style={styles.galleryGrid}>
            {gallery.map((uri, i) => (
              <PhotoCell
                key={uri}
                uri={uri}
                idx={i}
                activeDragIdx={activeDragIdx}
                activeTX={activeTX}
                activeTY={activeTY}
                activeScale={activeScale}
                draggingIdx={draggingIdx}
                hoverIdx={hoverIdx}
                onDragStart={handleDragStart}
                onDragUpdate={handleDragUpdate}
                onDragEnd={handleDragEnd}
                onRemove={() => removeGalleryPhoto(i)}
                onTap={() => {
                  setCropUri(gallery[i] ?? null);
                  setCropTargetIdx(i);
                }}
              />
            ))}

            {gallery.length < MAX_GALLERY ? (
              <Pressable
                style={({ pressed }) => [styles.addThumb, pressed && styles.pressed]}
                onPress={addGalleryPhoto}
              >
                <Ionicons name="add" size={28} color={GrottoTokens.textMuted} />
                <Text style={styles.addThumbText}>Add</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Personal details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal details</Text>

          <Field label="First name">
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Your name"
              placeholderTextColor={GrottoTokens.textMuted}
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field label="Location" hint="City, Country">
            <TextInput
              value={location}
              onChangeText={setLocation}
              autoCapitalize="words"
              placeholder="e.g. London, United Kingdom"
              placeholderTextColor={GrottoTokens.textMuted}
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field label="Occupation">
            <TextInput
              value={occupation}
              onChangeText={setOccupation}
              autoCapitalize="words"
              placeholder="e.g. Designer, Teacher, Engineer"
              placeholderTextColor={GrottoTokens.textMuted}
              style={styles.input}
              returnKeyType="next"
            />
          </Field>
        </View>

        {/* ── About you ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About you</Text>

          <Field label="Bio" hint="Tell owners a little about yourself">
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              placeholder="Share who you are, your lifestyle, and what makes you a great sitter…"
              placeholderTextColor={GrottoTokens.textMuted}
              style={[styles.input, styles.textArea]}
              returnKeyType="default"
              textAlignVertical="top"
            />
          </Field>

          <Field label="Why I want to sit" hint="What draws you to house sitting?">
            <TextInput
              value={whyIWantToSit}
              onChangeText={setWhyIWantToSit}
              multiline
              numberOfLines={4}
              placeholder="I love animals and exploring new places…"
              placeholderTextColor={GrottoTokens.textMuted}
              style={[styles.input, styles.textArea]}
              returnKeyType="default"
              textAlignVertical="top"
            />
          </Field>
        </View>

        {/* ── Preferred pets ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred pets</Text>
          <Text style={styles.sectionHint}>Select all the animals you're happy to care for</Text>
          <View style={styles.petsGrid}>
            {PET_OPTIONS.map((pet) => {
              const selected = preferredPets.includes(pet.key);
              return (
                <Pressable
                  key={pet.key}
                  style={({ pressed }) => [
                    styles.petChip,
                    selected && styles.petChipSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => togglePet(pet.key)}
                >
                  <Ionicons
                    name="paw"
                    size={13}
                    color={selected ? GrottoTokens.white : GrottoTokens.textSecondary}
                  />
                  <Text style={[styles.petChipText, selected && styles.petChipTextSelected]}>
                    {pet.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Save ── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            isSaving && styles.saveBtnDisabled,
            pressed && !isSaving && styles.pressed,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
      </ScrollView>

      {/* Gallery photo crop (4:3) */}
      <CropModal
        visible={cropUri !== null}
        imageUri={cropUri}
        aspect={[4, 3]}
        onCrop={(uri) => {
          if (cropTargetIdx !== null) {
            setGallery((prev) => {
              const updated = [...prev];
              updated[cropTargetIdx] = uri;
              return updated;
            });
          }
          setCropUri(null);
          setCropTargetIdx(null);
        }}
        onCancel={() => {
          setCropUri(null);
          setCropTargetIdx(null);
        }}
      />

      {/* Avatar crop (1:1) */}
      <CropModal
        visible={avatarCropUri !== null}
        imageUri={avatarCropUri}
        aspect={[1, 1]}
        onCrop={(uri) => {
          setAvatarUri(uri);
          setAvatarCropUri(null);
        }}
        onCancel={() => setAvatarCropUri(null)}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: GrottoTokens.offWhite },
  content: {
    padding: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.lg,
    gap: Layout.spacing.md,
  },

  // ── Section wrapper ───────────────────────────────────────────────────────
  section: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  sectionHint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    marginTop: -8,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: Layout.radius.full,
    flexShrink: 0,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: Layout.radius.full,
    borderWidth: 2,
    borderColor: GrottoTokens.goldMuted,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 2,
    borderColor: GrottoTokens.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.gold,
    lineHeight: 34,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.gold,
    borderWidth: 2,
    borderColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMeta: { flex: 1, gap: 4 },
  avatarMetaTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  avatarMetaBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    lineHeight: 17,
    color: GrottoTokens.textSecondary,
  },
  removeText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.error,
    marginTop: 2,
  },

  // ── Gallery grid ──────────────────────────────────────────────────────────
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    // Allow dragged items to visually overflow the grid bounds
    overflow: 'visible',
  },

  // Each slot is a fixed-size container; the photo lifts out of it
  thumbSlot: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: Layout.radius.lg,
    overflow: 'visible', // so the lifted photo isn't clipped
    position: 'relative',
  },

  // Ghost background that stays in place when the photo lifts
  ghostSlot: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.radius.lg,
    backgroundColor: 'transparent',
  },
  ghostSlotActive: {
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 1.5,
    borderColor: GrottoTokens.goldMuted,
    borderStyle: 'dashed',
  },
  ghostSlotHovered: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 2,
    borderColor: GrottoTokens.gold,
    borderStyle: 'solid',
  },

  // The Animated.View that actually lifts and follows the finger
  thumbInner: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbCropHint: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: Layout.radius.sm,
    padding: 3,
  },
  thumbRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  removeCircle: {
    width: 22,
    height: 22,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addThumb: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: GrottoTokens.offWhite,
  },
  addThumbText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },

  // ── Form fields ───────────────────────────────────────────────────────────
  field: { gap: 6 },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  fieldHint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  input: {
    height: 48,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.offWhite,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },

  // ── Pets ──────────────────────────────────────────────────────────────────
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  petChipSelected: {
    backgroundColor: GrottoTokens.gold,
    borderColor: GrottoTokens.gold,
  },
  petChipText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  petChipTextSelected: { color: GrottoTokens.white },

  // ── Save ──────────────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: `0 8px 20px rgba(201,168,76,0.35)`,
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});

// ─── Crop modal styles ─────────────────────────────────────────────────────────
const cropStyles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },
  headerSideBtn: {
    minWidth: 64,
  },
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  cancelText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  doneText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.gold,
    textAlign: 'right',
  },
  doneTextDisabled: {
    opacity: 0.35,
  },
  hint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: Layout.spacing.xl,
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Layout.spacing.xxl,
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: '#000',
    borderRadius: Layout.radius.md,
  },
  frameLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Gold crop-guide corners
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: GrottoTokens.gold,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: GrottoTokens.gold,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: GrottoTokens.gold,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: GrottoTokens.gold,
  },
});
