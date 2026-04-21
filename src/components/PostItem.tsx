import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, ThumbsUp, MessageCircle, Send, Bookmark, X, MoreHorizontal, Globe } from 'lucide-react';
import { useAppStore } from '../store';
import { toggleLike, addComment, getComments, deletePost, deleteComment, toggleCommentLike, toggleFavorite, incrementViewCount } from '../services/postService';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment } from '../types';
import { sendNotification } from '../services/notificationService';
import { findUserByUsername } from '../services/userService';
import { sendMessage, subscribeConversations } from '../services/chatService';
import { Trash2, Share2, Reply, Search } from 'lucide-react';

import { formatTime, formatCount } from '../utils';
import { SharePortal } from './ReelItem';
import { VerifiedBadge } from './VerifiedBadge';

interface PostItemProps {
  post: Post;
}

const MentionText = ({ text }: { text: string }) => {
  const parts = (text || '').split(/(@\w+)/g);
  return (
    <span className="text-[14px] text-gray-800 break-words leading-relaxed">
      {parts.map((part, i) => (
        part && part.startsWith('@') ? (
          <span key={i} className="text-blue-600 font-bold hover:underline cursor-pointer">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </span>
  );
};

const CommentItem = React.memo(({ comment, post, currentUser, onDelete, onReply }: { comment: Comment, post: Post, currentUser: any, onDelete: (id: string) => void, onReply: (id: string, name: string, authorId: string) => void }) => {
  const [cLiked, setCLiked] = useState(false);
  const [cLikesCount, setCLikesCount] = useState(comment.likesCount || 0);
  const { highlightedCommentId, setHighlightedCommentId } = useAppStore();
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
      const likeRef = doc(db, 'posts', post.id, 'comments', comment.id, 'likes', currentUser.uid);
      return onSnapshot(likeRef, (doc) => setCLiked(doc.exists()));
    }
  }, [post.id, comment.id, currentUser]);

  const handleCLike = async () => {
    if (!currentUser) return;
    const newLiked = !cLiked;
    setCLiked(newLiked);
    setCLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleCommentLike(post.id, comment.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(comment.authorId, 'comment_like', currentUser, comment.id, post.id, post.media?.[0], 'liked your comment', post.authorName, post.authorAvatar);
      }
    } catch (e) {
      setCLiked(!newLiked);
      setCLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  return (
    <div ref={itemRef} className={`flex flex-col space-y-2 transition-colors duration-500 rounded-xl p-1 ${highlightedCommentId === comment.id ? 'bg-blue-50/50' : ''} ${comment.parentId ? 'ml-12 border-l-2 border-gray-100 pl-4' : ''}`}>
      <div className="flex items-start space-x-3 group/comment relative">
        <img 
          src={comment.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || 'User')}&background=random`} 
          className={`${comment.parentId ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover shadow-sm`} 
          alt={comment.authorName || 'User'} 
          referrerPolicy="no-referrer"
        />
        <div className="flex-1">
          <div className="bg-gray-100 rounded-2xl px-4 py-2.5 inline-block max-w-full relative shadow-sm">
            <span className="font-bold text-[13px] block text-gray-900 mb-0.5">{comment.authorName || 'User'}</span>
            <MentionText text={comment.text} />
            {cLikesCount > 0 && (
              <div className="absolute -right-2 -bottom-2 bg-white shadow-md rounded-full px-1.5 py-0.5 flex items-center space-x-1 border border-gray-50">
                <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                <span className="text-[10px] font-bold text-gray-700">{cLikesCount}</span>
              </div>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5 font-bold flex items-center space-x-4 px-1 uppercase tracking-tight">
            <span>{formatTime(comment.createdAt)}</span>
            <button onClick={handleCLike} className={`${cLiked ? 'text-red-500' : 'hover:text-gray-900'} transition-colors`}>Like</button>
            <button onClick={() => onReply(comment.id, comment.authorName, comment.authorId)} className="hover:text-gray-900 transition-colors">Reply</button>
            {currentUser?.uid === comment.authorId || currentUser?.uid === post.authorId ? (
              <button onClick={() => onDelete(comment.id)} className="text-gray-300 hover:text-red-600 transition-colors">Delete</button>
            ) : null}
          </div>
        </div>
        <button onClick={handleCLike} className="flex-shrink-0 pt-2 px-1">
            <Heart className={`w-3 h-3 ${cLiked ? 'fill-red-500 text-red-500' : 'text-gray-300 group-hover/comment:text-gray-400'}`} />
        </button>
      </div>
    </div>
  );
});

export const PostItem: React.FC<PostItemProps> = React.memo(({ post }) => {
  const { setViewingUser, setViewingMedia, currentUser, pushPage, setActiveChat, setShowAnalytics, setTargetAnalyticsPostId } = useAppStore();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showOptions, setShowOptions] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [replyTo, setReplyTo] = useState<{id: string, name: string, authorId: string} | null>(null);
  const [mentions, setMentions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const commentInputRef = React.useRef<HTMLInputElement>(null);
  const { highlightedCommentId, setHighlightedCommentId, highlightedPostId, setHighlightedPostId } = useAppStore();

  useEffect(() => {
    if (highlightedPostId === post.id && highlightedCommentId && currentUser) {
      setShowCommentsModal(true);
    }
  }, [highlightedCommentId, highlightedPostId, post.id, currentUser]);

  useEffect(() => {
    return () => {
      const state = useAppStore.getState();
      if (state.highlightedPostId === post.id) {
        state.setHighlightedPostId(null);
        state.setHighlightedCommentId(null);
      }
    };
  }, [post.id]);

  useEffect(() => {
    if (currentUser) {
       import('../services/followService').then(s => s.getFollowing(currentUser.uid).then(setFriends));
    }
  }, [currentUser]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const match = val.match(/@(\w*)$/);
    if (match) {
      const term = match[1].toLowerCase();
      setMentions(friends.filter(f => (f.name || '').toLowerCase().includes(term)));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (friend: any) => {
    const newText = commentText.replace(/@(\w*)$/, `@${friend.name.replace(/\s/g, '')} `);
    setCommentText(newText);
    setShowMentions(false);
    commentInputRef.current?.focus();
  };
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { setShowLikesList, setTargetLikesPostId, setShowViewsList, setTargetViewsPostId } = useAppStore();

  const [isNearScreen, setIsNearScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsNearScreen(entry.isIntersecting),
      { rootMargin: '300px 0px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    
    // View Tracking Observer
    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewTrackedRef.current && currentUser && currentUser.uid !== post.authorId) {
           viewTrackedRef.current = true;
           incrementViewCount(post.id, currentUser.uid).catch(() => {});
        }
      },
      { threshold: 0.5 }
    );
    if (containerRef.current) viewObserver.observe(containerRef.current);
    
    return () => { observer.disconnect(); viewObserver.disconnect(); };
  }, []);

  useEffect(() => {
    if (currentUser && post.id && isNearScreen) {
       const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
       const unsubLike = onSnapshot(likeRef, (d) => setLiked(d.exists()));
       const favRef = doc(db, 'users', currentUser.uid, 'favorites', post.id);
       const unsubFav = onSnapshot(favRef, (d) => setIsSaved(d.exists()));
       return () => { unsubLike(); unsubFav(); };
    }
  }, [currentUser, post.id, isNearScreen]);

  const handleToggleFavorite = async () => {
    if (!currentUser) return;
    const newSaved = !isSaved;
    setIsSaved(newSaved);
    try {
      await toggleFavorite(post.id, currentUser.uid);
      if (newSaved) {
        await sendNotification(post.authorId, 'favorite', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
      }
    } catch (error) {
      setIsSaved(!newSaved);
    }
  };
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    if (showShareModal && currentUser) {
      const unsubscribe = subscribeConversations(currentUser.uid, setConversations);
      return () => unsubscribe();
    }
  }, [showShareModal, currentUser]);

  const handleLike = useCallback(async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    
    try {
      await toggleLike(post.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(post.authorId, 'like', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
      }
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  }, [liked, post.id, post.authorId, currentUser, post.media]);

  const handleAddComment = useCallback(async () => {
    if (!currentUser || !commentText.trim()) return;
    const originalText = commentText;
    const text = replyTo ? `@${replyTo.name} ${commentText}` : commentText;
    
    // Optimistic Update
    const optimisticComment: Comment = {
      id: `opt-${Date.now()}`,
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      text: text,
      createdAt: { toDate: () => new Date() } as any,
      likesCount: 0,
      parentId: replyTo?.id || null
    };
    
    setComments(prev => [optimisticComment, ...prev]);
    setCommentText('');
    setReplyTo(null);
    
    try {
      const newComment = await addComment(post.id, currentUser.uid, currentUser, text, replyTo?.id || null) as any;
      
      // Notify post author
      await sendNotification(post.authorId, 'comment', currentUser, newComment.id, post.id, post.media?.[0], text, post.authorName, post.authorAvatar);

      // Notify parent comment author if reply
      if (replyTo && replyTo.authorId && replyTo.authorId !== currentUser.uid && replyTo.authorId !== post.authorId) {
        await sendNotification(replyTo.authorId, 'reply', currentUser, newComment.id, post.id, post.media?.[0], text, post.authorName, post.authorAvatar);
      }

      {/* Mentions Notification */}
      const mentionMatches = text.match(/@(\w+)/g);
      if (mentionMatches) {
        const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
        for (const username of uniqueMentions) {
          const mentionedUser = await findUserByUsername(username);
          if (mentionedUser && mentionedUser.uid !== currentUser.uid && mentionedUser.uid !== post.authorId) {
            await sendNotification(mentionedUser.uid, 'mention', currentUser, newComment.id, post.id, post.media?.[0], text, post.authorName, post.authorAvatar);
          }
        }
      }
    } catch (error) {
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setCommentText(originalText);
    }
  }, [commentText, post.id, post.authorId, currentUser, replyTo, post.media]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!currentUser) return;
    try {
      await deleteComment(post.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error(error);
    }
  }, [currentUser, post.id]);

  const handleDelete = async () => {
    if (!currentUser || isDeleting) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id, currentUser.uid);
      setShowOptions(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error(error);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareToChat = async (convId: string) => {
    if (!currentUser) return;
    try {
      const content = `Shared a post: ${post.text.substring(0, 50)}...`;
      await sendMessage(convId, currentUser.uid, 'text', content);
      setShowShareModal(false);
      alert('Shared successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
  };

  useEffect(() => {
    if (showCommentsModal) {
      getComments(post.id).then(setComments);
    }
  }, [showCommentsModal, post.id]);

  const isBigText = !post.media || post.media.length === 0;
  const isShortText = post.text.length < 100;

  const renderedComments = React.useMemo(() => {
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
          post={post} 
          currentUser={currentUser}
          onDelete={handleDeleteComment} 
          onReply={(id, name, authorId) => { setReplyTo({id, name, authorId}); commentInputRef.current?.focus(); }} 
        />
        {repliesById[parent.id] && (
          <div className="space-y-4 ml-6 pl-4 border-l-2 border-gray-100 mt-2">
            {repliesById[parent.id].map((reply) => (
              <CommentItem 
                key={reply.id}
                comment={reply} 
                post={post} 
                currentUser={currentUser}
                onDelete={handleDeleteComment} 
                onReply={(id, name, authorId) => { setReplyTo({id, name, authorId}); commentInputRef.current?.focus(); }} 
              />
            ))}
          </div>
        )}
      </div>
    ));
  }, [comments, post, currentUser, handleDeleteComment]);

  return (
    <div 
      ref={containerRef}
      className="bg-white md:border md:rounded-2xl border-gray-100 overflow-hidden relative will-change-transform transform-gpu"
    >
      <div className="flex items-center justify-between p-4">
        <div 
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => {
            setViewingUser({ uid: post.authorId, name: post.authorName, avatar: post.authorAvatar });
            pushPage('profile');
          }}
        >
          <div className="relative">
            <img 
              src={post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=random`} 
              alt={post.authorName} 
              loading="lazy" 
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover shadow-sm group-hover:ring-2 ring-blue-500 transition-all" 
            />
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-3.5 h-3.5 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <h4 className="font-bold text-[15px] text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{post.authorName}</h4>
              {(post as any).authorIsVerified && <VerifiedBadge />}
            </div>
            <div className="flex items-center text-gray-500 text-[12px] font-medium mt-0.5">
              <span>{formatTime(post.createdAt)}</span>
              <span className="mx-1">•</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {currentUser?.uid === post.authorId && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetAnalyticsPostId(post.id);
                setShowAnalytics(true);
              }}
              className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all active:scale-95"
            >
              Analytics
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreHorizontal className="w-6 h-6 text-gray-500" />
            </button>
            
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)}></div>
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  {currentUser?.uid === post.authorId && (
                    <button 
                      onClick={() => { setShowDeleteConfirm(true); setShowOptions(false); }}
                      className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-red-50 transition-colors text-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="font-medium text-[14px]">Delete Post</span>
                    </button>
                  )}
                  <button 
                    onClick={() => { handleToggleFavorite(); setShowOptions(false); }}
                    className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    <span className="font-medium text-[14px]">{isSaved ? 'Unsave Post' : 'Save Post'}</span>
                  </button>
                  <button className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-50 transition-colors text-gray-700">
                    <X className="w-5 h-5" />
                    <span className="font-medium text-[14px]">Hide Post</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className={`px-4 pb-3 leading-relaxed ${isBigText && isShortText ? 'aspect-[4/3] flex items-center justify-center text-[24px] font-black text-center p-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl mx-4 my-2 shadow-xl' : 'text-[15px] text-gray-800 font-medium'}`}>
        <div className="max-w-full break-words">
          {isBigText && isShortText ? (
            post.text
          ) : (
            <>
              {isExpanded ? post.text : `${post.text.substring(0, 150)}${post.text.length > 150 ? '...' : ''}`}
              {post.text.length > 150 && !isExpanded && (
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="text-gray-500 font-bold ml-1 hover:underline"
                >
                  see more...
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {post.media && post.media.length > 0 && (
        <div className="w-full bg-black overflow-hidden border-y border-gray-100 flex justify-center">
          {post.media.length === 1 ? (
            <div className="w-full max-h-[600px] overflow-hidden flex items-center justify-center bg-black">
              {post.media[0].match(/\.(mp4|webm|mov|ogg)($|#|\?)/i) ? (
                <video 
                  src={post.media[0]} 
                  controls 
                  className="w-full h-auto max-h-[600px] block mx-auto"
                  referrerPolicy="no-referrer"
                  playsInline
                  preload="auto"
                  poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                />
              ) : (
                <img 
                  src={post.media[0]} 
                  alt="Post content" 
                  loading="lazy" 
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-[600px] object-cover cursor-pointer transition-all duration-300" 
                  onClick={() => setViewingMedia({ type: 'post', url: post.media[0], user: { name: post.authorName, avatar: post.authorAvatar } })}
                />
              )}
            </div>
          ) : (
            <div className={`grid gap-[2px] w-full ${post.media.length === 2 ? 'grid-cols-2' : post.media.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {post.media.slice(0, 4).map((img, idx) => (
                <div 
                  key={idx} 
                  className={`relative cursor-pointer overflow-hidden ${post.media.length === 3 && idx === 0 ? 'col-span-2' : ''} ${post.media.length >= 3 ? 'h-[200px]' : 'h-[300px]'}`}
                  onClick={() => setViewingMedia({ type: 'post', url: img, user: { name: post.authorName, avatar: post.authorAvatar } })}
                >
                  <img 
                    src={img} 
                    alt="Post content" 
                    loading="lazy" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
                  />
                  {post.media.length > 4 && idx === 3 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                      <span className="text-white text-3xl font-black tracking-tight">+{post.media.length - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="p-3 relative">
        <div className="flex items-center justify-between mb-3">
          <div 
            className="flex items-center space-x-1.5 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-full transition-colors"
            onClick={() => {
              if (currentUser?.uid === post.authorId) {
                setTargetLikesPostId(post.id);
                setShowLikesList(true);
              }
            }}
          >
            <div className="flex -space-x-1.5 mr-1">
              <div className="bg-blue-500 p-0.5 rounded-full border border-white z-20">
                <ThumbsUp className="w-2.5 h-2.5 text-white fill-white" />
              </div>
            </div>
            <span className="text-[13px] text-gray-500 font-bold">{formatCount(likesCount)} likes</span>
          </div>
          <div className="flex text-[13px] text-gray-500 font-bold space-x-3">
            {post.viewsCount !== undefined && post.viewsCount > 0 && (
              <span className={`hover:underline ${currentUser?.uid === post.authorId ? 'cursor-pointer' : 'cursor-default'}`} onClick={() => { 
                if (currentUser?.uid === post.authorId) {
                  setTargetViewsPostId(post.id); 
                  setShowViewsList(true); 
                }
              }}>{formatCount(post.viewsCount)} views</span>
            )}
            <span className="hover:underline cursor-pointer" onClick={() => setShowCommentsModal(true)}>{formatCount(post.commentsCount)} comments</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-2 px-1 mt-2">
          <button onClick={handleLike} className={`flex-1 flex items-center justify-center py-2 rounded-xl transition-all group ${liked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
            <ThumbsUp className={`w-6 h-6 transition-transform group-active:scale-75 ${liked ? 'fill-blue-500 text-blue-500 scale-110' : 'text-gray-600'}`} strokeWidth={2} />
          </button>
          <button onClick={() => setShowCommentsModal(true)} className="flex-1 flex items-center justify-center py-2 rounded-xl transition-all hover:bg-gray-50 group">
            <MessageCircle className="w-6 h-6 text-gray-600 group-active:scale-75 transition-transform" strokeWidth={2} />
          </button>
          <button onClick={handleShare} className="flex-1 flex items-center justify-center py-2 rounded-xl transition-all hover:bg-gray-50 group">
            <Share2 className="w-6 h-6 text-gray-600 group-active:scale-75 transition-transform" strokeWidth={2} />
          </button>
        </div>

        {/* Comments Modal */}
        {showCommentsModal && createPortal(
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4">
            <div 
              className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg h-[85vh] md:h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-[16px] text-center flex-1">Comments</h3>
                <button onClick={() => setShowCommentsModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors z-10">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {renderedComments}
                {comments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No comments yet. Be the first to reply!</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 bg-white relative">
                {showMentions && mentions.length > 0 && (
                  <div className="absolute bottom-full left-4 right-4 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto mb-2 z-[110]">
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

                {replyTo && (
                  <div className="flex items-center justify-between px-3 py-2 mb-3 bg-gray-50 rounded-xl text-[12px] text-gray-500 border border-gray-100">
                    <span>Replying to <span className="font-bold text-gray-900">@{replyTo.name}</span></span>
                    <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <img 
                    src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
                    className="w-9 h-9 rounded-full object-cover shadow-sm" 
                    alt="User" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 relative">
                    <input 
                      ref={commentInputRef}
                      type="text" 
                      placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Add a comment..."} 
                      value={commentText}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-400 rounded-full px-5 py-3 text-[14px] focus:outline-none transition-all" 
                    />
                    <button onClick={handleAddComment} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 font-bold text-sm disabled:opacity-30" disabled={!commentText.trim()}>Post</button>
                  </div>
                </div>
              </div>
            </div>
          </div>, document.body
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
              className="bg-white rounded-2xl w-full max-w-xs p-6 text-center shadow-2xl"
            >
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Post?</h3>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone. Are you sure?</p>
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <SharePortal reel={post} onClose={() => setShowShareModal(false)} />
        )}
      </div>
    </div>
  );
});
