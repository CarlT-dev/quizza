import { useRef, useState, useEffect, useReducer } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Loader2, AlertCircle, FileText, CopyCheck,
  Folder, CircleHelp, ChartColumn, List, Info, Check, } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useQuizGeneration } from '@/features/genai';
import type { GenerationResult } from '@/features/genai';
import { createQuizRequest } from '@/features/genai/schema';
import { useAuth } from '@/features/auth';
import { saveQuiz } from '@/features/quiz';
import { extractTextFromFile, DocExtractError } from '@/features/doc-extract';

const STORAGE_KEY = 'quizza_uploaded_file';

let attachmentCounter = 0;
/** Unique per-attachment id (React key + row updates). Module-level: never called during render. */
const nextAttachmentId = () => `att-${(attachmentCounter += 1)}`;

// Attachments: several files can be uploaded at once. Each is extracted
// independently (pluggable per format — adding PPTX later means one more
// adapter file, no page changes). Files that fail to read, or that would
// push the combined extracted text past the character limit, are
// "neglected": they show an error and contribute nothing to generation.
type AttachmentStatus = 'extracting' | 'done' | 'failed' | 'rejected';
type Attachment = {
  id: string;
  name: string;
  status: AttachmentStatus;
  progress: number;
  text?: string; // sanitized extracted text (done only)
  originalLength?: number; // sanitized length (done only)
  error?: string; // failed/rejected message
};

// Combined extracted-text budget across accepted attachments (decided in
// selection order): the file that would push the total past this limit is
// neglected with an error instead of being silently truncated.
const MAX_TOTAL_CONTEXT_CHARS = 35_000;

// Every attachment transition is a pure reducer action. The 100,000-char
// budget is DERIVED at decision time (sum of accepted rows), so removing
// a row mid-flight or uploading a second batch can never desync it from
// the "total across all accepted files" requirement.
//
// These live at module scope, NOT inside the component: React calls the
// reducer from inside the useReducer() call while draining queued actions,
// so anything it closes over must be initialized before the component body
// runs — a later-declared const in the component was a temporal-dead-zone
// crash the moment files finished extracting.
//
// The 100,000-char budget is DERIVED at decision time (sum of accepted rows),
// so removing a row mid-flight or uploading a second batch can never desync it
// from the "total across all accepted files" requirement.
type AttachmentAction =
  | { type: 'add-batch'; batch: Attachment[] }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'fail'; id: string; error: string }
  | { type: 'decide'; id: string; name: string; text: string; originalLength: number }
  | { type: 'remove'; id: string }
  | { type: 'restore'; attachments: Attachment[] };

const acceptedChars = (rows: Attachment[]): number =>
  rows.reduce(
    (sum, a) =>
      a.status === 'done' && typeof a.originalLength === 'number'
        ? sum + a.originalLength
        : sum,
    0
  );

function attachmentsReducer(state: Attachment[], action: AttachmentAction): Attachment[] {
  switch (action.type) {
    case 'add-batch':
      return [...state, ...action.batch];
    case 'progress':
      return state.map((a) =>
        a.id === action.id && a.status === 'extracting' ? { ...a, progress: action.progress } : a
      );
    case 'fail':
      return state.map((a) =>
        a.id === action.id && a.status === 'extracting'
          ? { ...a, status: 'failed', progress: 100, error: action.error }
          : a
      );
    case 'decide': {
      const target = state.find((a) => a.id === action.id);
      if (!target || target.status !== 'extracting') return state;
      const used = acceptedChars(state);
      if (used + action.originalLength > MAX_TOTAL_CONTEXT_CHARS) {
        return state.map((a) =>
          a.id === action.id
            ? {
                ...a,
                status: 'rejected',
                progress: 100,
                error: `"${action.name}" needs ${action.originalLength.toLocaleString()} characters but the ${MAX_TOTAL_CONTEXT_CHARS.toLocaleString()}-character limit is reached (${used.toLocaleString()} already used). Skipped.`,
              }
            : a
        );
      }
      return state.map((a) =>
        a.id === action.id
          ? { ...a, status: 'done', progress: 100, text: action.text, originalLength: action.originalLength }
          : a
      );
    }
    case 'remove':
      return state.filter((a) => a.id !== action.id);
    case 'restore':
      return action.attachments;
  }
}

// Selectable capsule chip: filled + check when selected, outlined + empty circle when not
function ChipButton({
  text,
  isActive,
  onToggle,
  className = '',
}: { text: string; isActive: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isActive}
      className={`
        inline-flex items-center justify-between gap-1.5 h-10 pl-3 pr-1 rounded-full border-2
        text-xs font-medium whitespace-nowrap select-none transition-all duration-200
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
        ${isActive
          ? 'bg-primary-500 border-primary-500 text-white shadow-[0_0_16px_rgba(37,99,235,0.35)]'
          : 'bg-transparent border-slate-300 dark:border-slate-400/50 text-gray-700 dark:text-white hover:border-primary-400'
        }
        ${className}
      `}
    >
      <span>{text}</span>
      <span
        className={`
          flex items-center justify-center mr-1 w-5 h-5 rounded-full flex-shrink-0 transition-colors
          ${isActive ? 'bg-white text-primary-500' : 'border-2 border-slate-300 dark:border-slate-400/70'}
        `}
        aria-hidden="true"
      >
        {isActive && <Check className="w-4 h-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

function SectionTitle({
  icon,
  title,
  right,
}: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3 text-lg font-bold text-text-primary dark:text-white">
        <span className="text-primary-500" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
      </div>
      {right && <div className="text-slate-400">{right}</div>}
    </div>
  );
}

const cardClass =
  'rounded-2xl border border-primary-200 dark:border-[#1f3358] bg-white dark:bg-[#0b1a3a]/80 p-4 shadow-lg';

// Select-all toggle for section headers (Question Type, Difficulty)
function SelectAllButton({ label, isAllSelected, onToggle }: {
  label: string; isAllSelected: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isAllSelected}
      className="cursor-pointer p-1 -m-1 rounded-md transition-colors hover:text-primary-400 dark:hover:text-primary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <CopyCheck className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

export function CreateQuizPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [isSingleActive, setIsSingleActive] = useState(false);
  const [isMultipleActive, setIsMultipleActive] = useState(false);
  const [isIdentificationActive, setIsIdentificationActive] = useState(false);
  const [isEnumerationActive, setIsEnumerationActive] = useState(false);
  const [isEasyActive, setIsEasyActive] = useState(false);
  const [isMediumActive, setIsMediumActive] = useState(false);
  const [isHardActive, setIsHardActive] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [topic, setTopic] = useState('');

  // Fewer than this many characters is not enough context; fall back to
  // topic-only generation.
  const MIN_CONTEXT_CHARS = 200;

  // Attachment list. The types, the 10,000-char constant, and the reducer
  // itself live at module scope: React calls the reducer from inside the
  // useReducer() call while draining queued actions, so it must not close
  // over anything declared later in this component (that was a runtime
  // temporal-dead-zone crash).
  const [attachments, dispatch] = useReducer(attachmentsReducer, []);

  // Persist attachment names only — the documents themselves are never
  // stored locally.
  const persistAttachmentNames = (all: Attachment[]) => {
    try {
      if (all.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ filenames: all.map((a) => a.name) }));
      }
    } catch {
      // Ignore quota exceeded errors
    }
  };

  // Load persisted attachment names from localStorage on mount (names only —
  // the documents themselves are never stored, so restored rows contribute
  // no context). Accepts the previous single-file storage shape.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { filename?: string; filenames?: string[] };
      const filenames = parsed.filenames ?? (parsed.filename ? [parsed.filename] : []);
      if (filenames.length === 0) return;
      // 'restore' REPLACES the whole list, so StrictMode's double-mounted
      // effect cannot stack duplicate rows (the second run overwrites the first).
      dispatch({
        type: 'restore',
        attachments: filenames.map((name) => ({
          id: nextAttachmentId(),
          name,
          status: 'done' as const,
          progress: 100,
        })),
      });
      // Extract clean topic from the first filename
      const first = filenames[0];
      const cleanTopic = first
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setTopic(cleanTopic || first);
    } catch {
      // Ignore corrupted localStorage
    }
  }, []);

  // Quiz Generation Hook
  const { isLoading, error, elapsedMs, generate, retry, cancel, reset } = useQuizGeneration();
  const { user } = useAuth();

  // Loading animation state
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    'Analyzing your topic...',
    'Crafting questions...',
    'Adding explanations...',
    'Balancing difficulty...',
    'Finalizing quiz...',
    'Almost ready...',
  ];

  // Cycle loading messages while generating
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleBack = () => {
    navigate('/');
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Reset so selecting the same file(s) again re-fires onChange.
    e.target.value = '';
    if (files.length === 0) return;

    const batch = files.map((file) => ({
      id: nextAttachmentId(),
      name: file.name,
      status: 'extracting' as const,
      progress: 0,
    }));

    // The first file of the batch sets the topic (today's overwrite-on-upload
    // behavior, applied once per batch); later files never clobber it.
    setTopic(topicFromFileName(files[0].name));

    // Force the "extracting" rows to render synchronously BEFORE any async
    // work begins (React 19 would otherwise batch them with the eventual
    // done/failed updates, so the user might never see "Reading document…").
    flushSync(() => {
      dispatch({ type: 'add-batch', batch });
    });
    persistAttachmentNames([...attachments, ...batch]);

    void runBatch(files, batch.map((b) => b.id));
  };

  // Extract all files of a batch in parallel (each updates only its own row),
  // then decide acceptance in selection order. The reducer derives the used
  // budget from the LIVE attachment state at each decision, so accepted files
  // from earlier batches always count toward the total, removing a row
  // mid-flight frees its room (that row's decision no-ops), and a second
  // picker selection cannot start from a fresh budget. Files that fail to
  // read are marked failed immediately by extractAttachment and consume no
  // budget.
  const runBatch = async (files: File[], ids: string[]) => {
    // Yield so the "extracting" rows paint before extraction begins — a fast
    // result could otherwise replace them before the browser paints.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const outcomes = files.map((file, i) => extractAttachment(ids[i], file));

    for (let i = 0; i < files.length; i++) {
      const outcome = await outcomes[i];
      if (!outcome.ok) continue; // already marked failed on its row

      dispatch({
        type: 'decide',
        id: ids[i],
        name: files[i].name,
        text: outcome.result.text,
        originalLength: outcome.result.originalLength,
      });
    }
  };

  // Extract one file: simulated progress on its own attachment row, then the
  // real result. Read failures are marked on the row immediately (with the
  // same ~300ms minimum so "Reading document…" is always visible).
  const extractAttachment = async (attachmentId: string, file: File) => {
    const startTime = Date.now();

    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      dispatch({ type: 'progress', id: attachmentId, progress });
    }, 150);

    try {
      const result = await extractTextFromFile(file);
      clearInterval(timer);
      return { ok: true as const, result };
    } catch (error) {
      clearInterval(timer);
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 300 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      const message =
        error instanceof DocExtractError
          ? error.message
          : `"${file.name}" could not be read.`;
      dispatch({ type: 'fail', id: attachmentId, error: message });
      return { ok: false as const };
    }
  };

  const handleRemoveAttachment = (id: string) => {
    dispatch({ type: 'remove', id });
    const next = attachments.filter((a) => a.id !== id);
    if (next.length === 0) {
      setTopic('');
    }
    persistAttachmentNames(next);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const topicFromFileName = (fileName: string): string =>
    fileName
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[-_]/g, ' ') // replace hyphens/underscores with spaces
      .replace(/\s+/g, ' ') // normalize whitespace
      .trim() || fileName;

  const getQuestionTypes = (): Array<'single' | 'multiple' | 'identification' | 'enumeration'> => {
    const types: Array<'single' | 'multiple' | 'identification' | 'enumeration'> = [];
    if (isSingleActive) types.push('single');
    if (isMultipleActive) types.push('multiple');
    if (isIdentificationActive) types.push('identification');
    if (isEnumerationActive) types.push('enumeration');
    return types;
  };

  const getDifficulties = (): Array<'easy' | 'medium' | 'hard'> => {
    const diffs: Array<'easy' | 'medium' | 'hard'> = [];
    if (isEasyActive) diffs.push('easy');
    if (isMediumActive) diffs.push('medium');
    if (isHardActive) diffs.push('hard');
    return diffs;
  };

  // Toggle-all for the section header icons: if every option in the section
  // is selected, clear them all; otherwise select them all (a partial
  // selection selects the rest).
  const areAllQuestionTypesSelected =
    isSingleActive && isMultipleActive && isIdentificationActive && isEnumerationActive;
  const toggleAllQuestionTypes = () => {
    const next = !areAllQuestionTypesSelected;
    setIsSingleActive(next);
    setIsMultipleActive(next);
    setIsIdentificationActive(next);
    setIsEnumerationActive(next);
  };

  const areAllDifficultiesSelected = isEasyActive && isMediumActive && isHardActive;
  const toggleAllDifficulties = () => {
    const next = !areAllDifficultiesSelected;
    setIsEasyActive(next);
    setIsMediumActive(next);
    setIsHardActive(next);
  };

  const canGenerate = () => {
    return (
      topic.trim().length > 0 &&
      getQuestionTypes().length > 0 &&
      getDifficulties().length > 0 &&
      itemCount !== null
    );
  };

  // Shared success handling so both Generate and Retry save + navigate.
  const handleResult = async (result: GenerationResult) => {
    if (result.success && result.data && user) {
      try {
        const quizId = await saveQuiz(result.data, user.uid);
        // Clear localStorage on successful quiz creation
        localStorage.removeItem(STORAGE_KEY);
        navigate(`/quiz/${quizId}`);
      } catch (err) {
        console.error('Failed to save quiz:', err);
        alert('Quiz generated but failed to save. Please try again.');
      }
    } else if (result.success && result.data) {
      // Clear localStorage on successful quiz creation
      localStorage.removeItem(STORAGE_KEY);
      alert(`Quiz generated successfully with ${result.data.questions.length} questions!`);
    }
  };

  // Accepted documents as generation context, joined in attachment order.
  // A document under ~200 chars, failed, rejected, or still extracting is
  // skipped; with nothing left, generation falls back to topic-only. (The
  // combined text can never reach the extractor's 100,000-char cap under the
  // 100,000-char total limit, so no truncation note is needed here.)
  const buildAdditionalContext = (): string | undefined => {
    const done = attachments.filter(
      (a): a is Attachment & { text: string } =>
        a.status === 'done' && typeof a.text === 'string' && a.text.length >= MIN_CONTEXT_CHARS
    );
    if (done.length === 0) return undefined;
    return done.map((a) => a.text).join('\n\n');
  };

  const handleGenerateQuiz = async () => {
    const request = createQuizRequest({
      topic,
      questionTypes: getQuestionTypes(),
      difficulties: getDifficulties(),
      itemCount,
      additionalContext: buildAdditionalContext(),
    });

    if (!request) {
      return;
    }

    const result = await generate(request);
    await handleResult(result);
  };

  // One-tap retry from the error box: re-runs the last request and handles
  // the result the same way as the original generate.
  const handleRetry = async () => {
    const result = await retry();
    if (result) {
      await handleResult(result);
    }
  };

  const handleErrorBack = () => {
    reset();
    navigate('/');
  };

  const handleCancelGeneration = () => {
    cancel();
  };

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gradient-to-b dark:from-[#071a3a] dark:to-[#040d24] min-h-screen">
      {/* Floating rounded header with wave decoration */}
      <header className="sticky top-3 z-10 mx-4 max-w-[500px] sm:mx-auto overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f6bff] to-[#0b4fe0] px-4 py-5 shadow-lg">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 500 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M300 0 C380 10 420 60 500 40 L500 0 Z" fill="white" fillOpacity="0.10" />
          <path d="M380 100 C420 70 460 60 500 30 L500 100 Z" fill="black" fillOpacity="0.12" />
        </svg>

        <div className="relative flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-2 text-white hover:bg-white/20"
            aria-label="Back to home"
          >
            <ChevronLeft className="w-7 h-7" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold leading-tight text-white">Quizza</h1>
            <p className="text-white/80 text-lg">Create Quiz</p>
          </div>
        </div>
      </header>

      <main className="max-w-[500px] mx-auto px-4 pt-4 pb-20 space-y-3">
        {/* Import File */}
        <section className={cardClass}>
          <SectionTitle
            icon={<Folder className="w-6 h-6 fill-current" />}
            title="Import File"
            right={<Info className="w-6 h-6" strokeWidth={1.5} aria-label="File import info" />}
          />

          <div
            className="relative rounded-2xl border-2 border-dashed border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-transparent p-8 text-center cursor-pointer hover:border-primary-300 transition-colors"
            onClick={handleFileClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFileClick();
              }
            }}
            aria-label="Tap to upload quiz file"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.pptx"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              aria-label="Upload quiz file (DOCX, PDF, or PPTX)"
            />

            <div className="space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.45)]">
                <Upload className="w-8 h-8" aria-hidden="true" />
              </div>
              <p className="text-lg font-bold text-primary-600 dark:text-white">Tap to upload</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                Supports: DOCX, PDF, PPTX • Select several*
                <br />
                35,000-character combined limit
              </p>
            </div>
          </div>
        </section>

        {/* Attachment rows (unchanged logic) */}
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="p-3 bg-primary-50 dark:bg-[#0b1a3a]/80 border border-primary-200 dark:border-[#1f3358] rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-primary-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300 truncate max-w-[250px]">
                  {attachment.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="text-primary-500 hover:text-primary-700 text-sm font-medium flex-shrink-0 ml-2"
              >
                Remove
              </button>
            </div>

            {attachment.status === 'extracting' && (
              <>
                <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full progress-shimmer animate-progress"
                    style={{ width: `${attachment.progress}%` }}
                    role="progressbar"
                    aria-valuenow={attachment.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Extracting text from ${attachment.name}`}
                  />
                </div>
                <p className="mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  Reading document…
                </p>
              </>
            )}
            {attachment.status === 'done' && attachment.originalLength !== undefined && (
              <p className="mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400">
                Extracted {attachment.originalLength.toLocaleString()} characters.
              </p>
            )}
            {(attachment.status === 'failed' || attachment.status === 'rejected') && (
              <p className="mt-1 ml-2 text-xs text-amber-600 dark:text-amber-400">
                {attachment.error}
                {attachment.status === 'failed' && ' Generating from the topic only.'}
              </p>
            )}
          </div>
        ))}

        {/* Question Type */}
        <section className={cardClass}>
          <SectionTitle
            icon={<CircleHelp className="w-6 h-6" />}
            title="Question Type"
            right={
              <SelectAllButton
                label="Select all question types"
                isAllSelected={areAllQuestionTypesSelected}
                onToggle={toggleAllQuestionTypes}
              />
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <ChipButton text="Multiple Choice" isActive={isSingleActive}
              onToggle={() => setIsSingleActive((v) => !v)} />
            <ChipButton text="True/False" isActive={isMultipleActive}
              onToggle={() => setIsMultipleActive((v) => !v)} />
            <ChipButton text="Identification" isActive={isIdentificationActive}
              onToggle={() => setIsIdentificationActive((v) => !v)} />
            <ChipButton text="Enumeration" isActive={isEnumerationActive}
              onToggle={() => setIsEnumerationActive((v) => !v)} />
          </div>
        </section>

        {/* Difficulty */}
        <section className={cardClass}>
          <SectionTitle
            icon={<ChartColumn className="w-6 h-6" />}
            title="Difficulty"
            right={
              <SelectAllButton
                label="Select all difficulties"
                isAllSelected={areAllDifficultiesSelected}
                onToggle={toggleAllDifficulties}
              />
            }
          />
          <div className="flex flex-wrap gap-2">
            <ChipButton className="flex-1 min-w-[90px]" text="Easy" isActive={isEasyActive}
              onToggle={() => setIsEasyActive((v) => !v)} />
            <ChipButton className="flex-1 min-w-[90px]" text="Average" isActive={isMediumActive}
              onToggle={() => setIsMediumActive((v) => !v)} />
            <ChipButton className="flex-1 min-w-[90px]" text="Difficult" isActive={isHardActive}
              onToggle={() => setIsHardActive((v) => !v)} />
          </div>
        </section>

        {/* Number of Items */}
        <section className={cardClass}>
          <SectionTitle icon={<List className="w-6 h-6" />} title="Number of Items" />
          <div className="flex gap-3">
            {[10, 15, 20, 30].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setItemCount(itemCount === value ? null : value)}
                aria-pressed={itemCount === value}
                className={`
                  flex-1 h-12 rounded-full border-2 text-sm font-medium transition-all duration-200
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                  ${itemCount === value
                    ? 'bg-primary-500 border-primary-500 text-white font-bold shadow-[0_0_16px_rgba(37,99,235,0.35)]'
                    : 'bg-transparent border-slate-300 dark:border-slate-400/50 text-gray-700 dark:text-white hover:border-primary-400'
                  }
                `}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isLoading}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleErrorBack}
                disabled={isLoading}
              >
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="mt-15 w-full"
          size="lg"
          disabled={isLoading || !canGenerate()}
          onClick={handleGenerateQuiz}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              Generating Quiz...
            </span>
          ) : (
            'Create Quiz'
          )}
        </Button>

        {!canGenerate() && !isLoading && (
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Fill in all fields to enable quiz generation
          </p>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label="Generating quiz"
          >
            {/* Animated blob background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary-200/50 dark:bg-primary-900/30 blur-3xl animate-blob" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary-300/40 dark:bg-primary-800/30 blur-3xl animate-blob animation-delay-2000" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-primary-100/60 dark:bg-primary-900/40 blur-3xl animate-pulse" />
            </div>

            {/* Main loading content */}
            <div className="relative z-10 text-center space-y-6 px-6 max-w-md">
              {/* Bouncing dots animation */}
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary-500 dark:bg-primary-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                    aria-hidden="true"
                  />
                ))}
              </div>

              {/* Progress text */}
              <div className="space-y-2">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 transition-opacity duration-300">
                  {loadingMessages[loadingStep]}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This may take up to 90 seconds
                </p>
                <p className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  {Math.floor(elapsedMs / 1000)}s elapsed
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full animate-progress"
                  style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
                />
              </div>

              {/* Fun fact / tip */}
              <div className="mt-4 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800">
                <p className="text-xs text-primary-700 dark:text-primary-300 italic">
                  💡 Tip: More specific topics generate better questions!
                </p>
              </div>

              {/* Cancel generation */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                radius="rounded"
                onClick={handleCancelGeneration}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}