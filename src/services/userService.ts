import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

export const findUserByUsername = async (username: string): Promise<User | null> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnapshot = querySnapshot.docs[0];
    return { uid: docSnapshot.id, ...docSnapshot.data() } as User;
  }
  return null;
};
