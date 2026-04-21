import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const requestFirebaseNotificationPermission = async (userId: string) => {
  console.log('Requesting notification permission...');
  
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      try {
        const messaging = getMessaging();
        
        // Suppress getToken if we know we don't have a service worker or valid environment yet
        // A real VAPID key is required in production:
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || null;
        
        if (vapidKey) {
            const currentToken = await getToken(messaging, {
              vapidKey: vapidKey
            }).catch((err) => {
              console.warn('Failed to get FCM token. A real VAPID key is required.', err.message);
              return null;
            });
            
            if (currentToken) {
              console.log('FCM Token generated:', currentToken);
              await updateDoc(doc(db, 'users', userId), {
                fcmToken: currentToken
              });
            }
        } else {
            console.log('No VAPID key configured. Skipping FCM token generation.');
        }
      } catch (err) {
         console.warn('Firebase Messaging not initialized properly. Proceeding without true push notifications.');
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.error('Error getting notification permission', error);
  }
};

export const onMessageListener = () => {
  try {
    const messaging = getMessaging();
    return new Promise((resolve) => {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    });
  } catch (err) {
    // Messaging won't work in iframes or without config, return empty promise
    return new Promise(() => {});
  }
};
