import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Image as ImageIcon, Play, User, Hash, MapPin, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';
import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from '../firebase';
import { followUser } from '../services/followService';
import { VerifiedBadge } from '../components/VerifiedBadge';

const POPULAR_TAGS = ['#funny', '#music', '#dance', '#tech', '#lifestyle', '#art'];

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [postsResults, setPostsResults] = useState<any[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const tabs = ['All', 'Posts', 'Accounts', 'Videos'];
  const { setViewingMedia, setViewingUser, setViewingReel, pushPage, currentUser } = useAppStore();

  // Load discovery content
  useEffect(() => {
    if (searchTerm.trim()) return;

    const fetchDiscovery = async () => {
      setLoading(true);
      try {
        let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
        
        if (activeTab === 'Posts') {
          q = query(collection(db, 'posts'), where('type', '==', 'post'), orderBy('createdAt', 'desc'), limit(30));
        } else if (activeTab === 'Videos') {
          q = query(collection(db, 'posts'), where('type', '==', 'reel'), orderBy('createdAt', 'desc'), limit(30));
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDiscoveryItems(items);
      } catch (err) {
        console.error("Discovery fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscovery();
  }, [searchTerm, activeTab]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setUsers([]);
      setPostsResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        // Search by name
        const usersNameQ = query(
          collection(db, 'users'),
          where('name', '>=', searchTerm),
          where('name', '<=', searchTerm + '\uf8ff'),
          limit(10)
        );
        
        // Search by username
        const usersUsernameQ = query(
          collection(db, 'users'),
          where('username', '>=', searchTerm.toLowerCase()),
          where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
          limit(10)
        );

        const postsQ = query(
          collection(db, 'posts'),
          where('text', '>=', searchTerm.toLowerCase()),
          where('text', '<=', searchTerm.toLowerCase() + '\uf8ff'),
          limit(20)
        );

        const [nameSnap, usernameSnap, postsSnap] = await Promise.all([
          getDocs(usersNameQ),
          getDocs(usersUsernameQ),
          getDocs(postsQ)
        ]);

        const userMap = new Map();
        nameSnap.docs.forEach(doc => userMap.set(doc.id, { uid: doc.id, ...doc.data(), searchType: 'user' }));
        usernameSnap.docs.forEach(doc => userMap.set(doc.id, { uid: doc.id, ...doc.data(), searchType: 'user' }));
        
        const userResults = Array.from(userMap.values());
        const rawPostResults = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), searchType: 'post' } as any));
        
        // Final filtering based on tab if needed (though discovery logic might handle it too)
        const postResults = rawPostResults.filter(p => {
          if (activeTab === 'Videos') return p.type === 'reel';
          if (activeTab === 'Posts') return p.type === 'post';
          return true;
        });
        
        setUsers(userResults);
        setPostsResults(postResults);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleUserClick = (user: any) => {
    setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar });
    pushPage('profile');
  };

  const handleFollow = async (e: React.MouseEvent, target: any) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      await followUser(currentUser, target);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#fafafa] flex flex-col items-center pb-20">
      {/* Mobile Header */}
      <div className="sm:hidden w-full px-4 py-4 border-b border-gray-100 flex items-center space-x-4 bg-white sticky top-0 z-20">
        <button onClick={() => pushPage('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Search</h2>
      </div>

      <div className="w-full max-w-[800px] pt-4 sm:pt-8 px-4">
        {/* Search Input */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for people..." 
            className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-[16px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all" 
            autoFocus 
          />
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-4 overflow-x-auto no-scrollbar pb-2">
          {tabs.map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-6 py-2.5 rounded-full font-bold text-[14px] transition-colors whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Popular Tags */}
        {!searchTerm && (
          <div className="flex space-x-2 mb-6 overflow-x-auto no-scrollbar pb-2">
            {POPULAR_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setSearchTerm(tag)}
                className="flex items-center space-x-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-[13px] border border-gray-200 transition-colors whitespace-nowrap active:scale-95"
              >
                <Hash className="w-3 h-3 text-blue-500" />
                <span>{tag.replace('#', '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="w-full">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!loading && searchTerm && users.length === 0 && postsResults.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No results found matching "{searchTerm}"
            </div>
          )}

          {searchTerm && (
            <div className="space-y-6">
              {/* Users Search Result */}
              {(activeTab === 'All' || activeTab === 'Accounts') && users.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-black text-gray-900 text-lg px-2">Accounts</h3>
                  {users.map((user) => (
                    <div 
                      key={user.uid} 
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user)}
                    >
                      <div className="flex items-center space-x-3">
                        <img 
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
                          className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" 
                          alt={user.name || 'User'} 
                          referrerPolicy="no-referrer" 
                        />
                        <div>
                          <div className="flex items-center space-x-1">
                            <h4 className="font-bold text-gray-900">{user.name || 'User'}</h4>
                            {user.isVerified && <VerifiedBadge />}
                          </div>
                          <p className="text-gray-500 text-sm">@{user.username || (user.name ? user.name.toLowerCase().replace(/ /g, '') : 'user')}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleFollow(e, user)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-blue-100"
                      >
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Posts Search Result */}
              {(activeTab === 'All' || activeTab === 'Posts' || activeTab === 'Videos') && postsResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-black text-gray-900 text-lg px-2">Posts & Reels</h3>
                  <div className="grid grid-cols-3 gap-1 md:gap-4">
                    {postsResults.map((post) => (
                      <div 
                        key={post.id} 
                        onClick={() => {
                          if (post.type === 'reel') {
                            setViewingReel({ ...post, single: true });
                          } else {
                            setViewingMedia({ type: 'post', url: post.media?.[0], user: { name: post.authorName, avatar: post.authorAvatar }, likes: post.likesCount, comments: post.commentsCount });
                          }
                        }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative aspect-square md:aspect-[4/5] group cursor-pointer"
                      >
                        {post.media?.[0] ? (
                          <>
                            {post.type === 'reel' ? (
                              <div className="w-full h-full relative">
                                <video src={`${post.media[0]}#t=0.001`} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-8 h-8 text-white fill-white" />
                                </div>
                                <div className="absolute bottom-2 left-2 flex items-center space-x-1 text-white">
                                  <Play className="w-3 h-3 fill-white" />
                                  <span className="text-[10px] font-bold">{post.viewsCount || 0}</span>
                                </div>
                              </div>
                            ) : (
                              <img src={post.media[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="post" referrerPolicy="no-referrer" />
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 p-4 flex items-center justify-center">
                            <p className="text-white text-[10px] font-bold text-center line-clamp-4">{post.text}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Discovery Content (when not searching) */}
          {!loading && !searchTerm && (
            <div className="grid grid-cols-3 gap-1 md:gap-4">
              {discoveryItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    if (item.type === 'reel') {
                      setViewingReel({ ...item, single: true });
                    } else {
                      setViewingMedia({ type: 'post', url: item.media?.[0], user: { name: item.authorName, avatar: item.authorAvatar }, likes: item.likesCount, comments: item.commentsCount });
                    }
                  }}
                  className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative group cursor-pointer ${item.type === 'reel' ? 'aspect-[9/16]' : 'aspect-square'}`}
                >
                  {item.media?.[0] ? (
                    <>
                      {item.type === 'reel' ? (
                        <div className="w-full h-full relative">
                          <video src={`${item.media[0]}#t=0.001`} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.1; }} />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-8 h-8 text-white fill-white" />
                          </div>
                          <div className="absolute bottom-2 left-2 flex items-center space-x-1 text-white z-10">
                            <Play className="w-3 h-3 fill-white" />
                            <span className="text-[10px] font-bold">{item.viewsCount || 0}</span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                        </div>
                      ) : (
                        <img src={item.media[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="post" referrerPolicy="no-referrer" />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-600 p-3 flex items-center justify-center">
                      <p className="text-white text-[10px] sm:text-xs font-bold text-center line-clamp-4 leading-tight">{item.text}</p>
                    </div>
                  )}
                </div>
              ))}
              
              {discoveryItems.length === 0 && (
                <div className="col-span-3 py-20 text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-10" />
                  <p>No content discovered yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
