import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, Heart, Search } from 'lucide-react';
import { useAppStore } from '../store';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const LikesList = () => {
  const { showLikesList, setShowLikesList, targetLikesPostId, setTargetLikesPostId, setViewingUser, pushPage } = useAppStore();
  const [likers, setLikers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (showLikesList && targetLikesPostId) {
      setLoading(true);
      const fetchLikers = async () => {
        try {
          const likesCol = collection(db, 'posts', targetLikesPostId, 'likes');
          const snapshot = await getDocs(likesCol);
          const userIds = snapshot.docs.map(d => d.id);
          
        const userPromises = userIds.map(async (uid) => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          return { uid, ...(userDoc.data() || {}) } as any;
        });
          
          const users = await Promise.all(userPromises);
          setLikers(users.filter(u => u.name)); // only those who have data
        } catch (err) {
          console.error("Failed to fetch likers:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchLikers();
    }
  }, [showLikesList, targetLikesPostId]);

  const handleClose = () => {
    setShowLikesList(false);
    setTargetLikesPostId(null);
  };

  const filteredLikers = likers.filter(l => 
    (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.username && l.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <AnimatePresence>
      {showLikesList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm h-full max-h-[500px] flex flex-col overflow-hidden shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <h3 className="font-black text-gray-900 tracking-tight">Likes</h3>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search likers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all border border-transparent focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-400 font-medium">Loading likers...</p>
                </div>
              ) : filteredLikers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <UserIcon className="w-12 h-12 opacity-10 mb-2" />
                  <p className="text-sm">No likers found</p>
                </div>
              ) : (
                filteredLikers.map((user) => (
                  <div 
                    key={user.uid} 
                    onClick={() => {
                      setViewingUser(user);
                      pushPage('profile');
                      handleClose();
                    }}
                    className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center space-x-3">
                      <img 
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                        className="w-11 h-11 rounded-full object-cover shadow-sm border border-gray-100"
                        referrerPolicy="no-referrer"
                        alt={user.name}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-sm tracking-tight">{user.name}</span>
                        <span className="text-gray-500 text-[12px]">@{user.username || user.name.toLowerCase().replace(/\s/g, '')}</span>
                      </div>
                    </div>
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-1.5 rounded-full text-xs font-bold transition-colors">
                      View Profile
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
