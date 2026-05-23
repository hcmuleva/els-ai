import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';

import { useAuth } from '../../../src/context/AuthContext';
import { buildLogicoTenSlotPositions, LOGICO_CARD_HEIGHT, LOGICO_CARD_WIDTH, LOGICO_LAYOUT_SPLIT } from './sourceframe/constants/logicoLayout';
import { Frame } from './sourceframe/components/frame/Frame';
import { ButtonIdentity, Card } from './sourceframe/types';
import { LOGICO_BUTTON_SET } from './sourceframe/utils/colors';
import { logicopiccoloStyles } from './styles';
import { useGameStore } from './sourceframe/store/gameStore';

type SavedWorksheetSetup = {
  name: string;
  imageUrl: string;
  imageStorageKey?: string;
  imageWidth?: number;
  imageHeight?: number;
  buttonSlotMap: Record<string, number>;
  updatedAt: string;
};

const WORKSHEET_SETUPS_STORAGE_KEY = 'logicopiccolo_saved_worksheet_setups';
const WORKSHEET_IMAGE_DB_NAME = 'logicopiccolo_worksheet_images_v1';
const WORKSHEET_IMAGE_STORE_NAME = 'images';

export function LogicopiccoloFrame() {
  const { user } = useAuth();
  const {
    currentCard,
    placements,
    showAnswer,
    setCurrentCard,
    resetPlacements,
    toggleAnswerFlip,
    checkAnswer,
  } = useGameStore();
  const isTeacherAdmin = user?.activeRole === 'teacher';

  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [uploadedImageSize, setUploadedImageSize] = useState<{ width: number; height: number } | null>(null);
  const [savedSetups, setSavedSetups] = useState<SavedWorksheetSetup[]>([]);
  const [previewImageUrls, setPreviewImageUrls] = useState<Record<string, string>>({});
  const [selectedSetupName, setSelectedSetupName] = useState<string | null>(null);
  const [isFrameOpen, setIsFrameOpen] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  useEffect(() => {
    getSavedWorksheetSetups().then(setSavedSetups);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all(
      savedSetups.map(async (setup) => {
        const imageUrl = await resolveSetupImageUrl(setup);
        return [setup.name, imageUrl] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      setPreviewImageUrls(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [savedSetups]);

  const selectedSetup = useMemo(() => {
    return savedSetups.find((setup) => setup.name === selectedSetupName) ?? null;
  }, [savedSetups, selectedSetupName]);

  const refreshSaved = async () => {
    const setups = await getSavedWorksheetSetups();
    setSavedSetups(setups);
  };

  const loadSetupForPlay = async (setup: SavedWorksheetSetup) => {
    const imageUrl = await resolveSetupImageUrl(setup);
    if (!imageUrl) return;
    setCurrentCard(
      buildCardFromSetup(setup.name, imageUrl, setup.buttonSlotMap, setup.imageWidth, setup.imageHeight),
    );
    setUploadedImageUrl(imageUrl);
    setUploadedImageName(setup.name);
    setUploadedImageSize({
      width: setup.imageWidth ?? LOGICO_CARD_WIDTH,
      height: setup.imageHeight ?? LOGICO_CARD_HEIGHT,
    });
    setSelectedSetupName(setup.name);
    resetPlacements();
    setScore(null);
    setIsFrameOpen(true);
  };

  const handleCreateCard = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;
        setUploadedImageUrl(result);
        setUploadedImageName(file.name);
        const probe = new window.Image();
        probe.onload = () => {
          const size = { width: probe.width, height: probe.height };
          setUploadedImageSize(size);
          setCurrentCard(
            buildCardFromSetup(
              file.name,
              result,
              defaultButtonSlotMap(),
              size.width,
              size.height,
            ),
          );
          setSelectedSetupName(null);
          resetPlacements();
          setScore(null);
          setIsFrameOpen(true);
        };
        probe.src = result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSaveArrangement = async () => {
    if (!currentCard) return;
    const buttonSlotMap = getButtonSlotMapFromPlacements(placements);
    const missing = LOGICO_BUTTON_SET.filter(
      (button) => !Number.isInteger(buttonSlotMap[`${button.color}-${button.variant}`]),
    );
    if (missing.length) return;

    const setupName = await promptSetupName();
    if (!setupName) return;

    const setups = await saveWorksheetSetup({
      name: setupName,
      imageUrl: uploadedImageUrl || currentCard.imageUrl || '',
      imageWidth: uploadedImageSize?.width ?? LOGICO_CARD_WIDTH,
      imageHeight: uploadedImageSize?.height ?? LOGICO_CARD_HEIGHT,
      buttonSlotMap,
    });
    setSavedSetups(setups);
    setSelectedSetupName(setupName);
    setUploadedImageName(setupName);
  };

  const handleCheckAnswer = () => {
    const result = checkAnswer();
    setScore({ correct: result.correct, total: result.total });
  };

  return (
    <View style={logicopiccoloStyles.screen}>
      <View style={logicopiccoloStyles.content}>
        <View style={logicopiccoloStyles.previewPanel}>
          <Text style={logicopiccoloStyles.previewTitle}>Cards</Text>
          {isTeacherAdmin && (
            <Pressable style={logicopiccoloStyles.flipButton} onPress={handleCreateCard}>
              <Text style={logicopiccoloStyles.flipButtonText}>+ Create Card</Text>
            </Pressable>
          )}

          <View style={logicopiccoloStyles.cardGrid}>
            {savedSetups.map((setup) => (
              <Pressable
                key={setup.name}
                style={logicopiccoloStyles.cardTile}
                onPress={() => loadSetupForPlay(setup)}
              >
                {previewImageUrls[setup.name] ? (
                  <Image source={{ uri: previewImageUrls[setup.name] }} style={logicopiccoloStyles.cardTileImage} resizeMode="cover" />
                ) : (
                  <View style={logicopiccoloStyles.cardTilePlaceholder}>
                    <Text style={logicopiccoloStyles.cardTilePlaceholderText}>No Preview</Text>
                  </View>
                )}
                <Text style={logicopiccoloStyles.cardTileTitle} numberOfLines={2}>{setup.name}</Text>
              </Pressable>
            ))}
          </View>

          {savedSetups.length === 0 && (
            <Text style={logicopiccoloStyles.previewCode}>No saved cards yet.</Text>
          )}

          {isTeacherAdmin && (
            <Pressable style={logicopiccoloStyles.flipButton} onPress={refreshSaved}>
              <Text style={logicopiccoloStyles.flipButtonText}>Refresh Cards</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        visible={isFrameOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFrameOpen(false)}
      >
        <View style={logicopiccoloStyles.screen}>
          <View style={logicopiccoloStyles.content}>
            <View style={logicopiccoloStyles.headerBar}>
              <Pressable style={logicopiccoloStyles.headerBtn} onPress={() => setIsFrameOpen(false)}>
                <Text style={[logicopiccoloStyles.headerBtnText, { color: '#F1C84D' }]}>← Cards</Text>
              </Pressable>
              <Text style={logicopiccoloStyles.headerTitle} numberOfLines={1}>
                {selectedSetup?.name || currentCard?.title || 'logicopiccolo'}
              </Text>
              <Pressable style={logicopiccoloStyles.headerBtn} onPress={toggleAnswerFlip}>
                <Text style={[logicopiccoloStyles.headerBtnText, { color: '#66d16f' }]}>
                  {showAnswer ? 'Hide Clip' : 'Clip'}
                </Text>
              </Pressable>
            </View>

            <View style={logicopiccoloStyles.frameHost}>
              <Frame />
            </View>

            <View style={logicopiccoloStyles.previewPanel}>
              {!isTeacherAdmin && (
                <Pressable style={logicopiccoloStyles.flipButton} onPress={handleCheckAnswer}>
                  <Text style={logicopiccoloStyles.flipButtonText}>Check Answer</Text>
                </Pressable>
              )}

              {isTeacherAdmin && (
                <Pressable style={logicopiccoloStyles.flipButton} onPress={handleSaveArrangement}>
                  <Text style={logicopiccoloStyles.flipButtonText}>Save Arrangement</Text>
                </Pressable>
              )}

              {score && (
                <Text style={logicopiccoloStyles.previewTitle}>
                  Score: {score.correct}/{score.total}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function defaultButtonSlotMap() {
  const map: Record<string, number> = {};
  LOGICO_BUTTON_SET.forEach((button, index) => {
    map[`${button.color}-${button.variant}`] = index + 1;
  });
  return map;
}

function buildCardFromSetup(
  name: string,
  imageUrl: string,
  buttonSlotMap: Record<string, number>,
  imageWidth?: number,
  imageHeight?: number,
): Card {
  const questions = LOGICO_BUTTON_SET.map((button, index) => {
    const key = `${button.color}-${button.variant}`;
    return {
      id: index + 1,
      question: key,
      answer: '',
      color: button.color,
      variant: button.variant,
      targetSlot: buttonSlotMap[key] ?? index + 1,
    };
  });

  return {
    id: `logicopiccolo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: name,
    description: 'logicopiccolo worksheet',
    difficulty: 'medium',
    category: 'Logicopiccolo',
    imageUrl,
    questions,
    optionSlots: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: '' })),
    frameConfig: {
      totalSlots: 10,
      allowedColors: ['red', 'blue', 'green', 'yellow', 'orange'],
      cardAspectRatio: (imageWidth && imageHeight) ? imageWidth / imageHeight : LOGICO_CARD_WIDTH / LOGICO_CARD_HEIGHT,
      slotPositions: buildLogicoTenSlotPositions(),
      useAlignedLayout: true,
      layoutTemplate: 'logico-10-right',
      layoutSplit: LOGICO_LAYOUT_SPLIT,
    },
    createdAt: new Date(),
    plays: 0,
    successRate: 0,
  };
}

function getButtonSlotMapFromPlacements(placements: Map<number, ButtonIdentity>) {
  const result: Record<string, number> = {};
  placements.forEach((button, slotId) => {
    result[`${button.color}-${button.variant ?? 'solid'}`] = slotId;
  });
  return result;
}

async function promptSetupName() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const value = window.prompt('Enter worksheet setup name');
    const trimmed = value?.trim();
    return trimmed || null;
  }
  return null;
}

async function getSavedWorksheetSetups(): Promise<SavedWorksheetSetup[]> {
  const raw = await AsyncStorage.getItem(WORKSHEET_SETUPS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveWorksheetSetup(setup: Omit<SavedWorksheetSetup, 'updatedAt'>): Promise<SavedWorksheetSetup[]> {
  const existing = await getSavedWorksheetSetups();
  const usesDataUrl = Platform.OS === 'web' && /^data:image\//i.test(setup.imageUrl);

  let imageUrl = setup.imageUrl;
  let imageStorageKey = setup.imageStorageKey;
  if (usesDataUrl) {
    const key = `logicopiccolo:${setup.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const persisted = await saveWorksheetImageToDb(key, setup.imageUrl);
    if (persisted) {
      imageUrl = '';
      imageStorageKey = key;
    }
  }

  const record: SavedWorksheetSetup = {
    ...setup,
    imageUrl,
    imageStorageKey,
    updatedAt: new Date().toISOString(),
  };

  const next = [record, ...existing.filter((item) => item.name !== record.name)];
  await AsyncStorage.setItem(WORKSHEET_SETUPS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function resolveSetupImageUrl(setup: SavedWorksheetSetup) {
  if (setup.imageUrl) return setup.imageUrl;
  if (!setup.imageStorageKey) return '';
  return (await getWorksheetImageFromDb(setup.imageStorageKey)) ?? '';
}

async function openWorksheetImageDb() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }

  return await new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = window.indexedDB.open(WORKSHEET_IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSHEET_IMAGE_STORE_NAME)) {
        db.createObjectStore(WORKSHEET_IMAGE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveWorksheetImageToDb(id: string, dataUrl: string) {
  try {
    const db = await openWorksheetImageDb();
    if (!db) return false;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSHEET_IMAGE_STORE_NAME, 'readwrite');
      tx.objectStore(WORKSHEET_IMAGE_STORE_NAME).put({ id, dataUrl, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

async function getWorksheetImageFromDb(id: string) {
  try {
    const db = await openWorksheetImageDb();
    if (!db) return null;
    const dataUrl = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(WORKSHEET_IMAGE_STORE_NAME, 'readonly');
      const request = tx.objectStore(WORKSHEET_IMAGE_STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result?.dataUrl ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return dataUrl;
  } catch {
    return null;
  }
}

function WebWorksheetIFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Logicopiccolo Worksheet"
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
    />
  );
}
