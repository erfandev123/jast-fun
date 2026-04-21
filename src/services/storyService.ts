import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadMedia } from './githubStorage';

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  mediaUrl?: string;
  text?: string;
  bg?: string;
  type: 'image' | 'video' | 'text';
  createdAt: any;
  expiresAt: any;
}

export const uploadStory = async (userId: string, userName: string, userAvatar: string, file?: File | null, text?: string) => {
  try {
    let mediaUrl = null;
    let type = 'text';
    
    if (file) {
      mediaUrl = await uploadMedia(file, 'stories');
      type = file.type.startsWith('video') ? 'video' : 'image';
    }
    
    const now = new Date();
    const expiresAt = new Timestamp(now.getTime() / 1000 + 48 * 60 * 60, 0); // 48 hours from now

    const storyData = {
      authorId: userId,
      authorName: userName,
      authorAvatar: userAvatar,
      ...(mediaUrl ? { mediaUrl } : {}),
      type,
      ...(text ? { text } : {}),
      createdAt: serverTimestamp(),
      expiresAt,
    };

    const docRef = await addDoc(collection(db, 'stories'), storyData);
    return { id: docRef.id, ...storyData };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const subscribeStories = (callback: (stories: Story[]) => void) => {
  const now = new Timestamp(new Date().getTime() / 1000, 0);
  const q = query(
    collection(db, 'stories'), 
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
    callback(stories);
  }, (error) => {
    console.error("Stories subscription error:", error);
  });
};

export const deleteStory = async (storyId: string) => {
  await deleteDoc(doc(db, 'stories', storyId));
};
