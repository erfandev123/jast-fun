import React, { useState, useRef, useEffect } from 'react';
import { Upload, Video, Image as ImageIcon, Music, Type, Smile, X, Camera, FlipHorizontal, Zap, Timer, Settings2, CheckCircle2, ArrowLeft, UserPlus, ChevronRight, MapPin, Play, Volume2, VolumeX, Save, Search, Check, Bookmark } from 'lucide-react';
import { safeFile } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';

import { createPost, subscribeSongs, subscribeFavoriteSongs, toggleSongFavorite } from '../services/postService';
import { findUserByUsername } from '../services/userService';
import { sendNotification } from '../services/notificationService';
import { uploadStory } from '../services/storyService';
import { Song } from '../types';

export default function Create() {
  const { pushPage, currentUser } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'reel' | 'story'>('reel');
  const [step, setStep] = useState<'capture' | 'preview' | 'details'>('capture');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [songTab, setSongTab] = useState<'search' | 'favorites'>('search');
  const [favoriteSongIds, setFavoriteSongIds] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const unsub = subscribeSongs(setSongs);
    let unsubFavs: () => void = () => {};
    if (currentUser) {
      unsubFavs = subscribeFavoriteSongs(currentUser.uid, setFavoriteSongIds);
    }
    return () => {
      unsub();
      unsubFavs();
    }
  }, [currentUser]);

  useEffect(() => {
    if (files.length > 0) {
      const urls = files.map(f => URL.createObjectURL(f));
      setPreviewUrls(urls);
      setStep('preview');
      return () => urls.forEach(u => URL.revokeObjectURL(u));
    } else {
      setPreviewUrls([]);
      setStep('capture');
    }
  }, [files]);

  useEffect(() => {
    if (selectedSong && step === 'preview' && audioRef.current) {
      audioRef.current.src = selectedSong.url;
      audioRef.current.loop = true;
      audioRef.current.play();
    } else if (audioRef.current && (!showSoundSelector || selectedSong)) {
      audioRef.current.pause();
    }
  }, [selectedSong, step]);

  useEffect(() => {
    if (selectedSong) {
      setIsMuted(true);
    }
  }, [selectedSong]);

  useEffect(() => {
    if (showSoundSelector && !selectedSong && audioRef.current) {
      audioRef.current.pause();
    }
  }, [showSoundSelector, selectedSong]);

  const handleUpload = async () => {
    if (!currentUser || files.length === 0) return;
    setLoading(true);
    try {
      if (mode === 'reel') {
        const post = await createPost(currentUser.uid, currentUser, caption, files, 'reel', selectedSong?.id) as any;
        
        // Mentions Notification
        const mentionMatches = caption.match(/@(\w+)/g);
        if (mentionMatches) {
          const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
          for (const username of uniqueMentions) {
             const mentionedUser = await findUserByUsername(username);
             if (mentionedUser && mentionedUser.uid !== currentUser.uid) {
               await sendNotification(mentionedUser.uid, 'mention', currentUser, post.id, post.id, post.media?.[0], caption, currentUser.name, currentUser.avatar);
             }
          }
        }
        
        pushPage('reels');
      } else {
        await uploadStory(currentUser.uid, currentUser.name, currentUser.avatar, files[0]);
        pushPage('home');
      }
    } catch (error) {
      console.error(error);
      alert('Upload failed');
    } finally {
      setLoading(false);
      setFiles([]);
    }
  };

  const filteredSongs = songs.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.artist.toLowerCase().includes(searchQuery.toLowerCase());
    if (songTab === 'favorites') {
      return matchesSearch && favoriteSongIds.includes(s.id);
    }
    return matchesSearch;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    
    if (isMobile && files.length === 0) {
      const startCamera = async () => {
        try {
          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: true
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          currentStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // Setup MediaRecorder
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              setRecordedChunks(prev => [...prev, e.data]);
            }
          };
          recorder.onstop = () => {
            setRecording(false);
          };
          setMediaRecorder(recorder);

        } catch (err: any) {
          console.error("Camera access error:", err);
          // Fallback to basic constraints
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            currentStream = fallbackStream;
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
          } catch (fallbackErr) {
            console.error("Fallback camera access error:", fallbackErr);
          }
        }
      };
      
      startCamera();
    }
    
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMobile, files, facingMode]);

  useEffect(() => {
    if (recordedChunks.length > 0 && !recording) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const recordedFile = safeFile(blob, `recorded-video-${Date.now()}.webm`);
      setFiles([recordedFile]);
      setRecordedChunks([]);
    }
  }, [recordedChunks, recording]);

  const toggleRecording = () => {
    if (!mediaRecorder) return;

    if (recording) {
      mediaRecorder.stop();
      setRecording(false);
    } else {
      setRecordedChunks([]);
      mediaRecorder.start();
      setRecording(true);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
        {step === 'capture' && (
          <div className="relative flex-1 overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Camera Controls Overlay */}
            <div className="absolute inset-0 p-4 flex flex-col justify-between z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pt-safe font-sans">
              <div className="flex items-start justify-between">
                <button onClick={() => pushPage('home')} className="p-2.5 text-white bg-black/20 rounded-full backdrop-blur-md active:scale-90 transition-transform"><X className="w-6 h-6" /></button>
                
                {mode === 'reel' && (
                  <button 
                    onClick={() => setShowSoundSelector(true)}
                    className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-6 py-2.5 rounded-full text-white font-black text-sm border border-white/20 active:scale-95 transition-all shadow-lg"
                  >
                    <Music className="w-4 h-4" />
                    <span className="truncate max-w-[120px] uppercase tracking-wider">{selectedSong ? selectedSong.title : 'Add Sound'}</span>
                  </button>
                )}

                <div className="flex flex-col space-y-4">
                  <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-2.5 bg-black/20 rounded-full backdrop-blur-md active:scale-95 transition-transform text-white"><FlipHorizontal className="w-6 h-6" /></button>
                  <button className="p-2.5 bg-black/20 rounded-full backdrop-blur-md active:scale-95 transition-transform text-white"><Zap className="w-6 h-6" /></button>
                  <button className="p-2.5 bg-black/20 rounded-full backdrop-blur-md active:scale-95 transition-transform text-white"><Timer className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-12 pb-safe-offset-8">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-900 border-2 border-white/40 overflow-hidden relative shadow-2xl active:scale-90 transition-transform cursor-pointer group">
                    <input type="file" accept="image/*,video/*" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleChange} />
                    <img src="https://picsum.photos/seed/gallery/100/100" className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="Gallery" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                <button 
                  className={`w-24 h-24 rounded-full border-4 border-white/30 flex items-center justify-center transition-all active:scale-90 ${recording ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-white/10 shadow-white/10'} shadow-2xl`}
                  onClick={toggleRecording}
                >
                  <div className={`w-18 h-18 bg-white rounded-full transition-all ${recording ? 'scale-50 rounded-xl' : ''}`}></div>
                </button>

                <div className="w-14 h-14"></div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && files.length > 0 && (
          <div className="relative flex-1 bg-black flex flex-col font-sans">
            <div className="relative flex-1 flex items-center justify-center overflow-hidden">
              {files[0].type.startsWith('video') ? (
                <video 
                  ref={previewVideoRef}
                  src={previewUrls[0] || ''} 
                  className="w-full max-h-[100dvh] object-contain" 
                  autoPlay 
                  loop 
                  muted={isMuted}
                  playsInline
                />
              ) : (
                <div 
                  className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full h-full items-center"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const index = Math.round(el.scrollLeft / el.clientWidth);
                    setCurrentImageIndex(index);
                  }}
                >
                  {previewUrls.map((url, i) => (
                    <img key={i} src={url} className="w-full max-h-[100dvh] object-contain shrink-0 snap-center" alt="Preview" />
                  ))}
                </div>
              )}
              
              {files.length > 1 && !files[0].type.startsWith('video') && (
                <div className="absolute bottom-24 left-0 right-0 flex justify-center space-x-2 z-20 pointer-events-none">
                  {files.map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all ${i === currentImageIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
                  ))}
                </div>
              )}
              
              <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={() => setFiles([])} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><ArrowLeft className="w-6 h-6" /></button>
                
                <button 
                  onClick={() => setShowSoundSelector(true)}
                  className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-6 py-2.5 rounded-full text-white font-black text-sm border border-white/20 active:scale-95 transition-all shadow-lg"
                >
                  <Music className="w-4 h-4" />
                  <span className="truncate max-w-[120px] uppercase tracking-wider">{selectedSong ? selectedSong.title : 'Add Sound'}</span>
                </button>

                <div className="flex flex-col space-y-4">
                   <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white">
                     {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                   </button>
                   <button onClick={() => setShowSoundSelector(true)} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white">
                     <Music className="w-6 h-6" />
                   </button>
                </div>
              </div>

              {selectedSong && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center space-x-3 z-10 animate-in slide-in-from-top duration-300 shadow-xl max-w-[90%]">
                  <Music className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xs truncate max-w-[150px]">{selectedSong.title}</p>
                  </div>
                  <button onClick={() => setSelectedSong(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}

              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-20 space-x-4">
                 <button 
                  onClick={() => setFiles([])} 
                  className="px-6 py-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white font-bold rounded-full transition-colors text-sm"
                 >
                   Discard
                 </button>
                 <button 
                  onClick={() => setStep('details')}
                  className="px-8 py-3 bg-white text-black font-bold rounded-full transition-transform active:scale-95 text-sm shadow-lg flex items-center space-x-1"
                 >
                   <span>Next</span>
                   <ChevronRight className="w-4 h-4" />
                 </button>
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="flex-1 bg-white flex flex-col animate-in slide-in-from-right duration-300 font-sans">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 pt-safe">
              <button onClick={() => setStep('preview')}><ArrowLeft className="w-6 h-6 text-gray-900" /></button>
              <h2 className="font-black text-xl tracking-tight">New {mode === 'reel' ? 'Reel' : 'Story'}</h2>
              <button 
                onClick={handleUpload} 
                disabled={loading} 
                className="bg-blue-500 text-white px-6 py-2 rounded-full font-black text-sm disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-100"
              >
                {loading ? 'Sharing...' : 'Share'}
              </button>
            </div>
            
            <div className="p-4 flex space-x-5 border-b border-gray-100">
              <div className="w-24 h-36 bg-black rounded-2xl overflow-hidden shrink-0 shadow-lg border-2 border-white">
                {files[0]?.type.startsWith('video') ? (
                  <video src={previewUrls[0] || ''} className="w-full h-full object-cover" muted playsInline preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
                ) : (
                  <img src={previewUrls[0] || ''} className="w-full h-full object-cover" alt="Preview" />
                )}
              </div>
              <textarea 
                placeholder="What's happening? #reel #trending" 
                className="flex-1 resize-none outline-none text-[16px] font-medium pt-2 placeholder-gray-300"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                autoFocus
              ></textarea>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {[
                { icon: UserPlus, label: 'Tag people', color: 'text-blue-500' },
                { icon: MapPin, label: 'Add location', color: 'text-red-500' },
                { icon: Music, label: 'Add music', color: 'text-purple-500', value: selectedSong?.title },
                { icon: Settings2, label: 'Advanced settings', color: 'text-gray-500' }
              ].map((item, i) => (
                <button key={i} className="flex items-center justify-between w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl bg-gray-50`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="font-bold text-gray-900">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.value && <span className="text-sm text-gray-400 font-bold truncate max-w-[100px]">{item.value}</span>}
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sound Selector Modal */}
        <AnimatePresence>
          {showSoundSelector && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-0 z-[100] bg-white flex flex-col pt-safe overflow-hidden font-sans"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <button onClick={() => setShowSoundSelector(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
                <h3 className="font-black text-lg">Music Library</h3>
                <div className="w-10"></div>
              </div>

              <div className="p-4 pt-1">
                <div className="flex bg-gray-100 rounded-full p-1 mb-4">
                  <button 
                    onClick={() => setSongTab('search')} 
                    className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${songTab === 'search' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Search
                  </button>
                  <button 
                    onClick={() => setSongTab('favorites')} 
                    className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${songTab === 'favorites' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Favorites
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search music or artists..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                {filteredSongs.map((song) => (
                  <div 
                    key={song.id} 
                    onClick={() => { setSelectedSong(song); setShowSoundSelector(false); }}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${selectedSong?.id === song.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform active:scale-95 transition-transform overflow-hidden relative group">
                        <Music className="w-6 h-6 text-white" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (audioRef.current) {
                              audioRef.current.src = song.url;
                              audioRef.current.play();
                            }
                          }}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Play className="w-6 h-6 text-white fill-white" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-black text-gray-900 text-[15px] truncate">{song.title || 'Unknown Sound'}</h4>
                        <p className="text-sm text-gray-400 font-bold truncate">{song.artist || 'Original Audio'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {currentUser && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSongFavorite(song.id, currentUser.uid);
                          }}
                          className={`p-2 rounded-full transition-colors active:scale-90 ${favoriteSongIds.includes(song.id) ? 'bg-red-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <Bookmark className={`w-4 h-4 ${favoriteSongIds.includes(song.id) ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} strokeWidth={2.5} />
                        </button>
                      )}
                      {selectedSong?.id === song.id && (
                        <div className="p-1.5 bg-blue-600 rounded-full shadow-lg shadow-blue-100">
                          <Check className="w-4 h-4 text-white" strokeWidth={4} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <audio ref={audioRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#f8f9fa] flex flex-col items-center overflow-y-auto pb-20 no-scrollbar font-sans">
      
      {/* PC Header */}
      <div className="w-full bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1000px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button onClick={() => pushPage('home')} className="p-3 hover:bg-gray-100 rounded-full transition-all active:scale-90 text-gray-900 group">
              <ArrowLeft className="w-7 h-7 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Create</h1>
              <p className="text-gray-400 text-sm font-bold -mt-1 uppercase tracking-[0.1em]">{mode} selection</p>
            </div>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-2xl p-1.5 shadow-inner">
            <button 
              onClick={() => { setMode('reel'); setStep('capture'); setFiles([]); }}
              className={`px-8 py-2.5 rounded-xl text-[15px] font-black transition-all ${mode === 'reel' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Reel
            </button>
            <button 
              onClick={() => { setMode('story'); setStep('capture'); setFiles([]); }}
              className={`px-8 py-2.5 rounded-xl text-[15px] font-black transition-all ${mode === 'story' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Story
            </button>
          </div>

          <div className="w-12"></div>
        </div>
      </div>

      <div className="w-full max-w-[720px] mt-4 px-4 flex flex-col lg:flex-row gap-4 items-start">
        
        {/* Upload/Preview Stage */}
        <div className="flex-1 w-full bg-white rounded-[24px] border border-gray-100 shadow-md overflow-hidden flex flex-col min-h-[480px] relative group border-2 border-transparent hover:border-blue-100 transition-all duration-500">
          {files.length === 0 ? (
            <div 
              className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-500 ${dragActive ? 'bg-blue-50/50 scale-[0.98]' : 'bg-white'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="w-32 h-32 mb-6 relative group-hover:scale-105 transition-transform duration-700">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full animate-blob"></div>
                <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-50">
                  <Video className="w-10 h-10 text-blue-600" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-1 tracking-tight">Post your creation</h2>
              <p className="text-gray-400 mb-6 text-center font-bold text-sm">MP4, WebM or Photos</p>
              
              <label className="bg-gray-900 hover:bg-black text-white font-black py-3 px-8 rounded-2xl cursor-pointer transition-all shadow-lg active:scale-95 flex items-center space-x-2.5 text-sm">
                <Upload className="w-4 h-4" />
                <span>Choose files</span>
                <input type="file" accept="video/*,image/*" multiple className="hidden" onChange={handleChange} />
              </label>
            </div>
          ) : (
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              {files[0].type.startsWith('video') ? (
                <video src={previewUrls[0] || ''} className="w-full max-h-[100dvh] object-contain" autoPlay loop muted={isMuted} playsInline preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
              ) : (
                <div 
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar items-center"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const index = Math.round(el.scrollLeft / el.clientWidth);
                    setCurrentImageIndex(index);
                  }}
                >
                  {previewUrls.map((url, i) => (
                    <img key={i} src={url} className="w-full max-h-[100dvh] object-contain shrink-0 snap-center" alt="Preview" />
                  ))}
                </div>
              )}
              
              {files.length > 1 && !files[0].type.startsWith('video') && (
                <div className="absolute bottom-24 left-0 right-0 flex justify-center space-x-2 z-20 pointer-events-none">
                  {files.map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all ${i === currentImageIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
                  ))}
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onClick={() => setFiles([])} className="p-2.5 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg"><X className="w-4 h-4" /></button>
                <div className="flex flex-col space-y-2">
                  <button onClick={() => setIsMuted(!isMuted)} className="p-2.5 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  {mode === 'reel' && (
                    <button onClick={() => setShowSoundSelector(true)} className="p-2.5 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg">
                      <Music className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {selectedSong && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center space-x-3 z-10 animate-in slide-in-from-top duration-300 shadow-xl max-w-[90%]">
                  <Music className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xs truncate max-w-[150px]">{selectedSong.title}</p>
                  </div>
                  <button onClick={() => setSelectedSong(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="w-full lg:w-[280px] flex flex-col space-y-4 h-full sticky top-24">
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-md p-5 space-y-5 flex-1">
            <div className="flex items-center space-x-2.5 pb-1.5 border-b border-gray-50 text-left">
              <img 
                src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
                alt="Profile" 
                className="w-10 h-10 rounded-lg object-cover ring-2 ring-gray-100" 
              />
              <div>
                <h4 className="font-black text-base text-gray-900 leading-tight">{currentUser?.name || 'Creator'}</h4>
                <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{mode}</p>
              </div>
            </div>

            <div className="space-y-2">
              <textarea 
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full h-28 resize-none bg-gray-50 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-sm placeholder:text-gray-300 border border-transparent focus:border-blue-100"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setShowSoundSelector(true)}
                className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-blue-50 rounded-2xl transition-all border border-transparent hover:border-blue-100 group"
              >
                <Music className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors mb-1" />
                <span className="font-black text-[11px] text-gray-500 group-hover:text-blue-900">{selectedSong ? 'Change' : 'Audio'}</span>
              </button>
              <button className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-green-50 rounded-2xl transition-all border border-transparent hover:border-green-100 group">
                <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors mb-1" />
                <span className="font-black text-[11px] text-gray-500 group-hover:text-green-900">Cover</span>
              </button>
            </div>

            <button 
              onClick={handleUpload}
              disabled={loading || files.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white font-black py-4 rounded-3xl text-lg transition-all shadow-xl shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  <span>Publish</span>
                </>
              )}
            </button>
          </div>

          <p className="px-8 text-center text-gray-400 text-sm font-bold opacity-50">By publishing, you agree to our Community Guidelines and Content Terms.</p>
        </div>
      </div>

      {/* PC Sound Selector Overlay */}
      <AnimatePresence>
        {showSoundSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSoundSelector(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[700px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight text-left">Music Gallery</h3>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-0.5 text-left">Pick the perfect beat</p>
                </div>
                <button onClick={() => setShowSoundSelector(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all active:scale-90 text-gray-400">
                  <X className="w-7 h-7" />
                </button>
              </div>

              <div className="p-8 pb-0 pt-4">
                <div className="flex bg-gray-100 rounded-full p-1.5 mb-6">
                  <button 
                    onClick={() => setSongTab('search')} 
                    className={`flex-1 py-3 text-[15px] font-black rounded-full transition-colors ${songTab === 'search' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Search
                  </button>
                  <button 
                    onClick={() => setSongTab('favorites')} 
                    className={`flex-1 py-3 text-[15px] font-black rounded-full transition-colors ${songTab === 'favorites' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Favorites
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search titles, vibes or artists..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-15 pr-6 py-5 bg-gray-50 rounded-[24px] outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-lg border border-transparent focus:border-blue-100"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-2 no-scrollbar">
                {filteredSongs.map(song => (
                  <div 
                    key={song.id}
                    onClick={() => { setSelectedSong(song); setShowSoundSelector(false); }}
                    className={`flex items-center justify-between p-5 rounded-[28px] transition-all cursor-pointer group ${selectedSong?.id === song.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="flex items-center space-x-6">
                      <div className="relative w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                        <Music className="w-8 h-8 text-white" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (audioRef.current) {
                              audioRef.current.src = song.url;
                              audioRef.current.play();
                            }
                          }}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Play className="w-8 h-8 text-white fill-white" />
                        </button>
                      </div>
                      <div className="text-left">
                        <h4 className="font-black text-xl text-gray-900 leading-tight">{song.title}</h4>
                        <p className="text-gray-400 font-bold text-sm tracking-wide mt-1">{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {currentUser && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSongFavorite(song.id, currentUser.uid);
                          }}
                          className={`p-3 rounded-full transition-colors active:scale-90 ${favoriteSongIds.includes(song.id) ? 'bg-red-50' : 'bg-gray-100 opacity-0 group-hover:opacity-100 hover:bg-gray-200'}`}
                        >
                          <Bookmark className={`w-5 h-5 ${favoriteSongIds.includes(song.id) ? 'text-red-500 fill-red-500' : 'text-gray-500'}`} strokeWidth={2.5} />
                        </button>
                      )}
                      {selectedSong?.id === song.id ? (
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                          <Check className="w-6 h-6 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Play className="w-5 h-5 text-gray-500 fill-gray-500" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
