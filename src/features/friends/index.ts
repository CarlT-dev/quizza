export {
  buildFriendshipId,
  getOtherParticipantUid,
  getFriendships,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  type FriendshipDocument,
  type FriendshipStatus,
  type FriendshipsData,
  type FriendRequestResult,
  type FriendRequestErrorCode,
} from './api/friends';
export { useFriendships } from './hooks/useFriendships';
export { useFriendships as useFriendshipsQuery } from './hooks/useFriendQueries';
export { useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest, useCancelFriendRequest, useRemoveFriend } from './hooks/useFriendMutations';
