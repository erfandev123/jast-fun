export interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  link?: string;
  isVerified?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: any;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  creatorId: string;
  creatorName: string;
  createdAt: any;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  media: string[];
  type: 'post' | 'reel';
  likesCount: number;
  commentsCount: number;
  repostsCount?: number;
  viewsCount?: number;
  favoritesCount?: number;
  songId?: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likesCount?: number;
  createdAt: any;
  parentId?: string | null;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantNames?: { [uid: string]: string };
  participantAvatars?: { [uid: string]: string };
  lastMessage: string;
  unreadCount: { [uid: string]: number };
  updatedAt: any;
  typing?: { [uid: string]: boolean };
}

export interface Message {
  id: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'reel';
  content: string;
  mediaUrl?: string;
  postId?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
  voiceDuration?: number;
  createdAt: any;
  replyTo?: {
    id: string;
    text: string;
    authorName: string;
  };
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'favorite' | 'comment_like';
  actorId: string;
  actorName: string;
  actorAvatar: string;
  targetId: string; // postId or userId
  postId?: string;
  postMedia?: string;
  postAuthorName?: string;
  postAuthorAvatar?: string;
  content?: string;
  isRead: boolean;
  createdAt: any;
}
