
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Smile, Image as ImageIcon, Phone, Video, MoreVertical, Minimize2, ExternalLink, Mic, Square, Trash2, Check, CheckCheck, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { sendMessage, subscribeMessages, createConversation, markConversationRead } from '../services/chatService';
import { subscribePresence, setTyping, subscribeTyping } from '../services/presenceService';
import { Message } from '../types';
import { formatTime } from '../utils';

export default function MiniChat() {
  const { miniChatUser, setMiniChatUser, currentUser, pushPage, setActiveChat } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (miniChatUser && currentUser) {
      const initChat = async () => {
        const id = await createConversation(
          [currentUser.uid, miniChatUser.uid],
          {
            [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
            [miniChatUser.uid]: { name: miniChatUser.name, avatar: miniChatUser.avatar }
          }
        );
        setConversationId(id);
      };
      initChat();
      
      const unsubPresence = subscribePresence(miniChatUser.uid, (data) => {
        setIsOnline(data.isOnline);
        setLastSeen(data.lastSeen);
      });
      return () => unsubPresence();
    } else {
      setConversationId(null);
      setMessages([]);
    }
  }, [miniChatUser, currentUser]);

  useEffect(() => {
    if (conversationId && currentUser) {
      const unsubMsgs = subscribeMessages(conversationId, 20, (msgs) => {
        setMessages(msgs);
        markConversationRead(conversationId, currentUser.uid);
      });
      const unsubTyping = subscribeTyping(conversationId, (users) => {
        setTypingUsers(users.filter(uid => uid !== currentUser.uid));
      });
      return () => { unsubMsgs(); unsubTyping(); };
    }
  }, [conversationId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isMinimized, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping && conversationId && currentUser) {
      setIsTyping(true);
      setTyping(conversationId, currentUser.uid, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (conversationId && currentUser) setTyping(conversationId, currentUser.uid, false);
    }, 2000);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
  };

  const finishRecording = async () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    if (!conversationId || !currentUser) return;
    // In a real app we'd upload the audio file to storage, here we just send a mock
    await sendMessage(conversationId, currentUser.uid, 'voice', `Voice message (${recordingDuration}s)`, undefined, undefined, { duration: recordingDuration });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || !currentUser) return;
    const text = inputText;
    setInputText('');
    setIsTyping(false);
    setTyping(conversationId, currentUser.uid, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    await sendMessage(conversationId, currentUser.uid, 'text', text);
  };

  if (!miniChatUser) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-[calc(100%-32px)] sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-[60px]' : 'h-[420px]'}`}
      >
        {/* Header */}
        <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
          <div className="flex items-center space-x-2 min-w-0">
            <div className="relative">
              <img src={miniChatUser.avatar} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt={miniChatUser.name} />
              {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>}
            </div>
            <div className="truncate">
              <h4 className="font-bold text-[14px] text-gray-900 truncate">{miniChatUser.name}</h4>
              {isOnline ? (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-tighter leading-none">Online</p>
              ) : (
                <p className="text-[10px] text-gray-400 font-medium leading-none">Last seen {lastSeen ? formatTime({ toMillis: () => lastSeen } as any) : 'recently'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveChat(conversationId);
                pushPage('messages');
                setMiniChatUser(null);
              }}
              className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setMiniChatUser(null); }} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafbfc] no-scrollbar">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUser?.uid;
                const isLastMsg = idx === messages.length - 1;
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] font-medium shadow-sm flex items-center space-x-2 ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                      }`}
                    >
                      {msg.type === 'voice' ? (
                        <div className="flex items-center space-x-2 w-[140px]">
                           <button className={`p-1.5 rounded-full ${isMe ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                             <Play className="w-3 h-3 fill-current" />
                           </button>
                           <div className="flex-1 h-1.5 rounded-full bg-white/30 overflow-hidden">
                             <div className="h-full w-0 bg-white"></div>
                           </div>
                           <span className="text-[10px] font-bold">0:{(msg as any).replyTo?.duration || '00'}</span>
                        </div>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                    </div>
                    {isMe && isLastMsg && (
                      <span className="text-[10px] mt-1 text-gray-400 mr-1 flexItemsCenter space-x-0.5">
                         {msg.status === 'seen' ? (
                            <><CheckCheck className="w-3 h-3 text-blue-500" /> <span>Seen</span></>
                         ) : msg.status === 'delivered' ? (
                            <><CheckCheck className="w-3 h-3" /> <span>Delivered</span></>
                         ) : (
                            <><Check className="w-3 h-3" /> <span>Sent</span></>
                         )}
                      </span>
                    )}
                  </div>
                );
              })}
              
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center space-x-1">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full"></motion.div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100 flex items-center space-x-2 relative overflow-hidden">
              <AnimatePresence>
                {isRecording ? (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute inset-0 bg-white flex items-center justify-between px-4 z-10"
                  >
                    <div className="flex items-center space-x-2 text-red-500 animate-pulse">
                      <Mic className="w-4 h-4" />
                      <span className="font-bold text-[13px]">
                        0:{recordingDuration.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                        <Trash2 className="w-[18px] h-[18px]" />
                      </button>
                      <button onClick={finishRecording} className="p-2 bg-blue-600 text-white rounded-full shadow-md active:scale-95 transition-transform">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              
              <div className="flex space-x-1">
                 <button className="p-1.5 h-8 w-8 hover:bg-gray-50 rounded-full text-gray-400 flex items-center justify-center"><ImageIcon className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl flex items-center px-3 py-1.5 border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  className="w-full bg-transparent outline-none text-[13px] font-medium text-gray-800"
                />
              </div>
              
              {inputText.trim() ? (
                <button 
                  onClick={handleSend}
                  className="p-2 rounded-xl transition-all active:scale-90 bg-blue-600 text-white shadow-md"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onMouseDown={startRecording}
                  className="p-2 rounded-xl transition-all active:scale-90 bg-blue-50 text-blue-600 border border-blue-100"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
