import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { followUser, unfollowUser } from '../services/followService';
import { Heart, MessageCircle, UserPlus, AtSign, Bookmark, ArrowLeft, Bell, Play } from 'lucide-react';
import { useAppStore } from '../store';
import { subscribeNotifications } from '../services/notificationService';
import { Notification } from '../types';
import { formatTime } from '../utils';

const getIconForType = (type: string) => {
  switch (type) {
    case 'like': return <div className="bg-red-500 p-1 rounded-full border-2 border-white"><Heart className="w-3 h-3 text-white fill-white" /></div>;
    case 'comment': return <div className="bg-blue-500 p-1 rounded-full border-2 border-white"><MessageCircle className="w-3 h-3 text-white fill-white" /></div>;
    case 'reply': return <div className="bg-blue-400 p-1 rounded-full border-2 border-white"><MessageCircle className="w-3 h-3 text-white" /></div>;
    case 'comment_like': return <div className="bg-red-500 p-1 rounded-full border-2 border-white"><Heart className="w-3 h-3 text-white fill-white" /></div>;
    case 'follow': return <div className="bg-[#0095f6] p-1 rounded-full border-2 border-white"><UserPlus className="w-3 h-3 text-white" /></div>;
    case 'mention': return <div className="bg-purple-500 p-1 rounded-full border-2 border-white"><AtSign className="w-3 h-3 text-white" /></div>;
    case 'favorite': return <div className="bg-yellow-500 p-1 rounded-full border-2 border-white"><Bookmark className="w-3 h-3 text-white fill-white" /></div>;
    default: return <div className="bg-gray-500 p-1 rounded-full border-2 border-white"><Bell className="w-3 h-3 text-white" /></div>;
  }
};

const NotificationItem = React.memo(({ notif }: { notif: Notification }) => {
  const { setViewingUser, pushPage, setViewingMedia, setViewingReel, currentUser, setHighlightedCommentId, setHighlightedPostId } = useAppStore();
  const [isFollowingState, setIsFollowingState] = useState(false);

  const [isActorFollowingMe, setIsActorFollowingMe] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const followRef = doc(db, 'users', currentUser.uid, 'following', notif.actorId);
      const unsub = onSnapshot(followRef, (doc) => setIsFollowingState(doc.exists()));
      
      const actorFollowRef = doc(db, 'users', notif.actorId, 'following', currentUser.uid);
      const unsub2 = onSnapshot(actorFollowRef, (doc) => setIsActorFollowingMe(doc.exists()));
      
      return () => { unsub(); unsub2(); };
    }
  }, [notif.actorId, currentUser]);

  const handleActorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingUser({ uid: notif.actorId, name: notif.actorName, avatar: notif.actorAvatar });
    pushPage('profile');
  };

  const handlePostClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notif.postId) {
      if (notif.type === 'comment' || notif.type === 'reply' || notif.type === 'like' || notif.type === 'comment_like' || notif.type === 'mention') {
        setHighlightedCommentId(notif.targetId);
        setHighlightedPostId(notif.postId);
      }
      
      try {
        const { getPost } = await import('../services/postService');
        const post = await getPost(notif.postId);
        if (post) {
          if (post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video')) {
             setViewingReel({ ...post, single: true });
          } else if (post.media && post.media.length > 0) {
             setViewingMedia({ url: post.media[0], type: 'post', user: { name: post.authorName, avatar: post.authorAvatar } });
          }
        } else if (notif.postMedia) {
           // Fallback if post was deleted
           const type = (notif.postMedia.includes('.mp4') || notif.postMedia.includes('video')) ? 'reel' : 'post';
           if (type === 'reel') {
             setViewingReel({ id: notif.postId, authorId: notif.actorId, authorName: notif.actorName, authorAvatar: notif.actorAvatar, media: [notif.postMedia], text: '', type: 'reel', single: true });
           } else {
             setViewingMedia({ url: notif.postMedia, type: 'post', user: { name: notif.actorName, avatar: notif.actorAvatar } });
           }
        }
      } catch (err) {
        console.error("Failed to load post for notification", err);
      }
    } else {
      handleActorClick(e);
    }
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (isFollowingState) {
        await unfollowUser(currentUser.uid, notif.actorId);
      } else {
        await followUser(currentUser, { uid: notif.actorId, name: notif.actorName, avatar: notif.actorAvatar });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const isFriend = isFollowingState && isActorFollowingMe;

  return (
    <div 
      onClick={handlePostClick}
      className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-blue-50/20' : ''}`}
    >
      <div className="flex items-center flex-1 pr-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0" onClick={handleActorClick}>
          <img 
            src={notif.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.actorName || 'User')}&background=random`} 
            alt="avatar" 
            className="w-11 h-11 rounded-full object-cover border border-gray-100" 
            referrerPolicy="no-referrer" 
          />
          <div className="absolute -bottom-1 -right-1">
            {getIconForType(notif.type)}
          </div>
        </div>

        {/* Text Content */}
        <div className="ml-3 text-[14px] leading-[18px] flex-1">
          <p className="text-gray-900">
            <span className="font-bold cursor-pointer hover:underline" onClick={handleActorClick}>
              {notif.actorName || 'User'}
            </span>
            <span className="ml-1 tracking-tight">
              {notif.type === 'like' && 'liked your post.'}
              {notif.type === 'comment' && `commented: ${notif.content}`}
              {notif.type === 'follow' && 'started following you.'}
              {notif.type === 'mention' && 'mentioned you in a post.'}
              {notif.type === 'reply' && `replied to your comment: ${notif.content}`}
              {notif.type === 'favorite' && 'added your reel to favorites.'}
              {notif.type === 'comment_like' && 'liked your comment.'}
            </span>
          </p>
          <span className="text-gray-400 text-xs font-medium mt-0.5 inline-block">
            {formatTime(notif.createdAt)}
          </span>
        </div>
      </div>
      
      {/* Right Action */}
      <div className="flex-shrink-0 ml-4">
        {notif.type === 'follow' ? (
          <button 
            onClick={handleFollowToggle}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${
               isFriend
                ? 'bg-gray-100 text-gray-500 border border-gray-200' 
                : isFollowingState
                ? 'bg-gray-100 text-gray-900 border border-gray-200'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
            }`}
          >
            {isFriend ? 'Friends' : isFollowingState ? 'Following' : 'Follow back'}
          </button>
        ) : notif.postMedia ? (
          <div className="w-12 h-16 rounded-lg overflow-hidden border border-gray-200 relative bg-black/5 shadow-sm">
            {notif.postMedia.includes('.mp4') || notif.postMedia.includes('video') ? (
              <div className="w-full h-full relative">
                <video 
                  src={notif.postMedia} 
                  className="w-full h-full object-cover" 
                  preload="metadata"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <Play className="w-4 h-4 text-white fill-white shadow-lg" />
                </div>
              </div>
            ) : (
              <img 
                src={notif.postMedia} 
                alt="Post" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                loading="lazy"
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default function Notifications() {
  const { pushPage, currentUser } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeNotifications(currentUser.uid, setNotifications);
    
    // Mark as read when entering the page
    const timer = setTimeout(() => {
      import('../services/notificationService').then(m => m.markAllRead(currentUser.uid));
    }, 2000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [currentUser]);

  const sections = [
    { title: 'New', items: notifications.filter(n => !n.isRead) },
    { title: 'Earlier', items: notifications.filter(n => n.isRead) }
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center">
      {/* Mobile Header */}
      <div className="sm:hidden w-full px-4 py-4 border-b border-gray-100 flex items-center space-x-4 bg-white sticky top-0 z-20">
        <button onClick={() => pushPage('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
      </div>

      <div className="w-full max-w-[600px] py-4 sm:py-8 px-4">
        <h2 className="hidden sm:block text-2xl font-bold text-gray-900 mb-6 px-2">Notifications</h2>
        
        <div className="space-y-6 pb-20">
          {sections.map((group) => group.items.length > 0 && (
            <div key={group.title}>
              <h3 className="font-bold text-[16px] text-gray-900 px-4 mb-3">{group.title}</h3>
              <div className="space-y-1">
                {group.items.map((notif) => (
                  <NotificationItem key={notif.id} notif={notif} />
                ))}
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Bell className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-lg font-medium">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
