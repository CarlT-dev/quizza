import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Edit, Globe, Lock, Users, User, HelpCircle, Target, Brain, List, Check, MoreVertical, Trash2 } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { ColorPalette } from '@/shared/components/ui/ColorPalette';
import { useCardSwipe } from '../hooks/useCardSwipe';
import { getCardColor, type CardColorId, type QuizDocument, type QuizProgress } from '@/features/quiz/api/quiz';

interface QuizCardProps {
  quiz: QuizDocument;
  currentUserId: string | null | undefined;
  progress: QuizProgress | null;
  colorId: CardColorId;
  customTitle: string;
  onClick: () => void;
  onColorChange: (colorId: CardColorId) => void;
  onTitleChange?: (title: string) => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
}

// Progress bar colors per card color. Literal class strings only — Tailwind v4
// generates classes it finds verbatim in source, so interpolated strings like
// `bg-${color}-500` would render nothing. Solid fills (background-color) are
// required because .progress-shimmer sets background-image and would override
// a gradient utility.
const PROGRESS_COLORS: Record<CardColorId, { track: string; fill: string; fillCompleted: string }> = {
  default: { track: 'bg-primary-100 dark:bg-primary-900/30', fill: 'bg-primary-500', fillCompleted: 'bg-primary-600' },
  primary: { track: 'bg-primary-100 dark:bg-primary-900/30', fill: 'bg-primary-500', fillCompleted: 'bg-primary-600' },
  blue:    { track: 'bg-blue-100 dark:bg-blue-900/30',       fill: 'bg-blue-500',    fillCompleted: 'bg-blue-600' },
  green:   { track: 'bg-green-100 dark:bg-green-900/30',     fill: 'bg-green-500',   fillCompleted: 'bg-green-600' },
  purple:  { track: 'bg-purple-100 dark:bg-purple-900/30',   fill: 'bg-purple-500',  fillCompleted: 'bg-purple-600' },
  orange:  { track: 'bg-orange-100 dark:bg-orange-900/30',   fill: 'bg-orange-500',  fillCompleted: 'bg-orange-600' },
  pink:    { track: 'bg-pink-100 dark:bg-pink-900/30',       fill: 'bg-pink-500',    fillCompleted: 'bg-pink-600' },
  teal:    { track: 'bg-teal-100 dark:bg-teal-900/30',       fill: 'bg-teal-500',    fillCompleted: 'bg-teal-600' },
  indigo:  { track: 'bg-indigo-100 dark:bg-indigo-900/30',   fill: 'bg-indigo-500',  fillCompleted: 'bg-indigo-600' },
};

export const QuizCard = memo(function QuizCard({
  quiz,
  currentUserId,
  progress,
  colorId: initialColorId,
  customTitle,
  onClick,
  onColorChange,
  onTitleChange,
  onToggleVisibility,
  onDelete,
}: QuizCardProps) {
  const isOwner = currentUserId && quiz.createdBy === currentUserId;
  const hasProgress = progress && progress.answeredCount > 0;
  const progressPercent = hasProgress ? (progress.answeredCount / progress.totalQuestions) * 100 : 0;
  const isCompleted = progress?.completed;

  // Card actions menu (⋯) - only for owned quizzes with a handler provided
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const canManage = Boolean(isOwner) && (Boolean(onToggleVisibility) || Boolean(onDelete));
  const canRename = Boolean(currentUserId) && Boolean(onTitleChange);

  // Local state for instant UI update, synced with prop initially
  const [localColorId, setLocalColorId] = useState<CardColorId>(initialColorId);

  // Keep local state in sync with prop (e.g., when parent refetches)
  useEffect(() => {
    setLocalColorId(initialColorId);
  }, [initialColorId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Ref for outside-click detection on the card palette
  const cardRef = useRef<HTMLDivElement>(null);

  // Debounce timer ref for Firestore save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track pending save to avoid duplicate requests
  const pendingColorRef = useRef<CardColorId | null>(null);

  const selectedColor = useMemo(() => getCardColor(localColorId), [localColorId]);

  const progressColors = PROGRESS_COLORS[localColorId];

  // Swipe gesture - swipe right to reveal palette
  const {
    swipeOffset,
    isOpen,
    handlers,
    close,
  } = useCardSwipe({
    threshold: 80,
    maxSwipe: 200,
    direction: 'right',
    onOpen: () => {},
    onClose: () => {},
  });

  // Keep menu interactions from reaching the card's click/keydown/swipe handlers.
  // stopPropagation on the React synthetic event also stops the native event,
  // so the document-level outside-click listener never sees menu presses either.
  const stopMenuEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };
  const menuEventProps = {
    onClick: stopMenuEvent,
    onKeyDown: stopMenuEvent,
    onMouseDown: stopMenuEvent,
    onTouchStart: stopMenuEvent,
    onTouchMove: stopMenuEvent,
    onTouchEnd: stopMenuEvent,
  };

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    setIsConfirmingDelete(false);
    close(); // collapse an open color palette
  }, [close]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setIsConfirmingDelete(false);
  }, []);

  // Close the menu on outside click or Escape while it is open. Uses click (not
  // mousedown) so a dismiss-tap on the card body is handled first by handleClick
  // (closes the menu, no navigation) before the document listener sees it.
  // setState inside the listeners is event-driven, not an effect-body call.
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = () => closeMenu();
    const handleMenuEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleMenuEscapeKey);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleMenuEscapeKey);
    };
  }, [isMenuOpen, closeMenu]);

  // Close the color palette on outside click or Escape while it is open.
  // Uses the card ref so clicks inside the card (e.g. on the Card body which
  // already calls close() via handleClick) don't double-fire.
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handlePaletteEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handlePaletteEscapeKey);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handlePaletteEscapeKey);
    };
  }, [isOpen, close]);

  // Handle click - close palette/menu if open, otherwise navigate
  const handleClick = useCallback(() => {
    if (isOpen) {
      close();
    } else if (isMenuOpen) {
      closeMenu();
    } else {
      onClick();
    }
  }, [isOpen, close, isMenuOpen, closeMenu, onClick]);

  // Handle color selection - instant local update, debounced Firestore save
  const handleColorSelect = useCallback((newColorId: CardColorId) => {
    // Instant UI update
    setLocalColorId(newColorId);

    // Clear any pending timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Track pending color to save
    pendingColorRef.current = newColorId;

    // Debounce the Firestore save (~500ms)
    saveTimerRef.current = setTimeout(() => {
      const colorToSave = pendingColorRef.current;
      if (colorToSave) {
        onColorChange(colorToSave);
        pendingColorRef.current = null;
      }
    }, 500);

    close();
  }, [onColorChange, close]);

  // Handle title save - called on Enter or blur when editing
  const handleTitleSave = useCallback(() => {
    if (editTitle.trim() && onTitleChange) {
      onTitleChange(editTitle.trim());
    }
    setIsEditingTitle(false);
  }, [editTitle, onTitleChange]);

  // Handle title cancel - discard changes and exit edit mode
  const handleTitleCancel = useCallback(() => {
    setEditTitle(customTitle);
    setIsEditingTitle(false);
  }, [customTitle]);

  // Determine card background classes
  const cardBgClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'bg-white dark:bg-gray-800';
    }
    return selectedColor.bgClass;
  }, [localColorId, selectedColor]);

  // Determine text color classes
  const textClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'text-gray-900 dark:text-gray-100';
    }
    return selectedColor.textClass;
  }, [localColorId, selectedColor]);

  // Border classes
  const borderClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'border-gray-200 dark:border-gray-700';
    }
    return 'border-white/20';
  }, [localColorId]);

  // Badge background classes
  const badgeBgClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'bg-primary-50 dark:bg-primary-900/30';
    }
    return 'bg-white/20';
  }, [localColorId]);

  // Badge text classes
  const badgeTextClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'text-primary-700 dark:text-primary-300';
    }
    return 'text-white';
  }, [localColorId]);

  // Badge border classes
  const badgeBorderClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'border-primary-200 dark:border-primary-800';
    }
    return 'border-white/30';
  }, [localColorId]);

  // Score chip classes: green family on default cards; white-on-gradient on
  // colored cards (theme-invariant - the gradient is identical in both modes,
  // matching the colored-card badge convention above, so no dark: pair there)
  const scoreChipClasses = useMemo(() => {
    if (localColorId === 'default') {
      return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
    }
    return 'bg-white/20 text-white border-white/30';
  }, [localColorId]);

  // Format visibility text
  const visibilityText = quiz.visibility === 'public' ? 'Everyone' : 'Only you';

  // Accordion state for metadata
  const [showMetadata, setShowMetadata] = useState(false);

  const toggleMetadata = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMetadata(!showMetadata);
  };

  return (
    <div ref={cardRef} className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Color Palette - positioned on LEFT side, stationary */}
      <div
        className="absolute top-0 left-0 bottom-0 z-0 flex items-center pl-2 pointer-events-none"
        style={{ width: '200px' }}
        inert={!isOpen}
      >
        <div className="w-full pointer-events-auto">
          <ColorPalette
            selectedColor={localColorId}
            onColorChange={handleColorSelect}
            variant="inline"
            className="w-full"
          />
        </div>
      </div>

      {/* Main Card - slides right to reveal palette */}
      <Card
        className={`
          relative z-10 overflow-hidden cursor-pointer transition-all duration-300
          active:shadow-xl active:-translate-y-0.5
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        `}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isOpen ? 'transform 0.2s ease-out' : 'transform 0.15s ease-out',
        }}
        padding='none'
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        {...handlers}
      >

        {/* Card Content */}
        <div className="relative z-10">
          {/* Header with Title & Author - COLORED SECTION */}
          <div className={`${cardBgClasses} ${textClasses} ${borderClasses} border-b p-4 relative`}>
            {/* Card actions: ⋯ menu for owned quizzes */}
            {(canManage || canRename) && (
              <button
                type="button"
                {...menuEventProps}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMenuOpen) {
                    closeMenu();
                  } else {
                    openMenu();
                  }
                }}
                className={`absolute top-2 right-2 z-10 p-1.5 rounded-lg transition-colors ${
                  localColorId === 'default'
                    ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-white/80 hover:bg-white/20'
                }`}
                aria-label="Quiz options"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <MoreVertical className="w-6 h-6" aria-hidden="true" />
              </button>
            )}
            {(canManage || canRename) && isMenuOpen && (
              <div
                {...menuEventProps}
                role="menu"
                aria-label="Quiz options"
                className="absolute right-2 top-10 z-20 w-44 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1"
              >
                {canRename && !isConfirmingDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditTitle(customTitle);
                      setIsEditingTitle(true);
                      closeMenu();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" aria-hidden="true" />
                    Rename
                  </button>
                )}
                {canManage && onToggleVisibility && !isConfirmingDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleVisibility();
                      closeMenu();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {quiz.visibility === 'public' ? (
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Globe className="w-4 h-4" aria-hidden="true" />
                    )}
                    {quiz.visibility === 'public' ? 'Make private' : 'Make public'}
                  </button>
                )}
                {canManage && onDelete && !isConfirmingDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Delete
                  </button>
                )}
                {isConfirmingDelete && (
                  <>
                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      Delete this quiz permanently?
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onDelete?.();
                        closeMenu();
                      }}
                      className="w-full px-3 py-2 text-sm text-left font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Tap again to delete
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={closeMenu}
                      className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
            <div className={`space-y-1 ${(canManage || canRename) ? 'pr-8' : ''}`}>
              <h3 className={`text-2xl font-semibold truncate`}>
                {isEditingTitle ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleTitleSave();
                      }
                      if (e.key === 'Escape') {
                        handleTitleCancel();
                      }
                    }}
                    className="inherit text-2xl font-semibold border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 bg-transparent focus:outline-none w-full"
                  />
                ) : (
                  customTitle
                )}
                <div>
                  <span className='text-[20px] font-light'>
                    {quiz.metadata.totalQuestions} Questions
                  </span>
                </div>
                <div className="flex items-center mt-2 gap-2 text-[16px] font-light">
                  {isOwner && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" aria-hidden="true" />
                      You
                    </span>
                  )}
                  {!isOwner && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      {quiz.createdBy.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${badgeBgClasses} ${badgeTextClasses} ${badgeBorderClasses} border`}>
                    {quiz.visibility === 'public' ? (
                      <Globe className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Lock className="w-3 h-3" aria-hidden="true" />
                    )}
                    {visibilityText}
                  </span>

                  {/* Score chip - only for a completed attempt: setDoc merge keeps the
                      old score during a retake, so a bare score check would show a
                      stale "8/10" beside a half-filled strip */}
                  {progress?.completed && progress.score && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${scoreChipClasses}`}>
                      <Check className="w-3 h-3" aria-hidden="true" />
                      {progress.score.correct}/{progress.score.total}
                    </span>
                  )}
                </div>
              </h3>
            </div>
          </div>

          {/* Content Area - NEUTRAL */}
          <div className="p-4">

            {/* Progress pill */}
            {hasProgress && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPercent)}
                  aria-label="Quiz progress"
                  className={`h-2 flex-1 rounded-full overflow-hidden ${progressColors.track}`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      isCompleted ? progressColors.fillCompleted : `${progressColors.fill} progress-shimmer`
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            )}

            {/* Metadata Accordion Trigger */}
            <button
              onClick={toggleMetadata}
              className="flex items-center justify-between w-full py-2 text-left"
              aria-expanded={showMetadata}
              aria-controls="metadata-content"
            >
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showMetadata ? 'rotate-180' : ''}`} aria-hidden="true" />
                Details
              </span>
            </button>

            {/* Metadata Accordion Content */}
            <div
              id="metadata-content"
              role="region"
              aria-hidden={!showMetadata}
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{ maxHeight: showMetadata ? '300px' : '0', opacity: showMetadata ? 1 : 0 }}
            >
              <div className="pt-3 pb-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {/* Question Types */}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Question Types</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(quiz.metadata.questionTypes) && quiz.metadata.questionTypes.length > 0
                      ? quiz.metadata.questionTypes
                      : quiz.metadata.questionType
                        ? [quiz.metadata.questionType]
                        : ['Unknown']
                    ).map((type, index) => {
                      const icons: Record<string, React.ReactNode> = {
                        multiple_choice: <Target className="w-3 h-3" aria-hidden="true" />,
                        true_false: <Brain className="w-3 h-3" aria-hidden="true" />,
                        identification: <HelpCircle className="w-3 h-3" aria-hidden="true" />,
                        enumeration: <List className="w-3 h-3" aria-hidden="true" />,
                      };
                      return (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                        >
                          {icons[type] || <HelpCircle className="w-3 h-3" aria-hidden="true" />}
                          {type.replace('_', ' ')}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulties */}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Target className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Difficulty Levels</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(quiz.metadata.difficulties) && quiz.metadata.difficulties.length > 0
                      ? quiz.metadata.difficulties
                      : quiz.metadata.difficulty
                        ? [quiz.metadata.difficulty]
                        : ['Unknown']
                    ).map((difficulty, index) => {
                      const difficultyConfig: Record<string, { label: string; color: string }> = {
                        easy: { label: 'Easy', color: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' },
                        medium: { label: 'Medium', color: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
                        hard: { label: 'Hard', color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
                      };
                      const config = difficultyConfig[difficulty] || { label: difficulty, color: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' };
                      return (
                        <span
                          key={index}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border ${config.color}`}
                        >
                          {config.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});