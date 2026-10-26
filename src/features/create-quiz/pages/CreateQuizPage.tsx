import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, X, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Card, CardTitle } from '@/shared/components/ui';
import { Box, BoxTitle, BoxContent } from '@/shared/components/ui/Box';
import { useQuizGeneration } from '@/features/genai';
import { createQuizRequest } from '@/features/genai/schema';

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
        group relative inline-flex items-center justify-center pl-4 pr-10 py-2 h-10 min-w-[120px] rounded-full
        text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis
        border-2 bg-inherit select-none
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
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-primary-400 group-hover:text-white'
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
  const [isEasyActive, setIsEasyActive] = useState(false);
  const [isMediumActive, setIsMediumActive] = useState(false);
  const [isHardActive, setIsHardActive] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [topic, setTopic] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Quiz Generation Hook
  const { isLoading, error, quizData, generate, reset } = useQuizGeneration();

  const handleBack = () => {
    navigate('/');
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      // DOCX and PDF are binary formats - parsing them requires additional libraries
      // For now, use the filename as topic hint. In the future, we could:
      // - Use mammoth.js for DOCX parsing
      // - Use pdf.js for PDF parsing
      // - Or send files to a backend for text extraction
      setTopic(`Quiz based on uploaded file: ${file.name}`);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFileName(null);
    setTopic('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getQuestionType = (): 'single' | 'multiple' | null => {
    if (isSingleActive) return 'single';
    if (isMultipleActive) return 'multiple';
    return null;
  };

  const getDifficulty = (): 'easy' | 'medium' | 'hard' | null => {
    if (isEasyActive) return 'easy';
    if (isMediumActive) return 'medium';
    if (isHardActive) return 'hard';
    return null;
  };

  const canGenerate = () => {
    return (
      topic.trim().length > 0 &&
      getQuestionType() !== null &&
      getDifficulty() !== null &&
      itemCount !== null
    );
  };

  const handleGenerateQuiz = async () => {
    const request = createQuizRequest({
      topic,
      questionType: getQuestionType()!,
      difficulty: getDifficulty()!,
      itemCount,
      isPublic,
    });

    if (!request) {
      return;
    }

    const result = await generate(request);

    if (result.success && result.data) {
      // Navigate to quiz preview page with generated data
      // For now, log the result and show success
      console.log('Quiz generated successfully:', result.data);
      // TODO: Navigate to preview page or save to Firebase
      alert(`Quiz generated successfully with ${result.data.questions.length} questions!`);
    }
  };

  const handleBackToForm = () => {
    reset();
  };

  // Show success state if quiz was generated
  if (quizData) {
    return (
      <div className="relative min-h-screen bg-primary-50/10 dark:bg-gray-900">
        <header className="fixed inset-x-0 top-0 z-10 max-w-[500px] mx-auto bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBackToForm}
            className="absolute top-6 left-4 p-2 text-white hover:bg-white/20"
            aria-label="Create another quiz"
          >
            <ChevronLeft className="w-7 h-7" aria-hidden="true" />
          </Button>

          <div className="pt-4 ml-15">
            <h1 className="text-3xl font-bold text-white">Quizza</h1>
            <p className="mt-0 text-white/80 text-lg">Quiz Generated</p>
          </div>
        </header>

        <main className="pt-1 pb-20 px-4 mt-23">
          <Card className='mt-4 border border-primary-300'>
            <CardTitle className='mb-6 text-text-primary flex items-center gap-2'>
              <CheckCircle className="w-6 h-6 text-green-500" aria-hidden="true" />
              Quiz Generated Successfully!
            </CardTitle>

            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Generated <span className="font-bold">{quizData.questions.length}</span> questions on <span className="font-bold">{quizData.metadata.topic}</span>
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Type: {quizData.metadata.questionType.replace('_', ' ')} • Difficulty: {quizData.metadata.difficulty}
                </p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {quizData.questions.slice(0, 5).map((q, i) => (
                  <div key={q.id} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {q.options.map((opt, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs rounded ${idx === q.correctAnswerIndex ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                          {opt} {idx === q.correctAnswerIndex && '✓'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {quizData.questions.length > 5 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    + {quizData.questions.length - 5} more questions
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={handleBackToForm}>
                  Create Another Quiz
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
                  Go to Home
                </Button>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-primary-50/10 dark:bg-gray-900">
      {/* Gradient Header with rounded bottom corners - fixed but constrained to layout width */}
      <header className="fixed inset-x-0 top-0 z-10 max-w-[500px] mx-auto bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
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
      <main className="pt-1 pb-20 px-4 mt-23">
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
        )}

        <Box className='mt-5 border-primary-300'>
          <BoxTitle className='text-text-primary'>
              Question Type
          </BoxTitle>
          <BoxContent>
            <div className="flex gap-2">
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
            </div>
            {(!isSingleActive && !isMultipleActive) && (
              <p className="mt-2 text-xs text-red-500">Please select a question type</p>
            )}
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
            {(!isEasyActive && !isMediumActive && !isHardActive) && (
              <p className="mt-2 text-xs text-red-500">Please select a difficulty</p>
            )}
          </BoxContent>
        </Box>

        {/* Number of Items */}
        <Box className='mt-5 border-primary-300 border-t-0'>
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
            {itemCount === null && (
              <p className="mt-2 text-xs text-red-500">Please select number of items</p>
            )}
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
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="mt-5 w-full"
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
      </main>
    </div>
  );
}