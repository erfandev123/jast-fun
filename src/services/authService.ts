import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { User } from '../types';

export const isUsernameUnique = async (username: string): Promise<boolean> => {
  const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

export const signUp = async (email: string, password: string, name: string, username: string) => {
  try {
    const unique = await isUsernameUnique(username);
    if (!unique) throw new Error('Username already taken');

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const userData: User = {
      uid: firebaseUser.uid,
      name,
      username: username.toLowerCase(),
      email,
      avatar: `https://picsum.photos/seed/${firebaseUser.uid}/150/150`,
      bio: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    return userData;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const docRef = doc(db, 'users', userCredential.user.uid);
    const docSnap = await getDoc(docRef);
    return docSnap.data() as User;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    
    const docRef = doc(db, 'users', firebaseUser.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const username = firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`;
      const userData: User = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        username: username.toLowerCase(),
        email: firebaseUser.email || '',
        avatar: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/150/150`,
        bio: '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, userData);
      return userData;
    }
    
    return docSnap.data() as User;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logout = () => signOut(auth);

export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    const updatedSnap = await getDoc(userRef);
    return updatedSnap.data() as User;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      callback(docSnap.data() as User);
    } else {
      callback(null);
    }
  });
};

export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  if (!searchTerm.trim()) return [];
  const qStr = searchTerm.toLowerCase();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '>=', qStr), where('username', '<=', qStr + '\uf8ff'), limit(10));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as User);
};
