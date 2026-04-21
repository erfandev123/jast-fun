import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, Smile, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Plus, Search, X, ChevronDown, ChevronRight, Type, Play, UserPlus, Globe, Share2, Music, Settings2, MoreVertical, ArrowLeft, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAppStore } from '../store';
import { db } from '../firebase';
import { subscribeFeed, createPost, subscribeReels } from '../services/postService';
import { subscribeStories, uploadStory, Story } from '../services/storyService';
import { followUser } from '../services/followService';
import { Post, Comment, User as AppUser } from '../types';
import { PostItem } from '../components/PostItem';
import { EnnvoLogo } from '../components/EnnvoLogo';

const contacts = [
  { id: 1, name: 'cute_coder', avatar: 'https://picsum.photos/seed/cute/32/32', online: true },
  { id: 2, name: 'master_dev', avatar: 'https://picsum.photos/seed/master/32/32', online: true },
  { id: 3, name: 'sarah_ui', avatar: 'https://picsum.photos/seed/sarah/32/32', online: false },
  { id: 4, name: 'alex_dev', avatar: 'https://picsum.photos/seed/alex/32/32', online: true },
  { id: 5, name: 'design_guru', avatar: 'https://picsum.photos/seed/design/32/32', online: true },
];

// --- Memoized Components ---
const StoryItem = React.memo(({ story, onClick }: { story: any, onClick: () => void }) => (
  <div onClick={onClick} className="relative w-[120px] h-[210px] rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer group shadow-md border border-gray-100 bg-gray-100">
    {story.mediaUrl && (story.mediaUrl.includes('.mp4') || story.mediaUrl.includes('video')) ? (
      <video 
        src={story.mediaUrl} 
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 pointer-events-none" 
        muted 
        playsInline 
        preload="auto"
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
      />
    ) : (
      <img 
        src={story.mediaUrl || story.bg || `https://picsum.photos/seed/${story.id}/200/300`} 
        alt="Story bg" 
        loading="lazy" 
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
      />
    )}
    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80"></div>
    
    {story.text && (
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <p className="text-white text-[10px] sm:text-xs font-bold text-center line-clamp-3 bg-black/40 px-2 py-1 rounded-xl backdrop-blur-sm shadow-sm">{story.text}</p>
      </div>
    )}
    
    {story.isUser ? (
      <div className="absolute top-3 left-3 bg-white rounded-full p-1 shadow-lg">
        <div className="bg-blue-600 rounded-full p-1.5"><Plus className="w-4 h-4 text-white" strokeWidth={3} /></div>
      </div>
    ) : (
      <div className="absolute top-3 left-3 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
        <img 
          src={story.authorAvatar || story.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName || story.name)}&background=random`} 
          alt={story.authorName || story.name} 
          loading="lazy" 
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-full border-2 border-white object-cover" 
        />
      </div>
    )}
    <span className="absolute bottom-3 left-3 right-3 text-white text-[13px] font-bold truncate drop-shadow-md text-center">{story.authorName || story.name}</span>
  </div>
));

const SuggestedAccountItem: React.FC<{ user: AppUser, key?: any }> = React.memo(({ user }) => {
  const { setViewingUser, currentUser, pushPage } = useAppStore();
  const [friendship, setFriendship] = useState({ following: false, followedBy: false, isFriend: false });

  useEffect(() => {
    if (currentUser && user.uid) {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        const followingRef = doc(db, 'users', currentUser.uid, 'following', user.uid);
        const followerRef = doc(db, 'users', user.uid, 'following', currentUser.uid);

        const unsubFollowing = onSnapshot(followingRef, (doc1) => {
          const following = doc1.exists();
          const unsubFollowed = onSnapshot(followerRef, (doc2) => {
            const followedBy = doc2.exists();
            setFriendship({ following, followedBy, isFriend: following && followedBy });
          });
        });
      });
    }
  }, [currentUser, user.uid]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (friendship.following) {
        await import('../services/followService').then(m => m.unfollowUser(currentUser.uid, user.uid));
      } else {
        await followUser(currentUser, user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div 
      className="w-[110px] flex-shrink-0 bg-white border border-gray-50 rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer hover:bg-gray-50 transition-all duration-200 group" 
      onClick={() => { setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar }); pushPage('profile'); }}
    >
      <div className="relative mb-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm transition-transform group-hover:scale-105" 
          alt="Suggested" 
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
      <h4 className="font-bold text-[12px] text-gray-900 truncate w-full mb-0.5">{user.name}</h4>
      <p className="text-[10px] text-gray-500 mb-2.5 font-bold tracking-tight">Suggested</p>
      <button 
        onClick={handleFollow}
        className={`w-full font-bold py-1 rounded-xl text-[10px] transition-all active:scale-95 ${friendship.isFriend ? 'bg-gray-100 text-gray-500' : friendship.following ? 'bg-gray-50 text-blue-600' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
      >
        {friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

const SuggestedAccounts = React.memo(() => {
  const { currentUser } = useAppStore();
  const [suggested, setSuggested] = useState<AppUser[]>([]);

  useEffect(() => {
    const fetchSuggested = async () => {
      if (!currentUser) return;
      try {
        const { collection, query, limit, getDocs, where } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), limit(20));
        const snapshot = await getDocs(q);
        const users = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as AppUser))
          .filter(u => u.uid !== currentUser.uid)
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        setSuggested(users);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSuggested();
  }, [currentUser]);

  if (suggested.length === 0) return null;

  return (
    <div className="bg-white border-b-[8px] border-gray-100 overflow-hidden py-3">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Suggested for you</h3>
        </div>
        <button onClick={() => useAppStore.getState().pushPage('search')} className="text-blue-600 font-bold text-xs hover:underline">See All</button>
      </div>
      <div className="flex space-x-2.5 overflow-x-auto no-scrollbar px-4">
        {suggested.map(user => (
          <SuggestedAccountItem key={user.uid} user={user} />
        ))}
      </div>
    </div>
  );
});

const SuggestedReels = React.memo(() => {
  const { setViewingReel, setViewingReelContext, pushPage } = useAppStore();
  const [reels, setReels] = useState<Post[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeReels((fetchedReels) => {
      setReels(fetchedReels.slice(0, 4)); // Only show 4 featured reels
    });
    return () => unsubscribe();
  }, []);

  if (reels.length === 0) return null;

  return (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3 py-3">
    <div className="flex items-center justify-between px-4 mb-2">
      <div className="flex items-center space-x-2">
        <Play className="w-4 h-4 text-red-500 fill-red-500" />
        <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Featured Reels</h3>
      </div>
      <button onClick={() => pushPage('reels')} className="text-blue-500 font-bold text-xs hover:underline">Watch All</button>
    </div>
    <div className="flex space-x-2.5 overflow-x-auto no-scrollbar px-4 pb-1">
      {reels.map(reel => (
        <div key={reel.id} onClick={() => {
          setViewingReelContext('all');
          setViewingReel(reel);
        }} className="w-[130px] h-[210px] flex-shrink-0 rounded-xl overflow-hidden relative cursor-pointer group shadow-md border border-white/5 bg-black">
          <video 
            src={reel.media?.[0]} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 pointer-events-none" 
            muted
            playsInline
            preload="auto"
            poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 text-white">
            <Play className="w-3 h-3 fill-white" />
            <span className="text-[11px] font-bold drop-shadow-md">{reel.viewsCount || 0}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
});

const RightPanel = React.memo(() => {
  const { currentUser } = useAppStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      const { getFollowing } = await import('../services/followService');
      const following = await getFollowing(currentUser.uid);
      setContacts(following);
      setLoading(false);
    };
    fetchContacts();
  }, [currentUser]);

  return (
    <div className="hidden lg:flex flex-col w-[280px] space-y-6 pt-4 sticky top-0 h-screen overflow-y-auto no-scrollbar pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-gray-400 font-bold text-[13px] tracking-[0.1em]">Contacts</h3>
          <div className="flex space-x-3">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><Search className="w-4 h-4 text-gray-500" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
        <div className="space-y-1.5 truncate">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-3 p-2 animate-pulse">
                  <div className="w-9 h-9 bg-gray-100 rounded-full"></div>
                  <div className="h-3 w-24 bg-gray-50 rounded"></div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-xs font-bold">No contacts yet</p>
              <button onClick={() => useAppStore.getState().pushPage('search')} className="text-blue-600 text-[11px] font-black mt-2">Find friends</button>
            </div>
          ) : (
            contacts.map(contact => (
              <div key={contact.uid} className="group flex items-center justify-between p-2 hover:bg-blue-50/50 rounded-2xl cursor-pointer transition-all active:scale-[0.98]" onClick={() => {
                const { setMiniChatUser } = useAppStore.getState();
                setMiniChatUser(contact);
              }}>
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
                      alt={contact.name} 
                      loading="lazy" 
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover:ring-blue-100 transition-all" 
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <span className="text-[14px] font-bold text-gray-700 group-hover:text-blue-600 transition-colors truncate">{contact.name}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                   <MessageCircle className="w-4 h-4 text-blue-500" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});



export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const { viewingStory, setViewingStory, setViewingReel, showCreatePost, setShowCreatePost, pushPage, currentUser, notificationCount, cachedFeed, setCachedFeed, setViewingUser } = useAppStore();
  const feedScrollY = useAppStore(state => state.feedScrollY);
  const setFeedScrollY = useAppStore(state => state.setFeedScrollY);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(feedScrollY);
  const scrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Only attempt scroll restore on initial mount when feed is done
    if (scrollContainerRef.current && feedScrollY > 0 && !isFeedLoading) {
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTo(0, feedScrollY);
      }, 50);
    }
  }, [isFeedLoading]); // Scroll after loading is done, omit feedScrollY from deps to avoid jumping

  // --- Local Caching ---
  useEffect(() => {
    if (cachedFeed.length > 0) {
        setPosts(cachedFeed);
        setIsFeedLoading(false);
    } else {
        const local = localStorage.getItem('cached_posts');
        if (local) {
            const parsed = JSON.parse(local);
            setPosts(parsed);
            setCachedFeed(parsed);
            setIsFeedLoading(false);
        }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribeFeed = subscribeFeed((newPosts) => {
      const filtered = newPosts.filter(p => p.type !== 'reel');
      setPosts(filtered);
      setCachedFeed(filtered);
      setIsFeedLoading(false);
      localStorage.setItem('cached_posts', JSON.stringify(filtered.slice(0, 20)));
    });
    const unsubscribeStories = subscribeStories((newStories) => {
      setStories(newStories);
    });
    return () => {
      unsubscribeFeed();
      unsubscribeStories();
    };
  }, [currentUser, setCachedFeed]);

  const [visiblePostsCount, setVisiblePostsCount] = useState(5);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScrollY = target.scrollTop;
    if (currentScrollY === 0) {
      setShowHeader(true);
    } else if (currentScrollY > 50) {
      setShowHeader(false);
    }
    
    // Progressive rendering for low-end devices
    if (target.scrollHeight - currentScrollY <= target.clientHeight * 2) {
      setVisiblePostsCount(prev => Math.min(prev + 5, posts.length));
    }
    
    lastScrollY.current = currentScrollY;
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setFeedScrollY(currentScrollY);
    }, 500); // Save scroll position periodically to avoid lag
  }, [posts.length, setFeedScrollY]);

  const [postText, setPostText] = useState('');
  const [postBg, setPostBg] = useState('bg-white');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [postPreviews, setPostPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPostFiles(prev => [...prev, ...files]);
    const urls = files.map((file: File) => URL.createObjectURL(file));
    setPostPreviews(prev => [...prev, ...urls]);
  };

  const handleCreatePost = async () => {
    if (!currentUser || (!postText.trim() && postFiles.length === 0)) return;
    setLoading(true);
    try {
      // Posts created from Home page are always 'post' type, even if they contain video
      const type = 'post';
      
      console.log(`Creating ${type} with files:`, postFiles);
      const post = await createPost(currentUser.uid, currentUser, postText, postFiles, type) as any;
      
      // Mentions Notification
      const mentionMatches = postText.match(/@(\w+)/g);
      if (mentionMatches && post) {
        const { findUserByUsername } = await import('../services/userService');
        const { sendNotification } = await import('../services/notificationService');
        const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
        uniqueMentions.forEach(async (username) => {
          const mentionedUser = await findUserByUsername(username);
          if (mentionedUser && mentionedUser.uid !== currentUser.uid) {
            await sendNotification(mentionedUser.uid, 'mention', currentUser, post.id, post.id, post.media?.[0], postText, currentUser.name, currentUser.avatar);
          }
        });
      }
      setPostText('');
      setPostFiles([]);
      setPostPreviews([]);
      setShowCreatePost(false);
    } catch (error: any) {
      console.error('Post creation error:', error);
      alert(`Failed to create post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const bgColors = [
    'bg-white', 
    'bg-gradient-to-tr from-blue-400 to-purple-500', 
    'bg-gradient-to-r from-pink-500 to-orange-400', 
    'bg-gradient-to-br from-gray-900 to-black',
    'bg-gradient-to-r from-green-400 to-blue-500'
  ];

  const handleCreateStory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const confirmCreateStory = async () => {
    if (!storyFile || !currentUser) return;
    setLoading(true);
    try {
      await uploadStory(currentUser.uid, currentUser.name, currentUser.avatar, storyFile);
      setStoryFile(null);
      setStoryPreview(null);
      setShowCreateStory(false);
    } catch (error: any) {
      console.error('Story upload error:', error);
      alert(`Failed to upload story: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={scrollContainerRef} id="home-scroll-container" className="h-full w-full overflow-y-auto bg-white flex flex-col items-center px-0 md:px-4" onScroll={handleScroll}>
      {/* Mobile Top Header - Clean & Modern */}
      <AnimatePresence>
        {showHeader && !showCreatePost && (
          <motion.div 
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="sm:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-100 z-[60] px-5 py-3 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-[10px] overflow-hidden shadow-sm border border-gray-100 flex-shrink-0">
                <EnnvoLogo className="w-full h-full" />
              </div>
              <h1 className="text-[26px] font-black tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">Ennvo</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => pushPage('search')} className="p-2 transition-transform active:scale-95">
                <Search className="w-5.5 h-5.5 text-gray-800" strokeWidth={2.5} />
              </button>
              <button onClick={() => pushPage('notifications')} className="p-2 transition-transform active:scale-95 relative">
                <Bell className="w-5.5 h-5.5 text-gray-800" strokeWidth={2.5} />
                {notificationCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>}
              </button>
              <button onClick={() => setShowCreatePost(true)} className="p-2 bg-blue-600 rounded-full shadow-lg shadow-blue-200 transition-transform active:scale-95"><Plus className="w-5 h-5 text-white" strokeWidth={3} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[1020px] flex justify-between space-x-0 md:space-x-8 pt-[64px] sm:pt-6 pb-24">
        <div className="flex-1 w-full max-w-[620px] mx-auto lg:mx-0 flex flex-col">
          {/* Create Post Box */}
          <div className="bg-white border-b border-gray-100 md:border md:border-gray-200 md:rounded-2xl px-4 py-3 md:p-5 mb-0 md:mb-4 group transition-all">
            <div className="flex items-center space-x-3 mb-2">
              <div className="relative group/avatar cursor-pointer" onClick={() => { setViewingUser({ uid: currentUser?.uid, name: currentUser?.name, avatar: currentUser?.avatar }); pushPage('profile'); }}>
                <img 
                  src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
                  alt="Profile" 
                  loading="lazy" 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover/avatar:ring-blue-100 transition-all" 
                />
              </div>
              <div 
                className="flex-1 bg-gray-50 hover:bg-gray-100 transition-all rounded-full px-5 py-2.5 text-[15px] font-medium text-gray-500 cursor-pointer border border-gray-100/50" 
                onClick={() => setShowCreatePost(true)}
              >
                What's on your mind?
              </div>
            </div>
            <div className="flex items-center justify-around translate-y-1">
              <button 
                onClick={() => setShowCreatePost(true)} 
                className="flex flex-col items-center justify-center p-2 rounded-xl transition-all group active:scale-95"
              >
                <Video className="w-5 h-5 text-red-500" />
              </button>
              <button 
                onClick={() => setShowCreatePost(true)} 
                className="flex flex-col items-center justify-center p-2 rounded-xl transition-all group active:scale-95"
              >
                <ImageIcon className="w-5 h-5 text-green-500" />
              </button>
              <button 
                onClick={() => setShowCreatePost(true)} 
                className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl transition-all group active:scale-95"
              >
                <Smile className="w-5 h-5 text-yellow-500" />
              </button>
            </div>
          </div>

          {/* Stories List */}
          <div className="mb-0 sm:mb-6 overflow-hidden border-b-[8px] border-gray-100 bg-white pb-3 sm:pb-4 md:border-t md:border-gray-100">
            <div className="flex space-x-3 overflow-x-auto no-scrollbar pt-3 pb-1 px-4 sm:px-0">
              <StoryItem 
                story={{ isUser: true, bg: currentUser?.avatar || 'https://picsum.photos/seed/myprofile/200/300', name: 'Create Story' }} 
                onClick={() => setShowCreateStory(true)} 
              />
              {stories.map(story => (
                <StoryItem key={story.id} story={story} onClick={() => setViewingStory(story)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col pb-20 space-y-0 sm:space-y-4 md:space-y-6">
            {isFeedLoading ? (
              <>
                {[1, 2, 3].map((key) => (
                  <div key={key} className="bg-white md:rounded-[22px] border-b border-gray-100 md:border p-6 shadow-sm animate-pulse">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="w-1/3 h-3 bg-gray-200 rounded"></div>
                        <div className="w-1/4 h-2 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="w-5/6 h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="w-full h-64 bg-gray-100 rounded-xl mb-3"></div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {posts.slice(0, visiblePostsCount).map((post, index) => (
                  <React.Fragment key={post.id}>
                    <div className="min-h-[300px] overflow-hidden bg-white border-b-[8px] border-gray-100 md:border md:border-gray-200 md:rounded-2xl pt-2 pb-1 content-auto will-change-transform">
                      <PostItem post={post} />
                    </div>
                    {index === 0 && <SuggestedAccounts />}
                  </React.Fragment>
                ))}
                {posts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Globe className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-bold">No posts yet. Be the first to post!</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <RightPanel />
      </div>

      {/* Create Post Page Overlay */}
      {showCreatePost && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200 overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
            <button onClick={() => setShowCreatePost(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-900" /></button>
            <h3 className="font-black text-gray-900 text-xl text-center flex-1 tracking-tight">Create post</h3>
            <button onClick={handleCreatePost} disabled={loading || (!postText.trim() && postFiles.length === 0)} className="text-blue-500 font-black px-4 py-2 hover:bg-blue-50 rounded-xl transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
          <div className="flex-1 p-6 max-w-[800px] mx-auto w-full flex flex-col">
            <div className="flex items-center space-x-3 mb-6">
              <img 
                src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
                alt="Profile" 
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-100" 
              />
              <div>
                <h4 className="font-bold text-[16px] text-gray-900 leading-tight">{currentUser?.name || 'Ennvo'}</h4>
                <div className="bg-gray-100 text-gray-700 text-[12px] font-bold px-3 py-1 rounded-lg mt-1 inline-flex items-center cursor-pointer hover:bg-gray-200 transition-colors">Public <ChevronDown className="w-3 h-3 ml-1" /></div>
              </div>
            </div>
            <div className={`w-full flex-1 min-h-[300px] rounded-2xl transition-all duration-300 ${postBg} ${postBg !== 'bg-white' ? 'flex items-center justify-center p-8 shadow-inner' : ''}`}>
              <textarea placeholder={`What's on your mind, ${currentUser?.name?.split(' ')[0] || 'Ennvo'}?`} value={postText} onChange={(e) => setPostText(e.target.value)} className={`w-full resize-none focus:outline-none bg-transparent ${postBg !== 'bg-white' ? 'text-white text-center text-4xl font-bold placeholder-white/70' : 'text-[24px] text-gray-800 placeholder-gray-400'} leading-relaxed`} autoFocus rows={postBg !== 'bg-white' ? 3 : 8}></textarea>
            </div>
            {postPreviews.length > 0 && (
              <div className="mt-6">
                <div className={`grid gap-2 ${postPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {postPreviews.map((img, idx) => (
                    <div key={idx} className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                      <img src={img} alt="Upload preview" className="w-full h-[200px] object-cover" />
                      <button onClick={() => { setPostFiles(prev => prev.filter((_, i) => i !== idx)); setPostPreviews(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors backdrop-blur-sm"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3 mt-6">
              {bgColors.map((bg, i) => (
                <button key={i} onClick={() => { setPostBg(bg); setPostFiles([]); setPostPreviews([]); }} className={`w-10 h-10 rounded-xl border-2 ${postBg === bg ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'} ${bg} shadow-sm transition-all`} />
              ))}
            </div>
            <div className="border border-gray-200 rounded-2xl p-5 flex items-center justify-between mt-6 shadow-sm bg-white">
              <span className="font-bold text-[16px] text-gray-900">Add to your post</span>
              <div className="flex space-x-2">
                <input type="file" accept="image/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors shadow-sm"><ImageIcon className="w-6 h-6 text-green-500" /></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors shadow-sm"><Video className="w-6 h-6 text-red-500" /></button>
                <button className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors shadow-sm"><Smile className="w-6 h-6 text-yellow-500" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Camera Overlay */}
      {showCreateStory && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200 overflow-hidden">
          {storyPreview ? (
            <div className="relative flex-1 overflow-hidden flex flex-col pt-safe pb-safe">
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="p-2 text-white bg-black/40 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 flex items-center justify-center bg-black/90 min-h-0 overflow-hidden relative">
                {storyFile?.type.startsWith('video') ? (
                  <video src={storyPreview} controls className="w-full h-full object-contain rounded-2xl" autoPlay loop muted playsInline />
                ) : (
                  <img src={storyPreview} className="w-full h-full object-contain rounded-2xl" alt="Story preview" />
                )}
              </div>
              <div className="p-4 bg-black flex justify-between items-center z-10 pb-8">
                <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="px-6 py-3 bg-gray-800 text-white rounded-full font-bold">Discard</button>
                <button onClick={confirmCreateStory} disabled={loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold flex items-center space-x-2 transition-colors">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Post Story</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 overflow-hidden">
              <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" ref={(ref) => { if (ref && !ref.srcObject) { navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }).then(stream => { ref.srcObject = stream; }).catch(err => console.error("Camera access denied:", err)); } }} />
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent pt-safe">
                <button onClick={() => setShowCreateStory(false)} className="p-2 text-white"><X className="w-7 h-7" /></button>
                <button className="flex items-center space-x-2 bg-black/60 px-4 py-1.5 rounded-full text-white font-semibold text-sm"><Music className="w-4 h-4" /><span>Add Sound</span></button>
                <div className="flex flex-col space-y-4 items-center">
                  <button className="flex flex-col items-center text-white"><Type className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Text</span></button>
                  <button className="flex flex-col items-center text-white"><Smile className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Stickers</span></button>
                  <button className="flex flex-col items-center text-white"><Settings2 className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Filters</span></button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-safe">
                <div className="flex space-x-8 mb-6 text-white/80 font-bold text-sm">
                  <button className="text-white border-b-2 border-white pb-1">Story</button>
                  <button className="hover:text-white">Photo</button>
                  <button className="hover:text-white">Video</button>
                </div>
                <div className="flex items-center justify-between w-full px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 overflow-hidden relative">
                      <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                      <img src="https://picsum.photos/seed/gallery/100/100" className="w-full h-full object-cover" alt="Gallery" />
                    </div>
                    <span className="text-white text-[11px] font-bold mt-2">Upload</span>
                  </div>
                  <div className="relative">
                    <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                    <button className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform active:scale-95 bg-white/20">
                      <div className="w-16 h-16 bg-white rounded-full transition-all"></div>
                    </button>
                  </div>
                  <div className="flex flex-col items-center opacity-0"><div className="w-10 h-10"></div><span className="text-white text-[11px] font-bold mt-2">Effects</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
