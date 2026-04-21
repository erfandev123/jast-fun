import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Eye } from 'lucide-react';
import { useAppStore } from '../store';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';

export const AnalyticsModal = () => {
  const { showAnalytics, setShowAnalytics, targetAnalyticsPostId, currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<'likes' | 'views'>('views');
  const [likes, setLikes] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showAnalytics && targetAnalyticsPostId) {
      setLoading(true);
      
      // Listen for likes
      const likesQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'likes'));
      const unsubLikes = onSnapshot(likesQuery, async (snapshot) => {
        const users = await Promise.all(snapshot.docs.map(async (d) => {
          const userDoc = await getDoc(doc(db, 'users', d.id));
          return userDoc.exists() ? { uid: d.id, ...userDoc.data() } : { uid: d.id, name: 'Unknown' };
        }));
        setLikes(users);
      });

      // Listen for views
      const viewsQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'views'));
      const unsubViews = onSnapshot(viewsQuery, async (snapshot) => {
        const users = await Promise.all(snapshot.docs.map(async (d) => {
          const userDoc = await getDoc(doc(db, 'users', d.id));
          return userDoc.exists() ? { uid: d.id, ...userDoc.data() } : { uid: d.id, name: 'Unknown' };
        }));
        setViews(users);
        setLoading(false);
      });

      return () => {
        unsubLikes();
        unsubViews();
      };
    }
  }, [showAnalytics, targetAnalyticsPostId]);

  if (!showAnalytics) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowAnalytics(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[600px]"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-xl text-gray-900 tracking-tight">Post Analytics</h2>
          <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-50">
          <button 
            onClick={() => setActiveTab('views')}
            className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'views' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Views ({views.length})</span>
            </div>
            {activeTab === 'views' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full mx-8" />}
          </button>
          <button 
            onClick={() => setActiveTab('likes')}
            className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'likes' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Heart className="w-4 h-4" />
              <span>Likes ({likes.length})</span>
            </div>
            {activeTab === 'likes' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-full mx-8" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-rotate" />
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Loading data...</p>
            </div>
          ) : (
            (activeTab === 'views' ? views : likes).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                {activeTab === 'views' ? <Eye className="w-12 h-12 opacity-10" /> : <Heart className="w-12 h-12 opacity-10" />}
                <p className="font-bold">No {activeTab} yet</p>
              </div>
            ) : (
              (activeTab === 'views' ? views : likes).map((user: any) => (
                <div key={user.uid} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                      className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm transition-transform group-hover:scale-105" 
                      alt={user.name}
                    />
                    <div>
                      <p className="font-bold text-sm text-gray-900">{user.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">@{user.name.toLowerCase().replace(/\s+/g, '')}</p>
                    </div>
                  </div>
                  <button className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold rounded-lg transition-all active:scale-95">
                    View Profile
                  </button>
                </div>
              ))
            )
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 italic text-[10px] text-gray-400 text-center font-medium">
          Only you can see these analytics for your own content.
        </div>
      </motion.div>
    </div>
  );
};
