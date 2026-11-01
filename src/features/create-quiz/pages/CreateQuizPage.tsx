import { useRef, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, X, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Card, CardTitle } from '@/shared/components/ui';
import { Box, BoxTitle, BoxContent } from '@/shared/components/ui/Box';
import { useQuizGeneration } from '@/features/genai';
import type { GenerationResult } from '@/features/genai';
import { createQuizRequest } from '@/features/genai/schema';
import { useAuth } from '@/features/auth';
import { saveQuiz } from '@/features/quiz';
import { extractTextFromFile, DocExtractError, MAX_CONTEXT_CHARS } from '@/features/doc-extract';

const STORAGE_KEY = 'quizza_uploaded_file';

// Local reusable capsule tab component
function TabButton({
  text,
  isActive,
  onActivate,
  onClose,
}: { text: string; isActive: boolean; onActivate: () => void; onClose?: () => void }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isActive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isActive ? -1 : 0}
      onClick={isActive ? undefined : onActivate}
      onKeyDown={handleKeyDown}
      className={`
        group relative inline-flex items-center justify-center pl-4 pr-10 py-2 h-10 rounded-full
        text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis
        border-2 bg-white select-none flex-shrink-0
        ${isActive
          ? 'text-primary-600 dark:text-primary-400 border-primary-500 font-semibold cursor-default'
          : 'text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:text-primary-400 dark:hover:text-primary-400 hover:border-primary-400'
        }
      `}
      aria-pressed={isActive}
      aria-disabled={isActive}
    >
      <span className="truncate">{text}</span>
      {onClose && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2 flex-shrink-0 p-1 rounded-full transition-colors
            ${isActive
              ? 'bg-primary-500 text-white group-hover:bg-primary-600'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400/50 dark:text-gray-400 group-hover:bg-primary-400 group-hover:text-white'
            }
          `}
          aria-label="Remove"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
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
  const [isPublic, setIsPublic] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [topic, setTopic] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Document extraction state (client-side, pluggable per format — adding
  // PPTX later means one more adapter file, no page changes).
  type ExtractionState =
    | { phase: 'idle' }
    | { phase: 'extracting'; progress: number }
    | { phase: 'done'; text: string; truncated: boolean }
    | { phase: 'failed'; message: string };

  // Fewer than this many characters is not enough context; fall back to
  // topic-only generation.
  const MIN_CONTEXT_CHARS = 200;

  const [extraction, setExtraction] = useState<ExtractionState>({ phase: 'idle' });

  // Load persisted file from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { filename } = JSON.parse(stored);
        setUploadedFileName(filename);
        // Extract clean topic from filename
        const cleanTopic = filename
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        setTopic(cleanTopic || filename);
      }
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
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setTopic(topicFromFileName(file.name));
    // Persist filename only — the document itself is never stored locally.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ filename: file.name }));
    } catch {
      // Ignore quota exceeded errors
    }

    void runExtraction(file);
  };

  const runExtraction = async (file: File) => {
    const startTime = Date.now();

    // Force the extracting state to render synchronously BEFORE any async
    // work begins. Without this, React 19 batches the 'extracting' update
    // together with the eventual 'done'/'failed' update, so the user never
    // sees the intermediate "Reading document..." state.
    flushSync(() => {
      setExtraction({ phase: 'extracting', progress: 0 });
    });

    // Yield to the browser so the "extracting" UI paints before extraction
    // begins. Without this, a fast extraction failure can replace "extracting"
    // with "failed" before the browser gets a chance to paint, so the user
    // never sees the "Reading document..." intermediate state.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulated progress while extraction is in flight. extractTextFromFile is
    // a black box with no progress callbacks, so we drive a client-side timer
    // from 0% up to ~90%, then jump to 100% when extraction completes.
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      setExtraction((prev) =>
        prev.phase === 'extracting' ? { ...prev, progress } : prev
      );
    }, 150);

    try {
      const result = await extractTextFromFile(file);
      clearInterval(timer);
      setExtraction({ phase: 'extracting', progress: 100 });
      setExtraction({ phase: 'done', text: result.text, truncated: result.truncated });
    } catch (error) {
      clearInterval(timer);
      // Ensure "extracting" is visible for at least ~300ms total so the user
      // always sees it before the failure state replaces it.
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 300 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setExtraction({
        phase: 'failed',
        message:
          error instanceof DocExtractError
            ? error.message
            : `"${file.name}" could not be read.`,
      });
    }
  };

  const handleRemoveFile = () => {
    setUploadedFileName(null);
    setTopic('');
    setExtraction({ phase: 'idle' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear from localStorage
    localStorage.removeItem(STORAGE_KEY);
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
        const quizId = await saveQuiz(result.data, user.uid, isPublic ? 'public' : 'private');
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

  // Document text as generation context: under ~200 chars, failed, or not-yet-
  // extracted extraction means topic-only generation.
  const buildAdditionalContext = (): string | undefined => {
    if (extraction.phase !== 'done') return undefined;
    const { text, truncated } = extraction;
    if (text.length < MIN_CONTEXT_CHARS) return undefined;
    return truncated
      ? `${text}\n\n[Source document truncated to ${MAX_CONTEXT_CHARS.toLocaleString()} characters — base questions on the provided excerpt.]`
      : text;
  };

  const handleGenerateQuiz = async () => {
    const request = createQuizRequest({
      topic,
      questionTypes: getQuestionTypes(),
      difficulties: getDifficulties(),
      itemCount,
      isPublic,
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
    <div className="min-h-screen bg-primary-50/30 dark:bg-gray-900">
      {/* Gradient Header with rounded bottom corners - fixed but constrained to layout width */}
      <header className="inset-x-0 top-0 z-10 max-w-[500px] mx-auto bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
        {/* Back button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="absolute top-6 left-4 p-2 text-white hover:bg-white/20"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-7 h-7" aria-hidden="true" />
        </Button>

        {/* Title and subtitle */}
        <div className="pt-4 ml-15">
          <h1 className="text-3xl font-bold text-white">Quizza</h1>
          <p className="mt-0 text-white/80 text-lg">Create Quiz</p>
        </div>
      </header>

      {/* Content area */}
      <main className="pt-1 pb-20 px-4 mt-2">
        {/* Import File Card - Dashed border */}
        <Card className='mt-4 border border-primary-300'>
            <CardTitle className='mb-6 text-text-primary'>
              Import File
            </CardTitle>
              <div className="max-w-[500px] mx-auto">
            <div
              className="relative rounded-2xl border-2 border-dashed border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-gray-800/50 p-8 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
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
                accept=".docx,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                aria-label="Upload quiz file (DOCX or PDF)"
              />

              <div className="space-y-1">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400">
                  <Upload className="w-8 h-8" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-lg font-medium text-primary-600 dark:text-gray-100">Tap to upload</p>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Supports: DOCX, PDF
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* File Selected Display */}
        {uploadedFileName && (
          <>
          <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-500" aria-hidden="true" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300 truncate max-w-[250px]">
                {uploadedFileName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-primary-500 hover:text-primary-700 text-sm font-medium"
            >
              Remove
            </button>
          </div>

          {/* Extraction status line */}
          {extraction.phase === 'extracting' && (
            <>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full progress-shimmer animate-progress"
                  style={{ width: `${extraction.progress}%` }}
                  role="progressbar"
                  aria-valuenow={extraction.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Extracting document text"
                />
              </div>
              <p className="mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                Reading document…
              </p>
            </>
          )}
          {extraction.phase === 'done' && (
            <p className="mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400">
              Extracted {extraction.text.length.toLocaleString()} characters
              {extraction.truncated ? ` (capped at ${MAX_CONTEXT_CHARS.toLocaleString()})` : ''}.
            </p>
          )}
          {extraction.phase === 'failed' && (
            <p className="mt-1 ml-2 text-xs text-amber-600 dark:text-amber-400">
              {extraction.message} Generating from the topic only.
            </p>
          )}
        </>
        )}

        <Box className='mt-5 border-primary-300'>
          <BoxTitle className='text-text-primary'>
              Question Type
          </BoxTitle>
          <BoxContent>
            <div className="flex gap-2 flex-wrap">
              <TabButton
                text="Multiple Choice"
                isActive={isSingleActive}
                onActivate={() => setIsSingleActive(true)}
                onClose={() => setIsSingleActive(false)}
              />
              <TabButton
                text="True/False"
                isActive={isMultipleActive}
                onActivate={() => setIsMultipleActive(true)}
                onClose={() => setIsMultipleActive(false)}
              />
              <TabButton
                text="Identification"
                isActive={isIdentificationActive}
                onActivate={() => setIsIdentificationActive(true)}
                onClose={() => setIsIdentificationActive(false)}
              />
              <TabButton
                text="Enumeration"
                isActive={isEnumerationActive}
                onActivate={() => setIsEnumerationActive(true)}
                onClose={() => setIsEnumerationActive(false)}
              />
            </div>
          </BoxContent>
        </Box>

        <Box className='border-primary-300 border-t-0'>
          <BoxTitle className='text-text-primary'>
              Difficulty
          </BoxTitle>
          <BoxContent>
            <div className="flex gap-2 flex-wrap">
              <TabButton
                text="Easy"
                isActive={isEasyActive}
                onActivate={() => setIsEasyActive(true)}
                onClose={() => setIsEasyActive(false)}
              />
              <TabButton
                text="Medium"
                isActive={isMediumActive}
                onActivate={() => setIsMediumActive(true)}
                onClose={() => setIsMediumActive(false)}
              />
              <TabButton
                text="Hard"
                isActive={isHardActive}
                onActivate={() => setIsHardActive(true)}
                onClose={() => setIsHardActive(false)}
              />
            </div>
          </BoxContent>
        </Box>

        {/* Number of Items */}
        <Box className='border-primary-300 border-t-0'>
          <BoxTitle className='text-text-primary'>
              Number of Items
          </BoxTitle>
          <BoxContent>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 10, label: '10' },
                { value: 15, label: '15' },
                { value: 20, label: '20' },
                { value: 30, label: '30' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setItemCount(itemCount === value ? null : value)}
                  className={`
                    flex-1 min-w-[60px] max-w-[72px] px-3 py-3 rounded-xl border-2 transition-all duration-200
                    text-center text-sm font-medium
                    ${itemCount === value
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700'
                    }
                  `}
                  aria-pressed={itemCount === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </BoxContent>
        </Box>

        {/* Visibility Toggle */}
        <Box className='border-primary-300 border-t-0'>
          <BoxTitle className='text-text-primary'>
              Visibility
          </BoxTitle>
          <BoxContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  {isPublic ? (
                    <span className="text-base font-semibold text-primary-600 dark:text-primary-400">
                      Public
                    </span>
                  ) : (
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Private
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {isPublic ? '(shareable to everyone)' : '(not shareable)'}
                  </span>
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer outline-0"
                />
                <div className="relative w-12 h-7 rounded-full transition-colors duration-200
                  peer-focus:outline-none peer-focus:ring-0 peer-focus:ring-offset-0
                  peer-checked:bg-primary-500
                  bg-gray-300 dark:bg-gray-600
                " />
                <span className="absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200
                  peer-checked:translate-x-5
                " />
              </label>
            </div>
          </BoxContent>
        </Box>

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