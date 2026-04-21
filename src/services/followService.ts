import { doc, setDoc, deleteDoc, increment, updateDoc, getDoc, serverTimestamp, runTransaction, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const followUser = async (currentUser: any, targetUser: any) => {
  if (currentUser.uid === targetUser.uid) return;

  const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUser.uid);
  const followerRef = doc(db, 'users', targetUser.uid, 'followers', currentUser.uid);

  try {
    await runTransaction(db, async (transaction) => {
      // Current user follows target user
      transaction.set(followingRef, { 
        createdAt: serverTimestamp(),
        name: targetUser.name,
        avatar: targetUser.avatar
      });
      // Target user gets a new follower
      transaction.set(followerRef, { 
        createdAt: serverTimestamp(),
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      transaction.update(doc(db, 'users', currentUser.uid), { followingCount: increment(1) });
      transaction.update(doc(db, 'users', targetUser.uid), { followersCount: increment(1) });
    });

    // Send notification
    try {
      const { sendNotification } = await import('./notificationService');
      await sendNotification(targetUser.uid, 'follow', currentUser, targetUser.uid);
    } catch (e) {
      console.error('Failed to send follow notification:', e);
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

  try {
    await runTransaction(db, async (transaction) => {
      transaction.delete(followingRef);
      transaction.delete(followerRef);
      transaction.update(doc(db, 'users', currentUserId), { followingCount: increment(-1) });
      transaction.update(doc(db, 'users', targetUserId), { followersCount: increment(-1) });
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const isFollowing = async (currentUserId: string, targetUserId: string) => {
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const docSnap = await getDoc(followingRef);
  return docSnap.exists();
};

export const checkFriendship = async (currentUserId: string, targetUserId: string) => {
  const following = await isFollowing(currentUserId, targetUserId);
  const followedBy = await isFollowing(targetUserId, currentUserId);
  return { following, followedBy, isFriend: following && followedBy };
};

export const getFollowing = async (userId: string) => {
  try {
    const followingRef = collection(db, 'users', userId, 'following');
    const q = query(followingRef, limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
  } catch (error) {
    console.error("Error fetching following:", error);
    return [];
  }
};
