export { getUserProfile, saveUserStats, renameUsername, updateBio, updateName } from './api/users';
export type { UserProfile, RenameUsernameResult, RenameUsernameErrorCode } from './api/users';
export { useUserProfile } from './hooks/useUserProfile';
export { useUserProfile as useUserProfileLegacy } from './hooks/useUserProfile';
export { useUserProfile as useUserProfileQuery, useUserStats } from './hooks/useUserQueries';
export { useUpdateBio, useUpdateName, useRenameUsername } from './hooks/useUserMutations';
export { ProfilePage } from './pages/ProfilePage';
