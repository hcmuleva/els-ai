import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { frameButtons } from './generated/buttons';
import { worksheetModels } from './generated/worksheets';
import { DraggableButton } from './DraggableButton';
import { SlotColumn } from './SlotColumn';
import { FRAME_BUTTON_SIZE, FRAME_SLOT_COUNT, logicopiccoloStyles } from './styles';
import { useDragLogic } from './useDragLogic';
import { WorksheetSelector } from './WorksheetSelector';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WORKSHEET_BASE_WIDTH = 794;
const WORKSHEET_BASE_HEIGHT = 1123;
const SLOT_COLUMN_WIDTH = 72;
const ANSWER_COLUMN_WIDTH = 96;

export function LogicopiccoloFrame() {
  const { width } = useWindowDimensions();
  const frameButtonSize = width < 430 ? 34 : FRAME_BUTTON_SIZE;
  const [selectedWorksheetId, setSelectedWorksheetId] = useState(worksheetModels[0]?.id ?? '');
  const [showBack, setShowBack] = useState(false);

  const [boardRect, setBoardRect] = useState<Rect | null>(null);
  const [rightRailLocalRect, setRightRailLocalRect] = useState<Rect | null>(null);
  const [slotLocalRect, setSlotLocalRect] = useState<Rect | null>(null);
  const [slotRect, setSlotRect] = useState<Rect | null>(null);
  const [trayRect, setTrayRect] = useState<Rect | null>(null);
  const [worksheetPaneWidth, setWorksheetPaneWidth] = useState(0);

  const dragBounds = useMemo<Rect | null>(() => {
    if (!boardRect || !trayRect) {
      return null;
    }

    return {
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: trayRect.y + trayRect.height - boardRect.y,
    };
  }, [boardRect, trayRect]);

  const selectedWorksheet = useMemo(() => {
    if (!worksheetModels.length) {
      return null;
    }

    return worksheetModels.find((worksheet) => worksheet.id === selectedWorksheetId) ?? worksheetModels[0];
  }, [selectedWorksheetId]);

  const boardHeight = useMemo(() => {
    const estimatedFrameWidth = Math.max(300, width - 56);
    const effectivePaneWidth = Math.max(
      220,
      worksheetPaneWidth || estimatedFrameWidth - SLOT_COLUMN_WIDTH - ANSWER_COLUMN_WIDTH - 6,
    );
    const sheetScale = Math.min(1, effectivePaneWidth / WORKSHEET_BASE_WIDTH);
    const scaledSheetHeight = Math.ceil(WORKSHEET_BASE_HEIGHT * sheetScale) + 16;
    return Math.max(420, scaledSheetHeight);
  }, [width, worksheetPaneWidth]);
  const currentWorksheetHtml = showBack ? selectedWorksheet?.backHtml : selectedWorksheet?.frontHtml;
  const worksheetHtml = useMemo(() => normalizeWorksheetHtml(currentWorksheetHtml ?? ''), [currentWorksheetHtml]);
  const worksheetOptions = useMemo(() => {
    return extractWorksheetOptions(currentWorksheetHtml || selectedWorksheet?.frontHtml || '');
  }, [currentWorksheetHtml, selectedWorksheet?.frontHtml]);

  useEffect(() => {
    if (!boardRect || !rightRailLocalRect || !slotLocalRect) {
      return;
    }

    setSlotRect({
      x: boardRect.x + rightRailLocalRect.x + slotLocalRect.x,
      y: boardRect.y + rightRailLocalRect.y + slotLocalRect.y,
      width: slotLocalRect.width,
      height: slotLocalRect.height,
    });
  }, [boardRect, rightRailLocalRect, slotLocalRect]);

  if (!selectedWorksheet) {
    return (
      <View style={logicopiccoloStyles.screen}>
        <View style={logicopiccoloStyles.content}>
          <Text style={logicopiccoloStyles.title}>Logicopiccolo</Text>
          <Text style={logicopiccoloStyles.subtitle}>No worksheet assets found. Run sync:logicopiccolo-assets.</Text>
        </View>
      </View>
    );
  }

  const { slots, hoveredSlotId, mapping, pans, getResponder } = useDragLogic({
    buttons: frameButtons,
    slotCount: FRAME_SLOT_COUNT,
    buttonSize: frameButtonSize,
    slotRect,
    trayRect,
    dragBounds,
  });

  const labelByButtonId = useMemo(() => {
    return frameButtons.reduce<Record<string, string>>((acc, button) => {
      acc[button.id] = button.label;
      return acc;
    }, {});
  }, []);

  const onBoardLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setBoardRect({ x, y, width, height });
  };

  const onSlotLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setSlotLocalRect({ x, y, width, height });
  };

  const onRightRailLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setRightRailLocalRect({ x, y, width, height });
  };

  const onTrayLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setTrayRect({ x, y, width, height });
  };

  const onWorksheetPaneLayout = (event: LayoutChangeEvent) => {
    const { width: paneWidth } = event.nativeEvent.layout;
    if (paneWidth > 0 && Math.abs(paneWidth - worksheetPaneWidth) > 1) {
      setWorksheetPaneWidth(paneWidth);
    }
  };

  return (
    <View style={logicopiccoloStyles.screen}>
      <View style={logicopiccoloStyles.content}>
        <Text style={logicopiccoloStyles.title}>Logicopiccolo</Text>
        <Text style={logicopiccoloStyles.subtitle}>Teacher preview using generated worksheet and button assets.</Text>

        <WorksheetSelector
          worksheets={worksheetModels}
          selectedWorksheetId={selectedWorksheetId}
          onSelect={(worksheetId) => {
            setSelectedWorksheetId(worksheetId);
            setShowBack(false);
          }}
        />

        <View style={logicopiccoloStyles.frameContainer}>
          <View style={logicopiccoloStyles.frameInner}>
            <View style={logicopiccoloStyles.topBar}>
              <Text style={logicopiccoloStyles.topBarTitle}>{selectedWorksheet.title}</Text>
              <Pressable style={logicopiccoloStyles.flipButton} onPress={() => setShowBack((prev) => !prev)}>
                <Text style={logicopiccoloStyles.flipButtonText}>Flip</Text>
              </Pressable>
            </View>

            <View style={[logicopiccoloStyles.boardRow, { height: boardHeight }]} onLayout={onBoardLayout}>
              <View style={logicopiccoloStyles.webViewWrap} onLayout={onWorksheetPaneLayout}>
                {Platform.OS === 'web' ? (
                  <View style={logicopiccoloStyles.webIframeWrap}>
                    <WebWorksheetIFrame html={worksheetHtml} />
                  </View>
                ) : (
                  <WebView
                    style={logicopiccoloStyles.webView}
                    originWhitelist={['*']}
                    source={{ html: worksheetHtml }}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                    bounces={false}
                    scalesPageToFit={false}
                  />
                )}
              </View>

                <View style={logicopiccoloStyles.rightRail} onLayout={onRightRailLayout}>
                <View style={logicopiccoloStyles.answerColumn}>
                  {slots.map((slot, index) => {
                    const option = worksheetOptions[index];
                    return (
                      <View
                        key={`answer-${slot.id}`}
                        style={[logicopiccoloStyles.answerRow, index === slots.length - 1 && logicopiccoloStyles.answerRowLast]}
                      >
                        <Text style={logicopiccoloStyles.answerId}>{option?.id || `R${slot.id + 1}`}</Text>
                        <Text style={logicopiccoloStyles.answerText} numberOfLines={2}>
                          {option?.text || '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <SlotColumn
                  slots={slots}
                  hoveredSlotId={hoveredSlotId}
                  labelByButtonId={labelByButtonId}
                  placeholderSize={frameButtonSize}
                  onLayout={onSlotLayout}
                />
              </View>
            </View>

            <View style={logicopiccoloStyles.tray} onLayout={onTrayLayout} />

            <View pointerEvents="box-none" style={logicopiccoloStyles.floatingLayer}>
              {frameButtons.map((button) => {
                const pan = pans[button.id];
                if (!pan) {
                  return null;
                }

                return (
                  <DraggableButton
                    key={button.id}
                    button={button}
                    pan={pan}
                    responder={getResponder(button.id)}
                    size={frameButtonSize}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View style={logicopiccoloStyles.previewPanel}>
          <Text style={logicopiccoloStyles.previewTitle}>Preview Mapping (slot {'->'} button)</Text>
          <Text style={logicopiccoloStyles.previewCode}>{JSON.stringify(mapping, null, 2)}</Text>
        </View>
      </View>
    </View>
  );
}

function normalizeWorksheetHtml(html: string) {
  if (!html) {
    return html;
  }

  let next = html;

  if (!next.includes('data-logicopiccolo-frame-fit')) {
    next = next.replace(
      /<head>/i,
      `<head><style data-logicopiccolo-frame-fit>html, body { width: 100%; max-width: 100%; overflow: hidden; background: #fff; } body { margin: 0; padding: 0; } .sheet { margin: 0 !important; transform-origin: top left; } .board { grid-template-columns: 1fr !important; } .right { display: none !important; }</style>`,
    );
  }

  if (!next.includes('data-logicopiccolo-fit-script')) {
    next = next.replace(
      /<\/body>/i,
      `<script data-logicopiccolo-fit-script>(function(){function fitSheet(){var sheet=document.querySelector('.sheet');if(!sheet){return;}sheet.style.transform='scale(1)';sheet.style.margin='0';var viewportWidth=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);var sheetWidth=sheet.offsetWidth||794;var scale=Math.min(1,viewportWidth/sheetWidth);sheet.style.transform='scale('+scale+')';sheet.style.transformOrigin='top left';document.body.style.minHeight=Math.ceil((sheet.offsetHeight||0)*scale)+'px';}window.addEventListener('resize',fitSheet);window.addEventListener('load',fitSheet);fitSheet();})();</script></body>`,
    );
  }

  return next;
}

function extractWorksheetOptions(html: string): Array<{ id: string; text: string }> {
  if (!html) {
    return [];
  }

  const options: Array<{ id: string; text: string }> = [];
  const optionRegex = /<div class="opt">\s*<div class="oid">([^<]+)<\/div>\s*<div>([\s\S]*?)<\/div>\s*<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = optionRegex.exec(html)) !== null) {
    options.push({
      id: decodeHtmlText(match[1]).trim(),
      text: decodeHtmlText(match[2]).replace(/\s+/g, ' ').trim(),
    });
  }

  return options;
}

function decodeHtmlText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
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
