import { useState, useRef, useEffect, useCallback } from 'react';
import { Edit2, ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { formatDate } from '../pages/ProfilePage';

interface ProfileHeaderProps {
  username: string;
  name?: string;
  displayName?: string;
  bio?: string;
  createdAt?: string;
  onUpdateBio: (bio: string) => Promise<void>;
  isUpdating?: boolean;
  quizzesCreated: number;
  quizzesTaken: number;
  bestAccuracy?: number;
  /** Optional back button callback — when provided, a back button is shown in the header overlay */
  onBack?: () => void;
  /** Optional title shown in the header overlay */
  title?: string;
}

const MAX_BIO_LENGTH = 160;

export function ProfileHeader({
  username,
  name,
  displayName,
  bio,
  createdAt,
  onUpdateBio,
  isUpdating,
  quizzesCreated,
  quizzesTaken,
  bestAccuracy,
  onBack,
}: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState(bio ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasBio = bio && bio.trim().length > 0;

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    const trimmed = editBio.trim().slice(0, MAX_BIO_LENGTH);
    await onUpdateBio(trimmed);
    setIsEditing(false);
  }, [editBio, onUpdateBio]);

  const handleCancel = useCallback(() => {
    setEditBio(bio ?? '');
    setIsEditing(false);
  }, [bio]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (isEditing) handleSave();
    }, 100);
  }, [isEditing, handleSave]);

  const initial = username.charAt(0).toUpperCase();
  //  dark:from-primary-900/30 dark:via-primary-900/20 dark:to-primary-900/20

  return (
    <div className="relative overflow-hidden border-b-2 border-gray-300/40 dark:border-none mb-4">
      {/* Gradient background overlay - transparent base */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-100/60 via-primary-50/30 to-white/60 dark:from-primary-100/60 dark:via-primary-300/20 dark:to-primary-900/20" aria-hidden="true" />

      {/* Header overlay: back button + title positioned over the gradient background */}
      {onBack && (
        <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between z-10">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg dark:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="relative flex flex-col items-center px-6 pt-16 pb-0 text-center">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-primary-500/30">
          {initial}
        </div>

        {/* Username & Display Name */}
        <div className="mt-4">
          {name ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {name}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">@{username}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                @{username}
              </h2>
              {displayName && displayName !== username && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{displayName}</p>
              )}
            </>
          )}
        </div>

        {/* Bio - centered, inline editable */}
        <div className="w-full max-w-xl px-4">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                maxLength={MAX_BIO_LENGTH}
                rows={3}
                className="w-full bg-white/50 dark:bg-gray-800/50 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-center"
                placeholder="Tell people about yourself..."
                aria-label="Edit bio"
              />
              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {editBio.length}/{MAX_BIO_LENGTH}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="text-gray-600 dark:text-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {hasBio ? (
                <div className="relative group">
                  <p
                    className="text-sm text-gray-400 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-center cursor-pointer transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => setIsEditing(true)}
                  >
                    {bio}
                  </p>
                  {/* Edit icon on hover/focus */}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-sm"
                    aria-label="Edit bio"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full text-center text-base text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 py-4 transition-colors"
                >
                  Add a bio to tell others about yourself...
                </button>
              )}
            </div>
          )}
        </div>

        {/* Member since */}
        {createdAt && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
            Member since {formatDate(createdAt)}
          </p>
        )}
      </div>

      {/* Stats - inline with transparent background */}
        <div className="w-full max-w-xl px-4">
          <div className="flex justify-center">
            <div className="flex backdrop-blur-sm overflow-hidden">
              <StatItem
                value={quizzesCreated}
                label="Created"
                isFirst
                hasDivider
              />
              <StatItem
                value={quizzesTaken}
                label="Taken"
                hasDivider
              />
              <StatItem
                value={bestAccuracy !== undefined ? `${bestAccuracy}%` : '—'}
                label="Best Accuracy"
                isLast
              />
            </div>
          </div>
        </div>
    </div>
  );
}

interface StatItemProps {
  value: string | number;
  label: string;
  isFirst?: boolean;
  isLast?: boolean;
  hasDivider?: boolean;
}

function StatItem({ value, label, isFirst, isLast, hasDivider }: StatItemProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center py-4 px-6 relative ${isFirst ? 'rounded-l-2xl' : ''} ${isLast ? 'rounded-r-2xl' : ''}`}
    >
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-xs text-center text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      {hasDivider && (
        <div
          className="absolute right-0 top-3 bottom-3 w-px bg-gray-300/50 dark:bg-gray-600/50"
          aria-hidden="true"
        />
      )}
    </div>
  );
}