import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification, User } from '../types';

export const sendNotification = async (
  userId: string, 
  type: Notification['type'], 
  actor: User, 
  targetId: string,
  postId: string | null = null,
  postMedia: string | null = null,
  content: string | null = null,
  postAuthorName: string | null = null,
  postAuthorAvatar: string | null = null
) => {
  if (!userId || userId === actor.uid) return;

  try {
    await addDoc(collection(db, 'notifications', userId, 'items'), {
      type,
      actorId: actor.uid,
      actorName: actor.name,
      actorAvatar: actor.avatar,
      targetId,
      postId: postId ?? null,
      postMedia: postMedia ?? null,
      postAuthorName: postAuthorName ?? null,
      postAuthorAvatar: postAuthorAvatar ?? null,
      content: content ?? null,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Notification Error:', error);
  }
};

export const subscribeNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications', userId, 'items'), 
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    callback(notifications);
  });
};

export const findUserByUsername = async (username: string) => {
  try {
    const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
    }
  } catch (error) {
    console.error('Find User Error:', error);
  }
  return null;
};

export const markAllRead = async (userId: string) => {
  try {
    const q = query(collection(db, 'notifications', userId, 'items'), where('isRead', '==', false));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();
  } catch (error: any) {
    console.error('Mark Read Error:', error);
  }
};
