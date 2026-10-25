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
        group inline-flex items-center justify-center gap-2 pl-4 pr-2 py-2 h-10 min-w-[120px] rounded-full
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
            flex-shrink-0 p-1 rounded-full transition-colors
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
    <div className="min-h-screen bg-primary-50/10 dark:bg-gray-900">
      {/* Gradient Header with rounded bottom corners */}
      <header className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
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
      <main className="pt-1 pb-20 px-4">
        <Card className='mt-4'>
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

        <Box className='mt-5'>
          <BoxTitle className='text-text-primary'>
              Question Type
          </BoxTitle>
          <BoxContent>
            <div className="flex gap-2">
              <TabButton
                text="Single Choice"
                isActive={isSingleActive}
                onActivate={() => setIsSingleActive(true)}
                onClose={() => setIsSingleActive(false)}
              />
              <TabButton
                text="Multiple Choice"
                isActive={isMultipleActive}
                onActivate={() => setIsMultipleActive(true)}
                onClose={() => setIsMultipleActive(false)}
              />
            </div>
          </BoxContent>
        </Box>
      </main>
    </div>
  );
}


