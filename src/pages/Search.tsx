import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Play, UserPlus, Heart, MessageCircle } from 'lucide-react';
import { searchUsers } from '../services/authService';
import { followUser, unfollowUser, isFollowing } from '../services/followService';
import { searchPosts, subscribeFeed } from '../services/postService';
import { useAppStore } from '../store';
import { PostItem } from '../components/PostItem';
import { User, Post } from '../types';

export default function Search() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'videos'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [discoveryPosts, setDiscoveryPosts] = useState<Post[]>([]);
  const [followingMap, setFollowingMap] = useState<{ [uid: string]: boolean }>({});
  const { currentUser, setViewingUser, pushPage, setViewingMedia, setViewingReel, setViewingReelContext } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Discovery content
  useEffect(() => {
    const unsub = subscribeFeed((posts) => {
      setDiscoveryPosts(posts);
    }, 24);
    return () => unsub();
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setPostResults([]);
      return;
    }
    setLoading(true);
    try {
      const users = await searchUsers(query);
      setSearchResults(users);
      
      const posts = await searchPosts(query);
      setPostResults(posts);

      if (currentUser) {
        const map: { [uid: string]: boolean } = {};
        for (const user of users) {
          map[user.uid] = await isFollowing(currentUser.uid, user.uid);
        }
        setFollowingMap(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    // Simple debounce
    const timer = setTimeout(() => handleSearch(val), 300);
    return () => clearTimeout(timer);
  };

  const handleFollowToggle = async (user: User) => {
    if (!currentUser) return;
    const isCurrentlyFollowing = followingMap[user.uid];
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.uid, user.uid);
        setFollowingMap(prev => ({ ...prev, [user.uid]: false }));
      } else {
        await followUser(currentUser, user);
        setFollowingMap(prev => ({ ...prev, [user.uid]: true }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const currentPosts = searchQuery ? postResults : discoveryPosts;

  return (
    <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center no-scrollbar">
      
      {/* Sticky Header */}
      <div className="w-full max-w-[600px] sticky top-0 bg-white/95 z-20 pt-4 sm:pt-6 border-b border-gray-100 px-4">
        <div className="mb-4">
          <div className="relative group">
            <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search people or keywords..." 
              value={searchQuery}
              onChange={onSearchChange}
              className="w-full bg-gray-100 text-gray-900 text-[15px] font-medium rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all shadow-sm border border-transparent focus:border-blue-100"
            />
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-8">
          <button 
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-[14px] font-black tracking-tight transition-all border-b-2 flex items-center space-x-2 ${activeTab === 'accounts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span>Accounts</span>
            {searchQuery && searchResults.length > 0 && <span className="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded-md">{searchResults.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('videos')}
            className={`pb-3 text-[14px] font-black tracking-tight transition-all border-b-2 flex items-center space-x-2 ${activeTab === 'videos' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span>Reels</span>
            {searchQuery && postResults.length > 0 && <span className="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded-md">{postResults.length}</span>}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-[600px] pb-24">
        
        {activeTab === 'accounts' && (
          <div className="flex flex-col py-2">
            {searchResults.map(user => (
              <div key={user.uid} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="flex items-center space-x-3 flex-1 min-w-0" onClick={() => { setViewingUser(user); pushPage('profile'); }}>
                  <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.username} className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100" referrerPolicy="no-referrer" />
                  <div className="truncate">
                    <p className="font-bold text-[15px] text-gray-900 truncate tracking-tight">{user.name}</p>
                    <p className="text-[13px] text-gray-500 truncate">@{user.username || (user.name || 'user').toLowerCase().replace(/\s/g, '_')}</p>
                  </div>
                </div>
                {currentUser?.uid !== user.uid && (
                  <button 
                    onClick={() => handleFollowToggle(user)}
                    className={`px-6 py-1.5 rounded-lg text-[13px] font-black transition-all active:scale-95 ${followingMap[user.uid] ? 'bg-gray-100 text-gray-900 border border-gray-200' : 'bg-[#0095f6] text-white hover:bg-blue-600 shadow-md'}`}
                  >
                    {followingMap[user.uid] ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
            {!searchQuery && (
              <div className="p-8 text-center text-gray-400">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-10" />
                <p className="font-bold text-sm">Search for friends and creators</p>
              </div>
            )}
            {searchQuery && !loading && searchResults.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-medium">No accounts found</div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="flex flex-col space-y-2.5 pb-20">
            <div className="grid grid-cols-3 gap-1 px-1">
              {currentPosts.map(post => {
                const isReel = post.type === 'reel';
                return (
                  <div 
                    key={post.id} 
                    className="relative aspect-[9/16] bg-gray-100 cursor-pointer overflow-hidden group"
                    onClick={() => {
                      if (isReel) {
                        setViewingReel(post);
                        setViewingReelContext(currentPosts.filter(p => p.type === 'reel'));
                        pushPage('reels');
                      } else {
                        setViewingMedia({ type: 'image', url: post.media?.[0] || '' });
                      }
                    }}
                  >
                    {isReel ? (
                      <video 
                        src={`${post.media?.[0]}#t=0.001`} 
                        className="w-full h-full object-cover pointer-events-none" 
                        muted 
                        playsInline 
                        preload="auto"
                        poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
                      />
                    ) : (
                      <img src={post.media?.[0]} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isReel ? <Play className="w-8 h-8 text-white fill-white" /> : <Heart className="w-6 h-6 text-white fill-white" />}
                    </div>
                    {isReel && (
                      <div className="absolute top-2 right-2">
                        <Play className="w-4 h-4 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {currentPosts.length === 0 && !loading && (
              <div className="text-center py-20 text-gray-400 font-medium px-4">
                No discovery content found
              </div>
            )}
            {searchQuery && loading && (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
