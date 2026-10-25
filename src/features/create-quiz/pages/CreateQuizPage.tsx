import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, X } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Card, CardTitle } from '@/shared/components/ui';
import { Box, BoxTitle, BoxContent } from '@/shared/components/ui/Box';

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
  const [isSingleActive, setIsSingleActive] = useState(false);
  const [isMultipleActive, setIsMultipleActive] = useState(false);
  const [isEasyActive, setIsEasyActive] = useState(false);
  const [isMediumActive, setIsMediumActive] = useState(false);
  const [isHardActive, setIsHardActive] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);

  const handleBack = () => {
    navigate('/');
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name);
      // TODO: Handle file upload
    }
  };

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
        <Card className='mt-4 border border-primary-300'>
            <CardTitle className='mb-6 text-text-primary'>
              Import File
            </CardTitle>
              <div className="max-w-[500px] mx-auto">
            {/* Import File Card - Dashed border */}
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
                accept=".json,.txt,.csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                aria-hidden="true"
              />

              <div className="space-y-1">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400">
                  <Upload className="w-8 h-8" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-lg font-medium text-primary-600 dark:text-gray-100">Tap to upload</p>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Supports: JSON, TXT, CSV
                </p>
              </div>
            </div>

          </div>
        </Card>

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

        {/* Submit Button */}
        <Button
          className="mt-5 w-full"
          size="lg"
        >
          Create Quiz
        </Button>
      </main>
    </div>
  );
}


