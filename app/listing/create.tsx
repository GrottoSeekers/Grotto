import { useCallback, useEffect, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { db } from '@/db/client';
import { listings, sits } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AMENITY_OPTIONS = [
  { key: 'wifi',             label: 'WiFi',        icon: 'wifi-outline' as const },
  { key: 'pool',             label: 'Pool',        icon: 'water-outline' as const },
  { key: 'gym',              label: 'Gym',         icon: 'barbell-outline' as const },
  { key: 'parking',          label: 'Parking',     icon: 'car-outline' as const },
  { key: 'garden',           label: 'Garden',      icon: 'leaf-outline' as const },
  { key: 'kitchen',          label: 'Kitchen',     icon: 'restaurant-outline' as const },
  { key: 'washer',           label: 'Washer',      icon: 'shirt-outline' as const },
  { key: 'tv',               label: 'TV',          icon: 'tv-outline' as const },
  { key: 'air conditioning', label: 'Air con',     icon: 'snow-outline' as const },
  { key: 'heating',          label: 'Heating',     icon: 'flame-outline' as const },
  { key: 'workspace',        label: 'Workspace',   icon: 'desktop-outline' as const },
  { key: 'bbq',              label: 'BBQ',         icon: 'bonfire-outline' as const },
  { key: 'patio',            label: 'Patio',       icon: 'home-outline' as const },
  { key: 'hot tub',          label: 'Hot tub',     icon: 'thermometer-outline' as const },
  { key: 'fireplace',        label: 'Fireplace',   icon: 'bonfire-outline' as const },
  { key: 'elevator',         label: 'Elevator',    icon: 'arrow-up-outline' as const },
];

const PET_TYPE_OPTIONS = [
  { key: 'dog',     label: 'Dog',     icon: '🐕' },
  { key: 'cat',     label: 'Cat',     icon: '🐈' },
  { key: 'bird',    label: 'Bird',    icon: '🦜' },
  { key: 'rabbit',  label: 'Rabbit',  icon: '🐇' },
  { key: 'fish',    label: 'Fish',    icon: '🐠' },
  { key: 'reptile', label: 'Reptile', icon: '🦎' },
  { key: 'other',   label: 'Other',   icon: '🐾' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TOTAL_STEPS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PetEntry {
  type: string;
  name: string;
  breed: string;
  age: string;
  photoUrls: string[];
}

interface DateRange {
  id: string;
  startDate: string; // stored as YYYY-MM-DD
  endDate: string;   // stored as YYYY-MM-DD
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Display format: DD-MM-YYYY */
function toDisplayDate(ymd: string): string {
  if (!ymd || ymd.length < 10) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
}

// ─── Calendar picker modal ────────────────────────────────────────────────────

function CalendarPicker({
  visible,
  onClose,
  onSelect,
  selectedDate,
  minDate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (ymd: string) => void;
  selectedDate: string;
  minDate?: string;
}) {
  const today = new Date();

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Sync view to selected date when modal opens
  useEffect(() => {
    if (visible) {
      if (selectedDate && selectedDate.length === 10) {
        setViewYear(parseInt(selectedDate.slice(0, 4), 10));
        setViewMonth(parseInt(selectedDate.slice(5, 7), 10) - 1);
      } else {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const ymd = `${viewYear}-${mm}-${dd}`;
    onSelect(ymd);
    onClose();
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday-first offset: Sunday (0) → 6, Monday (1) → 0, etc.
  const rawFirst = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (rawFirst + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selDay = selectedDate && selectedDate.slice(0, 7) === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    ? parseInt(selectedDate.slice(8, 10), 10)
    : null;

  const todayDay   = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  const minYmd = minDate ?? '';

  function isDayDisabled(day: number): boolean {
    if (!minYmd) return false;
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}` < minYmd;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={calStyles.overlay} onPress={onClose}>
        <Pressable style={calStyles.sheet} onPress={() => { /* absorb touches */ }}>
          {/* Month nav */}
          <View style={calStyles.calHeader}>
            <Pressable style={calStyles.calNavBtn} onPress={prevMonth} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={GrottoTokens.textPrimary} />
            </Pressable>
            <Text style={calStyles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <Pressable style={calStyles.calNavBtn} onPress={nextMonth} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={GrottoTokens.textPrimary} />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={calStyles.dayHeaders}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <Text key={d} style={calStyles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={calStyles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={calStyles.cell} />;
              const isSel      = day === selDay;
              const isToday    = day === todayDay;
              const isDisabled = isDayDisabled(day);
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    calStyles.cell,
                    isSel     && calStyles.cellSelected,
                    isToday && !isSel && calStyles.cellToday,
                    pressed && !isDisabled && calStyles.cellPressed,
                  ]}
                  onPress={() => !isDisabled && handleDay(day)}
                  disabled={isDisabled}
                >
                  <Text style={[
                    calStyles.cellText,
                    isSel      && calStyles.cellTextSel,
                    isToday && !isSel && calStyles.cellTextToday,
                    isDisabled && calStyles.cellTextDisabled,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={calStyles.doneBtn} onPress={onClose}>
            <Text style={calStyles.doneBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateListingScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [step, setStep]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Step 1 – Basics
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');

  // Step 2 – Location
  const [postcode, setPostcode] = useState('');
  const [city, setCity]         = useState('');
  const [country, setCountry]   = useState('');
  // Geocoded coordinates (set automatically when leaving step 2)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Step 3 – Property
  const [bedrooms, setBedrooms]   = useState(1);
  const [bathrooms, setBathrooms] = useState(1);

  // Step 4 – Amenities
  const [amenities, setAmenities] = useState<string[]>([]);

  // Step 5 – Photos
  const [coverPhoto, setCoverPhoto]   = useState<string | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);

  // Step 6 – Pets
  const [pets, setPets] = useState<PetEntry[]>([]);

  // Step 7 – Dates
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: Date.now().toString(), startDate: '', endDate: '' },
  ]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function canProceed(): boolean {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return city.trim().length > 0 && country.trim().length > 0;
    return true;
  }

  // ── Image picking ───────────────────────────────────────────────────────────

  async function pickCoverPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) setCoverPhoto(result.assets[0].uri);
  }

  async function pickExtraPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      setExtraPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }

  async function pickPetPhoto(petIndex: number) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newUrls = result.assets.map((a) => a.uri);
      setPets((prev) =>
        prev.map((p, i) =>
          i === petIndex ? { ...p, photoUrls: [...p.photoUrls, ...newUrls] } : p
        )
      );
    }
  }

  function removePetPhoto(petIndex: number, photoIndex: number) {
    setPets((prev) =>
      prev.map((p, i) =>
        i === petIndex
          ? { ...p, photoUrls: p.photoUrls.filter((_, j) => j !== photoIndex) }
          : p
      )
    );
  }

  function addPet(type: string) {
    setPets((prev) => [...prev, { type, name: '', breed: '', age: '', photoUrls: [] }]);
  }

  function removePet(index: number) {
    setPets((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePet(index: number, field: keyof Omit<PetEntry, 'photoUrls'>, value: string) {
    setPets((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  function addDateRange() {
    setDateRanges((prev) => [
      ...prev,
      { id: Date.now().toString(), startDate: '', endDate: '' },
    ]);
  }

  function removeDateRange(id: string) {
    setDateRanges((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDateRange(id: string, field: 'startDate' | 'endDate', value: string) {
    setDateRanges((prev) => prev.map((d) => d.id === id ? { ...d, [field]: value } : d));
  }

  // ── Publish ─────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const lat = coords?.lat ?? 0;
      const lng = coords?.lng ?? 0;

      const validDates = dateRanges.filter(
        (d) =>
          d.startDate.match(/^\d{4}-\d{2}-\d{2}$/) &&
          d.endDate.match(/^\d{4}-\d{2}-\d{2}$/) &&
          d.endDate > d.startDate
      );

      const petPhotoData = pets.map((p) => ({
        name: p.name.trim() || p.type,
        breed: p.breed.trim() || undefined,
        age: p.age ? (parseInt(p.age, 10) || undefined) : undefined,
        photoUrl: p.photoUrls[0] || undefined,
        photos: p.photoUrls.length > 1 ? p.photoUrls : undefined,
      }));

      const inserted = await db.insert(listings).values({
        ownerId: currentUser.id,
        title: title.trim(),
        description: description.trim() || null,
        address: postcode.trim() || null, // postcode stored in address field
        latitude: lat,
        longitude: lng,
        city: city.trim() || null,
        country: country.trim() || null,
        bedrooms,
        bathrooms,
        amenities: amenities.length > 0 ? JSON.stringify(amenities) : null,
        petCount: pets.length,
        petTypes: pets.length > 0 ? JSON.stringify(pets.map((p) => p.type)) : null,
        coverPhotoUrl: coverPhoto ?? null,
        photos: extraPhotos.length > 0 ? JSON.stringify(extraPhotos) : null,
        petPhotos: petPhotoData.length > 0 ? JSON.stringify(petPhotoData) : null,
        isActive: 1,
      }).returning();

      const newListing = inserted[0];
      if (!newListing) throw new Error('Insert failed');

      for (const d of validDates) {
        await db.insert(sits).values({
          listingId: newListing.id,
          ownerId: currentUser.id,
          status: 'open',
          startDate: d.startDate,
          endDate: d.endDate,
        });
      }

      router.replace('/(tabs)/explore');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save listing. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => (step === 1 ? router.back() : setStep((s) => s - 1))}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>New listing</Text>
        <Text style={styles.headerStep}>{step}/{TOTAL_STEPS}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {/* Keyboard-aware wrapper that pushes the footer button up */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {step === 1 && (
            <StepBasics
              title={title}
              description={description}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
            />
          )}
          {step === 2 && (
            <StepLocation
              postcode={postcode}
              city={city}
              country={country}
              onPostcodeChange={setPostcode}
              onCityChange={setCity}
              onCountryChange={setCountry}
            />
          )}
          {step === 3 && (
            <StepProperty
              bedrooms={bedrooms}
              bathrooms={bathrooms}
              onBedroomsChange={setBedrooms}
              onBathroomsChange={setBathrooms}
            />
          )}
          {step === 4 && (
            <StepAmenities selected={amenities} onToggle={(k) =>
              setAmenities((prev) => prev.includes(k) ? prev.filter((a) => a !== k) : [...prev, k])
            } />
          )}
          {step === 5 && (
            <StepPhotos
              coverPhoto={coverPhoto}
              extraPhotos={extraPhotos}
              onPickCover={pickCoverPhoto}
              onPickExtra={pickExtraPhoto}
              onRemoveExtra={(uri) => setExtraPhotos((prev) => prev.filter((p) => p !== uri))}
            />
          )}
          {step === 6 && (
            <StepPets
              pets={pets}
              onAddPet={addPet}
              onRemovePet={removePet}
              onUpdatePet={updatePet}
              onPickPetPhoto={pickPetPhoto}
              onRemovePetPhoto={removePetPhoto}
            />
          )}
          {step === 7 && (
            <StepDates
              dateRanges={dateRanges}
              onAdd={addDateRange}
              onRemove={removeDateRange}
              onUpdate={updateDateRange}
            />
          )}

          {/* Extra bottom padding so content isn't hidden behind the footer */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Footer lives inside KeyboardAvoidingView so it lifts above the keyboard */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={useCallback(async () => {
              if (!canProceed()) return;

              // Step 2: geocode the postcode / city / country before advancing
              if (step === 2) {
                setGeocoding(true);
                try {
                  const query = [postcode.trim(), city.trim(), country.trim()]
                    .filter(Boolean)
                    .join(', ');
                  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
                  const res = await fetch(url, {
                    headers: { 'User-Agent': 'GrottoApp/1.0', 'Accept': 'application/json' },
                  });
                  const data = await res.json();
                  if (!data?.[0]) {
                    Alert.alert(
                      'Location not found',
                      'We couldn\'t find that location. Please check your postcode, city, and country then try again.',
                    );
                    return;
                  }
                  // Tiny random offset (~250 m) so the exact point isn't pinned
                  const OFFSET = 0.0025;
                  setCoords({
                    lat: parseFloat(data[0].lat) + (Math.random() - 0.5) * OFFSET * 2,
                    lng: parseFloat(data[0].lon) + (Math.random() - 0.5) * OFFSET * 2,
                  });
                  setStep((s) => s + 1);
                } catch {
                  Alert.alert('Network error', 'Please check your connection and try again.');
                } finally {
                  setGeocoding(false);
                }
                return;
              }

              if (step < TOTAL_STEPS) setStep((s) => s + 1);
              else handlePublish();
            }, [step, postcode, city, country, canProceed])}
            disabled={saving || geocoding}
          >
            <Text style={styles.nextBtnText}>
              {geocoding ? 'Finding location…' : saving ? 'Publishing…' : step < TOTAL_STEPS ? 'Continue' : 'Publish listing'}
            </Text>
            {!saving && !geocoding && (
              <Ionicons
                name={step < TOTAL_STEPS ? 'arrow-forward' : 'checkmark'}
                size={18}
                color={GrottoTokens.white}
              />
            )}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step 1 – Basics ──────────────────────────────────────────────────────────

function StepBasics({
  title, description, onTitleChange, onDescriptionChange,
}: {
  title: string; description: string;
  onTitleChange: (v: string) => void; onDescriptionChange: (v: string) => void;
}) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 1 of 7</Text>
      <Text style={ss.heading}>Name your home</Text>
      <Text style={ss.subheading}>
        Give your listing a title that captures what makes your home special.
      </Text>

      <Field label="Listing title *">
        <TextInput
          style={ss.input}
          value={title}
          onChangeText={onTitleChange}
          placeholder="e.g. Cosy cottage in the Cotswolds"
          placeholderTextColor={GrottoTokens.textMuted}
          maxLength={80}
          returnKeyType="next"
        />
        <Text style={ss.charCount}>{title.length}/80</Text>
      </Field>

      <Field label="Description">
        <TextInput
          style={[ss.input, ss.textArea]}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Tell sitters about your home — the neighbourhood, what makes it special, any quirks to know about…"
          placeholderTextColor={GrottoTokens.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={1500}
        />
        <Text style={ss.charCount}>{description.length}/1500</Text>
      </Field>
    </View>
  );
}

// ─── Step 2 – Location ────────────────────────────────────────────────────────

function StepLocation({
  postcode, city, country,
  onPostcodeChange, onCityChange, onCountryChange,
}: {
  postcode: string; city: string; country: string;
  onPostcodeChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onCountryChange: (v: string) => void;
}) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 2 of 7</Text>
      <Text style={ss.heading}>Where is your home?</Text>

      {/* Privacy disclosure */}
      <View style={ss.disclosureBanner}>
        <Ionicons name="lock-closed-outline" size={16} color={GrottoTokens.gold} style={{ marginTop: 1 }} />
        <Text style={ss.disclosureText}>
          Your exact address is never shown on your public listing. Sitters see only an approximate area on the map. The full address is shared privately once a sit has been accepted and confirmed.
        </Text>
      </View>

      <Field label="Postcode">
        <TextInput
          style={ss.input}
          value={postcode}
          onChangeText={onPostcodeChange}
          placeholder="SW1A 1AA"
          placeholderTextColor={GrottoTokens.textMuted}
          autoCapitalize="characters"
        />
      </Field>

      <View style={ss.row}>
        <Field label="City *" style={{ flex: 1 }}>
          <TextInput
            style={ss.input}
            value={city}
            onChangeText={onCityChange}
            placeholder="London"
            placeholderTextColor={GrottoTokens.textMuted}
          />
        </Field>
        <Field label="Country *" style={{ flex: 1 }}>
          <TextInput
            style={ss.input}
            value={country}
            onChangeText={onCountryChange}
            placeholder="United Kingdom"
            placeholderTextColor={GrottoTokens.textMuted}
          />
        </Field>
      </View>

      <View style={ss.infoBanner}>
        <Ionicons name="map-outline" size={16} color={GrottoTokens.gold} style={{ marginTop: 1 }} />
        <Text style={ss.infoText}>
          We'll automatically place your listing on the map using your postcode and city. Sitters will see a shaded area, not your exact door.
        </Text>
      </View>
    </View>
  );
}

// ─── Step 3 – Property ────────────────────────────────────────────────────────

function StepProperty({
  bedrooms, bathrooms, onBedroomsChange, onBathroomsChange,
}: {
  bedrooms: number; bathrooms: number;
  onBedroomsChange: (v: number) => void; onBathroomsChange: (v: number) => void;
}) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 3 of 7</Text>
      <Text style={ss.heading}>Property details</Text>
      <Text style={ss.subheading}>Help sitters know what space they'll have.</Text>
      <Stepper label="Bedrooms" icon="bed-outline" value={bedrooms} min={1} max={20} onChange={onBedroomsChange} />
      <Stepper label="Bathrooms" icon="water-outline" value={bathrooms} min={1} max={10} onChange={onBathroomsChange} />
    </View>
  );
}

function Stepper({
  label, icon, value, min, max, onChange,
}: {
  label: string; icon: keyof typeof Ionicons.glyphMap;
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={ss.stepperRow}>
      <View style={ss.stepperLeft}>
        <Ionicons name={icon} size={22} color={GrottoTokens.textSecondary} />
        <Text style={ss.stepperLabel}>{label}</Text>
      </View>
      <View style={ss.stepperControls}>
        <Pressable
          style={[ss.stepperBtn, value <= min && ss.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Ionicons name="remove" size={18} color={value <= min ? GrottoTokens.textMuted : GrottoTokens.textPrimary} />
        </Pressable>
        <Text style={ss.stepperValue}>{value}</Text>
        <Pressable
          style={[ss.stepperBtn, value >= max && ss.stepperBtnDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Ionicons name="add" size={18} color={value >= max ? GrottoTokens.textMuted : GrottoTokens.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 4 – Amenities ───────────────────────────────────────────────────────

function StepAmenities({ selected, onToggle }: { selected: string[]; onToggle: (k: string) => void }) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 4 of 7</Text>
      <Text style={ss.heading}>What does your home offer?</Text>
      <Text style={ss.subheading}>Select all the amenities available to sitters.</Text>

      <View style={ss.amenityGrid}>
        {AMENITY_OPTIONS.map((a) => {
          const active = selected.includes(a.key);
          return (
            <Pressable
              key={a.key}
              style={({ pressed }) => [
                ss.amenityChip,
                active && ss.amenityChipActive,
                pressed && ss.amenityChipPressed,
              ]}
              onPress={() => onToggle(a.key)}
            >
              <Ionicons
                name={a.icon}
                size={18}
                color={active ? GrottoTokens.gold : GrottoTokens.textSecondary}
              />
              <Text style={[ss.amenityLabel, active && ss.amenityLabelActive]}>{a.label}</Text>
              {active && (
                <Ionicons name="checkmark-circle" size={14} color={GrottoTokens.gold} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 5 – Photos ──────────────────────────────────────────────────────────

function StepPhotos({
  coverPhoto, extraPhotos, onPickCover, onPickExtra, onRemoveExtra,
}: {
  coverPhoto: string | null; extraPhotos: string[];
  onPickCover: () => void; onPickExtra: () => void;
  onRemoveExtra: (uri: string) => void;
}) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 5 of 7</Text>
      <Text style={ss.heading}>Show off your home</Text>
      <Text style={ss.subheading}>Great photos are the #1 thing sitters look at.</Text>

      <Text style={ss.fieldLabel}>Cover photo</Text>
      <Pressable style={ss.coverPhotoBtn} onPress={onPickCover}>
        {coverPhoto ? (
          <>
            <Image source={{ uri: coverPhoto }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <View style={ss.coverPhotoOverlay}>
              <Ionicons name="camera-outline" size={22} color={GrottoTokens.white} />
              <Text style={ss.coverPhotoOverlayText}>Change photo</Text>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="camera-outline" size={36} color={GrottoTokens.goldMuted} />
            <Text style={ss.coverPhotoLabel}>Tap to add cover photo</Text>
            <Text style={ss.coverPhotoHint}>4:3 ratio recommended</Text>
          </>
        )}
      </Pressable>

      <View style={ss.extraPhotosHeader}>
        <Text style={ss.fieldLabel}>Additional photos</Text>
        <Text style={ss.extraCount}>{extraPhotos.length} added</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ss.extraRow}
        style={ss.extraScroll}
      >
        {extraPhotos.map((uri) => (
          <View key={uri} style={ss.extraThumbWrap}>
            <Image source={{ uri }} style={ss.extraThumb} contentFit="cover" />
            <Pressable style={ss.extraRemoveBtn} onPress={() => onRemoveExtra(uri)} hitSlop={6}>
              <Ionicons name="close-circle" size={20} color={GrottoTokens.error} />
            </Pressable>
          </View>
        ))}
        <Pressable style={ss.addExtraBtn} onPress={onPickExtra}>
          <Ionicons name="add" size={24} color={GrottoTokens.gold} />
          <Text style={ss.addExtraText}>Add photos</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Step 6 – Pets ────────────────────────────────────────────────────────────

function StepPets({
  pets, onAddPet, onRemovePet, onUpdatePet, onPickPetPhoto, onRemovePetPhoto,
}: {
  pets: PetEntry[];
  onAddPet: (type: string) => void;
  onRemovePet: (i: number) => void;
  onUpdatePet: (i: number, field: keyof Omit<PetEntry, 'photoUrls'>, value: string) => void;
  onPickPetPhoto: (i: number) => void;
  onRemovePetPhoto: (petI: number, photoI: number) => void;
}) {
  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 6 of 7</Text>
      <Text style={ss.heading}>Meet the pets</Text>
      <Text style={ss.subheading}>Add details about each animal sitters will be caring for.</Text>

      <Text style={ss.fieldLabel}>Add a pet</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ss.petTypeRow}
        style={ss.petTypeScroll}
      >
        {PET_TYPE_OPTIONS.map((p) => {
          const count = pets.filter((e) => e.type === p.key).length;
          return (
            <Pressable
              key={p.key}
              style={({ pressed }) => [
                ss.petTypeChip,
                pressed && ss.petTypeChipPressed,
              ]}
              onPress={() => onAddPet(p.key)}
            >
              <Text style={ss.petTypeEmoji}>{p.icon}</Text>
              <Text style={ss.petTypeLabel}>{p.label}</Text>
              {count > 0 && (
                <View style={ss.petCountBadge}>
                  <Text style={ss.petCountBadgeText}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {pets.length === 0 && (
        <View style={ss.noDataHint}>
          <Ionicons name="paw-outline" size={36} color={GrottoTokens.goldMuted} />
          <Text style={ss.noDataText}>No pets added yet</Text>
          <Text style={ss.noDataSub}>Tap a pet type above to add one</Text>
        </View>
      )}

      {pets.map((pet, index) => (
        <View key={index} style={ss.petCard}>
          {/* Card header */}
          <View style={ss.petCardHeader}>
            <Text style={ss.petCardTitle}>
              {PET_TYPE_OPTIONS.find((p) => p.key === pet.type)?.icon}{' '}
              {PET_TYPE_OPTIONS.find((p) => p.key === pet.type)?.label} #{index + 1}
            </Text>
            <Pressable onPress={() => onRemovePet(index)} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={22} color={GrottoTokens.error} />
            </Pressable>
          </View>

          {/* Name + breed row */}
          <View style={ss.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={ss.input}
                value={pet.name}
                onChangeText={(v) => onUpdatePet(index, 'name', v)}
                placeholder="Pet name"
                placeholderTextColor={GrottoTokens.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={ss.input}
                value={pet.breed}
                onChangeText={(v) => onUpdatePet(index, 'breed', v)}
                placeholder="Breed (optional)"
                placeholderTextColor={GrottoTokens.textMuted}
              />
            </View>
          </View>

          <TextInput
            style={[ss.input, { width: '45%' }]}
            value={pet.age}
            onChangeText={(v) => onUpdatePet(index, 'age', v)}
            placeholder="Age (years)"
            placeholderTextColor={GrottoTokens.textMuted}
            keyboardType="number-pad"
          />

          {/* Photos */}
          <Text style={[ss.fieldLabel, { marginTop: Layout.spacing.sm }]}>Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ss.petPhotosRow}
          >
            {pet.photoUrls.map((uri, photoIndex) => (
              <View key={photoIndex} style={ss.petPhotoWrap}>
                <Image source={{ uri }} style={ss.petPhotoImg} contentFit="cover" />
                <Pressable
                  style={ss.petPhotoRemove}
                  onPress={() => onRemovePetPhoto(index, photoIndex)}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={20} color={GrottoTokens.error} />
                </Pressable>
              </View>
            ))}
            <Pressable style={ss.addPetPhotoBtn} onPress={() => onPickPetPhoto(index)}>
              <Ionicons name="camera-outline" size={22} color={GrottoTokens.gold} />
              <Text style={ss.addPetPhotoText}>Add{'\n'}photo</Text>
            </Pressable>
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

// ─── Step 7 – Dates ───────────────────────────────────────────────────────────

function StepDates({
  dateRanges, onAdd, onRemove, onUpdate,
}: {
  dateRanges: DateRange[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'startDate' | 'endDate', value: string) => void;
}) {
  const [calTarget, setCalTarget] = useState<{ id: string; field: 'startDate' | 'endDate' } | null>(null);

  const activeRange  = calTarget ? dateRanges.find((d) => d.id === calTarget.id) : null;
  const activeValue  = activeRange ? activeRange[calTarget!.field] : '';
  const minForEndDate = calTarget?.field === 'endDate' && activeRange?.startDate
    ? activeRange.startDate
    : undefined;

  return (
    <View style={ss.container}>
      <Text style={ss.stepLabel}>Step 7 of 7</Text>
      <Text style={ss.heading}>When do you need a sitter?</Text>
      <Text style={ss.subheading}>
        Add one or more date ranges. Each becomes an available sit on your listing.
      </Text>

      {dateRanges.map((d, index) => (
        <View key={d.id} style={ss.dateCard}>
          <View style={ss.dateCardHeader}>
            <Text style={ss.dateCardLabel}>Date range {index + 1}</Text>
            {dateRanges.length > 1 && (
              <Pressable onPress={() => onRemove(d.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={GrottoTokens.error} />
              </Pressable>
            )}
          </View>
          <View style={ss.row}>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>From</Text>
              <Pressable
                style={ss.dateInput}
                onPress={() => setCalTarget({ id: d.id, field: 'startDate' })}
              >
                <Ionicons name="calendar-outline" size={16} color={GrottoTokens.gold} />
                <Text style={[ss.dateInputText, !d.startDate && ss.dateInputPlaceholder]}>
                  {d.startDate ? toDisplayDate(d.startDate) : 'DD-MM-YYYY'}
                </Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>To</Text>
              <Pressable
                style={ss.dateInput}
                onPress={() => setCalTarget({ id: d.id, field: 'endDate' })}
              >
                <Ionicons name="calendar-outline" size={16} color={GrottoTokens.gold} />
                <Text style={[ss.dateInputText, !d.endDate && ss.dateInputPlaceholder]}>
                  {d.endDate ? toDisplayDate(d.endDate) : 'DD-MM-YYYY'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}

      <Pressable style={ss.addDateBtn} onPress={onAdd}>
        <Ionicons name="add-circle-outline" size={18} color={GrottoTokens.gold} />
        <Text style={ss.addDateText}>Add another date range</Text>
      </Pressable>

      {/* Calendar modal */}
      <CalendarPicker
        visible={calTarget !== null}
        onClose={() => setCalTarget(null)}
        onSelect={(ymd) => {
          if (calTarget) {
            onUpdate(calTarget.id, calTarget.field, ymd);
            setCalTarget(null);
          }
        }}
        selectedDate={activeValue}
        minDate={minForEndDate}
      />
    </View>
  );
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

function Field({
  label, children, style,
}: {
  label: string; children: React.ReactNode; style?: object;
}) {
  return (
    <View style={[ss.field, style]}>
      <Text style={ss.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
  },
  headerStep: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  progressTrack: {
    height: 3,
    backgroundColor: GrottoTokens.borderSubtle,
  },
  progressFill: {
    height: 3,
    backgroundColor: GrottoTokens.gold,
  },
  scrollContent: {
    paddingBottom: Layout.spacing.md,
  },
  footer: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnDisabled: {
    backgroundColor: GrottoTokens.goldMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.white,
  },
});

// Step-level styles (shared across all steps)
const ss = StyleSheet.create({
  container: {
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  stepLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 26,
    color: GrottoTokens.textPrimary,
    lineHeight: 34,
    marginTop: -4,
  },
  subheading: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },

  // Field
  field: {
    gap: Layout.spacing.xs,
  },
  fieldLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    backgroundColor: GrottoTokens.white,
  },
  textArea: {
    minHeight: 130,
    paddingTop: 12,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },

  // Banners
  disclosureBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
  },
  disclosureText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.surface,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  infoText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  stepperLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  stepperLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    backgroundColor: GrottoTokens.surface,
  },
  stepperValue: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
    color: GrottoTokens.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },

  // Amenities
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  amenityChipActive: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  amenityChipPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  amenityLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  amenityLabelActive: {
    color: GrottoTokens.gold,
  },

  // Cover photo
  coverPhotoBtn: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Layout.radius.lg,
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    borderStyle: 'dashed',
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: Layout.spacing.sm,
  },
  coverPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.xs,
  },
  coverPhotoOverlayText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.white,
  },
  coverPhotoLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
  },
  coverPhotoHint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  extraPhotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Layout.spacing.sm,
  },
  extraCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  extraScroll: {
    marginHorizontal: -Layout.spacing.md,
  },
  extraRow: {
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
    paddingVertical: 4,
  },
  extraThumbWrap: {
    position: 'relative',
  },
  extraThumb: {
    width: 100,
    height: 100,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.surface,
  },
  extraRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: GrottoTokens.white,
    borderRadius: 10,
  },
  addExtraBtn: {
    width: 100,
    height: 100,
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    borderStyle: 'dashed',
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addExtraText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
  },

  // Pets step
  petTypeScroll: {
    marginHorizontal: -Layout.spacing.md,
  },
  petTypeRow: {
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
    paddingVertical: 4,
  },
  petTypeChip: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    minWidth: 72,
    position: 'relative',
  },
  petTypeChipPressed: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.goldSubtle,
    transform: [{ scale: 0.94 }],
  },
  petTypeEmoji: {
    fontSize: 24,
  },
  petTypeLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  petCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GrottoTokens.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GrottoTokens.white,
    paddingHorizontal: 3,
  },
  petCountBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 10,
    color: GrottoTokens.white,
  },
  noDataHint: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
    gap: Layout.spacing.sm,
  },
  noDataText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
  },
  noDataSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
  petCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  petCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petCardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  petPhotosRow: {
    gap: Layout.spacing.sm,
    paddingVertical: 4,
  },
  petPhotoWrap: {
    position: 'relative',
  },
  petPhotoImg: {
    width: 80,
    height: 80,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.surface,
  },
  petPhotoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: GrottoTokens.white,
    borderRadius: 10,
  },
  addPetPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    borderStyle: 'dashed',
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addPetPhotoText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
  },

  // Dates step
  dateCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  dateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCardLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    backgroundColor: GrottoTokens.white,
  },
  dateInputText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  dateInputPlaceholder: {
    color: GrottoTokens.textMuted,
  },
  addDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: 14,
    borderRadius: Layout.radius.md,
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
    borderStyle: 'dashed',
    backgroundColor: GrottoTokens.goldSubtle,
    marginTop: Layout.spacing.xs,
  },
  addDateText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.gold,
  },
});

// Calendar styles
const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.md,
  },
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    width: Math.min(SCREEN_WIDTH - 32, 360),
    gap: Layout.spacing.sm,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: FontFamily.serifBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginTop: Layout.spacing.xs,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.full,
  },
  cellSelected: {
    backgroundColor: GrottoTokens.gold,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
  },
  cellPressed: {
    backgroundColor: GrottoTokens.goldSubtle,
  },
  cellText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  cellTextSel: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
  },
  cellTextToday: {
    color: GrottoTokens.gold,
    fontFamily: FontFamily.sansSemiBold,
  },
  cellTextDisabled: {
    color: GrottoTokens.borderSubtle,
  },
  doneBtn: {
    marginTop: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});
