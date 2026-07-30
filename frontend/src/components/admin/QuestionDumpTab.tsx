/**
 * Question Dump Admin Panel Component.
 * Supports bulk question creation from JSON file upload or direct code editor input.
 * Fully responsive for mobile and desktop screens.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Code,
  Copy,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

import { Colors, Radius, Shadow } from '../../theme';
import { STANDARD_OPTIONS } from '../../constants/standards';
import SafeImage from '../quiz/SafeImage';
import {
  QTYPES_BG,
  QTYPES_COLOR,
} from '../quiz/questionEditor.types';
import {
  getQuestionTypeLabel,
} from '../quiz/questionEditor.helpers';
import {
  downloadFileInBrowser,
  generateQuestionJsonSchema,
  generateSampleQuestionsJson,
  QuestionValidationError,
  ValidatedQuestionItem,
  validateQuestionsJsonBatch,
  ValidationReport,
} from './questionDump.helpers';

export interface QuestionDumpTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  subjectCatalog?: Array<{ title: string; classLevel?: string; class_level?: string; class_id?: string }>;
}

type Stage = 'input' | 'preview' | 'importing' | 'summary';
type InputMode = 'paste' | 'file';

interface ImportResultLog {
  index: number;
  title: string;
  questionType: string;
  status: 'success' | 'failed' | 'skipped';
  errorDetails?: string;
  createdQuestionId?: string;
}

export function QuestionDumpTab({ apiFetch, subjectCatalog }: QuestionDumpTabProps) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : Dimensions.get('window').width,
  );

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const isDesktop = windowWidth >= 800;

  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [jsonText, setJsonText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Workflow stages
  const [stage, setStage] = useState<Stage>('input');

  // Validation report
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Accordion state in preview
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  // Import progress state
  const [isImporting, setIsImporting] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results log
  const [importLogs, setImportLogs] = useState<ImportResultLog[]>([]);

  // Schema & Catalog Modal State
  const [schemaModalVisible, setSchemaModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'schema' | 'catalog'>('schema');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [dbCatalog, setDbCatalog] = useState<Record<string, unknown> | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const fetchDbCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiFetch('/users/subjects?limit=500');
      let fetchedSubjects: Array<{ id?: string; title?: string; class_id?: string; classLevel?: string; class_level?: string }> = [];
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        fetchedSubjects = data.subjects || [];
      } else if (subjectCatalog && subjectCatalog.length > 0) {
        fetchedSubjects = subjectCatalog.map((s) => ({ title: s.title, class_id: s.class_id, class_level: s.class_level || s.classLevel }));
      }

      const classSet = new Set<string>();
      STANDARD_OPTIONS.forEach((opt) => classSet.add(opt.value));
      fetchedSubjects.forEach((s) => {
        const c = (s.class_level || s.classLevel || '').trim();
        if (c) classSet.add(c);
      });

      const subjectsByClass: Record<string, Array<{ subject_id?: string; title: string }>> = {};
      const allSubjectsList: Array<{ subject_id?: string; title: string; class_id: string; class_level: string }> = [];

      fetchedSubjects.forEach((s) => {
        const cLevel = (s.class_level || s.classLevel || '').trim() || 'General';
        const classId = (s.class_id || cLevel).trim();
        const subjTitle = (s.title || '').trim();
        const subjId = s.id || undefined;
        if (subjTitle) {
          if (!subjectsByClass[cLevel]) subjectsByClass[cLevel] = [];
          if (!subjectsByClass[cLevel].some((existing) => existing.title === subjTitle)) {
            subjectsByClass[cLevel].push({ subject_id: subjId, title: subjTitle });
          }
          allSubjectsList.push({ subject_id: subjId, title: subjTitle, class_id: classId, class_level: cLevel });
        }
      });

      setDbCatalog({
        availableClassLevels: Array.from(classSet),
        subjectsByClassLevel: subjectsByClass,
        totalSubjectsInDb: fetchedSubjects.length,
        allSubjects: allSubjectsList,
      });
    } catch (err) {
      console.error('Failed to load DB catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (schemaModalVisible && !dbCatalog) {
      fetchDbCatalog();
    }
  }, [schemaModalVisible]);

  // Auto-scroll or UI helpers
  const lineCount = useMemo(() => jsonText.split('\n').length, [jsonText]);

  // Handle Load Sample JSON
  const handleLoadSample = () => {
    const sample = generateSampleQuestionsJson();
    setJsonText(sample);
    setUploadedFileName(null);
    setValidationReport(null);
    setValidationAttempted(false);
  };

  // Handle File Upload via DocumentPicker or Web input
  const handlePickFile = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            setUploadedFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target?.result as string;
              setJsonText(text || '');
              setValidationReport(null);
              setValidationAttempted(false);
            };
            reader.readAsText(file);
          }
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadedFileName(asset.name);
        if (asset.uri) {
          const res = await fetch(asset.uri);
          const text = await res.text();
          setJsonText(text);
          setValidationReport(null);
          setValidationAttempted(false);
        }
      }
    } catch (err: any) {
      console.error('File pick error:', err);
    }
  };

  // Format JSON in Code Editor
  const handleFormatJson = () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      // Syntax error will be shown on validate
    }
  };

  // Clear Input
  const handleClear = () => {
    setJsonText('');
    setUploadedFileName(null);
    setValidationReport(null);
    setValidationAttempted(false);
  };

  // Run Validation
  const handleValidate = () => {
    setValidationAttempted(true);
    if (!jsonText.trim()) {
      setValidationReport({
        total: 0,
        validCount: 0,
        invalidCount: 0,
        warningCount: 0,
        errors: [{ questionIndex: 0, message: 'Please upload or paste JSON content first.', severity: 'error' }],
        validItems: [],
      });
      return;
    }

    const report = validateQuestionsJsonBatch(jsonText);
    setValidationReport(report);

    if (report.errors.length === 0 && report.validItems.length > 0) {
      // Collapse all by default
      const initialExpanded: Record<number, boolean> = {};
      report.validItems.forEach((_, idx) => {
        initialExpanded[idx] = idx === 0; // Expand first question by default
      });
      setExpandedCards(initialExpanded);
      setStage('preview');
    }
  };

  // Toggle card expansion
  const toggleExpandCard = (idx: number) => {
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const expandAll = () => {
    if (!validationReport) return;
    const next: Record<number, boolean> = {};
    validationReport.validItems.forEach((_, idx) => (next[idx] = true));
    setExpandedCards(next);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  // Start Bulk Creation
  const handleStartImport = async () => {
    if (!validationReport || validationReport.validItems.length === 0) return;

    setStage('importing');
    setIsImporting(true);
    setCancelRequested(false);
    setCurrentImportIndex(0);
    setSuccessCount(0);
    setFailedCount(0);
    setSkippedCount(0);
    setElapsedSeconds(0);
    setImportLogs([]);

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const items = validationReport.validItems;
    const logs: ImportResultLog[] = [];
    let currentSuccess = 0;
    let currentFailed = 0;
    let currentSkipped = 0;

    for (let i = 0; i < items.length; i++) {
      if (cancelRequested) {
        currentSkipped += items.length - i;
        setSkippedCount(currentSkipped);
        for (let k = i; k < items.length; k++) {
          logs.push({
            index: items[k].index,
            title: items[k].title,
            questionType: items[k].questionType,
            status: 'skipped',
            errorDetails: 'Import cancelled by user',
          });
        }
        break;
      }

      setCurrentImportIndex(i + 1);
      const item = items[i];

      try {
        const response = await apiFetch('/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          const resData = await response.json().catch(() => ({}));
          currentSuccess++;
          setSuccessCount(currentSuccess);
          logs.push({
            index: item.index,
            title: item.title,
            questionType: item.questionType,
            status: 'success',
            createdQuestionId: resData.id,
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: 'HTTP request failed' }));
          currentFailed++;
          setFailedCount(currentFailed);
          logs.push({
            index: item.index,
            title: item.title,
            questionType: item.questionType,
            status: 'failed',
            errorDetails: errorData.message || `Server returned code ${response.status}`,
          });
        }
      } catch (err: any) {
        currentFailed++;
        setFailedCount(currentFailed);
        logs.push({
          index: item.index,
          title: item.title,
          questionType: item.questionType,
          status: 'failed',
          errorDetails: err?.message || 'Network / connection error',
        });
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setIsImporting(false);
    setImportLogs(logs);
    setStage('summary');
  };

  // Export Error / Results Report
  const handleExportErrorReport = (format: 'json' | 'csv') => {
    if (!validationReport && importLogs.length === 0) return;

    if (format === 'json') {
      const exportObj = {
        timestamp: new Date().toISOString(),
        summary: {
          total: validationReport?.total || 0,
          created: successCount,
          failed: failedCount,
          skipped: skippedCount,
          validationErrorsCount: validationReport?.errors.length || 0,
        },
        validationErrors: validationReport?.errors || [],
        importResults: importLogs,
      };
      downloadFileInBrowser('question_dump_report.json', JSON.stringify(exportObj, null, 2), 'application/json');
    } else {
      const csvRows = ['Question Index,Title,Question Type,Status,Error Details'];
      importLogs.forEach((log) => {
        const cleanTitle = `"${log.title.replace(/"/g, '""')}"`;
        const cleanError = log.errorDetails ? `"${log.errorDetails.replace(/"/g, '""')}"` : '""';
        csvRows.push(`${log.index},${cleanTitle},${log.questionType},${log.status},${cleanError}`);
      });
      downloadFileInBrowser('question_dump_report.csv', csvRows.join('\n'), 'text/csv');
    }
  };

  // Copy helper
  const handleCopyText = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyNotice(`${label} copied!`);
      setTimeout(() => setCopyNotice(null), 2500);
    }
  };

  return (
    <View style={s.container}>
      {/* HEADER SECTION */}
      <View style={s.headerBanner}>
        <View style={s.headerLeft}>
          <View style={s.badgeRow}>
            <View style={s.headerBadge}>
              <FileSpreadsheet size={13} color="#fff" />
              <Text style={s.headerBadgeText}>Admin Utility</Text>
            </View>
            <View style={s.stagePill}>
              <Text style={s.stagePillText}>
                {stage === 'input'
                  ? 'Step 1: Input JSON'
                  : stage === 'preview'
                  ? 'Step 2: Review Preview'
                  : stage === 'importing'
                  ? 'Step 3: Creating Questions'
                  : 'Step 4: Final Summary'}
              </Text>
            </View>
          </View>
          <Text style={s.headerTitle}>Question Dump</Text>
          <Text style={s.headerSub}>
            Bulk import questions from JSON. Reuse existing schema, images, and question options effortlessly.
          </Text>
        </View>

        <View style={s.headerActions}>
          <Pressable style={s.secondaryHeaderBtn} onPress={() => setSchemaModalVisible(true)}>
            <HelpCircle size={15} color={Colors.primary} />
            <Text style={s.secondaryHeaderBtnText}>JSON Schema & Docs</Text>
          </Pressable>

          <Pressable style={s.secondaryHeaderBtn} onPress={handleLoadSample}>
            <Sparkles size={15} color={Colors.accent} />
            <Text style={s.secondaryHeaderBtnText}>Load Sample JSON</Text>
          </Pressable>
        </View>
      </View>

      {/* STEP 1: JSON INPUT STAGE */}
      {stage === 'input' && (
        <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
          {/* Method selector tabs */}
          <View style={[s.inputTabRow, !isDesktop && s.flexCol]}>
            <View style={s.tabGroup}>
              <Pressable
                style={[s.inputTabBtn, inputMode === 'paste' && s.inputTabBtnActive]}
                onPress={() => setInputMode('paste')}
              >
                <Code size={16} color={inputMode === 'paste' ? '#fff' : Colors.textSecondary} />
                <Text style={[s.inputTabText, inputMode === 'paste' && s.inputTabTextActive]}>
                  Option B: Code Editor
                </Text>
              </Pressable>

              <Pressable
                style={[s.inputTabBtn, inputMode === 'file' && s.inputTabBtnActive]}
                onPress={() => setInputMode('file')}
              >
                <UploadCloud size={16} color={inputMode === 'file' ? '#fff' : Colors.textSecondary} />
                <Text style={[s.inputTabText, inputMode === 'file' && s.inputTabTextActive]}>
                  Option A: Upload JSON File
                </Text>
              </Pressable>
            </View>

            <View style={s.editorTools}>
              {jsonText.length > 0 && (
                <>
                  <Text style={s.metaText}>
                    {lineCount} lines · {jsonText.length} chars
                  </Text>
                  <Pressable style={s.toolBtn} onPress={handleFormatJson}>
                    <Text style={s.toolBtnText}>Format JSON</Text>
                  </Pressable>
                  <Pressable style={s.toolBtnDanger} onPress={handleClear}>
                    <Trash2 size={13} color={Colors.danger} />
                    <Text style={s.toolBtnDangerText}>Clear</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* FILE UPLOAD DROPZONE */}
          {inputMode === 'file' ? (
            <View style={s.dropZoneCard}>
              <View style={s.dropZoneIconCircle}>
                <FileCode size={36} color={Colors.primary} />
              </View>
              <Text style={s.dropZoneTitle}>
                {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Select a .json Question Dump File'}
              </Text>
              <Text style={s.dropZoneSub}>
                Upload any formatted JSON file containing an array of questions conforming to the project schema.
              </Text>

              <View style={s.dropZoneBtnRow}>
                <Pressable style={s.primaryActionBtn} onPress={handlePickFile}>
                  <UploadCloud size={18} color="#fff" />
                  <Text style={s.primaryActionBtnText}>
                    {uploadedFileName ? 'Choose Different File' : 'Browse JSON File'}
                  </Text>
                </Pressable>

                {uploadedFileName && (
                  <Pressable style={s.secondaryActionBtn} onPress={handleClear}>
                    <X size={16} color={Colors.textSecondary} />
                    <Text style={s.secondaryActionBtnText}>Remove File</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            /* CODE EDITOR TEXTAREA */
            <View style={s.editorWrapper}>
              <View style={s.editorHeader}>
                <View style={s.editorHeaderDots}>
                  <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
                  <View style={[s.dot, { backgroundColor: '#F59E0B' }]} />
                  <View style={[s.dot, { backgroundColor: '#10B981' }]} />
                </View>
                <Text style={s.editorHeaderTitle}>JSON Code Editor</Text>
                <Pressable
                  style={s.copySnippetBtn}
                  onPress={() => handleCopyText(jsonText, 'JSON editor content')}
                >
                  <Copy size={13} color={Colors.textSecondary} />
                  <Text style={s.copySnippetText}>Copy Code</Text>
                </Pressable>
              </View>

              <TextInput
                style={[s.codeTextArea, Platform.OS === 'web' && ({ outline: 'none' } as any)]}
                multiline
                numberOfLines={18}
                {...({ rows: 18 } as any)}
                value={jsonText}
                onChangeText={(text) => {
                  setJsonText(text);
                  setValidationReport(null);
                  setValidationAttempted(false);
                }}
                placeholder={'// Paste or edit your questions JSON here...\n[\n  {\n    "questionTitle": "Sample Question",\n    "questionType": "single_choice",\n    "points": 10\n  }\n]'}
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
          )}

          {/* VALIDATION RESULTS PANEL (IF ERRORS EXIST) */}
          {validationReport && validationReport.errors.length > 0 && (
            <View style={s.errorReportBox}>
              <View style={s.errorReportHeader}>
                <AlertCircle size={20} color={Colors.danger} />
                <Text style={s.errorReportTitle}>
                  Validation Failed — {validationReport.errors.length} Issue(s) Found
                </Text>
              </View>

              <Text style={s.errorReportSub}>
                All questions were analyzed against the system schema. Please resolve the following errors before creating questions:
              </Text>

              <View style={s.errorList}>
                {validationReport.errors.map((err, idx) => (
                  <View key={idx} style={s.errorItemCard}>
                    <View style={s.errorBadge}>
                      <Text style={s.errorBadgeText}>
                        {err.questionIndex > 0 ? `Q #${err.questionIndex}` : 'Global Syntax'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={s.errorItemTitle}>{err.questionTitle || 'JSON Structure'}</Text>
                      <Text style={s.errorItemMsg}>
                        {err.field ? `[${err.field}] ` : ''}
                        {err.message}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* FOOTER ACTIONS */}
          <View style={s.bottomActionBar}>
            <Pressable style={s.primaryValidateBtn} onPress={handleValidate}>
              <CheckCircle2 size={20} color="#fff" />
              <Text style={s.primaryValidateBtnText}>Validate Questions JSON</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* STEP 2: PREVIEW SCREEN */}
      {stage === 'preview' && validationReport && (
        <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
          {/* STATS SUMMARY BAR */}
          <View style={s.summaryStatsGrid}>
            <View style={[s.statCard, { borderLeftColor: Colors.primary }]}>
              <Text style={[s.statValue, { color: Colors.primary }]}>{validationReport.total}</Text>
              <Text style={s.statLabel}>Total Questions</Text>
            </View>

            <View style={[s.statCard, { borderLeftColor: Colors.success }]}>
              <Text style={[s.statValue, { color: Colors.success }]}>{validationReport.validCount}</Text>
              <Text style={s.statLabel}>Valid Questions</Text>
            </View>

            <View style={[s.statCard, { borderLeftColor: Colors.danger }]}>
              <Text style={[s.statValue, { color: Colors.danger }]}>{validationReport.invalidCount}</Text>
              <Text style={s.statLabel}>Invalid Questions</Text>
            </View>

            <View style={[s.statCard, { borderLeftColor: Colors.warning }]}>
              <Text style={[s.statValue, { color: Colors.warning }]}>{validationReport.warningCount}</Text>
              <Text style={s.statLabel}>Warnings</Text>
            </View>
          </View>

          {/* PREVIEW TOOLBAR */}
          <View style={s.previewToolbar}>
            <Text style={s.sectionTitle}>
              Validated Questions Preview ({validationReport.validItems.length})
            </Text>

            <View style={s.accordionBtnRow}>
              <Pressable style={s.smallBtn} onPress={expandAll}>
                <Text style={s.smallBtnText}>Expand All</Text>
              </Pressable>
              <Pressable style={s.smallBtn} onPress={collapseAll}>
                <Text style={s.smallBtnText}>Collapse All</Text>
              </Pressable>
            </View>
          </View>

          {/* QUESTION CARDS LIST */}
          <View style={s.previewList}>
            {validationReport.validItems.map((item, idx) => {
              const isExpanded = Boolean(expandedCards[idx]);
              const qType = item.questionType;
              const typeLabel = getQuestionTypeLabel(qType);
              const typeBg = QTYPES_BG[qType] || '#E0F2FE';
              const typeColor = QTYPES_COLOR[qType] || Colors.primary;
              const payloadData = (item.payload.questionData as Record<string, unknown>) || {};
              const options = (payloadData.options || item.raw.options) as Array<Record<string, unknown>> | undefined;
              const promptImage = (payloadData.prompt_image || item.raw.mainImage) as string | undefined;

              return (
                <View key={idx} style={s.previewCard}>
                  {/* Card Header */}
                  <Pressable style={s.previewCardHeader} onPress={() => toggleExpandCard(idx)}>
                    <View style={s.cardHeaderLeft}>
                      <View style={s.qIndexPill}>
                        <Text style={s.qIndexText}>Q#{item.index}</Text>
                      </View>

                      <View style={[s.qTypeBadge, { backgroundColor: typeBg }]}>
                        <Text style={[s.qTypeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
                      </View>

                      <Text style={s.cardTitleSnippet} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>

                    <View style={s.cardHeaderRight}>
                      <Text style={s.metaChipText}>
                        {item.points} pts · {item.timeLimitSeconds}s
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={20} color={Colors.textSecondary} />
                      ) : (
                        <ChevronDown size={20} color={Colors.textSecondary} />
                      )}
                    </View>
                  </Pressable>

                  {/* Card Expanded Content */}
                  {isExpanded && (
                    <View style={s.previewCardBody}>
                      {/* Meta information row */}
                      <View style={s.cardMetaRow}>
                        {item.classLevel ? (
                          <View style={s.metaChip}>
                            <Text style={s.metaChipLabel}>Class: {item.classLevel}</Text>
                          </View>
                        ) : null}
                        {item.subject ? (
                          <View style={s.metaChip}>
                            <Text style={s.metaChipLabel}>Subject: {item.subject}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Main Title & Instructions */}
                      <Text style={s.qFullTitle}>{item.title}</Text>
                      {item.payload.questionInstruction ? (
                        <Text style={s.qInstruction}>
                          Instruction: {String(item.payload.questionInstruction)}
                        </Text>
                      ) : null}

                      {/* Prompt Media Image */}
                      {promptImage ? (
                        <View style={s.mediaPreviewWrap}>
                          <Text style={s.mediaLabelText}>Question Image:</Text>
                          <SafeImage uri={promptImage} style={s.promptImagePreview} resizeMode="contain" />
                        </View>
                      ) : null}

                      {/* Options Preview */}
                      {Array.isArray(options) && options.length > 0 && (
                        <View style={s.optionsSection}>
                          <Text style={s.optionsSectionTitle}>Options ({options.length}):</Text>

                          <View style={s.optionsGrid}>
                            {options.map((opt, optIdx) => {
                              const isCorrect = Boolean(opt.is_correct || opt.isCorrect);
                              const optImg = String(opt.image || opt.image_url || '');

                              const optLabel = typeof opt === 'string' ? opt : String(opt.label ?? opt.text ?? opt.value ?? opt.option ?? opt.title ?? opt.name ?? `Option ${optIdx + 1}`);

                              return (
                                <View
                                  key={optIdx}
                                  style={[s.optionItemCard, isCorrect && s.optionItemCardCorrect]}
                                >
                                  {isCorrect && (
                                    <View style={s.correctCheckBadge}>
                                      <Check size={12} color="#fff" />
                                    </View>
                                  )}

                                  {optImg ? (
                                    <SafeImage uri={optImg} style={s.optionImgPreview} resizeMode="contain" />
                                  ) : null}

                                  <Text style={[s.optionLabelText, isCorrect && s.optionLabelTextCorrect]}>
                                    {optLabel}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      {/* Explanation */}
                      {item.payload.explanation ? (
                        <View style={s.explanationBox}>
                          <Text style={s.explanationTitle}>Explanation:</Text>
                          <Text style={s.explanationText}>{String(item.payload.explanation)}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* CONFIRMATION BOTTOM BAR */}
          <View style={s.bottomConfirmationBar}>
            <Pressable style={s.secondaryActionBtn} onPress={() => setStage('input')}>
              <ArrowLeft size={16} color={Colors.textSecondary} />
              <Text style={s.secondaryActionBtnText}>Back to Editor</Text>
            </Pressable>

            <Pressable style={s.primaryCreateBtn} onPress={handleStartImport}>
              <Play size={18} color="#fff" />
              <Text style={s.primaryCreateBtnText}>
                Create {validationReport.validItems.length} Question(s) Now
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* STEP 3: LIVE IMPORT PROGRESS UI */}
      {stage === 'importing' && validationReport && (
        <View style={s.progressCenteredWrap}>
          <View style={s.progressCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.progressTitle}>Bulk Creating Questions...</Text>
            <Text style={s.progressSub}>
              Processing question {currentImportIndex} of {validationReport.validItems.length}
            </Text>

            {/* Progress Bar */}
            <View style={s.progressBarTrack}>
              <View
                style={[
                  s.progressBarFill,
                  {
                    width: `${Math.round(
                      (currentImportIndex / Math.max(validationReport.validItems.length, 1)) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>

            {/* Metrics Live Row */}
            <View style={s.progressMetricsRow}>
              <View style={s.progressMetric}>
                <Text style={[s.progressMetricValue, { color: Colors.success }]}>{successCount}</Text>
                <Text style={s.progressMetricLabel}>Created</Text>
              </View>

              <View style={s.progressMetric}>
                <Text style={[s.progressMetricValue, { color: Colors.danger }]}>{failedCount}</Text>
                <Text style={s.progressMetricLabel}>Failed</Text>
              </View>

              <View style={s.progressMetric}>
                <Text style={[s.progressMetricValue, { color: Colors.warning }]}>{skippedCount}</Text>
                <Text style={s.progressMetricLabel}>Skipped</Text>
              </View>

              <View style={s.progressMetric}>
                <Text style={s.progressMetricValue}>{elapsedSeconds}s</Text>
                <Text style={s.progressMetricLabel}>Elapsed Time</Text>
              </View>
            </View>

            <Pressable
              style={s.cancelImportBtn}
              onPress={() => setCancelRequested(true)}
              disabled={cancelRequested}
            >
              <Text style={s.cancelImportBtnText}>
                {cancelRequested ? 'Cancelling...' : 'Cancel Remaining Import'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STEP 4: FINAL SUMMARY SCREEN */}
      {stage === 'summary' && (
        <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
          <View style={s.summaryHeaderBox}>
            <View
              style={[
                s.summaryIconCircle,
                { backgroundColor: failedCount === 0 ? Colors.successLight : Colors.warningLight },
              ]}
            >
              {failedCount === 0 ? (
                <CheckCircle2 size={40} color={Colors.success} />
              ) : (
                <AlertTriangle size={40} color={Colors.warning} />
              )}
            </View>

            <Text style={s.summaryTitle}>
              {failedCount === 0
                ? 'All Questions Successfully Created!'
                : 'Bulk Import Finished with Errors'}
            </Text>
            <Text style={s.summarySub}>
              {successCount} created successfully · {failedCount} failed · {skippedCount} skipped
            </Text>
          </View>

          {/* DOWNLOAD REPORT ACTIONS */}
          <View style={s.exportActionRow}>
            <Pressable style={s.primaryActionBtn} onPress={() => handleExportErrorReport('json')}>
              <Download size={16} color="#fff" />
              <Text style={s.primaryActionBtnText}>Download Report (JSON)</Text>
            </Pressable>

            <Pressable style={s.secondaryActionBtn} onPress={() => handleExportErrorReport('csv')}>
              <Download size={16} color={Colors.textSecondary} />
              <Text style={s.secondaryActionBtnText}>Download Report (CSV)</Text>
            </Pressable>

            <Pressable
              style={s.resetBtn}
              onPress={() => {
                setStage('input');
                setValidationReport(null);
                setImportLogs([]);
              }}
            >
              <RotateCcw size={16} color={Colors.primary} />
              <Text style={s.resetBtnText}>Import Another Batch</Text>
            </Pressable>
          </View>

          {/* DETAILED RESULTS LOG TABLE */}
          <View style={s.logTableCard}>
            <Text style={s.logTableTitle}>Import Results Log ({importLogs.length})</Text>

            <View style={s.logTable}>
              {importLogs.map((log, idx) => (
                <View key={idx} style={s.logTableRow}>
                  <View style={s.logColIndex}>
                    <Text style={s.logColIndexText}>#{log.index}</Text>
                  </View>

                  <View style={s.logColMain}>
                    <Text style={s.logTitleText}>{log.title}</Text>
                    <Text style={s.logMetaText}>Type: {getQuestionTypeLabel(log.questionType)}</Text>
                    {log.errorDetails ? (
                      <Text style={s.logErrorText}>Error: {log.errorDetails}</Text>
                    ) : null}
                  </View>

                  <View style={s.logColStatus}>
                    {log.status === 'success' && (
                      <View style={[s.statusPill, { backgroundColor: Colors.successLight }]}>
                        <Check size={12} color={Colors.success} />
                        <Text style={[s.statusPillText, { color: Colors.success }]}>Success</Text>
                      </View>
                    )}

                    {log.status === 'failed' && (
                      <View style={[s.statusPill, { backgroundColor: Colors.dangerLight }]}>
                        <X size={12} color={Colors.danger} />
                        <Text style={[s.statusPillText, { color: Colors.danger }]}>Failed</Text>
                      </View>
                    )}

                    {log.status === 'skipped' && (
                      <View style={[s.statusPill, { backgroundColor: Colors.warningLight }]}>
                        <Clock size={12} color={Colors.warning} />
                        <Text style={[s.statusPillText, { color: Colors.warning }]}>Skipped</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* SCHEMA & DOCS MODAL */}
      <Modal visible={schemaModalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, !isDesktop && { width: '95%', maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={20} color={Colors.primary} />
                <Text style={s.modalTitle}>Question Dump Schema & DB Catalog</Text>
              </View>
              <Pressable style={s.closeModalBtn} onPress={() => setSchemaModalVisible(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Modal Internal Navigation Tabs */}
            <View style={s.modalNavTabRow}>
              <Pressable
                style={[s.modalNavTabBtn, modalTab === 'schema' && s.modalNavTabBtnActive]}
                onPress={() => setModalTab('schema')}
              >
                <Code size={15} color={modalTab === 'schema' ? Colors.primary : Colors.textSecondary} />
                <Text style={[s.modalNavTabText, modalTab === 'schema' && s.modalNavTabTextActive]}>
                  JSON Schema Definition
                </Text>
              </Pressable>

              <Pressable
                style={[s.modalNavTabBtn, modalTab === 'catalog' && s.modalNavTabBtnActive]}
                onPress={() => {
                  setModalTab('catalog');
                  if (!dbCatalog) fetchDbCatalog();
                }}
              >
                <Database size={15} color={modalTab === 'catalog' ? Colors.primary : Colors.textSecondary} />
                <Text style={[s.modalNavTabText, modalTab === 'catalog' && s.modalNavTabTextActive]}>
                  Classes & Subjects (DB)
                </Text>
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {modalTab === 'schema' ? (
                <>
                  <Text style={s.docParagraph}>
                    The Question Dump engine expects an array of Question objects conforming exactly to the backend API creation format.
                  </Text>

                  <Text style={s.docSubTitle}>Accepted Question Types (Enum):</Text>
                  <Text style={s.docParagraph}>
                    <Text style={{ fontWeight: 'bold' }}>single_choice, multi_choice, true_false, guess_image, guess_audio, drag_drop_match, logico, memory_match, fill_blank, jigsaw</Text>
                  </Text>

                  <Text style={s.docSubTitle}>JSON Schema Definition:</Text>
                  <View style={s.schemaCodeBox}>
                    <TextInput
                      style={[s.schemaCodeText, Platform.OS === 'web' && ({ outline: 'none' } as any)]}
                      multiline
                      numberOfLines={18}
                      {...({ rows: 18 } as any)}
                      editable={false}
                      value={generateQuestionJsonSchema()}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 }}>
                    <Pressable
                      style={s.primaryActionBtn}
                      onPress={() => handleCopyText(generateQuestionJsonSchema(), 'JSON Schema')}
                    >
                      <Copy size={16} color="#fff" />
                      <Text style={s.primaryActionBtnText}>Copy Schema</Text>
                    </Pressable>

                    <Pressable style={s.secondaryActionBtn} onPress={() => setSchemaModalVisible(false)}>
                      <Text style={s.secondaryActionBtnText}>Close</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.docParagraph}>
                    Below is the live JSON catalog of Class Levels and Subjects currently configured in your database. Use these exact string values for <Text style={{ fontWeight: 'bold' }}>classLevel</Text> and <Text style={{ fontWeight: 'bold' }}>subject</Text> in your question dump payloads.
                  </Text>

                  {loadingCatalog ? (
                    <View style={{ padding: 36, alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={{ marginTop: 12, fontSize: 13, color: Colors.textSecondary }}>
                        Fetching Database Classes & Subjects...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={s.docSubTitle}>Database Classes & Subjects JSON Catalog:</Text>
                      <View style={s.schemaCodeBox}>
                        <TextInput
                          style={[s.schemaCodeText, Platform.OS === 'web' && ({ outline: 'none' } as any)]}
                          multiline
                          numberOfLines={18}
                          {...({ rows: 18 } as any)}
                          editable={false}
                          value={dbCatalog ? JSON.stringify(dbCatalog, null, 2) : '// No DB catalog data'}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, marginBottom: 20 }}>
                        <Pressable
                          style={s.primaryActionBtn}
                          onPress={() => handleCopyText(dbCatalog ? JSON.stringify(dbCatalog, null, 2) : '', 'Classes & Subjects JSON')}
                        >
                          <Copy size={16} color="#fff" />
                          <Text style={s.primaryActionBtnText}>Copy Classes & Subjects JSON</Text>
                        </Pressable>

                        <Pressable style={s.secondaryActionBtn} onPress={fetchDbCatalog}>
                          <RefreshCw size={14} color={Colors.textSecondary} />
                          <Text style={s.secondaryActionBtnText}>Refresh DB Catalog</Text>
                        </Pressable>

                        <Pressable style={s.secondaryActionBtn} onPress={() => setSchemaModalVisible(false)}>
                          <Text style={s.secondaryActionBtnText}>Close</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COPY TOAST NOTICE */}
      {copyNotice && (
        <View style={s.toastBox}>
          <CheckCircle2 size={16} color={Colors.success} />
          <Text style={s.toastBoxText}>{copyNotice}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header Banner
  headerBanner: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 280,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  stagePill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  secondaryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  secondaryHeaderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Main Scrollable Area
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    gap: 20,
  },

  // Tab Row & Input Options
  inputTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  flexCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  inputTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  inputTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  inputTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  inputTabTextActive: {
    color: '#FFFFFF',
  },
  editorTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toolBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerLight,
  },
  toolBtnDangerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },

  // DropZone Card (Option A)
  dropZoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
  },
  dropZoneIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dropZoneTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  dropZoneSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 460,
    lineHeight: 19,
  },
  dropZoneBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },

  // Code Editor Area (Option B)
  editorWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 440,
  },
  editorHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  editorHeaderDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editorHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copySnippetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copySnippetText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  codeTextArea: {
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 16,
    textAlignVertical: 'top',
    height: 400,
    minHeight: 400,
  },

  // Validation Error Box
  errorReportBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 12,
  },
  errorReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorReportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.danger,
  },
  errorReportSub: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  errorList: {
    gap: 8,
  },
  errorItemCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorBadge: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  errorItemMsg: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 2,
  },

  // Action Buttons
  primaryValidateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryValidateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bottomActionBar: {
    marginTop: 10,
  },

  // Preview Stage
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    ...Shadow.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  accordionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  previewList: {
    gap: 12,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  previewCardHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  qIndexPill: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  qIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  qTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitleSnippet: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaChipText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  previewCardBody: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  metaChipLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  qFullTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  qInstruction: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },

  // Media Preview
  mediaPreviewWrap: {
    gap: 6,
  },
  mediaLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  promptImagePreview: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
  },

  // Options Preview
  optionsSection: {
    gap: 8,
  },
  optionsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionItemCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    position: 'relative',
    gap: 6,
  },
  optionItemCardCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: Colors.success,
  },
  correctCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionImgPreview: {
    width: '100%',
    height: 70,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
  },
  optionLabelText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  optionLabelTextCorrect: {
    fontWeight: '700',
    color: Colors.success,
  },

  // Explanation
  explanationBox: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  explanationText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },

  // Bottom Confirmation
  bottomConfirmationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  primaryCreateBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryCreateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Importing Centered Screen
  progressCenteredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  progressCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderRadius: Radius.xl,
    alignItems: 'center',
    gap: 16,
    ...Shadow.lg,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  progressSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  progressMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
  },
  progressMetric: {
    alignItems: 'center',
  },
  progressMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  progressMetricLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cancelImportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight,
    marginTop: 8,
  },
  cancelImportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },

  // Final Summary Stage
  summaryHeaderBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 28,
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summarySub: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  exportActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Log Table
  logTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  logTableTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  logTable: {
    gap: 8,
  },
  logTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    gap: 12,
  },
  logColIndex: {
    width: 36,
  },
  logColIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  logColMain: {
    flex: 1,
    gap: 2,
  },
  logTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  logMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logErrorText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 2,
  },
  logColStatus: {
    width: 90,
    alignItems: 'flex-end',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: 680,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalNavTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    gap: 8,
  },
  modalNavTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalNavTabBtnActive: {
    borderBottomColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  modalNavTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalNavTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeModalBtn: {
    padding: 4,
  },
  docParagraph: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  docSubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  schemaCodeBox: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    overflow: 'hidden',
    height: 320,
    minHeight: 320,
  },
  schemaCodeText: {
    color: '#38BDF8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 12,
    height: 320,
    minHeight: 320,
  },

  // Toast
  toastBox: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toastBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
