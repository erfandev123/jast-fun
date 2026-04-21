import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Check, X, Loader2, Globe, Lock, Link as LinkIcon, AtSign, User } from 'lucide-react';
import { useAppStore } from '../store';
import { updateUserProfile } from '../services/authService';
import { uploadMedia } from '../services/githubStorage';

export default function EditProfile() {
  const { currentUser, setCurrentUser, setCurrentPage } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [link, setLink] = useState(currentUser?.link || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatar(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let finalAvatar = avatar;
      if (avatarFile) {
        finalAvatar = await uploadMedia(avatarFile, 'avatars');
      }

      const updatedUser = await updateUserProfile(currentUser.uid, {
        name,
        username: username.toLowerCase(),
        bio,
        link,
        avatar: finalAvatar
      });

      setCurrentUser(updatedUser);
      setCurrentPage('profile');
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => setCurrentPage('profile')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-xl font-black tracking-tight">Edit Profile</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 flex items-center space-x-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{loading ? 'Saving...' : 'Done'}</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto w-full p-6 space-y-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gray-50 shadow-lg">
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-blue-600 font-bold text-sm hover:underline">Change Profile Photo</button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Name</span>
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-2">
              <AtSign className="w-4 h-4" />
              <span>Username</span>
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="username"
              />
            </div>
            <p className="text-[11px] text-gray-400 font-medium px-1">You can change your username once every 30 days.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>Bio</span>
            </label>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[100px] resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-2">
              <LinkIcon className="w-4 h-4" />
              <span>Link</span>
            </label>
            <input 
              type="text" 
              value={link} 
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="https://yourlink.com"
            />
          </div>
        </div>

        {/* Private Info Section */}
        <div className="pt-8 border-t border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-900 mb-4 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-gray-400" />
            <span>Private Information</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium">Email</span>
              <span className="text-sm text-gray-900 font-bold">{currentUser?.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
