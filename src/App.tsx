import React, { useState, useCallback, memo, useEffect } from 'react';
import { X, Heart, MessageCircle, Share2, Play, ArrowLeft, MoreHorizontal, Send, Bookmark, VolumeX, ChevronUp, ChevronDown, Globe, ImageIcon, UserPlus, MapPin, Share, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Search from './pages/Search';
import Reels from './pages/Reels';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Create from './pages/Create';
import SearchPage from './pages/SearchPage';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import MiniChat from './components/MiniChat';
import { useAppStore } from './store';
import { onAuthChange } from './services/authService';
import { setOnline } from './services/presenceService';
import { deleteStory } from './services/storyService';
import { subscribeReels } from './services/postService';
import { formatTime } from './utils';
import { doc, onSnapshot, collection, query, where, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { ReelItem, SharePortal } from './components/ReelItem';
import { LikesList } from './components/LikesList';
import { AnalyticsModal } from './components/AnalyticsModal';
import { getPost } from './services/postService';
import { EnnvoLogo } from './components/EnnvoLogo';

// Test connection strictly once on boot
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore is in offline mode. Please check your configuration.");
    }
  }
}
testFirestoreConnection();

const InAppToaster = memo(() => {
  const { currentUser, setViewingMedia, setViewingReel, pushPage, setViewingUser, setHighlightedCommentId, setHighlightedPostId, setActiveChat, activeChat } = useAppStore();
  const [toast, setToast] = useState<any | null>(null);
  const initialLoadRef = React.useRef(true);
  const initialMsgLoadRef = React.useRef(true);
  const timeoutRef = React.useRef<any>(null);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'notifications', currentUser.uid, 'items'), (snap) => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return;
      }
      const changes = snap.docChanges();
      changes.forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.createdAt && Date.now() - data.createdAt.toMillis() < 10000) {
             setToast({ id: change.doc.id, ...data });
             if (timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = setTimeout(() => setToast(null), 4000);
          }
        }
      });
    });

    const unsubMsg = onSnapshot(query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.uid)), (snap) => {
      if (initialMsgLoadRef.current) {
        initialMsgLoadRef.current = false;
        return;
      }
      const changes = snap.docChanges();
      changes.forEach(change => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          // If the unread count went up for the current user, show a toast
          // We can check if it has unreadCount for current user
          if (data.unreadCount?.[currentUser.uid] > 0 && data.updatedAt && Date.now() - data.updatedAt.toMillis() < 10000 && activeChat !== change.doc.id) {
             const otherId = data.participantIds.find((id: string) => id !== currentUser.uid);
             const name = data.participantNames?.[otherId] || 'User';
             const avatar = data.participantAvatars?.[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
             setToast({ 
               id: change.doc.id, 
               type: 'message', 
               actorName: name, 
               actorAvatar: avatar, 
               content: data.lastMessage,
               conversationId: change.doc.id
             });
             if (timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = setTimeout(() => setToast(null), 4000);
          }
        }
      });
    });

    return () => { unsub(); unsubMsg(); };
  }, [currentUser, activeChat]);

  if (!toast) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-4 left-0 right-0 z-[200] flex justify-center pointer-events-none px-4"
      >
         <div 
          className="bg-white/95 backdrop-blur-md shadow-2xl border border-gray-100 rounded-2xl flex items-center p-3 sm:p-4 pointer-events-auto cursor-pointer max-w-[90vw] sm:max-w-md w-full transition-all active:scale-95 shadow-blue-900/10"
          onClick={async () => {
             setToast(null);
             if (toast.type === 'message') {
               setActiveChat(toast.conversationId);
               pushPage('messages');
             } else if (toast.postId) {
               try {
                 const post = await getPost(toast.postId);
                 if (toast.type === 'comment' || toast.type === 'reply' || toast.type === 'like' || toast.type === 'comment_like') {
                   setHighlightedPostId(toast.postId);
                   setHighlightedCommentId(toast.targetId);
                 }
                 if (post) {
                   if (post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video')) {
                      setViewingReel({ ...post, single: true });
                   } else if (post.media && post.media.length > 0) {
                      setViewingMedia({ url: post.media[0], type: 'post', user: { name: post.authorName, avatar: post.authorAvatar } });
                   }
                 }
               } catch (e) {
                 console.error(e);
               }
             } else {
               setViewingUser({ uid: toast.actorId, name: toast.actorName, avatar: toast.actorAvatar });
               pushPage('profile');
             }
          }}
        >
          <img src={toast.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(toast.actorName || 'User')}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-white/80" alt="avatar" />
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-[13px] text-gray-900 leading-tight">
              <span className="font-bold mr-1">{toast.actorName || 'User'}</span>
              <span className="text-gray-700 tracking-tight">
                {toast.type === 'message' && `sent a message: ${toast.content}`}
                {toast.type === 'like' && 'liked your post.'}
                {toast.type === 'comment' && `commented: ${toast.content}`}
                {toast.type === 'follow' && 'started following you.'}
                {toast.type === 'mention' && 'mentioned you.'}
                {toast.type === 'favorite' && 'saved your post.'}
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

import { requestFirebaseNotificationPermission, onMessageListener } from './services/messagingService';

export default function App() {
  const { 
    currentPage, pushPage, 
    viewingMedia, setViewingMedia, 
    viewingStory, setViewingStory, 
    viewingReel, setViewingReel, 
    viewingReelContext, setViewingReelContext,
    activeChat, showCreatePost, 
    isAuthenticated, isAuthLoading, 
    currentUser, setCurrentUser, 
    setNotificationCount,
    setMessageCount
  } = useAppStore();

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        // App mounts underneath and caches feed/reels aggressively.
        // Cap splash screen at 1.2s to be ultra fast on low end devices.
        const timer = setTimeout(() => setShowSplash(false), 1200);
        return () => clearTimeout(timer);
      } else {
        setShowSplash(false);
      }
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    // Request push notification permission
    requestFirebaseNotificationPermission(currentUser.uid);
    onMessageListener().then(payload => {
      console.log('Received foreground message', payload);
      // You could use custom events to show toast here if needed
    });

    const unsubscribeNotifs = onSnapshot(query(collection(db, 'notifications', currentUser.uid, 'items'), where('isRead', '==', false)), (snap) => {
      setNotificationCount(snap.size);
    });

    const unsubscribeMessages = onSnapshot(query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.uid)), (snap) => {
      let total = 0;
      const state = useAppStore.getState();
      const currentActiveChat = state.activeChat;

      snap.docs.forEach(doc => {
        const data = doc.data();
        const unreadForUser = data.unreadCount?.[currentUser.uid] || 0;
        
        if (currentActiveChat === doc.id && unreadForUser > 0) {
          // If we are currently looking at this chat, clear the unread count instead of adding it
          import('./services/chatService').then(m => m.markConversationRead(doc.id, currentUser.uid));
        } else {
          total += unreadForUser;
        }
      });
      setMessageCount(total);
    });

    return () => {
      unsubscribeNotifs();
      unsubscribeMessages();
    };
  }, [isAuthenticated, currentUser, setNotificationCount, setMessageCount]);
  
  const [realReels, setRealReels] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeReels((reels) => {
      setRealReels(reels.slice(0, 50));
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      if (user) {
        setOnline(user.uid);
      }
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

  const isNavHidden = currentPage === 'create' || 
    currentPage === 'edit-profile' ||
    currentPage === 'settings' ||
    showCreatePost || 
    !!viewingStory || 
    !!viewingMedia || 
    !!viewingReel || 
    (currentPage === 'messages' && activeChat !== null && window.innerWidth < 768) ||
    ((currentPage === 'search' || currentPage === 'notifications') && window.innerWidth < 768);

  const isReelsPage = currentPage === 'reels';

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home />;
      case 'search': return <SearchPage />;
      case 'reels': return <Reels />;
      case 'messages': return <Messages />;
      case 'notifications': return <Notifications />;
      case 'create': return <Create />;
      case 'profile': return <Profile />;
      case 'edit-profile': return <EditProfile />;
      case 'settings': return <Settings />;
      default: return <Home />;
    }
  };

  // Splash screen removed as blocking mechanism, only displayed as overlay
  if (!isAuthenticated && !showSplash && !isAuthLoading) {
    return <Auth />;
  }

  return (
    <div className={`flex h-screen w-full text-black overflow-hidden font-sans relative transition-colors duration-1000 ${isReelsPage ? 'bg-black' : 'bg-white'}`}>
      <AnimatePresence>
        {(showSplash || isAuthLoading) && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 1, type: "spring", stiffness: 100, damping: 20 }}
              className="flex flex-col items-center justify-center"
            >
              <div className="w-24 h-24 rounded-3xl overflow-hidden mb-6 shadow-[0_8px_30px_rgb(59,130,246,0.25)] border border-gray-100 flex-shrink-0">
                <EnnvoLogo className="w-full h-full" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm mb-1">
                Ennvo
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isNavHidden && (
        <div className="hidden md:flex">
          <Sidebar currentPage={currentPage} />
        </div>
      )}
      <main className={`flex-1 h-full overflow-hidden relative ${!isNavHidden ? 'pb-[60px] md:pb-0' : ''}`}>
        {renderPage()}
      </main>
      {!isNavHidden && <BottomNav />}

      {/* Global Media Viewer */}
      {viewingMedia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <button onClick={() => setViewingMedia(null)} className="absolute top-4 right-4 md:top-6 md:right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white z-50 backdrop-blur-md">
            <X className="w-6 h-6" />
          </button>
          
          <div className="w-full h-full flex flex-col relative overflow-hidden">
            {viewingMedia.user && (
              <div className="absolute top-4 left-4 flex items-center space-x-3 bg-black/40 backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-full border border-white/10 z-20">
                <img 
                  src={viewingMedia.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingMedia.user.name)}&background=random`} 
                  className="w-9 h-9 rounded-full border-2 border-white/80 object-cover" 
                  alt="Avatar" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-white font-bold text-[14px] drop-shadow-md">{viewingMedia.user.name}</span>
              </div>
            )}
            
            <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-auto no-scrollbar">
              <motion.img 
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.1}
                whileTap={{ scale: 1.2 }}
                src={viewingMedia.url} 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-zoom-in" 
                alt="Media content" 
              />
              {viewingMedia.type === 'reel' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Story Viewer */}
      {viewingStory && (
        <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />
      )}

      <InAppToaster />
      <LikesList />
      <ViewsList />
      <AnalyticsModal />
      <MiniChat />

      {/* Global Reel Viewer (Modal) */}
      {viewingReel && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-200">
          <div id="global-reels-container" className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory no-scrollbar overscroll-none overflow-x-hidden">
            {/* If we have a specific reel to view (e.g. from notification), show it first or alone */}
            {viewingReel.single ? (
              <ReelItem key={viewingReel.id} reel={viewingReel as any} isModal onClose={() => setViewingReel(null)} />
            ) : (
              (() => {
                const reelsList = viewingReelContext && viewingReelContext !== 'all' ? realReels.filter(r => r.authorId === viewingReelContext) : realReels;
                const activeIndex = viewingReel ? reelsList.findIndex(r => r.id === viewingReel.id) : 0;
                const sortedReels = activeIndex > -1 ? [...reelsList.slice(activeIndex), ...reelsList.slice(0, activeIndex)] : reelsList;

                if (sortedReels.length === 0) {
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center text-white bg-black">
                      <p className="mb-4">No reels found</p>
                      <button onClick={() => setViewingReel(null)} className="px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">Close</button>
                    </div>
                  );
                }

                return sortedReels.map((reel) => (
                  <ReelItem key={reel.id} reel={reel} isModal onClose={() => setViewingReel(null)} />
                ));
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewsList() {
  const { showViewsList, setShowViewsList, targetViewsPostId, setTargetViewsPostId, setViewingUser, pushPage } = useAppStore();
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showViewsList && targetViewsPostId) {
      setLoading(true);
      const fetchViewers = async () => {
        try {
          const { getDocs, collection, doc, getDoc } = await import('firebase/firestore');
          const viewsCol = collection(db, 'posts', targetViewsPostId, 'views');
          const snapshot = await getDocs(viewsCol);
          const userIds = snapshot.docs.map(d => d.id);
          
          const userPromises = userIds.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            const data = userDoc.data();
            return data ? { uid, ...data } : null;
          });
          
          const users = (await Promise.all(userPromises)).filter(Boolean);
          setViewers(users as any[]);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchViewers();
    }
  }, [showViewsList, targetViewsPostId]);

  return (
    <AnimatePresence>
      {showViewsList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowViewsList(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm h-full max-h-[500px] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-white">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-blue-500 fill-blue-500" />
                <h3 className="font-black text-gray-900 tracking-tight">Views</h3>
              </div>
              <button onClick={() => setShowViewsList(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-400">Loading viewers...</p>
                </div>
              ) : viewers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Globe className="w-12 h-12 opacity-10 mb-2" />
                  <p className="text-sm">No views yet</p>
                </div>
              ) : (
                viewers.map((user) => (
                  <div key={user.uid} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer" onClick={() => { setViewingUser(user); pushPage('profile'); setShowViewsList(false); }}>
                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-11 h-11 rounded-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                    <span className="font-bold text-gray-900">{user.name}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const StoryViewer = memo(({ story, onClose }: { story: any, onClose: () => void }) => {
  const [progress, setProgress] = useState(0);
  const { currentUser } = useAppStore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(15000); // Default 15s
  const [replyText, setReplyText] = useState('');
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  const handleDelete = async () => {
    import('./services/storyService').then(s => s.deleteStory(story.id));
    onClose();
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !currentUser || currentUser.uid === story.authorId) return;
    try {
      const { createConversation, sendMessage } = await import('./services/chatService');
      const convId = await createConversation(
        [currentUser.uid, story.authorId],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [story.authorId]: { name: story.authorName || story.name, avatar: story.authorAvatar || story.avatar }
        }
      );
      await sendMessage(convId, currentUser.uid, 'text', replyText, undefined, undefined, {
         id: story.id, content: story.text || 'Viewed your story', type: story.type || 'story', mediaUrl: story.mediaUrl || story.bg
      });
      setReplyText('');
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReact = async () => {
    if (!currentUser || currentUser.uid === story.authorId) return;
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 1000);
    try {
      const { createConversation, sendMessage } = await import('./services/chatService');
      const convId = await createConversation(
        [currentUser.uid, story.authorId],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [story.authorId]: { name: story.authorName || story.name, avatar: story.authorAvatar || story.avatar }
        }
      );
      await sendMessage(convId, currentUser.uid, 'text', '❤️ Reacted to your story', undefined, undefined, {
         id: story.id, content: story.text || 'Story context', type: story.type || 'story', mediaUrl: story.mediaUrl || story.bg
      });
    } catch (e) {}
  };

  useEffect(() => {
    let interval: any;
    const startTime = Date.now();
    
    interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / duration) * 100;
      if (newProgress >= 100) {
        clearInterval(interval);
        onClose();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onClose, duration]);

  const onVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration * 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 z-10 pointer-events-none"></div>
      
      <button onClick={onClose} className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white z-50 backdrop-blur-md border border-white/20 active:scale-90">
        <X className="w-6 h-6" />
      </button>

      <div className="w-full h-full sm:h-[90vh] sm:max-w-[450px] bg-black sm:rounded-[2.5rem] overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="absolute top-4 left-4 right-4 flex space-x-1 z-30">
          <div className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden">
            <div 
              className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-50" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="absolute top-10 left-4 right-4 flex items-center justify-between z-30">
          <div className="flex items-center space-x-3">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
              <img 
                src={story.authorAvatar || story.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName || story.name)}&background=random`} 
                className="w-10 h-10 rounded-full border-2 border-black object-cover" 
                alt="Avatar" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-[15px] drop-shadow-md">{story.authorName || story.name}</span>
              <span className="text-white/70 text-[12px] font-medium drop-shadow-sm">{story.createdAt ? formatTime(story.createdAt) : 'Just now'}</span>
            </div>
          </div>
          {currentUser?.uid === story.authorId && (
            <button onClick={handleDelete} className="p-2 bg-black/20 hover:bg-red-500/40 rounded-full transition-colors text-white backdrop-blur-md">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {story.type === 'video' || (story.mediaUrl && (story.mediaUrl.includes('.mp4') || story.mediaUrl.includes('video'))) ? (
          <video 
            ref={videoRef}
            src={story.mediaUrl || story.bg} 
            autoPlay 
            playsInline 
            preload="metadata"
            onLoadedMetadata={onVideoLoaded}
            className="w-full h-full object-cover" 
          />
        ) : (
          <img 
            src={story.mediaUrl || story.bg || `https://picsum.photos/seed/${story.id}/800/1600`} 
            className="w-full h-full object-cover" 
            alt="Story content" 
            referrerPolicy="no-referrer"
          />
        )}
        
        {story.text && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pointer-events-none">
            <h2 className="text-white text-3xl sm:text-4xl font-black text-center drop-shadow-2xl bg-black/40 px-6 py-4 rounded-3xl backdrop-blur-sm leading-tight">
              {story.text}
            </h2>
          </div>
        )}
        
        
        {showHeartAnim && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-[60] pointer-events-none">
            <Heart className="w-48 h-48 text-red-500 fill-red-500 scale-150 animate-ping opacity-0" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center space-x-2 sm:space-x-4 z-30 pb-safe">
          <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 sm:px-5 py-2 sm:py-3 flex items-center">
            <input 
              type="text" 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendReply();
              }}
              placeholder={`Reply to ${story.authorName || story.name}...`} 
              className="flex-1 bg-transparent text-white placeholder-white/60 text-[13px] sm:text-[15px] focus:outline-none font-medium" 
            />
          </div>
          <button onClick={handleReact} className="p-2 sm:p-3 text-white hover:text-red-500 transition-colors active:scale-110 shrink-0"><Heart className="w-6 h-6 sm:w-7 sm:h-7" /></button>
          <button onClick={handleSendReply} className="p-2 sm:p-3 text-white hover:text-blue-400 transition-colors active:scale-110 shrink-0"><Send className="w-6 h-6 sm:w-7 sm:h-7" /></button>
        </div>
      </div>
    </div>
  );
});

const GlobalReelItem = memo(({ reel }: { reel: any }) => {
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number, x: number, y: number, color: string }[]>([]);
  const { setViewingUser, setCurrentPage, setViewingReel, currentUser } = useAppStore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'posts', reel.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
      }
    });

    if (currentUser) {
      import('firebase/firestore').then(m => {
        const likeRef = m.doc(db, 'posts', reel.id, 'likes', currentUser.uid);
        const favRef = m.doc(db, 'users', currentUser.uid, 'favorites', reel.id);
        const followRef = m.doc(db, 'users', currentUser.uid, 'following', reel.authorId || reel.authorUID);

        m.onSnapshot(likeRef, (s) => setLiked(s.exists()));
        m.onSnapshot(favRef, (s) => setSaved(s.exists()));
        m.onSnapshot(followRef, (s) => setIsFollowingUser(s.exists()));
      });
    }
    return () => unsub();
  }, [reel.id, currentUser]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPlaying(true);
            import('./services/postService').then(m => m.incrementViewCount(reel.id, currentUser?.uid || 'anonymous'));
          } else {
            setPlaying(false);
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
            }
          }
        });
      },
      { threshold: 0.8 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reel.id]);

  useEffect(() => {
    if (videoRef.current) {
      if (playing) videoRef.current.play().catch(() => setPlaying(false));
      else videoRef.current.pause();
    }
  }, [playing]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      const { toggleLike } = await import('./services/postService');
      const { sendNotification } = await import('./services/notificationService');
      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
      await toggleLike(reel.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(reel.authorId || reel.authorUID, 'like', currentUser, reel.id, reel.id, reel.media?.[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.detail === 1) {
      setPlaying(!playing);
    } else {
      const colors = ['#ff0000', '#ff69b4', '#ff1493', '#ff4500', '#ff8c00', '#00ff00', '#00ffff', '#ffff00'];
      const newHeart = {
        id: Date.now() + Math.random(),
        x,
        y,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      setFloatingHearts(prev => [...prev, newHeart]);
      if (!liked) handleLike();
      setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id)), 1000);
    }
  };

  const isCurrentUser = currentUser?.uid === (reel.authorId || reel.authorUID);
  const { setHighlightedCommentId, highlightedCommentId, highlightedPostId, setHighlightedPostId } = useAppStore();

  useEffect(() => {
    if (highlightedPostId === reel.id && highlightedCommentId && currentUser) {
      setShowComments(true);
    }
  }, [highlightedCommentId, highlightedPostId, reel.id, currentUser]);

  useEffect(() => {
    return () => {
      if (highlightedPostId === reel.id) {
        setHighlightedPostId(null);
        setHighlightedCommentId(null);
      }
    };
  }, [reel.id, highlightedPostId, setHighlightedPostId, setHighlightedCommentId]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      const { deletePost } = await import('./services/postService');
      await deletePost(reel.id, currentUser!.uid);
      setViewingReel(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full snap-start snap-always flex items-center justify-center relative">
      {/* Main Video Container - Slim/Compact */}
      <div 
        onClick={handleVideoClick}
        className="relative w-full h-full sm:h-[90%] sm:max-h-[850px] sm:w-[340px] aspect-[9/16] bg-black sm:rounded-[40px] overflow-hidden flex shadow-2xl shrink-0 border border-white/5 cursor-pointer"
      >
          <video 
            ref={videoRef}
            src={reel.media?.[0]} 
            loop 
            muted={muted}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            className={`w-full h-full object-contain transition-opacity duration-200 ${playing ? 'opacity-100' : 'opacity-80'}`}
          />
          
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <Play className="w-24 h-24 text-white/90 fill-white/90 drop-shadow-2xl" />
            </div>
          )}

          <AnimatePresence>
            {floatingHearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 2.5, y: -200, rotate: (Math.random() - 0.5) * 60 }}
                className="absolute z-50 pointer-events-none"
                style={{ left: heart.x - 20, top: heart.y - 20 }}
              >
                <Heart className="w-12 h-12 fill-current drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ color: heart.color }} />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none"></div>
          
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
            <div className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-50" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="absolute bottom-6 left-6 right-16 z-10">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); setViewingReel(null); setCurrentPage('profile'); }}
                src={reel.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.authorName || 'User')}&background=random`} 
                className="w-11 h-11 rounded-full border-2 border-white shadow-lg object-cover cursor-pointer" 
                alt="avatar" 
                referrerPolicy="no-referrer"
              />
              <span onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); setViewingReel(null); setCurrentPage('profile'); }} className="text-white font-bold text-[16px] drop-shadow-lg cursor-pointer">{reel.authorName}</span>
              {!isCurrentUser && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!currentUser) return;
                    const { followUser, unfollowUser } = await import('./services/followService');
                    if (isFollowingUser) {
                      await unfollowUser(currentUser.uid, reel.authorId || reel.authorUID);
                    } else {
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[13px] font-bold transition-all backdrop-blur-md border ${isFollowingUser ? 'bg-white/10 border-white/30 text-white' : 'bg-white border-white text-black'}`}
                >
                  {isFollowingUser ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="text-white text-[14px] leading-relaxed drop-shadow-lg font-medium mb-4 line-clamp-3">
              {reel.text}
            </p>
          </div>

          <div 
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
            className="absolute bottom-4 right-4 p-2 bg-black/40 rounded-full backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors z-20"
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
          </div>

          <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-7 z-20">
            <button onClick={(e) => { e.stopPropagation(); handleLike(); }} className="flex flex-col items-center group">
              <Heart className={`w-[28px] h-[28px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-transform active:scale-125 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
              <span className="text-xs font-black mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{likesCount}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center group">
              <MessageCircle className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
              <span className="text-xs font-black mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{commentsCount}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center group">
              <Share className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
            </button>
            {isCurrentUser && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className={`flex flex-col items-center group ${confirmDelete ? 'text-red-600' : 'text-red-500'}`}>
                <Trash2 className="w-[28px] h-[28px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
                <span className="text-[9px] font-black mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight text-center">{confirmDelete ? 'Confirm?' : ''}</span>
              </button>
            )}
          </div>

          {showComments && (
            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 h-[70%] z-50 bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-300 flex flex-col shadow-2xl">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1"></div>
              <div className="flex items-center justify-between p-4 border-b border-gray-50">
                <span className="font-bold text-gray-900">Comments</span>
                <button onClick={() => setShowComments(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <CommentsFeed postId={reel.id} />
              </div>
            </div>
          )}
          {showShare && (
            <SharePortal reel={reel} onClose={() => setShowShare(false)} />
          )}
        </div>
      </div>
  );
});

const CommentsFeed = ({ postId }: { postId: string }) => {
  const [comments, setComments] = useState<any[]>([]);
  const { currentUser } = useAppStore();

  useEffect(() => {
    import('./services/postService').then(m => m.getComments(postId)).then(setComments);
  }, [postId]);

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    try {
      const { deleteComment } = await import('./services/postService');
      await deleteComment(postId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
    }
  };

  if (comments.length === 0) return <div className="text-center text-gray-400 py-10">No comments yet</div>;

  return (
    <>
      {comments.map(comment => (
        <div key={comment.id} className="flex space-x-3 group relative">
          <img src={comment.authorAvatar} className="w-8 h-8 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <p className="text-[13px] font-bold text-gray-900">{comment.authorName}</p>
              {currentUser?.uid === comment.authorId && (
                <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-gray-400 hover:text-red-500 uppercase font-bold">Delete</button>
              )}
            </div>
            <p className="text-[14px] text-gray-800 leading-snug">{comment.text}</p>
          </div>
        </div>
      ))}
    </>
  );
};
