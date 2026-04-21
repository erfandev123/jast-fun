import { create } from 'zustand';
import { User as AppUser } from './types';

export type PageType = 'home' | 'search' | 'reels' | 'messages' | 'notifications' | 'create' | 'profile' | 'settings' | 'edit-profile';

export type Media = {
  type: 'post' | 'reel' | 'image' | 'video';
  url: string;
  user?: { name: string; avatar: string };
  likes?: number;
  comments?: number;
};

type AppState = {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  viewingUser: any | null;
  setViewingUser: (user: any | null) => void;
  viewingMedia: Media | null;
  setViewingMedia: (media: Media | null) => void;
  chatTheme: string;
  setChatTheme: (theme: string) => void;
  viewingStory: any | null;
  setViewingStory: (story: any | null) => void;
  viewingReel: any | null;
  setViewingReel: (reel: any | null) => void;
  viewingReelContext: 'all' | string; // 'all' or userId
  setViewingReelContext: (ctx: 'all' | string) => void;
  activeChat: string | null;
  setActiveChat: (chatId: string | null) => void;
  showCreatePost: boolean;
  setShowCreatePost: (show: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  isAuthLoading: boolean;
  setIsAuthLoading: (val: boolean) => void;
  navigationStack: PageType[];
  pushPage: (page: PageType) => void;
  popPage: () => void;
  highlightedCommentId: string | null;
  setHighlightedCommentId: (id: string | null) => void;
  highlightedPostId: string | null;
  setHighlightedPostId: (id: string | null) => void;
  showLikesList: boolean;
  setShowLikesList: (show: boolean) => void;
  targetLikesPostId: string | null;
  setTargetLikesPostId: (id: string | null) => void;
  showViewsList: boolean;
  setShowViewsList: (show: boolean) => void;
  targetViewsPostId: string | null;
  setTargetViewsPostId: (id: string | null) => void;
  showAnalytics: boolean;
  setShowAnalytics: (show: boolean) => void;
  targetAnalyticsPostId: string | null;
  setTargetAnalyticsPostId: (id: string | null) => void;
  notificationCount: number;
  setNotificationCount: (count: number) => void;
  messageCount: number;
  setMessageCount: (count: number) => void;
  lastCheckedActivity: number;
  setLastCheckedActivity: (time: number) => void;
  lastCheckedFollowers: number;
  setLastCheckedFollowers: (time: number) => void;
  cachedFeed: any[];
  setCachedFeed: (posts: any[]) => void;
  cachedReels: any[];
  setCachedReels: (reels: any[]) => void;
  feedScrollY: number;
  setFeedScrollY: (y: number) => void;
  reelsScrollY: number;
  setReelsScrollY: (y: number) => void;
  globalMuted: boolean;
  setGlobalMuted: (val: boolean) => void;
  miniChatUser: any | null;
  setMiniChatUser: (user: any | null) => void;
};

const getInitialPage = (): PageType => {
  const last = sessionStorage.getItem('lastVisitedPage');
  if (last === 'home' || last === 'reels') return last as PageType;
  return Math.random() > 0.5 ? 'home' : 'reels';
};

export const useAppStore = create<AppState>((set) => ({
  currentPage: getInitialPage(),
  setCurrentPage: (page) => {
    sessionStorage.setItem('lastVisitedPage', page);
    set({ currentPage: page });
  },
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user, isAuthenticated: !!user, isAuthLoading: false }),
  viewingUser: null,
  setViewingUser: (user) => set({ viewingUser: user }),
  viewingMedia: null,
  setViewingMedia: (media) => set({ viewingMedia: media }),
  chatTheme: 'bg-white',
  setChatTheme: (theme) => set({ chatTheme: theme }),
  viewingStory: null,
  setViewingStory: (story) => set({ viewingStory: story }),
  viewingReel: null,
  setViewingReel: (reel) => set({ viewingReel: reel }),
  viewingReelContext: 'all',
  setViewingReelContext: (ctx) => set({ viewingReelContext: ctx }),
  activeChat: null,
  setActiveChat: (chatId) => set({ activeChat: chatId }),
  showCreatePost: false,
  setShowCreatePost: (show) => set({ showCreatePost: show }),
  isAuthenticated: false,
  setIsAuthenticated: (val) => set({ isAuthenticated: val }),
  isAuthLoading: true,
  setIsAuthLoading: (val) => set({ isAuthLoading: val }),
  navigationStack: ['home'],
  pushPage: (page) => set((state) => {
    sessionStorage.setItem('lastVisitedPage', page);
    return { 
      currentPage: page, 
      navigationStack: [...state.navigationStack, page] 
    };
  }),
  popPage: () => set((state) => {
    if (state.navigationStack.length <= 1) {
      sessionStorage.setItem('lastVisitedPage', 'home');
      return { currentPage: 'home', navigationStack: ['home'] };
    }
    const newStack = [...state.navigationStack];
    newStack.pop();
    const prevPage = newStack[newStack.length - 1];
    sessionStorage.setItem('lastVisitedPage', prevPage);
    return { 
      currentPage: prevPage, 
      navigationStack: newStack 
    };
  }),
  highlightedCommentId: null,
  setHighlightedCommentId: (id) => set({ highlightedCommentId: id }),
  highlightedPostId: null,
  setHighlightedPostId: (id) => set({ highlightedPostId: id }),
  showLikesList: false,
  setShowLikesList: (show) => set({ showLikesList: show }),
  targetLikesPostId: null,
  setTargetLikesPostId: (id) => set({ targetLikesPostId: id }),
  showViewsList: false,
  setShowViewsList: (show) => set({ showViewsList: show }),
  targetViewsPostId: null,
  setTargetViewsPostId: (id) => set({ targetViewsPostId: id }),
  showAnalytics: false,
  setShowAnalytics: (show) => set({ showAnalytics: show }),
  targetAnalyticsPostId: null,
  setTargetAnalyticsPostId: (id) => set({ targetAnalyticsPostId: id }),
  notificationCount: 0,
  setNotificationCount: (count) => set({ notificationCount: count }),
  messageCount: 0,
  setMessageCount: (count) => set({ messageCount: count }),
  lastCheckedActivity: Number(localStorage.getItem('lastCheckedActivity')) || 0,
  setLastCheckedActivity: (time) => {
    localStorage.setItem('lastCheckedActivity', time.toString());
    set({ lastCheckedActivity: time });
  },
  lastCheckedFollowers: Number(localStorage.getItem('lastCheckedFollowers')) || 0,
  setLastCheckedFollowers: (time) => {
    localStorage.setItem('lastCheckedFollowers', time.toString());
    set({ lastCheckedFollowers: time });
  },
  cachedFeed: [],
  setCachedFeed: (posts) => set({ cachedFeed: posts }),
  cachedReels: [],
  setCachedReels: (reels) => set({ cachedReels: reels }),
  feedScrollY: 0,
  setFeedScrollY: (y) => {
    set({ feedScrollY: y });
  },
  reelsScrollY: 0,
  setReelsScrollY: (y) => {
    set({ reelsScrollY: y });
  },
  globalMuted: true,
  setGlobalMuted: (val) => set({ globalMuted: val }),
  miniChatUser: null,
  setMiniChatUser: (user) => set({ miniChatUser: user }),
}));

