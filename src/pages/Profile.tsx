import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, query, collection, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Grid, Bookmark, UserSquare, Link as LinkIcon, Heart, MessageCircle, PlaySquare, Play, ArrowLeft, Globe, MoreHorizontal, Send, CheckCircle2, UserPlus, X, Lock } from 'lucide-react';
import { useAppStore } from '../store';
import { PostItem } from '../components/PostItem';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { followUser, unfollowUser, checkFriendship } from '../services/followService';
import { getFeed, subscribeUserPosts, getUserTotalLikes, getSavedPosts } from '../services/postService';
import { createConversation } from '../services/chatService';
import { Post, User } from '../types';
import { formatTime, formatCount } from '../utils';

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('reels');
  const { viewingUser, setViewingUser, setViewingMedia, setViewingReel, setViewingReelContext, currentUser, pushPage, popPage, setActiveChat } = useAppStore();
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [peopleList, setPeopleList] = useState<any[]>([]);
  const [friendship, setFriendship] = useState({ following: false, followedBy: false, isFriend: false });
  const [loading, setLoading] = useState(false);

  // Profile views states
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [showProfileViews, setShowProfileViews] = useState(false);
  const [profileViewers, setProfileViewers] = useState<any[]>([]);

  const isCurrentUser = !viewingUser || viewingUser.uid === currentUser?.uid;
  const targetUserId = isCurrentUser ? currentUser?.uid : viewingUser.uid;
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    if (targetUserId) {
      const unsubscribe = onSnapshot(doc(db, 'users', targetUserId), (doc) => {
        if (doc.exists()) {
          setUserData({ uid: doc.id, ...doc.data() } as User);
        }
      });
      return () => unsubscribe();
    }
  }, [targetUserId]);

  const user = isCurrentUser ? (userData || currentUser) : (userData || viewingUser);

  // Track and fetch profile views
  useEffect(() => {
    if (user?.uid) {
      if (!isCurrentUser && currentUser) {
        import('firebase/firestore').then(({ setDoc, doc }) => {
          setDoc(doc(db, 'users', user.uid, 'profileViews', currentUser.uid), {
            uid: currentUser.uid,
            name: currentUser.name,
            avatar: currentUser.avatar,
            timestamp: Date.now()
          }, { merge: true }).catch(console.error);
        });
      }

      if (isCurrentUser) {
        let unsubscribeViews = () => {};
        import('firebase/firestore').then(({ collection, onSnapshot }) => {
          const viewsRef = collection(db, 'users', user.uid, 'profileViews');
          unsubscribeViews = onSnapshot(viewsRef, (snapshot) => {
            setProfileViewsCount(snapshot.docs.length);
            if (showProfileViews) {
               const list = snapshot.docs.map(d => d.data());
               list.sort((a: any, b: any) => b.timestamp - a.timestamp);
               setProfileViewers(list);
            }
          });
        });
        return () => unsubscribeViews();
      }
    }
  }, [user?.uid, isCurrentUser, currentUser, showProfileViews]);
  
  const profileName = user?.name || 'User';
  const profileAvatar = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=random`;
  const profileHandle = user?.username ? `@${user.username}` : (user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '_')}` : '@user');

  const reels = profilePosts.filter(p => p.type === 'reel');
  const regularPosts = profilePosts.filter(p => p.type !== 'reel');

  useEffect(() => {
    if (user?.uid) {
      // Subscribe to user posts
      const unsubscribePosts = subscribeUserPosts(user.uid, (posts) => {
        setProfilePosts(posts);
      });

      // Real-time total likes
      const qLikes = query(collection(db, 'posts'), where('authorId', '==', user.uid));
      const unsubscribeLikes = onSnapshot(qLikes, (snapshot) => {
        let total = 0;
        snapshot.docs.forEach((doc) => {
          total += doc.data().likesCount || 0;
        });
        setTotalLikes(total);
      });

      // Fetch followers/following list if open
      let unsubscribePeople: () => void = () => {};
      if (showFollowersList) {
        const qPeople = query(collection(db, 'users', user.uid, showFollowersList), orderBy('createdAt', 'desc'));
        unsubscribePeople = onSnapshot(qPeople, (snapshot) => {
          const list = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
          setPeopleList(list);
        });
      }
      
      // Check friendship with real-time subscription for ultra speed
      let unsubscribeFriendship: () => void = () => {};
      if (!isCurrentUser && currentUser) {
        const followingRef = doc(db, 'users', currentUser.uid, 'following', user.uid);
        const followerRef = doc(db, 'users', user.uid, 'following', currentUser.uid);

        const unsubFollowing = onSnapshot(followingRef, (doc1) => {
          const following = doc1.exists();
          const unsubFollowed = onSnapshot(followerRef, (doc2) => {
            const followedBy = doc2.exists();
            setFriendship({ following, followedBy, isFriend: following && followedBy });
          });
          unsubscribeFriendship = () => { unsubFollowing(); unsubFollowed(); };
        });
      }

      return () => {
        unsubscribePosts();
        unsubscribeFriendship();
        unsubscribeLikes();
        unsubscribePeople();
      };
    }
  }, [user?.uid, currentUser?.uid, isCurrentUser, showFollowersList]);

  useEffect(() => {
    if (isCurrentUser && activeTab === 'saved' && user?.uid) {
      // Real-time snapshot to ensure favorites are always up-to-date across navigation
      const unsub = onSnapshot(collection(db, 'users', user.uid, 'favorites'), () => {
        getSavedPosts(user.uid).then(posts => setSavedPosts(posts));
      });
      return () => unsub();
    }
  }, [activeTab, isCurrentUser, user?.uid]);

  const handleFollow = async () => {
    if (!currentUser || !user || isCurrentUser) return;
    
    // Optimistic update
    const wasFollowing = friendship.following;
    setFriendship(prev => ({ 
      ...prev, 
      following: !wasFollowing, 
      isFriend: !wasFollowing ? prev.followedBy : false 
    }));

    try {
      if (wasFollowing) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, user);
      }
    } catch (error) {
      // Revert on error
      setFriendship(prev => ({ 
        ...prev, 
        following: wasFollowing, 
        isFriend: wasFollowing ? prev.followedBy : false 
      }));
      console.error(error);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !user || isCurrentUser) return;
    try {
      const convId = await createConversation(
        [currentUser.uid, user.uid],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [user.uid]: { name: user.name, avatar: user.avatar }
        }
      );
      setActiveChat(convId);
      pushPage('messages');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center relative">
      <AnimatePresence>
        {/* Profile Views List */}
        {showProfileViews && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
            <div className="h-[60px] border-b border-gray-100 flex items-center px-4 sticky top-0 bg-white z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowProfileViews(false); }} 
                className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="flex-1 text-center font-bold text-lg capitalize mr-10">Profile Views</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {profileViewers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Globe className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium">No views yet</p>
                </div>
              ) : (
                profileViewers.map((viewer) => (
                  <div 
                    key={viewer.uid} 
                    className="flex items-center justify-between p-3 first:pt-0 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors"
                    onClick={() => {
                      setViewingUser({ uid: viewer.uid, name: viewer.name, avatar: viewer.avatar });
                      setShowProfileViews(false);
                      pushPage('profile');
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <img 
                        src={viewer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewer.name)}&background=random`} 
                        className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" 
                        referrerPolicy="no-referrer" 
                      />
                      <div>
                        <p className="font-bold text-[15px] text-gray-900">{viewer.name}</p>
                        <p className="text-gray-500 text-[11px] font-medium">{new Date(viewer.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <button className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95">View</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {showFollowersList && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
            <div className="h-[60px] border-b border-gray-100 flex items-center px-4 sticky top-0 bg-white z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowFollowersList(null); }} 
                className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="flex-1 text-center font-bold text-lg capitalize mr-10">{showFollowersList}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {peopleList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <UserPlus className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium">No {showFollowersList} yet</p>
                </div>
              ) : (
                peopleList.map((person) => (
                  <div 
                    key={person.uid} 
                    className="flex items-center justify-between p-3 first:pt-0 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors"
                    onClick={() => {
                      setViewingUser({ uid: person.uid, name: person.name, avatar: person.avatar });
                      setShowFollowersList(null);
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <img 
                        src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=random`} 
                        className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" 
                        referrerPolicy="no-referrer" 
                      />
                      <div>
                        <p className="font-bold text-[15px] text-gray-900">{person.name}</p>
                        <p className="text-gray-500 text-[13px]">@{person.username || (person.name || 'user').toLowerCase().replace(/ /g, '')}</p>
                      </div>
                    </div>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all active:scale-95">View</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="w-full max-w-[935px] px-2 md:px-8 py-4 md:py-12">
          {/* TikTok-style Profile Header (Compact & Rearranged) */}
          <div className="bg-white overflow-hidden mb-4 md:mb-6 relative p-4 md:p-6 flex flex-col items-center text-center">
            
            {!isCurrentUser && (
              <button 
                onClick={() => popPage()}
                className="absolute top-2 left-2 z-30 bg-gray-100 hover:bg-gray-200 text-gray-900 p-2 rounded-full transition-all border border-gray-200 active:scale-90"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {isCurrentUser && (
              <div 
                className="absolute top-2 right-2 z-30 flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-full transition-all border border-gray-200 cursor-pointer active:scale-95"
                onClick={() => setShowProfileViews(true)}
              >
                <Globe className="w-4 h-4" />
                <span className="font-bold text-sm tracking-tight">{profileViewsCount}</span>
              </div>
            )}

            <div className="relative z-20 mb-3">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-gray-100 shadow-sm overflow-hidden bg-white">
                <img src={profileAvatar} alt="Profile" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>

            <div className="space-y-0.5 mb-4">
              <div className="flex items-center justify-center space-x-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">{profileName}</h1>
                {user?.isVerified && (
                  <VerifiedBadge />
                )}
              </div>
              <p className="text-gray-500 font-medium text-sm">@{profileHandle.replace('@', '')}</p>
            </div>

            {/* Stats Grid (Below Name) */}
            <div className="flex items-center justify-center space-x-6 md:space-x-10 mb-6 w-full">
              <div 
                className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setShowFollowersList('following')}
              >
                <span className="text-lg font-bold text-gray-900">{formatCount(user?.followingCount || 0)}</span>
                <span className="text-gray-500 text-[12px] font-medium tracking-tight">Following</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer border-x border-gray-100 px-6 md:px-10 hover:opacity-70 transition-opacity"
                onClick={() => setShowFollowersList('followers')}
              >
                <span className="text-lg font-bold text-gray-900">{formatCount(user?.followersCount || 0)}</span>
                <span className="text-gray-500 text-[12px] font-medium tracking-tight">Followers</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                <span className="text-lg font-bold text-gray-900">{formatCount(totalLikes)}</span>
                <span className="text-gray-500 text-[12px] font-medium tracking-tight">Likes</span>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-2 w-full max-w-[280px] mb-6">
              {isCurrentUser ? (
                <>
                  <button 
                    onClick={() => pushPage('edit-profile')}
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-bold text-[13px] px-6 py-2 rounded-lg transition-all active:scale-95"
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={() => pushPage('settings')}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all text-gray-900"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    disabled={loading}
                    className={`flex-1 ${friendship.following ? 'bg-gray-100 text-gray-900' : 'bg-blue-500 text-white'} font-bold text-[13px] px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50`}
                  >
                    {friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
                  </button>
                  <button 
                    onClick={handleMessage}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-[13px] px-6 py-2 rounded-lg transition-all active:scale-95"
                  >
                    Message
                  </button>
                </>
              )}
            </div>

            {/* Bio & Link (Bottom) */}
            <div className="max-w-[300px] space-y-1.5">
              <p className="text-gray-700 text-[13px] leading-relaxed whitespace-pre-line">
                {user?.bio || 'Digital Creator • UI/UX Enthusiast 🎨\nTurning coffee into code ☕✨'}
              </p>
              {user?.link && (
                <a 
                  href={user.link.startsWith('http') ? user.link : `https://${user.link}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-1 text-blue-600 hover:underline cursor-pointer"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span className="text-[12px] font-medium">{user.link.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          </div>

        {/* Modern Tabs */}
        {(!isCurrentUser && userData?.isPrivate && !friendship.following) ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-t border-gray-100 w-full">
            <Lock className="w-16 h-16 mb-4 text-gray-200" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">This account is private</h2>
            <p className="text-[14px]">Follow this account to see their photos and videos.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center space-x-2 mb-8">
              <button 
                onClick={() => setActiveTab('posts')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-[13px] shadow-sm transition-transform active:scale-95 ${activeTab === 'posts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
              >
                <Grid className="w-4 h-4" />
                <span>Posts</span>
              </button>
              <button 
                onClick={() => setActiveTab('reels')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-[13px] shadow-sm transition-transform active:scale-95 ${activeTab === 'reels' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
              >
                <PlaySquare className="w-4 h-4" />
                <span>Reels</span>
              </button>
              {isCurrentUser && (
                <button 
                  onClick={() => setActiveTab('saved')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-[13px] shadow-sm transition-transform active:scale-95 ${activeTab === 'saved' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Saved</span>
                </button>
              )}
            </div>

            {/* Posts Feed */}
            {activeTab === 'posts' && (
              <div className="flex flex-col pb-20 max-w-[600px] mx-auto w-full">
                {regularPosts.map((post) => (
                  <PostItem key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Reels Grid */}
            {activeTab === 'reels' && (
              <div className="grid grid-cols-3 gap-1 sm:gap-4 pb-20">
                {reels.map((reel) => (
                  <div 
                    key={reel.id} 
                    className="relative aspect-[9/16] bg-black overflow-hidden rounded-2xl cursor-pointer group shadow-sm"
                    onClick={() => {
                      setViewingReelContext(user?.uid || 'all');
                      setViewingReel(reel);
                    }}
                  >
                    <video 
                      src={`${reel.media?.[0]}#t=0.001`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 pointer-events-none" 
                      muted 
                      playsInline
                      preload="auto"
                      poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                      onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80"></div>
                    <div className="absolute bottom-4 left-4 flex items-center text-white font-bold text-[14px] drop-shadow-md">
                      <Play className="w-4 h-4 mr-1 fill-white" /> {reel.viewsCount || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Saved Grid */}
            {activeTab === 'saved' && (
              <div className="grid grid-cols-3 gap-1 sm:gap-4 pb-20">
                {savedPosts.map((post) => (
                  <div 
                    key={post.id} 
                    className="relative aspect-square bg-gray-100 overflow-hidden rounded-2xl cursor-pointer group shadow-sm"
                    onClick={() => {
                      if (post.type === 'reel') {
                        setViewingReel({ ...post, single: true } as any);
                      } else {
                        setViewingMedia({ type: 'post', url: post.media?.[0] || '', user: { name: post.authorName, avatar: post.authorAvatar } });
                      }
                    }}
                  >
                    {(post.media && post.media.length > 0) ? (
                      post.type === 'reel' ? (
                        <video src={`${post.media[0]}#t=0.001`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none" muted playsInline preload="auto" disablePictureInPicture poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                      ) : (
                        <img src={post.media[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Saved" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-purple-600 text-white text-[10px] font-bold text-center">
                        {post.text?.substring(0, 50)}...
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Heart className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                ))}
                {savedPosts.length === 0 && (
                  <div className="col-span-3 flex flex-col items-center justify-center py-20 text-gray-500">
                    <Bookmark className="w-16 h-16 mb-4 text-gray-300" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">No Saved Content</h2>
                    <p className="text-[14px]">Only you can see what you've saved</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
