import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  increment,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Conversation, Message } from '../types';

export const createConversation = async (participantIds: string[], participants: { [uid: string]: { name: string, avatar: string } }) => {
  try {
    // Check if conversation already exists
    const q = query(
      collection(db, 'conversations'), 
      where('participantIds', 'array-contains', participantIds[0])
    );
    const querySnapshot = await getDocs(q);
    const existing = querySnapshot.docs.find(doc => {
      const data = doc.data();
      return (data.participantIds?.length === participantIds.length) && 
             participantIds.every(id => data.participantIds?.includes(id));
    });

    if (existing) {
      // Update names/avatars in case they changed
      const convRef = doc(db, 'conversations', existing.id);
      const participantNames: { [uid: string]: string } = {};
      const participantAvatars: { [uid: string]: string } = {};
      Object.entries(participants).forEach(([uid, data]) => {
        participantNames[uid] = data.name;
        participantAvatars[uid] = data.avatar;
      });
      await updateDoc(convRef, { participantNames, participantAvatars });
      return existing.id;
    }

    const unreadCount: { [uid: string]: number } = {};
    const participantNames: { [uid: string]: string } = {};
    const participantAvatars: { [uid: string]: string } = {};
    
    participantIds.forEach(id => {
      unreadCount[id] = 0;
      if (participants[id]) {
        participantNames[id] = participants[id].name;
        participantAvatars[id] = participants[id].avatar;
      }
    });

    const docRef = await addDoc(collection(db, 'conversations'), {
      participantIds,
      participantNames,
      participantAvatars,
      lastMessage: '',
      unreadCount,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const sendMessage = async (conversationId: string, senderId: string, type: Message['type'], content: string, mediaUrl?: string, postId?: string, replyTo?: any) => {
  try {
    const messageData: any = {
      senderId,
      type,
      content,
      mediaUrl: mediaUrl || null,
      createdAt: serverTimestamp(),
      status: 'sent'
    };
    
    if (postId) messageData.postId = postId;
    if (replyTo) messageData.replyTo = replyTo;

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Update conversation and increment unread count for others
    const convRef = doc(db, 'conversations', conversationId);
    if (!messageData.createdAt) {
       messageData.createdAt = serverTimestamp();
    }
    
    // We need to use runTransaction or getDoc to increment properly
    import('firebase/firestore').then(async (m) => {
      const convSnap = await m.getDoc(convRef);
      if (convSnap.exists()) {
        const data = convSnap.data();
        const unreadCount = data.unreadCount || {};
        
        // Increment for everyone else
        data.participantIds?.forEach((id: string) => {
          if (id !== senderId) {
            unreadCount[id] = (unreadCount[id] || 0) + 1;
          }
        });

        await m.updateDoc(convRef, {
          lastMessage: type === 'text' ? content : `Sent a ${type}`,
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount
        });
      }
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const markConversationRead = async (conversationId: string, userId: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`unreadCount.${userId}`]: 0
    });

    // Mark unread messages as seen
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'), 
      where('senderId', '!=', userId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let updated = false;
    snap.docs.forEach(d => {
      if (d.data().status !== 'seen') {
        batch.update(d.ref, { status: 'seen' });
        updated = true;
      }
    });
    if (updated) await batch.commit();
  } catch (error: any) {
    console.error(error);
  }
};

export const subscribeMessages = (conversationId: string, limitCount: number, callback: (messages: Message[]) => void) => {
  import('firebase/firestore').then(({ query, collection, orderBy, limit, onSnapshot }) => {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'), 
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
      callback(messages);
    });
  });
  return () => {}; // We'll handle cleanup in the component or rely on a wrapper
};

export const subscribeConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'), 
    where('participantIds', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    // Sort client-side to avoid index requirement
    conversations.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    callback(conversations);
  });
};
