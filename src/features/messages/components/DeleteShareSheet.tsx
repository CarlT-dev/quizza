import React, { useState, useCallback } from 'react';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { type DeleteShareMode, type ShareDocument } from '../api/messages';

interface DeleteShareSheetProps {
  share: ShareDocument | null;
  onClose: () => void;
  /** Current user's UID to determine share ownership */
  currentUserId: string | null;
  /** Called when user selects a delete action (sheet will close first) */
  onActionSelect?: (mode: DeleteShareMode) => void;
}

export const DeleteShareSheet: React.FC<DeleteShareSheetProps> = ({ share, onClose, currentUserId, onActionSelect }) => {
  // Hold the last non-null share while the sheet animates out, so its content
  // doesn't vanish mid close-animation (same pattern as ShareQuizSheet).
  const [shownShare, setShownShare] = useState<ShareDocument | null>(share);
  if (share !== null && share !== shownShare) {
    setShownShare(share);
  }

  const handleButtonClick = useCallback(
    (mode: DeleteShareMode) => {
      // Notify parent of the action; parent will close the sheet by setting share to null
      onActionSelect?.(mode);
    },
    [onActionSelect]
  );

  // Determine if the share belongs to the current user
  const isOwner = shownShare?.sharedBy === currentUserId;

  return (
    <BottomSheet
      isOpen={share != null}
      onClose={onClose}
      title="Delete shared quiz"
      height="none"
    >
      <div className="pb-10 pt-0.5 text-center">
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleButtonClick('me')}
            className="w-full py-3 px-4 text-left text-sm border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center gap-3 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <span className="flex-1">Delete for you</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => handleButtonClick('everyone')}
              className="w-full py-3 px-4 text-left text-sm bg-red-50/30 dark:bg-red-900/20 flex items-center gap-3 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              <span className="flex-1 text-red-600 dark:text-red-400">Delete for everyone</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};