import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, VolumeX, Play, X, ArrowLeft, ChevronUp, ChevronDown, Share2, Share, SendHorizontal, Trash2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { subscribeReels, toggleLike, toggleFavorite, incrementViewCount, addComment, getComments, toggleCommentLike } from '../services/postService';
import { Post, Comment } from '../types';
import { followUser, unfollowUser, isFollowing, getFollowing } from '../services/followService';
import { sendNotification } from '../services/notificationService';
import { sendMessage, subscribeConversations } from '../services/chatService';

import { ReelItem } from '../components/ReelItem';

export default function Reels() {
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const { pushPage, currentUser, cachedReels, setCachedReels } = useAppStore();
  const reelsScrollY = useAppStore(state => state.reelsScrollY);
  const setReelsScrollY = useAppStore(state => state.setReelsScrollY);
  const reelsContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Re-attach keyboard listener logic strictly for reels container
    const handleKeyDown = (e: KeyboardEvent) => {
      const c = reelsContainerRef.current;
      if (!c) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        c.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        c.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
      }
    };
    
    const handleRefresh = () => {
      if (reelsContainerRef.current) {
        reelsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Simulate "refreshing" by showing loading briefly or re-shuffling
      setLoading(true);
      setTimeout(() => {
        setReels(prev => [...prev].sort(() => Math.random() - 0.5));
        setLoading(false);
      }, 500);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('refreshReels', handleRefresh);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('refreshReels', handleRefresh);
    };
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Removed scroll state saving constraint to improve performance
  }, []);

  useEffect(() => {
    if (cachedReels.length > 0) {
      setReels(cachedReels);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeReels((fetchedReels) => {
      setReels(fetchedReels);
      setCachedReels(fetchedReels);
      setLoading(false);
    });
    
    // Fetch following list for filtering
    getFollowing(currentUser.uid).then(following => {
      setFollowingIds(new Set(following.map(f => f.uid)));
    });

    return () => unsubscribe();
  }, [currentUser, setCachedReels]);

  const filteredReels = useMemo(() => {
    if (activeTab === 'following') {
      return reels.filter(r => followingIds.has(r.authorId));
    }
    return reels;
  }, [reels, activeTab, followingIds]);

  if (loading) {
    return (
      <div className="h-full w-full bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center text-gray-900 p-4">
        <Play className="w-16 h-16 mb-4 text-gray-300" />
        <h2 className="text-xl font-bold mb-2">No reels yet</h2>
        <p className="text-gray-500 text-center mb-6">Be the first to share a reel!</p>
        <button 
          onClick={() => pushPage('create')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-full transition-all active:scale-95 shadow-lg shadow-blue-100"
        >
          Create Reel
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-transparent overflow-hidden relative">
      {/* Feed Tabs Overlay */}
      <div className="absolute top-4 left-0 right-0 md:left-8 md:right-auto z-40 flex justify-center md:justify-start pointer-events-none">
        <div className="flex items-center space-x-6 px-6 py-2 pointer-events-auto">
          <button 
            onClick={() => setActiveTab('following')}
            className={`text-[15px] font-black drop-shadow-md transition-all ${activeTab === 'following' ? 'text-white scale-105' : 'text-white/60 hover:text-white'}`}
          >
            Following
            {activeTab === 'following' && <motion.div layoutId="reel-tab" className="h-0.5 bg-white rounded-full mt-0.5" />}
          </button>
          <button 
            onClick={() => setActiveTab('forYou')}
            className={`text-[15px] font-black drop-shadow-md transition-all ${activeTab === 'forYou' ? 'text-white scale-105' : 'text-white/60 hover:text-white'}`}
          >
            For You
            {activeTab === 'forYou' && <motion.div layoutId="reel-tab" className="h-0.5 bg-white rounded-full mt-0.5" />}
          </button>
        </div>
      </div>

      <div 
        id="global-reels-container"
        ref={reelsContainerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar overscroll-none"
      >
        {filteredReels.length === 0 && activeTab === 'following' ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
            <UserPlus className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">No following reels</h2>
            <p className="opacity-60 mb-6">Follow some creators to see their content here!</p>
            <button onClick={() => setActiveTab('forYou')} className="bg-white text-black px-8 py-2.5 rounded-full font-bold">Discover Creators</button>
          </div>
        ) : (
          filteredReels.map((reel) => (
            <ReelItem key={reel.id} reel={reel} />
          ))
        )}
      </div>
    </div>
  );
}
