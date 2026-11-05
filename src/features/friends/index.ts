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
