import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  Play, 
  VolumeX, 
  Volume2,
  X, 
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Music,
  Repeat
} from 'lucide-react';
import { useAppStore } from '../store';
import { db } from '../firebase';
import { 
  onSnapshot, 
  doc,
  collection,
  query,
  orderBy,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { 
  toggleLike, 
  toggleFavorite, 
  incrementViewCount, 
  addComment, 
  getComments, 
  toggleCommentLike,
  deletePost,
  toggleSongFavorite,
  toggleRepost,
  checkHasReposted
} from '../services/postService';
import { sendNotification } from '../services/notificationService';
import { findUserByUsername } from '../services/userService';
import { subscribeConversations, sendMessage } from '../services/chatService';
import { Post, Comment } from '../types';
import { followUser, unfollowUser } from '../services/followService';
import { formatTime, formatCount } from '../utils';
import { VerifiedBadge } from './VerifiedBadge';

interface ReelItemProps {
  reel: Post;
  isModal?: boolean;
  onClose?: () => void;
}

export const ReelItem: React.FC<ReelItemProps> = React.memo(({ reel, isModal, onClose }) => {
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [repostsCount, setRepostsCount] = useState(reel.repostsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number, x: number, y: number }[]>([]);
  const [isNearScreen, setIsNearScreen] = useState(false);
  const [isVertical, setIsVertical] = useState(true);
  
  const [isSongSaved, setIsSongSaved] = useState(false);
  const isImageReel = reel.media && reel.media.length > 0 && !reel.media[0].match(/\.(mp4|webm|mov|ogg)($|#|\?)/i);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reelSong, setReelSong] = useState<{id: string, title: string, artist: string, url: string} | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<number>(0);
  const [replyTo, setReplyTo] = useState<{id: string, name: string, authorId: string} | null>(null);
  
  const { 
    currentUser, 
    setViewingUser, 
    pushPage, 
    setViewingReel, 
    highlightedCommentId, 
    highlightedPostId, 
    setHighlightedPostId, 
    setShowLikesList, 
    setTargetLikesPostId, 
    setShowViewsList, 
    setTargetViewsPostId, 
    setShowAnalytics, 
    setTargetAnalyticsPostId,
    globalMuted: muted,
    setGlobalMuted: setMuted
  } = useAppStore();

  useEffect(() => {
    // Optimization: Unmount heavy reel contents if they are further than 2 viewports away
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearScreen(entry.isIntersecting);
        });
      },
      { rootMargin: '100% 0px' }
    );
    if (containerRef.current) preloadObserver.observe(containerRef.current);
    
    return () => preloadObserver.disconnect();
  }, []);

  useEffect(() => {
    if (highlightedPostId === reel.id && highlightedCommentId && currentUser) {
      // If there's a highlighted comment for THIS reel, automatically show comments
      setShowComments(true);
      // We don't clear setHighlightedPostId(null) here yet, might need it for scrolling in CommentsPortal
    }
  }, [highlightedCommentId, highlightedPostId, reel.id, currentUser]);

  useEffect(() => {
    return () => {
      // Clear highlights when reel item is destroyed if they matched this reel
      if (typeof setHighlightedPostId === 'function') {
        const { highlightedPostId: currentHPostId } = useAppStore.getState();
        if (currentHPostId === reel.id) {
          useAppStore.getState().setHighlightedPostId(null);
          useAppStore.getState().setHighlightedCommentId(null);
        }
      }
    };
  }, [reel.id]);

  useEffect(() => {
    if (!isNearScreen || !currentUser) return;

    const reelRef = doc(db, 'posts', reel.id);
    const likeRef = doc(db, 'posts', reel.id, 'likes', currentUser.uid);
    const favRef = doc(db, 'users', currentUser.uid, 'favorites', reel.id);
    const followRef = doc(db, 'users', currentUser.uid, 'following', reel.authorId);
    const repostRef = doc(db, 'posts', reel.id, 'reposts', currentUser.uid);

    const unsubReel = onSnapshot(reelRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
        if (data.repostsCount !== undefined) setRepostsCount(data.repostsCount);
      }
    });

    const unsubLike = onSnapshot(likeRef, (s) => setLiked(s.exists()));
    const unsubFav = onSnapshot(favRef, (s) => setSaved(s.exists()));
    const unsubFollow = onSnapshot(followRef, (s) => setIsFollowingUser(s.exists()));
    const unsubRepost = onSnapshot(repostRef, (s) => setReposted(s.exists()));

    let unsubSongFav: () => void = () => {};
    if (reel.songId) {
      getDoc(doc(db, 'songs', reel.songId)).then((snap: any) => {
        if (snap.exists()) {
          setReelSong({ id: snap.id, ...snap.data() } as any);
        }
      });
      const songFavRef = doc(db, 'users', currentUser.uid, 'favoriteSongs', reel.songId);
      unsubSongFav = onSnapshot(songFavRef, (s) => setIsSongSaved(s.exists()));
    }

    return () => {
      unsubReel();
      unsubLike();
      unsubFav();
      unsubFollow();
      unsubRepost();
      unsubSongFav();
    };
  }, [reel.id, currentUser, reel.authorId, isNearScreen]);

  useEffect(() => {
    if (audioRef.current && reelSong) {
      if (playing && !muted) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
      audioRef.current.muted = muted;
    }
  }, [playing, muted, reelSong]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPlaying(true);
            if (currentUser) incrementViewCount(reel.id, currentUser.uid);
          } else {
            setPlaying(false);
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reel.id, currentUser]);

  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            if (!muted) {
              setMuted(true);
              videoRef.current?.play().catch(() => setPlaying(false));
            } else {
              setPlaying(false);
            }
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing, muted]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const ratio = video.videoHeight / video.videoWidth;
    setIsVertical(ratio > 1.5);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleLike(reel.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(reel.authorId, 'like', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
      }
    } catch {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  const handleRepost = async () => {
    if (!currentUser) return;
    const newReposted = !reposted;
    setReposted(newReposted);
    setRepostsCount(prev => newReposted ? prev + 1 : Math.max(0, prev - 1));
    try {
      const isNowReposted = await toggleRepost(reel.id, currentUser.uid);
      if (isNowReposted) {
        // Send notification for reposting
      }
    } catch {
      // Revert if error
      setReposted(!newReposted);
      setRepostsCount(prev => newReposted ? Math.max(0, prev - 1) : prev + 1);
    }
  };

  const handleFavorite = async () => {
    if (!currentUser) return;
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      await toggleFavorite(reel.id, currentUser.uid);
      if (newSaved) {
        await sendNotification(reel.authorId, 'favorite', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
      }
    } catch (e) {
      setSaved(!newSaved);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    // Only toggle if not clicking on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const now = Date.now();
    if (now - lastTap.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newHeart = { id: Date.now(), x, y };
      setFloatingHearts(prev => [...prev, newHeart]);
      if (!liked) handleLike();
      setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id)), 1000);
    } else {
      setPlaying(!playing);
    }
    lastTap.current = now;
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deletePost(reel.id, currentUser!.uid);
      if (isModal && onClose) onClose();
      setShowMoreActions(false);
    } catch (e) {
      console.error(e);
    }
  };

  const isCurrentUser = currentUser?.uid === reel.authorId;

  return (
    <div ref={containerRef} className="w-full h-full snap-start snap-always flex items-center justify-center relative bg-black sm:bg-[#f8f9fa] content-auto">
      {isNearScreen && (
        <div className="flex flex-col md:flex-row items-center md:items-end justify-center w-full h-full max-w-[1200px] mx-auto relative group py-0 md:py-8 md:space-x-4 lg:space-x-8 animate-in fade-in duration-300">
          
          {/* Desktop Left Info Column */}
        <div className="hidden md:flex flex-col justify-end w-[260px] lg:w-[320px] pb-4 shrink-0 transition-all duration-300">
            <div className="flex items-center space-x-3 mb-3">
              <img 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); 
                  if (onClose) onClose();
                  pushPage('profile'); 
                }}
                src={reel.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.authorName)}&background=random`} 
                className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer border border-gray-100" 
              />
              <div className="flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-900 font-bold text-[15px] cursor-pointer hover:underline" onClick={() => {
                     setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); 
                     if (onClose) onClose();
                     pushPage('profile'); 
                  }}>
                    {(reel.authorName || 'User').toLowerCase().replace(/\s+/g, '_')}
                  </span>
                  {(reel as any).authorIsVerified && <VerifiedBadge />}
                </div>
                {/* Audio Info Desktop */}
                <div className="flex items-center space-x-1 text-gray-500 mt-0.5">
                   <Music className="w-3 h-3 shrink-0" />
                   <span className="text-[12px] truncate font-medium">Original Audio</span>
                </div>
              </div>
              {!isCurrentUser && !isFollowingUser && (
                <>
                  <span className="text-gray-300 text-xs px-1">•</span>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUser) return;
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }}
                    className="text-blue-600 font-bold text-[14px] hover:text-blue-700 transition-colors"
                  >
                    Follow
                  </button>
                </>
              )}
            </div>
            {reel.text && (
              <p className="text-gray-800 text-[14px] font-medium leading-[1.5] mb-2 pr-4 break-words whitespace-pre-line">
                {reel.text}
              </p>
            )}
        </div>

        {/* Main Video Container */}
        <div 
          onClick={handleTap}
          className="relative w-full h-full md:h-[min(90dvh,850px)] md:w-auto md:min-w-[350px] md:aspect-[9/16] bg-black sm:rounded-[3px] overflow-hidden md:shadow-[0_0_15px_rgba(0,0,0,0.05)] cursor-pointer flex justify-center group/video shrink-0 pt-0"
        >
          {reelSong && <audio ref={audioRef} src={reelSong.url} loop playsInline preload="auto" className="hidden" />}
          
          {isImageReel ? (
            <div 
              className="w-full h-[calc(100vh-64px)] md:h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
              onScroll={(e) => {
                const el = e.currentTarget;
                const index = Math.round(el.scrollLeft / el.clientWidth);
                setCurrentImageIndex(index);
              }}
            >
              {reel.media.map((url, i) => (
                <img key={i} src={url} className="w-full h-full object-contain shrink-0 snap-center" alt="" />
              ))}
            </div>
          ) : (
            <video 
              ref={videoRef}
              src={`${reel.media?.[0]}#t=0.001`} 
              loop 
              muted={muted || !!reelSong}
              playsInline
              autoPlay={playing}
              preload="auto"
              poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className={`w-full h-[calc(100vh-64px)] md:h-full mx-auto ${isVertical ? 'object-cover md:object-cover' : 'object-contain'}`}
            />
          )}

          {isImageReel && reel.media.length > 1 && (
            <div className="absolute bottom-28 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
              {reel.media.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          )}

          <AnimatePresence>
            {floatingHearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 2.5, y: -200, rotate: (Math.random() - 0.5) * 40 }}
                className="absolute z-50 pointer-events-none"
                style={{ left: heart.x - 20, top: heart.y - 20 }}
              >
                <Heart className="w-12 h-12 fill-red-500 text-red-500 drop-shadow-lg" />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="md:hidden absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pt-20 pointer-events-none"></div>

          {/* Info Bottom (Overlayed on Video - MOBILE ONLY) */}
          <div className="md:hidden absolute bottom-3 left-4 right-4 z-10 text-left flex flex-col pointer-events-auto">
            {reposted && (
              <div className="mb-2 bg-black/30 text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 flex items-center space-x-1 self-start backdrop-blur-md">
                <Repeat className="w-3 h-3" strokeWidth={3} />
                <span>You reposted</span>
              </div>
            )}
            {isCurrentUser && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetAnalyticsPostId(reel.id);
                  setShowAnalytics(true);
                }}
                className="mb-2 bg-black/30 hover:bg-black/50 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 transition-all active:scale-95 flex items-center space-x-1.5 self-start"
              >
                <MoreHorizontal className="w-3 h-3" />
                <span>View Analytics</span>
              </button>
            )}
            <div className="flex items-center space-x-2 mb-2">
              <img 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); 
                  if (onClose) onClose();
                  pushPage('profile'); 
                }}
                src={reel.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.authorName)}&background=random`} 
                className="w-8 h-8 rounded-full object-cover border border-white shadow-lg cursor-pointer" 
              />
              <div className="flex items-center space-x-1">
                <span className="text-white font-bold text-[14px] drop-shadow-md cursor-pointer hover:underline" onClick={() => {
                   setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); 
                   if (onClose) onClose();
                   pushPage('profile'); 
                }}>
                  {(reel.authorName || 'User').toLowerCase().replace(/\s+/g, '_')}
                </span>
                {(reel as any).authorIsVerified && <VerifiedBadge />}
              </div>
              {!isCurrentUser && !isFollowingUser && (
                <>
                  <span className="text-white/60 text-xs">•</span>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUser) return;
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }}
                    className="text-white border border-white/50 bg-black/20 font-bold text-[12px] px-2 py-0.5 rounded-md hover:bg-white hover:text-black transition-colors"
                  >
                    Follow
                  </button>
                </>
              )}
            </div>
            {reel.text && (
              <p className="text-white text-[14px] font-medium leading-[1.4] drop-shadow-md line-clamp-2 pr-[60px] mb-2">
                {reel.text}
              </p>
            )}
            
            {/* Audio Track Info (Optional/Placeholder) */}
            <div className="flex items-center space-x-2 text-white/80 max-w-[200px]">
               <Music className="w-3.5 h-3.5 shrink-0" />
               <div className="flex flex-col overflow-hidden">
                 <span className="text-[12px] truncate font-medium">{reelSong ? reelSong.title : 'Original Audio'}</span>
                 {reelSong && <span className="text-[9px] truncate font-bold text-white/60">{reelSong.artist}</span>}
               </div>
               {reelSong && currentUser && (
                 <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    toggleSongFavorite(reelSong.id, currentUser.uid); 
                  }} 
                  className={`ml-2 p-1.5 rounded-full backdrop-blur-md transition-all active:scale-90 ${isSongSaved ? 'bg-white/20' : 'bg-black/30 hover:bg-black/50'} border border-white/10`}
                 >
                   <Bookmark className={`w-3 h-3 ${isSongSaved ? 'fill-white text-white' : 'text-white'}`} strokeWidth={2.5} />
                 </button>
               )}
            </div>
          </div>

          {/* Vertical Action Buttons (Overlayed on Video - MOBILE ONLY) */}
          <div className="md:hidden absolute right-2 bottom-[calc(max(10px,env(safe-area-inset-bottom)+5px))] flex flex-col items-center space-y-4 z-20 pointer-events-auto">
            <button 
              onClick={(e) => { e.stopPropagation(); handleLike(); }} 
              className="flex flex-col items-center space-y-1 group transition-transform active:scale-90"
            >
              <Heart className={`w-[28px] h-[28px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform active:scale-125 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
              <span className="text-[12px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-tight">{likesCount > 0 ? formatCount(likesCount) : 'Like'}</span>
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center space-y-1 group transition-transform active:scale-90">
              <MessageCircle className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
              <span className="text-[12px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-tight">{commentsCount > 0 ? formatCount(commentsCount) : 'Comment'}</span>
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center space-y-1 group transition-transform active:scale-90">
              <Send className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
              <span className="text-[12px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-tight">Share</span>
            </button>

            <button onClick={(e) => { e.stopPropagation(); handleFavorite(); }} className="flex flex-col items-center space-y-1 group transition-transform active:scale-90">
              <Bookmark className={`w-[28px] h-[28px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${saved ? 'fill-white text-white' : 'text-white'}`} strokeWidth={2.5} />
              <span className="text-[12px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-tight">Save</span>
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); setShowMoreActions(!showMoreActions); }} className="flex flex-col items-center group transition-transform active:scale-90 pb-2">
              <MoreHorizontal className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
            </button>

            {/* Spinning Record */}
            <div 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (reelSong && currentUser) {
                  toggleSongFavorite(reelSong.id, currentUser.uid);
                } 
              }}
              className={`w-[38px] h-[38px] rounded-full border border-white/40 bg-[#1c1c1c] flex items-center justify-center overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.6)] cursor-pointer active:scale-95 transition-transform relative ${playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}
            >
              <img src={reel.authorAvatar || `https://ui-avatars.com/api/?name=Music`} className="w-5 h-5 rounded-full object-cover" />
              {isSongSaved && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <Bookmark className="w-4 h-4 text-white fill-white" />
                </div>
              )}
            </div>
          </div>

            {/* Mute logic */}
            {isImageReel && !reelSong ? null : (
              <button 
                onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                className="absolute top-6 right-4 z-20 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all active:scale-95 border border-white/10"
              >
                {muted ? <VolumeX className="w-5 h-5 fill-white" /> : <Volume2 className="w-5 h-5 fill-white" />}
              </button>
            )}

          {!playing && !isImageReel && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <Play className="w-16 h-16 text-white/40 fill-white/40" />
            </div>
          )}

          {/* Progress Bar (Only for Video) */}
          {!isImageReel && (
            <div className="absolute bottom-1 left-0 right-0 h-[2.5px] bg-white/10 z-30 md:hidden overflow-hidden">
              <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>

        {/* Desktop Right Actions Column */}
        <div className="hidden md:flex flex-col items-center justify-end space-y-6 pb-8 pl-4 w-[60px] shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); handleLike(); }} 
            className="flex flex-col items-center space-y-1 group transition-transform hover:scale-105 active:scale-95"
          >
            <Heart className={`w-[28px] h-[28px] transition-transform ${liked ? 'fill-red-500 text-red-500' : 'text-gray-900 drop-shadow-sm'}`} strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-gray-700">{likesCount > 0 ? formatCount(likesCount) : 'Like'}</span>
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }} 
            className="flex flex-col items-center space-y-1 group transition-transform hover:scale-105 active:scale-95"
          >
            <MessageCircle className="w-[28px] h-[28px] text-gray-900 drop-shadow-sm" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-gray-700">{commentsCount > 0 ? formatCount(commentsCount) : 'Comment'}</span>
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowShare(true); }} 
            className="flex flex-col items-center space-y-1 group transition-transform hover:scale-105 active:scale-95"
          >
            <Send className="w-[28px] h-[28px] text-gray-900 drop-shadow-sm" strokeWidth={2.5} />
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); handleFavorite(); }} 
            className="flex flex-col items-center space-y-1 group transition-transform hover:scale-105 active:scale-95"
          >
            <Bookmark className={`w-[28px] h-[28px] ${saved ? 'fill-black text-black' : 'text-gray-900 drop-shadow-sm'}`} strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMoreActions(!showMoreActions); }} 
            className="flex flex-col items-center space-y-1 group transition-transform hover:scale-105 active:scale-95"
          >
            <MoreHorizontal className="w-[28px] h-[28px] text-gray-900 drop-shadow-sm" strokeWidth={2.5} />
          </button>

          {isCurrentUser && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetAnalyticsPostId(reel.id);
                setShowAnalytics(true);
              }}
              className="mt-4 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
            >
              Analytics
            </button>
          )}
        </div>

        {/* Navigation Indicators (Right far - PC ONLY) */}
        <div className="hidden lg:flex flex-col items-center absolute right-[10px] sm:right-[30px] md:right-[50px] top-[10px] z-50 bg-white/10 p-2 rounded-full backdrop-blur-md border border-white/20">
           <button 
             onClick={(e) => {
               e.stopPropagation();
               const c = document.getElementById('global-reels-container') || document.documentElement;
               c.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
             }}
             title="Previous Reel"
             className="p-3 bg-white/20 rounded-full shadow-md hover:bg-white transition-all active:scale-95 border border-transparent group mb-2"
           >
             <ChevronUp className="w-6 h-6 text-white group-hover:text-gray-900 drop-shadow-md" strokeWidth={3} />
           </button>
           <button 
             onClick={(e) => {
               e.stopPropagation();
               const c = document.getElementById('global-reels-container') || document.documentElement;
               c.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
             }}
             title="Next Reel"
             className="p-3 bg-white/20 rounded-full shadow-md hover:bg-white transition-all active:scale-95 border border-transparent group"
           >
             <ChevronDown className="w-6 h-6 text-white group-hover:text-gray-900 drop-shadow-md" strokeWidth={3} />
           </button>
        </div>

        {/* Modal Close Button */}
        {isModal && (
          <button onClick={onClose} className="absolute top-4 left-4 sm:top-8 sm:left-8 p-3 bg-black/40 sm:bg-white hover:bg-black/60 sm:hover:bg-gray-100 rounded-full text-white sm:text-gray-900 sm:shadow-md sm:border sm:border-gray-200 transition-all active:scale-90 z-[100]">
            <X className="w-6 h-6" strokeWidth={2.5} />
          </button>
        )}
      </div>
      )}

      {/* Action Menu Popover */}
      {showMoreActions && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80" onClick={() => setShowMoreActions(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-[300px] bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => {
              handleRepost();
              setShowMoreActions(false);
            }} className="w-full flex items-center justify-center space-x-2 px-6 py-4 text-center font-bold border-b border-gray-100 active:bg-gray-50 transition-colors">
              <Repeat className={`w-5 h-5 ${reposted ? 'text-green-500' : 'text-gray-900'}`} strokeWidth={2.5} />
              <span className={reposted ? 'text-green-500' : 'text-gray-900'}>{reposted ? 'Undo Repost' : 'Repost'}</span>
            </button>
            {isCurrentUser && (
              <button onClick={handleDelete} className="w-full px-6 py-4 text-center text-red-600 font-bold border-b border-gray-100 active:bg-red-50 transition-colors">
                {confirmDelete ? 'Confirm Delete?' : 'Delete'}
              </button>
            )}
            <button className="w-full px-6 py-4 text-center text-gray-900 font-bold border-b border-gray-100 active:bg-gray-50 transition-colors">
              Add to story
            </button>
            <button className="w-full px-6 py-4 text-center text-gray-900 font-bold border-b border-gray-100 active:bg-gray-50 transition-colors">
              Copy link
            </button>
            <button onClick={() => setShowMoreActions(false)} className="w-full px-6 py-4 text-center text-gray-500 font-medium active:bg-gray-50 transition-colors">
              Cancel
            </button>
          </motion.div>
        </div>
      )}

        {/* Modal Header for Web/Tablets */}
        {isModal && (
          <button onClick={onClose} className="hidden sm:flex absolute -top-12 -left-12 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white border border-white/20 transition-all active:scale-95">
            <X className="w-6 h-6" />
          </button>
        )}

      {/* Overlays */}
      {showComments && (
        <CommentsPortal 
          postId={reel.id} 
          onClose={() => setShowComments(false)} 
          authorId={reel.authorId}
          authorName={reel.authorName}
          authorAvatar={reel.authorAvatar}
          media={reel.media?.[0]} 
          initialReply={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}
      {showShare && (
        <SharePortal reel={reel} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
});

const MentionText = ({ text }: { text: string }) => {
  const parts = (text || '').split(/(@\w+)/g);
  return (
    <p className="text-[14px] text-gray-800 leading-relaxed mt-0.5">
      {parts.map((part, i) => (
        part && part.startsWith('@') ? (
          <span key={i} className="text-blue-500 font-bold hover:underline cursor-pointer">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </p>
  );
};



const CommentItem = React.memo(({ comment, postId, authorId, authorName, authorAvatar, media, onReply }: { comment: Comment, postId: string, authorId: string, authorName: string, authorAvatar: string, media?: string, onReply: (id: string, name: string, authorId: string) => void }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [showOptions, setShowOptions] = useState(false);
  const [cConfirmDelete, setCConfirmDelete] = useState(false);
  const { currentUser, setViewingUser, pushPage, highlightedCommentId, setHighlightedCommentId } = useAppStore();
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedCommentId === comment.id && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedCommentId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedCommentId, comment.id]);

  useEffect(() => {
    if (currentUser && comment.id) {
      const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', currentUser.uid);
      return onSnapshot(likeRef, (doc) => setLiked(doc.exists()));
    }
  }, [postId, comment.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleCommentLike(postId, comment.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(comment.authorId, 'comment_like', currentUser, comment.id, postId, media, 'liked your comment', authorName, authorAvatar);
      }
    } catch (err) {
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  const handleDelete = async () => {
     if (!currentUser || (currentUser.uid !== comment.authorId && currentUser.uid !== authorId)) return;
     if (!cConfirmDelete) {
       setCConfirmDelete(true);
       setTimeout(() => setCConfirmDelete(false), 3000);
       return;
     }
     try {
       const { deleteComment } = await import('../services/postService');
       await deleteComment(postId, comment.id!);
     } catch (err) {
       console.error("Failed to delete comment:", err);
     }
  };

  const handleProfileClick = () => {
    setViewingUser({ uid: comment.authorId, name: comment.authorName, avatar: comment.authorAvatar });
    pushPage('profile');
  };

  return (
    <div ref={itemRef} className={`flex space-x-3 group relative transition-colors duration-500 rounded-xl p-1 ${highlightedCommentId === comment.id ? 'bg-blue-50/50' : ''} ${comment.parentId ? 'ml-10 mt-2' : ''}`}>
      <img 
        src={comment.authorAvatar} 
        className={`${comment.parentId ? 'w-6 h-6' : 'w-9 h-9'} rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity`} 
        onClick={handleProfileClick}
        referrerPolicy="no-referrer"
      />
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <p className={`${comment.parentId ? 'text-[11px]' : 'text-[13px]'} font-bold cursor-pointer hover:underline`} onClick={handleProfileClick}>{comment.authorName}</p>
          <span className="text-[11px] text-gray-400 font-medium">{formatTime(comment.createdAt)}</span>
        </div>
        <div className={`${comment.parentId ? 'text-[13px]' : 'text-[14px]'} text-gray-800`}>
          <MentionText text={comment.text} />
        </div>
        <div className="flex items-center space-x-4 mt-1.5 text-[11px] font-bold text-gray-400">
           <button onClick={handleLike} className={`${liked ? 'text-red-500' : 'hover:text-gray-900'} transition-colors uppercase`}>
             {likesCount > 0 ? `${likesCount} likes` : 'Like'}
           </button>
           <button onClick={() => onReply(comment.id!, comment.authorName, comment.authorId)} className="hover:text-gray-900 uppercase">Reply</button>
           {currentUser?.uid === comment.authorId || currentUser?.uid === authorId ? (
             <button onClick={handleDelete} className={`${cConfirmDelete ? 'text-red-500' : 'text-gray-300 hover:text-red-600'} uppercase text-[10px]`}>{cConfirmDelete ? 'Confirm?' : 'Delete'}</button>
           ) : null}
        </div>
      </div>
      <button onClick={handleLike} className="flex-shrink-0 pt-1">
        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-gray-400'}`} />
      </button>
    </div>
  );
});

const CommentsPortal = ({ postId, onClose, authorId, authorName, authorAvatar, media, initialReply, onClearReply }: { postId: string, onClose: () => void, authorId: string, authorName: string, authorAvatar: string, media?: string, initialReply?: {id: string, name: string, authorId: string} | null, onClearReply: () => void }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string, authorId: string} | null>(initialReply || null);
  const [mentions, setMentions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const { currentUser } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [postId]);

  useEffect(() => {
    if (currentUser) {
      import('../services/followService').then(service => {
        service.getFollowing(currentUser.uid).then(setFriends);
      });
    }
  }, [currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    const match = val.match(/@(\w*)$/);
    if (match) {
      const searchTerm = match[1].toLowerCase();
      const filtered = friends.filter(f => (f.name || '').toLowerCase().includes(searchTerm));
      setMentions(filtered);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (friend: any) => {
    const newText = text.replace(/@(\w*)$/, `@${friend.name.replace(/\s/g, '')} `);
    setText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !text.trim()) return;
    const commentText = replyingTo ? `@${replyingTo.name} ${text}` : text;
    
    // Optimistic comment
    const optimisticComment = {
      id: `opt-${Date.now()}`,
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      text: commentText,
      createdAt: { toDate: () => new Date() },
      likesCount: 0
    };
    
    setComments(prev => [optimisticComment as any, ...prev]);
    setText('');
    setReplyingTo(null);
    onClearReply();
    
    try {
      const newComment = await addComment(postId, currentUser.uid, currentUser, commentText, replyingTo?.id || null) as any;
      
      // Notify post author
      await sendNotification(authorId, 'comment', currentUser, newComment.id, postId, media, commentText, authorName, authorAvatar);
      
      // Notify parent comment author if reply
      if (replyingTo && replyingTo.authorId && replyingTo.authorId !== currentUser.uid && replyingTo.authorId !== authorId) {
        await sendNotification(replyingTo.authorId, 'reply', currentUser, newComment.id, postId, media, commentText, authorName, authorAvatar);
      }

      {/* Mentions Notification */}
      const mentionMatches = commentText.match(/@(\w+)/g);
      if (mentionMatches) {
        const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
        for (const username of uniqueMentions) {
          const mentionedUser = await findUserByUsername(username);
          if (mentionedUser && mentionedUser.uid !== currentUser.uid && mentionedUser.uid !== authorId) {
            await sendNotification(mentionedUser.uid, 'mention', currentUser, newComment.id, postId, media, commentText, authorName, authorAvatar);
          }
        }
      }
    } catch (err) {
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setText(commentText);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 md:p-4" onClick={(e) => e.stopPropagation()}>
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900">Comments</h3>
          <button onClick={onClose} className="p-2 bg-gray-100/50 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-rotate"></div></div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <MessageCircle className="w-16 h-16 opacity-10 mb-4" />
              <p className="font-medium">No comments yet. Be the first!</p>
            </div>
          ) : (
            (() => {
              const parentComments = comments.filter(c => !c.parentId);
              const repliesById = comments.reduce((acc, c) => {
                if (c.parentId) {
                  if (!acc[c.parentId]) acc[c.parentId] = [];
                  acc[c.parentId].push(c);
                }
                return acc;
              }, {} as Record<string, Comment[]>);

              return parentComments.map((parent) => (
                <div key={parent.id} className="space-y-4">
                  <CommentItem 
                    comment={parent} 
                    postId={postId} 
                    authorId={authorId} 
                    authorName={authorName}
                    authorAvatar={authorAvatar}
                    media={media} 
                    onReply={(id, name, authorId) => { setReplyingTo({id, name, authorId}); inputRef.current?.focus(); }} 
                  />
                  {repliesById[parent.id] && (
                    <div className="space-y-4 pl-4 border-l border-gray-100 ml-4 mt-2">
                      {repliesById[parent.id].map((reply) => (
                        <CommentItem 
                          key={reply.id} 
                          comment={reply} 
                          postId={postId} 
                          authorId={authorId} 
                          authorName={authorName}
                          authorAvatar={authorAvatar}
                          media={media} 
                          onReply={(id, name, authorId) => { setReplyingTo({id, name, authorId}); inputRef.current?.focus(); }} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              ));
            })()
          )}
        </div>

        {showMentions && mentions.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
            {mentions.map(f => (
              <button 
                key={f.uid} 
                onClick={() => selectMention(f)}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <img src={f.avatar} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                <span className="font-bold text-sm text-gray-900">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 flex flex-col space-y-2 bg-white sticky bottom-0">
          {replyingTo && (
            <div className="flex items-center justify-between text-[12px] bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-gray-500">Replying to <span className="font-bold text-gray-900">@{replyingTo.name}</span></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-900 font-bold uppercase text-[10px]">Cancel</button>
            </div>
          )}
          <div className="flex items-center space-x-3 border bg-gray-50 hover:bg-gray-100 transition-colors border-gray-200 rounded-full px-1.5 py-1.5">
            <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/32/32"} className="w-8 h-8 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
            <div className="flex-1 relative flex items-center pr-2">
              <input 
                ref={inputRef}
                value={text} 
                onChange={handleInputChange}
                placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : `Add a comment...`} 
                className="w-full bg-transparent focus:outline-none text-[14px] text-gray-900 placeholder-gray-500" 
              />
              <button disabled={!text.trim()} className="text-white bg-blue-500 p-2 rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:text-white transition-all flex items-center justify-center shadow-sm">
                <Send className="w-4 h-4 ml-[-2px] mt-[1px]" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>, document.body
  );
};

export const SharePortal = ({ reel, onClose }: { reel: Post, onClose: () => void }) => {
  const { currentUser } = useAppStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvs, setSelectedConvs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (currentUser) {
      import('../services/postService').then(() => {
         import('../services/chatService').then(m => {
             m.subscribeConversations(currentUser.uid, setConversations);
         });
      });
    }
  }, [currentUser]);

  const toggleSelect = (convId: string) => {
    setSelectedConvs(prev => prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]);
  };

  const handleSend = async () => {
    if (!currentUser || selectedConvs.length === 0 || sending) return;
    setSending(true);
    
    try {
      const { sendMessage } = await import('../services/chatService');
      const promises = selectedConvs.map(convId => 
        sendMessage(convId, currentUser.uid, 'reel', `Shared a reel`, reel.media?.[0], reel.id)
      );
      await Promise.all(promises);
      onClose();
    } catch (e) {
      console.error(e);
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/80 md:p-4" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-sm h-[70vh] max-h-[600px] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
        
        {/* Header */}
        <div className="relative p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="w-8"></div>
          <h3 className="font-bold text-[16px] text-gray-900 mx-auto">Share</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
             <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Search placeholder */}
        <div className="p-3">
          <div className="bg-gray-100 rounded-xl px-4 py-2.5 flex items-center mb-1">
             <span className="text-gray-500 font-bold text-sm">To:</span>
             <input type="text" placeholder="Search..." className="bg-transparent pl-3 flex-1 outline-none text-sm font-medium" />
          </div>
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto px-4 pb-20 no-scrollbar">
          <div className="grid grid-cols-3 gap-x-4 gap-y-6 pt-2">
            {conversations.map(c => {
               const otherId = c.participantIds.find((id: string) => id !== currentUser?.uid);
               const isSelected = selectedConvs.includes(c.id);
               return (
                 <div key={c.id} onClick={() => toggleSelect(c.id)} className="flex flex-col items-center justify-start cursor-pointer group active:scale-95 transition-transform relative">
                   <div className="relative mb-2">
                     <img 
                       src={c.participantAvatars[otherId || ''] || `https://ui-avatars.com/api/?name=User`} 
                       className={`w-[60px] h-[60px] rounded-full object-cover shadow-sm transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 opacity-80' : 'group-hover:opacity-90'}`} 
                       referrerPolicy="no-referrer"
                     />
                     {isSelected && (
                       <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full border-2 border-white p-0.5">
                         <CheckCircle2 className="w-4 h-4 text-white fill-white" />
                       </div>
                     )}
                   </div>
                   <span className="font-medium text-[12px] text-center text-gray-800 leading-tight line-clamp-1">{c.participantNames[otherId || '']}</span>
                 </div>
               )
            })}
          </div>
        </div>
        
        {/* Send Button Fixed Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
           <button 
             onClick={handleSend}
             disabled={selectedConvs.length === 0 || sending}
             className="w-full bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:bg-blue-300 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
           >
             {sending ? 'Sending...' : selectedConvs.length > 0 ? `Send to Selected` : 'Done'}
           </button>
        </div>

      </div>
    </div>, document.body
  );
};
