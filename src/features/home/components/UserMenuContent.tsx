import { useNavigate } from 'react-router-dom';
import { Fragment, useState, useEffect } from 'react';
import { User, Lock, SquarePen, LogOut, ChevronDown, UserPlus, Check, X } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUserProfile, updateName } from '@/features/users';
import { Button, Card } from '@/shared/components/ui';

// Mock additional accounts - in real app this would come from auth context/localStorage
interface AdditionalAccount {
  id: string;
  displayName: string;
  email: string;
  initial: string;
}

const mockAdditionalAccounts: AdditionalAccount[] = [
  // Add mock accounts here for testing - remove or replace with real data
  // { id: '2', displayName: 'Jane Doe', email: 'jane@example.com', initial: 'J' },
  // { id: '3', displayName: 'John Smith', email: 'john@work.com', initial: 'J' },
];

export function UserMenuContent() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  // Fetch user profile from Firestore to get the display name (name field)
  const { profile } = useUserProfile(user?.uid);

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  // Displayed name state - initialized from Firebase Auth but updated from Firestore profile name
  const [displayName, setDisplayName] = useState(
    profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User'
  );
  const userEmail = user?.email || '';
  const userInitial = displayName.charAt(0).toUpperCase();

  // Sync displayName from profile when it loads (async)
  useEffect(() => {
    if (profile?.name) {
      setDisplayName(profile.name);
    }
  }, [profile?.name]);

  const isPasswordProvider = user?.providerData.some(p => p.providerId === 'password') ?? false;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSwitchAccount = (account: AdditionalAccount) => {
    // In a real app, this would switch the active account
    console.log('Switch to account:', account);
  };

  const handleAddAccount = () => {
    // Navigate to login/add account flow
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (!isPasswordProvider || !user?.email) {
      alert('This account does not use a password. Password change is not available.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert(`Password reset email sent to ${user.email}. Check your inbox to change your password.`);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      alert('Failed to send password reset email. Please try again.');
    }
  };

  const handleEditName = () => {
    setNameDraft(displayName);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !user) {
      setIsEditingName(false);
      return;
    }

    if (trimmed.length > 50) {
      setNameError('Name must be at most 50 characters');
      return;
    }

    setIsSavingName(true);
    setNameError(null);
    try {
      await updateName(user.uid, trimmed);
      // Optimistically update the displayed name
      setDisplayName(trimmed);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
      setNameError('Failed to update name. Please try again.');
    }
    setIsSavingName(false);
  };

  const handleCancelName = () => {
    setNameError(null);
    setIsEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-primary-50/50 dark:bg-gray-900/40">
      {/* User Profile Header - Expandable */}
      <Card padding='none' className="mx-3 mt-3 overflow-hidden">
        <button
          onClick={() => setIsProfileExpanded(!isProfileExpanded)}
          className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left transition-all duration-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          aria-expanded={isProfileExpanded}
          aria-label={isProfileExpanded ? 'Collapse account details' : 'Expand account details'}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-17 h-17 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-3xl flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-text-primary dark:text-gray-100 truncate">
                {displayName}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {userEmail}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200 ${
              isProfileExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {/* Expanded Content - Account Switcher & Logout */}
        {/* Always mounted so the height can animate; invisible keeps it out of tab order while collapsed */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isProfileExpanded ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mx-4 h-px bg-gray-100 dark:bg-gray-700" aria-hidden="true" />

            {/* Account Switcher - only show if there are additional accounts */}
            {mockAdditionalAccounts.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Signed in accounts
                </p>
                {mockAdditionalAccounts.map((account, index) => (
                  <Fragment key={account.id}>
                    {index > 0 && (
                      <div className="mx-4 h-px bg-gray-100 dark:bg-gray-700" aria-hidden="true" />
                    )}
                    <Button
                      variant="none"
                      size="md"
                      className="w-full justify-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => handleSwitchAccount(account)}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-lg flex-shrink-0">
                        {account.initial}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-bold text-sm text-text-primary dark:text-gray-100 truncate">
                          {account.displayName}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {account.email}
                        </p>
                      </div>
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-medium flex-shrink-0">
                        Switch
                      </span>
                    </Button>
                  </Fragment>
                ))}
                <div className="mx-4 h-px bg-gray-100 dark:bg-gray-700" aria-hidden="true" />
                <Button
                  variant="none"
                  size="md"
                  className="w-full justify-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={handleAddAccount}
                >
                  <span
                    className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    <UserPlus className="w-5 h-5 text-primary dark:text-primary-400" />
                  </span>
                  <span className="text-base font-bold text-text-primary dark:text-gray-100">Add another account</span>
                </Button>
              </div>
            )}

            {/* Logout at the very bottom */}
            <Button
              variant="none"
              size="md"
              className="w-full justify-start gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <span
                className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <LogOut className="w-5 h-5 text-primary dark:text-primary-400" />
              </span>
              <span className="text-base font-bold text-text-primary dark:text-gray-100">Logout</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Account Settings */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Account Settings</span>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden pb-9">
          {/* Change Password */}
          <Button
            variant="none"
            size="md"
            className="w-full justify-start gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={handleChangePassword}
            aria-label="Change password"
          >
            <span className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Lock className="w-5 h-5 text-primary dark:text-primary-400" />
            </span>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-base font-bold text-text-primary dark:text-gray-100">Change Password</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">update your password for security</span>
            </div>
          </Button>

          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-700" aria-hidden="true" />

          {/* Username with inline edit */}
          <div className="w-full flex items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <User className="w-5 h-5 text-primary dark:text-primary-400" />
            </span>
            {isEditingName ? (
              <form
                className="flex-1 flex items-center gap-2 min-w-0"
                onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}
              >
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-base font-bold text-text-primary dark:text-gray-100">Name</span>
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="mt-1 w-full text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border-2 border-primary-500 rounded-lg px-2 py-0.5 focus:outline-none"
                    autoFocus
                    aria-label="Edit name"
                    aria-invalid={nameError ? true : undefined}
                    disabled={isSavingName}
                  />
                  {nameError && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                      {nameError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50 flex-shrink-0"
                  aria-label="Save name"
                  disabled={isSavingName}
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelName}
                  className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
                  aria-label="Cancel editing"
                  disabled={isSavingName}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <>
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-base font-bold text-text-primary dark:text-gray-100">Name</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleEditName}
                  className="p-1.5 rounded-lg text-primary dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex-shrink-0"
                  aria-label="Edit name"
                >
                  <SquarePen className="w-5 h-5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-700" aria-hidden="true" />
        </div>
      </div>

      {/* App Version/Footer */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          Quizza v1.0.0
        </p>
      </div>
    </div>
  );
}