import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Video, Phone, MoreVertical, Image as ImageIcon, Mic, Smile, Plus, ArrowLeft, Check, CheckCheck, Info, ChevronDown, Send, X, Heart, Type, Music, MoreHorizontal, UserPlus, Bell, MessageCircle, Play, Reply, Trash2, UserSquare, Palette, ChevronRight, EyeOff, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeNotifications } from '../services/notificationService';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { uploadMedia } from '../services/githubStorage';

import { useAppStore } from '../store';
import { safeFile } from '../utils';
import EnnvoLogo from '../assets/Ennvo.png';
import { subscribeConversations, subscribeMessages, sendMessage, createConversation } from '../services/chatService';
import { subscribePresence, setTyping, subscribeTyping } from '../services/presenceService';
import { followUser } from '../services/followService';
import { Conversation, Message as AppMessage, Notification } from '../types';

const FollowerItem = React.memo(({ follower, currentUser, onFollowBack }: { follower: any, currentUser: any, onFollowBack: (f: any) => void }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  // They are in our followers list, so they follow us by definition
  const followsMe = true; 
  const { setViewingUser, pushPage } = useAppStore();

  useEffect(() => {
    if (currentUser && follower.id) {
       const followRef = doc(db, 'users', currentUser.uid, 'following', follower.id);
       return onSnapshot(followRef, (d) => setIsFollowing(d.exists()));
    }
  }, [currentUser, follower.id]);

  const isFriend = isFollowing && followsMe;

  return (
    <div 
      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all"
      onClick={() => { setViewingUser({ uid: follower.id, name: follower.name || 'User', avatar: follower.avatar }); pushPage('profile'); }}
    >
      <div className="flex items-center space-x-3">
        <img 
          src={follower.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(follower.name || 'User')}&background=random`} 
          className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100" 
          alt="follower" 
          referrerPolicy="no-referrer" 
        />
        <div>
          <p className="font-bold text-[15px] text-gray-900">{follower.name || 'New Follower'}</p>
          <p className="text-[12px] text-gray-500">Started following you</p>
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onFollowBack(follower); }}
        className={`px-5 py-1.5 rounded-lg text-[13px] font-bold transition-all active:scale-95 shadow-sm ${
          isFriend 
            ? 'bg-gray-100 text-gray-500 border border-gray-200' 
            : isFollowing 
            ? 'bg-gray-100 text-gray-900 border border-gray-200' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow back'}
      </button>
    </div>
  );
});

export default function Messages() {
  const { chatTheme, setChatTheme, setViewingUser, viewingStory, setViewingStory, activeChat, setActiveChat, currentUser, pushPage, lastCheckedActivity, setLastCheckedActivity, lastCheckedFollowers, setLastCheckedFollowers, setViewingReel, setViewingReelContext, setViewingMedia } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesCache, setMessagesCache] = useState<Record<string, any[]>>({});
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presenceData, setPresenceData] = useState<{ [uid: string]: { isOnline: boolean, lastSeen: number } }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [userDataCache, setUserDataCache] = useState<{ [uid: string]: { name: string, avatar: string } }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string } | null>(null);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyImage, setStoryImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const storyImageInputRef = useRef<HTMLInputElement>(null);
  const [lastSeenFollowers, setLastSeenFollowers] = useState(0);
  const [replyingTo, setReplyingTo] = useState<AppMessage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageLimit, setMessageLimit] = useState(20);
  const isPaginatingRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);
  
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const durationIntervalRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        
        try {
          if (activeChat && activeChat !== 'followers' && activeChat !== 'activity' && currentUser) {
            const dataUrl = await uploadMedia(audioFile, 'voice');
            sendMessage(activeChat, currentUser.uid, 'voice', 'Sent a voice message', dataUrl).catch(console.error);
          }
        } catch (error) {
          console.error("Voice upload failed:", error);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Prevent the send logic from firing
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || activeChat === 'followers' || activeChat === 'activity' || !currentUser) return;
    
    // Convert to a downscaled base64 image immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        sendMessage(activeChat, currentUser.uid, 'image', 'Sent an image', dataUrl).catch(console.error);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const saved = localStorage.getItem('last_seen_followers');
    if (saved) setLastSeenFollowers(parseInt(saved));
  }, []);

  useEffect(() => {
    if (activeChat === 'activity' && currentUser) {
      import('../services/notificationService').then(m => m.markAllRead(currentUser.uid));
      setLastCheckedActivity(Date.now());
    }
    if (activeChat === 'followers' && followers.length > 0) {
      setLastCheckedFollowers(followers.length);
    }
  }, [activeChat, currentUser, followers.length]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeConversations(currentUser.uid, setConversations);
    const unsubscribeNotifs = subscribeNotifications(currentUser.uid, setNotifications);
    
    // Fetch followers for the followers tab
    const q = query(collection(db, 'users', currentUser.uid, 'followers'), orderBy('createdAt', 'desc'));
    const unsubscribeFollowers = onSnapshot(q, async (snapshot) => {
      const { getDoc, doc } = await import('firebase/firestore');
      const followerData = await Promise.all(snapshot.docs.map(async (docRef) => {
        const data = docRef.data();
        // If data is missing (old follow), fetch it
        if (!data.name || !data.avatar) {
          const userSnap = await getDoc(doc(db, 'users', docRef.id));
          if (userSnap.exists()) {
            return { id: docRef.id, ...data, ...userSnap.data() };
          }
        }
        return { id: docRef.id, ...data };
      }));
      setFollowers(followerData);
    });

    return () => {
      unsubscribe();
      unsubscribeNotifs();
      unsubscribeFollowers();
    };
  }, [currentUser]);

  // Fetch missing user data for conversations
  useEffect(() => {
    conversations.forEach(async (conv) => {
      const otherId = conv.participantIds?.find(id => id !== currentUser?.uid);
      if (otherId && (!conv.participantNames?.[otherId] || !conv.participantAvatars?.[otherId])) {
        if (!userDataCache[otherId]) {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', otherId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserDataCache(prev => ({ ...prev, [otherId]: { name: data.name, avatar: data.avatar } }));
          }
        }
      }
    });
  }, [conversations, currentUser, userDataCache]);

  useEffect(() => {
    if (!activeChat || activeChat === 'followers' || activeChat === 'activity') return;
    
    if (messagesCache[activeChat]) {
      setMessages(messagesCache[activeChat]);
    }

    if (currentUser) {
      import('../services/chatService').then(m => m.markConversationRead(activeChat, currentUser.uid));
    }
    
    const unsubscribe = subscribeMessages(activeChat, messageLimit, (newMsgs) => {
      setMessages(newMsgs);
      setMessagesCache(prev => ({ ...prev, [activeChat]: newMsgs }));
    });
    const unsubscribeTyping = subscribeTyping(activeChat, (users) => {
      setTypingUsers(users.filter(uid => uid !== currentUser?.uid));
    });
    return () => {
      unsubscribe();
      unsubscribeTyping();
    };
  }, [activeChat, currentUser]);

  useEffect(() => {
    conversations.forEach(conv => {
      const otherId = conv.participantIds.find(id => id !== currentUser?.uid);
      if (otherId && !presenceData[otherId]) {
        subscribePresence(otherId, (data) => {
          setPresenceData(prev => ({ ...prev, [otherId]: data }));
        });
      }
    });
  }, [conversations, currentUser]);

  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const swipeHandledRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState<{ [msgId: string]: number }>({});

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipeHandledRef.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent, msg: any) => {
    if (touchStartRef.current !== null && !swipeHandledRef.current) {
      const diffX = e.touches[0].clientX - touchStartRef.current.x;
      const diffY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      
      if (diffY > 15 && diffY > diffX * 0.5) {
        // Vertical scroll dominant, cancel swipe
        touchStartRef.current = null;
        setSwipeOffset(prev => ({ ...prev, [msg.id]: 0 }));
        return;
      }
      
      if (diffX > 10 && diffX > diffY) {
        setSwipeOffset(prev => ({ ...prev, [msg.id]: Math.min(diffX, 80) }));
        if (diffX > 60) {
          setReplyingTo(msg);
          swipeHandledRef.current = true;
          // Quickly revert swipe position
          setTimeout(() => {
            setSwipeOffset(prev => ({ ...prev, [msg.id]: 0 }));
          }, 50);
          touchStartRef.current = null;
        }
      }
    }
  };
  const handleTouchEnd = (msgId: string) => {
    touchStartRef.current = null;
    swipeHandledRef.current = false;
    setSwipeOffset(prev => ({ ...prev, [msgId]: 0 }));
  };

  const handleLongPress = (e: React.UIEvent, msgId: string) => {
    e.preventDefault();
    const x = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    setContextMenu({ x: Math.min(x, window.innerWidth - 200), y: Math.min(y, window.innerHeight - 250), msgId });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || activeChat === 'followers' || activeChat === 'activity' || !currentUser) return;

    const replyData = replyingTo ? { id: replyingTo.id, content: replyingTo.content, senderId: replyingTo.senderId, type: replyingTo.type, mediaUrl: replyingTo.mediaUrl } : undefined;

    try {
      await sendMessage(activeChat, currentUser.uid, 'text', inputText, undefined, undefined, replyData);
      setInputText('');
      setReplyingTo(null);
      setTyping(activeChat, currentUser.uid, false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (activeChat && activeChat !== 'followers' && activeChat !== 'activity' && currentUser) {
      setTyping(activeChat, currentUser.uid, e.target.value.length > 0);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    let x = e.clientX;
    let y = e.clientY;
    
    const menuWidth = 200; 
    const menuHeight = 240; 
    
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
     
    setContextMenu({ x, y, msgId });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleFollowBack = async (follower: any) => {
    if (!currentUser) return;
    try {
      await followUser(currentUser, { uid: follower.id, name: follower.name, avatar: follower.avatar });
    } catch (error) {
      console.error(error);
    }
  };

  const handleScrollMessages = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0) {
      if (messages.length >= messageLimit) {
        isPaginatingRef.current = true;
        setMessageLimit(prev => prev + 20);
      }
    }
  }, [messages.length, messageLimit]);

  const activeConversation = conversations.find(c => c.id === activeChat);
  const otherParticipantId = activeConversation?.participantIds?.find(id => id !== currentUser?.uid);
  const activeContact = activeConversation ? {
    id: activeConversation.id,
    uid: otherParticipantId,
    name: (activeConversation.participantNames || {})[otherParticipantId || ''] || userDataCache[otherParticipantId || '']?.name || 'User',
    avatar: (activeConversation.participantAvatars || {})[otherParticipantId || ''] || userDataCache[otherParticipantId || '']?.avatar || `https://ui-avatars.com/api/?name=User&background=random`,
    online: presenceData[otherParticipantId || '']?.isOnline || false,
    lastSeen: presenceData[otherParticipantId || '']?.lastSeen || 0
  } : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    if (isPaginatingRef.current && messages.length > prevMessagesLengthRef.current) {
      // If we paginated, do not scroll down
      isPaginatingRef.current = false;
      
      // Attempt to restore scroll position roughly to where old messages started
      if (messagesScrollRef.current) {
         messagesScrollRef.current.scrollTop = 50; // just slightly below top so it doesn't instantly retrigger
      }
    } else {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, typingUsers]);

  const isSpecialChat = activeChat === 'followers' || activeChat === 'activity';

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  const renderedMessages = React.useMemo(() => messages.map((msg, idx) => {
    const isMe = msg.senderId === currentUser?.uid;
    const prevMsg = messages[idx - 1];
    const nextMsg = messages[idx + 1];
    const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
    const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

    const offset = swipeOffset[msg.id] || 0;

    let borderRadius = 'rounded-3xl';
    if (isMe) {
      if (!isFirstInGroup && !isLastInGroup) borderRadius = 'rounded-3xl rounded-tr-md rounded-br-md';
      else if (!isFirstInGroup && isLastInGroup) borderRadius = 'rounded-3xl rounded-tr-md';
      else if (isFirstInGroup && !isLastInGroup) borderRadius = 'rounded-3xl rounded-br-md';
    } else {
      if (!isFirstInGroup && !isLastInGroup) borderRadius = 'rounded-3xl rounded-tl-md rounded-bl-md';
      else if (!isFirstInGroup && isLastInGroup) borderRadius = 'rounded-3xl rounded-tl-md';
      else if (isFirstInGroup && !isLastInGroup) borderRadius = 'rounded-3xl rounded-bl-md';
    }

    return (
      <div 
        key={msg.id}
        id={`msg-${msg.id}`}
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'} group relative touch-pan-y will-change-transform`}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => handleTouchMove(e, msg)}
        onTouchEnd={() => handleTouchEnd(msg)}
        onContextMenu={(e) => handleLongPress(e, msg.id)}
      >
        {/* Swipe Reply Indicator */}
        {offset > 20 && !isMe && (
          <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-60">
            <Reply className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {!isMe && isLastInGroup && (
          <img src={activeContact?.avatar} className="w-7 h-7 rounded-full mr-2 self-end mb-1 shadow-sm object-cover" alt="Avatar" />
        )}
        {!isMe && !isLastInGroup && <div className="w-9"></div>}
        
        {isMe && (
          <div className="hidden sm:group-hover:flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
             <button onClick={() => setReplyingTo(msg as any)} className="p-1.5 hover:bg-black/5 rounded-full"><Reply className="w-4 h-4 text-gray-400 cursor-pointer" /></button>
          </div>
        )}

        <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
          <div 
            onContextMenu={(e) => handleContextMenu(e, msg.id)}
            onDoubleClick={async (e) => {
              e.stopPropagation();
              if (activeChat) {
                try {
                  const { updateDoc, doc } = await import('firebase/firestore');
                  await updateDoc(doc(db, 'conversations', activeChat, 'messages', msg.id), {
                    reaction: (msg as any).reaction === '❤️' ? null : '❤️'
                  });
                } catch (err) {}
              }
            }}
            className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full select-none`}
          >
            {/* Reply preview inside message bubble if it's a reply */}
            {msg.replyTo && (
               <div 
                 className={`mb-1 px-2 py-1 rounded-md text-[11px] opacity-80 border-l-[3px] border-white/50 cursor-pointer hover:opacity-100 transition-opacity max-w-full flex items-center ${isMe ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-800 border-gray-400'}`}
                 onClick={() => {
                   const el = document.getElementById(`msg-${msg.replyTo.id}`);
                   if (el) {
                     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     el.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                     setTimeout(() => el.style.backgroundColor = '', 2000);
                   }
                 }}
               >
                  <div className="flex-1 min-w-0 pr-1">
                    {msg.replyTo.type === 'reel' ? (
                      <div className="flex items-center space-x-1.5">
                        <Play className={`w-3 h-3 ${isMe ? 'text-white' : 'text-gray-500'}`} />
                        <span className="font-medium">Reel</span>
                      </div>
                    ) : (
                      <p className="line-clamp-1 italic text-ellipsis break-words opacity-90 max-w-[250px] leading-tight">"{msg.replyTo.content}"</p>
                    )}
                  </div>
                  {msg.replyTo.type === 'reel' && msg.replyTo.mediaUrl && (
                     <div className="w-6 h-8 rounded shrink-0 overflow-hidden ml-1">
                       <video src={`${msg.replyTo.mediaUrl}#t=0.001`} className="w-full h-full object-cover pointer-events-none" preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                     </div>
                  )}
               </div>
            )}
            <div className="max-w-full relative">
              {(() => {
                const contentStr = msg.content.trim();
                const hasText = /[a-zA-Z0-9]/.test(contentStr);
                const isEmojiOnly = !hasText && contentStr.length > 0 && contentStr.length <= 15;
                
                if (msg.type === 'reel') {
                  return (
                    <div className="relative w-48 aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer shadow-md bg-black group"
                        onClick={() => {
                          import('../services/postService').then(s => s.getPost(msg.postId)).then(reel => {
                              if(reel) {
                                setViewingReel({ ...reel, single: true });
                                setViewingReelContext('chat');
                              }
                          });
                        }}>

                        <video src={`${msg.mediaUrl}#t=0.001`} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform pointer-events-none" preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10">
                           <div className="bg-black/60 p-3 rounded-full mb-3">
                             <Play className="w-8 h-8 text-white fill-white drop-shadow-md" />
                           </div>
                           <span className="text-white font-bold text-[13px] drop-shadow-md bg-black/60 px-3 py-1.5 rounded-xl border border-white/10 line-clamp-2">{msg.content}</span>
                        </div>
                    </div>
                  );
                } else if (msg.type === 'voice') {
                  return (
                     <div className={`px-4 py-2 flex items-center space-x-3 shadow-sm ${borderRadius} ${isMe ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-gray-100 text-gray-900 border border-gray-100'}`}>
                       <button onClick={() => {
                         const audio = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                         if (audio) {
                           if (audio.paused) audio.play();
                           else audio.pause();
                         }
                       }} className={`p-2 rounded-full flex-shrink-0 transition-transform active:scale-95 ${isMe ? 'bg-white text-blue-600 hover:bg-gray-50 shadow-sm' : 'bg-blue-600 text-white shadow-md'}`}>
                         <Play className="w-3.5 h-3.5 fill-current" />
                       </button>
                       <div className="relative flex-1 w-24 sm:w-32 h-1.5 bg-black/10 rounded-full overflow-hidden">
                          <div id={`audio-progress-${msg.id}`} className={`absolute top-0 left-0 h-full transition-all duration-75 ${isMe ? 'bg-white' : 'bg-blue-600'}`} style={{ width: '0%' }}></div>
                       </div>
                       <span className="text-[11px] font-bold tracking-tighter opacity-90">{msg.replyTo?.duration ? `0:${msg.replyTo.duration.toString().padStart(2, '0')}` : '0:03'}</span>
                       <audio id={`audio-${msg.id}`} src={msg.mediaUrl} className="hidden" onTimeUpdate={(e) => {
                          const audio = e.target as HTMLAudioElement;
                          const progress = (audio.currentTime / (audio.duration || 1)) * 100;
                          const bar = document.getElementById(`audio-progress-${msg.id}`);
                          if (bar) bar.style.width = `${progress}%`;
                       }} onEnded={() => {
                         const bar = document.getElementById(`audio-progress-${msg.id}`);
                         if (bar) bar.style.width = '0%';
                       }} />
                     </div>
                  );
                } else if (msg.type === 'audio') {
                  return (
                    <div className={`px-4 py-3 shadow-sm ${borderRadius} ${isMe ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-gray-100 text-gray-900 border border-gray-100'}`}>
                      <audio controls src={msg.mediaUrl} className={`h-8 ${isMe ? 'invert filter grayscale' : ''}`} style={{ maxWidth: '200px' }}></audio>
                    </div>
                  );
                } else if (msg.type === 'image') {
                  return (
                    <div className={`relative group cursor-pointer rounded-2xl overflow-hidden shadow-sm max-w-[240px] border ${isMe ? 'border-blue-400' : 'border-gray-100'}`} onClick={() => setViewingMedia({ type: 'image', url: msg.mediaUrl!, user: { name: activeContact?.name || '', avatar: activeContact?.avatar || '' } })}>
                      <img src={msg.mediaUrl} alt="Sent image" className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="bg-black/60 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">View Full Screen</div>
                      </div>
                    </div>
                  );
                } else if (isEmojiOnly) {
                  return <div className="text-[44px] leading-none drop-shadow-sm px-2 py-1 animate-in zoom-in duration-300">{msg.content}</div>;
                } else {
                  return (
                    <div className={`px-4 py-2.5 text-[15px] shadow-sm whitespace-pre-wrap break-words inline-block ${borderRadius} ${isMe ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-gray-100 text-gray-900 border border-gray-100'}`}>
                      {msg.content}
                    </div>
                  );
                }
              })()}
            </div>
            {(msg as any).reaction && (
              <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-white border border-gray-100 rounded-full px-1.5 py-0.5 text-sm shadow-sm z-10`}>
                {(msg as any).reaction}
              </div>
            )}
          </div>
          {isLastInGroup && (
            <div className={`flex items-center mt-1 space-x-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[11px] text-gray-500 font-medium">
                {(() => {
                  try {
                    const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                    if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } catch (e) {}
                  return 'Just now';
                })()}
              </span>
              {isMe && (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              )}
            </div>
          )}
        </div>

        {!isMe && (
          <div className="hidden sm:group-hover:flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2">
             <button onClick={() => setReplyingTo(msg as any)} className="p-1.5 hover:bg-black/5 rounded-full"><Reply className="w-4 h-4 text-gray-400 cursor-pointer" /></button>
          </div>
        )}

      </div>
    );
  }), [messages, swipeOffset, currentUser, activeContact, chatTheme, activeChat]);

  return (
    <div className="h-full w-full flex bg-white overflow-hidden relative" onClick={closeContextMenu}>
      
      {/* Left Sidebar (Contacts) */}
      <div className={`w-full md:w-[350px] flex-shrink-0 border-r border-gray-100 flex flex-col h-full bg-white transition-transform duration-300 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm border border-gray-100 flex-shrink-0">
              <img src={EnnvoLogo} alt="Ennvo Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-[24px] font-black tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">Ennvo</h1>
            <ChevronDown className="w-5 h-5 text-gray-900 mt-1" />
          </div>
          <div className="flex items-center space-x-1">
            {isSearchExpanded ? (
              <div className="relative flex items-center animate-in fade-in slide-in-from-right-2">
                <Search className="w-4 h-4 absolute left-3 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="w-40 bg-gray-100 rounded-full pl-9 pr-8 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  autoFocus
                />
                <button onClick={() => setIsSearchExpanded(false)} className="absolute right-2 p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsSearchExpanded(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Search className="w-6 h-6 text-gray-900" />
              </button>
            )}
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Plus className="w-6 h-6 text-gray-900" />
            </button>
          </div>
        </div>

        {/* Scrollable Area (Stories + Contacts) */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Small Stories with Notes */}
          <div className="px-2 pt-4 pb-2 border-b border-gray-100">
            <div className="flex space-x-4 overflow-x-auto scrollbar-hide px-4">
              <div onClick={() => setShowCreateStory(true)} className="flex flex-col items-center space-y-1.5 flex-shrink-0 cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 relative group-hover:bg-gray-200 transition-colors">
                  <img src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${currentUser?.name || 'Me'}&background=random`} className="w-12 h-12 rounded-full object-cover opacity-50" alt="Me" referrerPolicy="no-referrer" />
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-2xl px-3 py-1 shadow-md">
                    <span className="text-[10px] font-black text-gray-900 whitespace-nowrap">Share a thought...</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                    <Plus className="w-3 h-3 text-white" strokeWidth={4} />
                  </div>
                </div>
                <span className="text-[11px] font-black text-gray-500 mt-0.5">Your note</span>
              </div>
              {conversations.slice(0, 5).map((conv) => {
                const otherId = conv.participantIds?.find(id => id !== currentUser?.uid);
                const name = (conv.participantNames || {})[otherId || ''] || 'User';
                const avatar = (conv.participantAvatars || {})[otherId || ''] || `https://ui-avatars.com/api/?name=${name}&background=random`;
                return (
                  <div onClick={() => setActiveChat(conv.id)} key={conv.id} className="flex flex-col items-center space-y-1.5 flex-shrink-0 cursor-pointer group">
                    <div className="relative">
                      <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 group-hover:scale-105 transition-transform shadow-sm">
                        <img src={avatar} className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-white object-cover" alt={name} referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-gray-700 truncate w-14 md:w-16 text-center mt-0.5">{name.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contacts List */}
          <div className="pt-2">
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="font-bold text-[15px] text-gray-900">Messages</span>
              <span className="text-[14px] text-gray-500 font-medium cursor-pointer hover:text-gray-900">Requests</span>
            </div>
          
          {/* New Followers & Activity (Normal Style) - ONLY MOBILE */}
          <div className="px-2 py-1 space-y-1 md:hidden border-b border-gray-100 pb-2 mb-2">
            <div 
              onClick={() => setActiveChat('followers')}
              className={`flex items-center space-x-3 p-3 rounded-2xl cursor-pointer transition-colors ${activeChat === 'followers' ? 'bg-gray-200' : followers.length > lastCheckedFollowers ? 'bg-green-50' : 'hover:bg-gray-50'}`}
            >
              <div className="relative flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                <UserPlus className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">New followers</h3>
                <p className="text-[13px] text-gray-500 truncate">See who followed you</p>
              </div>
              {followers.length > lastCheckedFollowers && (
                <div className="bg-red-500 text-white text-[12px] font-bold rounded-lg px-2 py-1 ml-auto shadow-sm shrink-0">
                  {followers.length - lastCheckedFollowers} new
                </div>
              )}
            </div>

            <div 
              onClick={() => setActiveChat('activity')}
              className={`flex items-center space-x-3 p-3 rounded-2xl cursor-pointer transition-colors ${activeChat === 'activity' ? 'bg-gray-200' : unreadNotifsCount > 0 ? 'bg-green-50' : 'hover:bg-gray-50'}`}
            >
              <div className="relative flex-shrink-0 w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                <Heart className="w-6 h-6 text-white fill-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Activity</h3>
                <p className="text-[13px] text-gray-500 truncate">Likes, comments & more</p>
              </div>
              {unreadNotifsCount > 0 && (
                <div className="bg-red-500 text-white text-[12px] font-bold rounded-lg px-2 py-1 ml-auto shadow-sm shrink-0">
                  {unreadNotifsCount} new
                </div>
              )}
            </div>
          </div>

          {conversations.map(conv => {
            const otherId = conv.participantIds?.find(id => id !== currentUser?.uid);
            const name = (conv.participantNames || {})[otherId || ''] || userDataCache[otherId || '']?.name || 'User';
            const avatar = (conv.participantAvatars || {})[otherId || ''] || userDataCache[otherId || '']?.avatar || `https://ui-avatars.com/api/?name=${name}&background=random`;
            const isOnline = presenceData[otherId || '']?.isOnline || false;
            const unreadMessages = currentUser && conv.unreadCount && conv.unreadCount[currentUser.uid] ? conv.unreadCount[currentUser.uid] : 0;
            
            return (
              <div 
                key={conv.id} 
                onClick={() => setActiveChat(conv.id)}
                className={`flex items-center space-x-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors ${activeChat === conv.id ? 'bg-gray-100' : typeof unreadMessages === 'number' && unreadMessages > 0 ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
              >
                <div className="relative" onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: otherId || '', name, avatar }); pushPage('profile'); }}>
                  <img src={avatar} alt={name} loading="lazy" className="w-14 h-14 rounded-full object-cover shadow-sm hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                  {isOnline && <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-[15px] truncate font-semibold ${typeof unreadMessages === 'number' && unreadMessages > 0 ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>{name}</h3>
                    <span className="text-[12px] text-gray-500 flex-shrink-0 ml-2">
                      {(() => {
                        try {
                          if (!conv.lastMessageTime) return '';
                          const d = (conv.lastMessageTime as any)?.toDate?.() || new Date(conv.lastMessageTime);
                          if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {}
                        return '';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={`text-[14px] truncate ${typeof unreadMessages === 'number' && unreadMessages > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {conv.lastMessage || 'No messages yet'}
                    </p>
                    {typeof unreadMessages === 'number' && unreadMessages > 0 && (
                      <div className="bg-red-500 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 shadow-sm ml-2">
                        {unreadMessages}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* Right Chat Area */}
      {activeChat ? (
        isSpecialChat ? (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.8 }}
            onDragEnd={(e, info) => {
              if (info.offset.x > 80 && info.velocity.x > 10) {
                setActiveChat(null);
              }
            }}
            className="fixed inset-0 z-[100] md:relative md:z-auto flex-1 flex flex-col h-full bg-white transition-colors duration-300"
          >
            <div className="h-[72px] px-4 border-b border-gray-100 flex items-center space-x-4 bg-white/90 backdrop-blur-md sticky top-0 z-20">
              <button className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full" onClick={() => setActiveChat(null)}>
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="font-bold text-[16px] leading-tight text-gray-900">{activeChat === 'followers' ? 'New followers' : 'Activity'}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
                          {activeChat === 'followers' ? (
                <div className="space-y-1">
                  {followers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-20">
                      <UserPlus className="w-16 h-16 text-gray-200" />
                      <p className="font-medium text-lg">No new followers yet</p>
                    </div>
                  ) : (
                    followers.map((f: any) => (
                      <FollowerItem key={f.id} follower={f} currentUser={currentUser} onFollowBack={handleFollowBack} />
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-20">
                      <Bell className="w-16 h-16 text-gray-200" />
                      <p className="font-medium text-lg">No activity yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
                        onClick={() => {
                          if (n.postId && n.postMedia) {
                            const { setHighlightedCommentId, setHighlightedPostId, setShowLikesList, setTargetLikesPostId, setViewingReel, setViewingMedia } = useAppStore.getState();
                            
                            if (n.type === 'like') {
                               setTargetLikesPostId(n.postId);
                               setShowLikesList(true);
                            } else if (n.type === 'comment' || n.type === 'reply' || n.type === 'mention' || n.type === 'comment_like') {
                               setHighlightedCommentId(n.targetId);
                               setHighlightedPostId(n.postId);
                            }

                            const isReel = n.postMedia.includes('.mp4') || n.postMedia.includes('video');
                            const postAuthor = {
                              name: n.postAuthorName || n.actorName,
                              avatar: n.postAuthorAvatar || n.actorAvatar
                            };

                            if (isReel) {
                              setViewingReel({ 
                                id: n.postId, 
                                authorId: n.actorId,
                                authorName: postAuthor.name,
                                authorAvatar: postAuthor.avatar,
                                media: [n.postMedia], 
                                text: '', 
                                type: 'reel',
                                likesCount: 0,
                                commentsCount: 0,
                                single: true 
                              });
                            } else {
                              setViewingMedia({ 
                                url: n.postMedia, 
                                type: 'post', 
                                user: postAuthor
                              });
                            }
                          } else {
                            setViewingUser({ uid: n.actorId, name: n.actorName, avatar: n.actorAvatar });
                            pushPage('profile');
                          }
                        }}
                      >
                        <div className="relative flex-shrink-0" onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: n.actorId, name: n.actorName, avatar: n.actorAvatar }); pushPage('profile'); }}>
                          <img 
                            src={n.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actorName || 'User')}&background=random`} 
                            className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-100" 
                            alt="actor" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 scale-90">
                            {n.type === 'like' && <Heart className="w-3 h-3 text-red-500 fill-red-500" />}
                            {n.type === 'comment' && <MessageCircle className="w-3 h-3 text-blue-500 fill-blue-500" />}
                            {n.type === 'follow' && <UserPlus className="w-3 h-3 text-purple-500" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] leading-snug">
                            <span className="font-bold text-gray-900 hover:underline">{n.actorName || 'User'}</span>
                            <span className="text-gray-600 ml-1">
                              {n.type === 'like' && 'liked your post.'}
                              {n.type === 'comment' && `commented: ${n.content}`}
                              {n.type === 'follow' && 'started following you.'}
                              {n.type === 'mention' && 'mentioned you.'}
                              {n.type === 'favorite' && 'saved your post.'}
                              {n.type === 'reply' && `replied to your comment: ${n.content}`}
                              {n.type === 'comment_like' && 'liked your comment.'}
                            </span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-tight">
                            {(() => {
                              const timestamp = n.createdAt;
                              if (!timestamp) return 'Just now';
                              try {
                                const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
                                if (isNaN(date.getTime())) return 'Just now';
                                const now = new Date();
                                const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
                                if (diff < 60) return 'Just now';
                                if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                return date.toLocaleDateString();
                              } catch (e) { return 'Just now'; }
                            })()}
                          </p>
                        </div>
                        {n.postMedia && (
                          <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm group-hover:opacity-80 transition-opacity bg-gray-50">
                            {n.postMedia.includes('.mp4') || n.postMedia.includes('video') ? (
                              <div className="relative w-full h-full">
                                <video src={n.postMedia} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <Play className="w-4 h-4 text-white fill-white" />
                                </div>
                              </div>
                            ) : (
                              <img src={n.postMedia} className="w-full h-full object-cover" alt="thumb" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
        <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.8 }}
            onDragEnd={(e, info) => {
              if (info.offset.x > 80 && info.velocity.x > 10) {
                setActiveChat(null);
              }
            }}
            className={`fixed inset-0 z-[100] md:relative md:z-auto flex-1 flex flex-col h-full ${chatTheme} relative ${!activeChat ? 'hidden md:flex' : 'flex'} transition-colors duration-300`}
        >
          
          {/* Chat Header */}
          <div className={`h-[72px] px-4 border-b border-gray-100 flex items-center justify-between ${chatTheme === 'bg-white' ? 'bg-white/90' : 'bg-transparent'} backdrop-blur-md sticky top-0 z-20 transition-colors duration-300`}>
            <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setShowChatSettings(true)}>
              <button className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full" onClick={(e) => { e.stopPropagation(); setActiveChat(null); }}>
                <ArrowLeft className={`w-6 h-6 ${chatTheme === 'bg-white' ? 'text-gray-900' : 'text-gray-800'}`} />
              </button>
              <img src={activeContact?.avatar} alt="Avatar" className="w-11 h-11 rounded-full object-cover shadow-sm border border-gray-100 group-hover:opacity-80 transition-opacity" />
              <div>
                <h2 className={`font-bold text-[16px] leading-tight ${chatTheme === 'bg-white' ? 'text-gray-900' : 'text-gray-900'}`}>{activeContact?.name}</h2>
                <p className={`text-[12px] font-medium ${chatTheme === 'bg-white' ? 'text-gray-500' : 'text-gray-700'}`}>{activeContact?.online ? 'Active now' : 'Active 2h ago'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => setShowChatSettings(true)} className="p-2.5 hover:bg-black/5 rounded-full transition-colors"><Info className={`w-6 h-6 ${chatTheme === 'bg-white' ? 'text-gray-900' : 'text-gray-800'}`} strokeWidth={1.5} /></button>
            </div>
          </div>

          {/* Messages Area */}
          <div 
             className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide"
             onScroll={handleScrollMessages}
             ref={messagesScrollRef}
          >
            <div className="flex flex-col items-center justify-center py-8">
              <img src={activeContact?.avatar} className="w-24 h-24 rounded-full object-cover shadow-md mb-4 cursor-pointer hover:opacity-80 transition-opacity" alt="Profile" onClick={() => { if (activeContact?.uid) { setViewingUser({ uid: activeContact.uid, name: activeContact.name, avatar: activeContact.avatar }); pushPage('profile'); } }} />
              <h2 className={`text-xl font-bold cursor-pointer hover:underline ${chatTheme === 'bg-white' ? 'text-gray-900' : 'text-gray-900'}`} onClick={() => { if (activeContact?.uid) { setViewingUser({ uid: activeContact.uid, name: activeContact.name, avatar: activeContact.avatar }); pushPage('profile'); } }}>{activeContact?.name}</h2>
              <p className={`text-sm mt-1 ${chatTheme === 'bg-white' ? 'text-gray-500' : 'text-gray-700'}`}>Instagram</p>
              <button onClick={() => { if (activeContact?.uid) { setViewingUser({ uid: activeContact.uid, name: activeContact.name, avatar: activeContact.avatar }); pushPage('profile'); } }} className="mt-4 bg-black/5 hover:bg-black/10 text-gray-900 font-semibold px-4 py-1.5 rounded-lg transition-colors text-sm">
                View Profile
              </button>
            </div>

            {renderedMessages}
            
            {typingUsers.length > 0 && (
              <div className="flex justify-start mt-3">
                <img src={activeContact?.avatar} className="w-7 h-7 rounded-full mr-2 self-end mb-1 shadow-sm object-cover" alt="Avatar" />
                <div className={`px-4 py-3 rounded-3xl rounded-bl-md shadow-sm flex items-center space-x-1 ${chatTheme === 'bg-white' ? 'bg-gray-100' : 'bg-white/50 backdrop-blur-sm'}`}>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-3 md:p-4 ${chatTheme === 'bg-white' ? 'bg-white' : 'bg-transparent'} z-10 pb-6 transition-colors duration-300 w-full flex flex-col relative`}>
            {showEmojiPicker && (
              <div className="absolute bottom-[calc(100%+10px)] left-2 md:left-4 z-50">
                 <EmojiPicker 
                   onEmojiClick={(emojiData: EmojiClickData) => setInputText(prev => prev + emojiData.emoji)} 
                   previewConfig={{showPreview: false}}
                   skinTonesDisabled
                 />
              </div>
            )}
            {replyingTo && (
              <div className={`flex items-center justify-between rounded-t-2xl px-3 py-2 mx-2 -mb-2 z-0 shadow-sm relative ${chatTheme === 'bg-white' ? 'bg-gray-50 border border-b-0 border-gray-100' : 'bg-black/10 text-white backdrop-blur-md'}`}>
                <div className={`flex-1 min-w-0 border-l-[3px] ${chatTheme === 'bg-white' ? 'border-blue-500' : 'border-white/50'} pl-2 flex items-center`}>
                  {replyingTo.type === 'reel' && replyingTo.mediaUrl && (
                    <div className="w-8 h-10 rounded shrink-0 overflow-hidden mr-2">
                       <video src={`${replyingTo.mediaUrl}#t=0.001`} className="w-full h-full object-cover pointer-events-none" preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                    </div>
                  )}
                  <p className={`text-[12px] font-bold truncate leading-tight ${chatTheme === 'bg-white' ? 'text-gray-700' : 'text-white/90'}`}>{replyingTo.content || replyingTo.type}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-black/10 rounded-full transition-colors ml-2 shrink-0">
                  <X className={`w-3.5 h-3.5 ${chatTheme === 'bg-white' ? 'text-gray-500' : 'text-white/80'}`} />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-center space-x-2 md:space-x-3 max-w-full relative z-10">
              <div className={`flex-1 ${chatTheme === 'bg-white' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/80 hover:bg-white'} rounded-[24px] flex items-center px-3 md:px-4 py-1.5 md:py-2 border border-gray-200 focus-within:border-blue-200 focus-within:bg-white transition-all shadow-sm overflow-hidden`}>
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-1.5 hover:bg-black/5 rounded-full mr-1 md:mr-2 transition-colors shrink-0 ${showEmojiPicker ? 'bg-black/5' : ''}`}><Smile className="w-5 h-5 md:w-6 md:h-6 text-gray-500" strokeWidth={1.5} /></button>
                {!isRecording && (
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={handleTyping}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder="Message..." 
                    className="flex-1 bg-transparent focus:outline-none text-[14px] md:text-[15px] py-2 font-medium text-gray-800 placeholder-gray-400 min-w-0"
                  />
                )}
                {isRecording && <div className="flex-1"></div>}
                {!inputText ? (
                  <div className="flex items-center space-x-0.5 md:space-x-1 ml-1 md:ml-2 shrink-0">
                    {isRecording ? (
                      <div className="flex items-center space-x-2 mr-2">
                        <button type="button" onClick={cancelRecording} className="p-1 px-3 hover:bg-gray-200 text-gray-500 rounded-full font-bold text-sm transition-colors text-[13px]">Cancel</button>
                        <div className="flex items-center mx-1 bg-red-50 px-2 py-1 rounded-full">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"></div>
                          <span className="text-red-500 text-sm font-bold w-9">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <button type="button" onClick={stopRecording} className="p-1.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold text-sm transition-colors shadow-sm text-[13px]">Send</button>
                      </div>
                    ) : (
                      <button type="button" onClick={startRecording} className="p-1.5 hover:bg-black/5 rounded-full transition-colors"><Mic className="w-5 h-5 md:w-6 md:h-6 text-gray-500" strokeWidth={1.5} /></button>
                    )}
                    {!isRecording && (
                      <>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-black/5 rounded-full transition-colors"><ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-gray-500" strokeWidth={1.5} /></button>
                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" />
                      </>
                    )}
                  </div>
                ) : (
                  <button type="submit" className="text-blue-600 font-bold px-2 md:px-3 py-1 hover:bg-blue-50 rounded-full transition-colors shrink-0">Send</button>
                )}
              </div>
            </form>
          </div>

          {/* Theme Settings Modal */}
          {showThemeSettings && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-[16px] text-center flex-1">Customize Chat</h3>
                  <button onClick={() => setShowThemeSettings(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-[14px] text-gray-900 mb-4">Background Theme</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { name: 'Default', class: 'bg-white' },
                      { name: 'Sky', class: 'bg-blue-50' },
                      { name: 'Rose', class: 'bg-rose-50' },
                      { name: 'Mint', class: 'bg-emerald-50' },
                      { name: 'Lavender', class: 'bg-purple-50' },
                      { name: 'Sunset', class: 'bg-gradient-to-br from-orange-50 to-rose-50' },
                      { name: 'Ocean', class: 'bg-gradient-to-br from-cyan-50 to-blue-50' },
                      { name: 'Forest', class: 'bg-gradient-to-br from-green-50 to-emerald-50' },
                      { name: 'Dark', class: 'bg-gray-900' },
                    ].map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => setChatTheme(theme.class)}
                        className={`flex flex-col items-center space-y-2 group`}
                      >
                        <div className={`w-16 h-16 rounded-full border-2 ${chatTheme === theme.class ? 'border-blue-500 scale-110' : 'border-gray-200 group-hover:border-gray-300'} transition-all ${theme.class} shadow-inner`}></div>
                        <span className={`text-[12px] font-medium ${chatTheme === theme.class ? 'text-blue-500' : 'text-gray-600'}`}>{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Context Menu */}
          <AnimatePresence>
            {contextMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeContextMenu}></div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-64 z-50 overflow-hidden"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                  <div className="flex items-center justify-around px-2 py-3 border-b border-gray-50 mb-1">
                    {['❤️', '😂', '😮', '😢', '🔥', '👏'].map(emoji => (
                      <button 
                        key={emoji} 
                        onClick={async () => {
                          if (activeChat) {
                            try {
                              const { updateDoc, doc } = await import('firebase/firestore');
                              await updateDoc(doc(db, 'conversations', activeChat, 'messages', contextMenu.msgId), {
                                reaction: emoji
                              });
                            } catch (e) { console.error('Failed to react', e); }
                          }
                          closeContextMenu();
                        }}
                        className="text-2xl hover:scale-125 transition-transform active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const msg = messages.find(m => m.id === contextMenu.msgId);
                      if (msg) setReplyingTo(msg as any);
                      closeContextMenu();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                  >
                    <Reply className="w-5 h-5 text-gray-500" />
                    <span className="font-semibold text-[14px]">Reply</span>
                  </button>
                  <button 
                    onClick={() => {
                      const msg = messages.find(m => m.id === contextMenu.msgId);
                      if (msg?.content) navigator.clipboard.writeText(msg.content);
                      closeContextMenu();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                  >
                    <Send className="w-5 h-5 text-gray-500" />
                    <span className="font-semibold text-[14px]">Copy</span>
                  </button>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button 
                    onClick={async () => {
                      if (activeChat) {
                        try {
                          const { deleteDoc, doc } = await import('firebase/firestore');
                          await deleteDoc(doc(db, 'conversations', activeChat, 'messages', contextMenu.msgId));
                        } catch (err) {
                          console.error('Failed to unsend message', err);
                        }
                      }
                      closeContextMenu();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center space-x-3 transition-colors text-red-600"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-bold text-[14px]">Unsend</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </motion.div>
        )
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-white">
          <div className="w-24 h-24 border border-gray-100 rounded-3xl flex items-center justify-center mb-6 overflow-hidden shadow-[0_8px_30px_rgb(59,130,246,0.15)]">
            <img src={EnnvoLogo} alt="Ennvo Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Messages</h2>
          <p className="text-gray-500 mb-6">Send private photos and messages to a friend or group.</p>
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-sm">
            Send Message
          </button>
        </div>
      )}

      {/* Create Story Page Overlay */}
      {showCreateStory && (
        <div className="absolute inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-200 overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
            <button onClick={() => { setShowCreateStory(false); setStoryImage(null); setStoryText(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h3 className="font-black text-gray-900 text-xl text-center flex-1 tracking-tight">Create story</h3>
            <button 
              onClick={async () => {
                if (!currentUser) return;
                try {
                  const { uploadStory } = await import('../services/storyService');
                  let fileToUpload = null;
                  if (storyImage) {
                    // Try fetching blob if we have object URL or data URL
                    const res = await fetch(storyImage);
                    const blob = await res.blob();
                    fileToUpload = safeFile(blob, 'story.jpg');
                  }
                  
                  if (fileToUpload || storyText) {
                    await uploadStory(currentUser.uid, currentUser.name, currentUser.avatar, fileToUpload as any, storyText);
                    setShowCreateStory(false);
                    setStoryImage(null);
                    setStoryText('');
                  }
                } catch(e) {
                  console.error(e);
                }
              }}
              className="text-blue-500 font-black px-4 py-2 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
            >
              Share
            </button>
          </div>
          <div className="flex-1 p-6 max-w-[800px] mx-auto w-full flex flex-col">
            <div className="flex items-center space-x-3 mb-8">
              <img src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}`} alt="Profile" className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white" />
              <div>
                <h4 className="font-black text-[17px] text-gray-900 leading-tight">{currentUser?.name}</h4>
                <p className="text-[13px] text-gray-500 font-bold mt-0.5">Your Story</p>
              </div>
            </div>
            
            <div className={`w-full flex-1 min-h-[400px] rounded-[2.5rem] flex flex-col items-center justify-center p-8 shadow-2xl relative overflow-hidden group ${storyImage ? 'bg-black' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
              {!storyImage && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>}
              {storyImage && <img src={storyImage} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Background" />}
              <textarea 
                placeholder="What's on your mind?" 
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                className="w-full resize-none focus:outline-none bg-transparent text-white text-center text-4xl font-black placeholder-white/80 leading-tight z-10 drop-shadow-md"
                autoFocus
                rows={4}
              ></textarea>
              <div className="absolute bottom-8 flex space-x-4 z-10">
                <button className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-white hover:bg-white/30 transition-all border border-white/20 shadow-lg"><Type className="w-6 h-6" /></button>
                <button className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-white hover:bg-white/30 transition-all border border-white/20 shadow-lg"><Music className="w-6 h-6" /></button>
                <button onClick={() => storyImageInputRef.current?.click()} className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-white hover:bg-white/30 transition-all border border-white/20 shadow-lg"><ImageIcon className="w-6 h-6" /></button>
                <input 
                  type="file" 
                  ref={storyImageInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setStoryImage(URL.createObjectURL(file));
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Settings Overlay */}
      <AnimatePresence>
        {showChatSettings && activeContact && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-white flex flex-col md:w-[350px] md:left-auto md:border-l border-gray-100 shadow-2xl"
          >
            <div className="h-[72px] px-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowChatSettings(false)} className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors">
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="font-bold text-[17px] text-gray-900">Details</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center py-8 border-b border-gray-100">
                <div className="relative mb-4">
                  <img src={activeContact.avatar} className="w-24 h-24 rounded-full object-cover shadow-md border-2 border-white" alt={activeContact.name} />
                  {activeContact.online && <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{activeContact.name}</h3>
                <p className="text-sm text-gray-500 font-medium">@{activeContact.name.toLowerCase().replace(/ /g, '_')}</p>
                <div className="flex items-center space-x-4 mt-6">
                  <div className="flex flex-col items-center space-y-1">
                    <button onClick={() => { setViewingUser({ uid: activeContact.uid!, name: activeContact.name, avatar: activeContact.avatar }); pushPage('profile'); }} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><UserSquare className="w-5 h-5 text-gray-900" /></button>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Profile</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><Bell className="w-5 h-5 text-gray-900" /></button>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Mute</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><Search className="w-5 h-5 text-gray-900" /></button>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Search</span>
                  </div>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <h4 className="px-4 py-2 text-[12px] font-black text-gray-400 uppercase tracking-widest">Chat Settings</h4>
                <button 
                  onClick={() => setShowThemeSettings(true)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 rounded-lg"><Palette className="w-5 h-5 text-indigo-600" /></div>
                    <span className="font-bold text-gray-900 text-[15px]">Themes</span>
                  </div>
                  <span className="text-sm text-gray-400 font-bold capitalize">{chatTheme.replace('bg-', '').replace('gradient-to-tr from-', '').split('-')[0]}</span>
                </button>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg"><ImageIcon className="w-5 h-5 text-blue-600" /></div>
                    <span className="font-bold text-gray-900 text-[15px]">Shared Media</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="p-2 space-y-1 border-t border-gray-100 mt-2">
                <h4 className="px-4 py-2 text-[12px] font-black text-gray-400 uppercase tracking-widest">Privacy & Support</h4>
                <button 
                  onClick={() => setIsBlocked(!isBlocked)}
                  className="w-full flex items-center space-x-3 p-4 hover:bg-red-50 rounded-2xl transition-colors group"
                >
                   <div className="p-2 bg-red-50 group-hover:bg-red-100 rounded-lg"><EyeOff className="w-5 h-5 text-red-600" /></div>
                   <span className="font-bold text-red-600 text-[15px]">{isBlocked ? 'Unblock' : 'Block'} User</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-4 hover:bg-red-50 rounded-2xl transition-colors group">
                   <div className="p-2 bg-red-50 group-hover:bg-red-100 rounded-lg"><Shield className="w-5 h-5 text-red-600" /></div>
                   <span className="font-bold text-red-600 text-[15px]">Report User</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-4 hover:bg-red-50 rounded-2xl transition-colors group text-left">
                   <div className="p-2 bg-red-50 group-hover:bg-red-100 rounded-lg"><Trash2 className="w-5 h-5 text-red-600" /></div>
                   <div className="flex-1">
                     <span className="font-bold text-red-600 text-[15px]">Delete Chat</span>
                     <p className="text-[11px] text-red-400 font-bold -mt-0.5">This will clear message history</p>
                   </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
