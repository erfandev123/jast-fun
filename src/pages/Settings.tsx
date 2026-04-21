import React, { useState, useEffect } from 'react';
import { User, Bell, Lock, Shield, Palette, HelpCircle, ChevronRight, Moon, Globe, EyeOff, Activity, LogOut, ArrowLeft, Smartphone, AlertTriangle, UserX, MessageSquare, AtSign } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Account');
  const [showMobileContent, setShowMobileContent] = useState(false);
  const { setIsAuthenticated, currentUser, popPage } = useAppStore();
  const [userSettings, setUserSettings] = useState<any>({
    // Privacy
    isPrivate: false,
    showActivity: true,
    hideStory: false,
    publicSearch: true,
    whoCanMessage: 'everyone',
    whoCanComment: 'everyone',
    followRequests: 'everyone',
    // Notifications
    pushNotifications: true,
    likeAlerts: true,
    commentAlerts: true,
    followAlerts: true,
    messageAlerts: true,
    silentMode: false,
    // Security
    suspiciousLogins: true
  });

  useEffect(() => {
    if (currentUser) {
      const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docObj) => {
        if (docObj.exists()) {
          const data = docObj.data();
          setUserSettings(prev => ({ ...prev, ...data }));
        }
      });
      return () => unsub();
    }
  }, [currentUser]);

  const toggleSetting = async (key: string) => {
    if (!currentUser) return;
    const newValue = !userSettings[key];
    setUserSettings(prev => ({ ...prev, [key]: newValue }));
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: newValue
      });
    } catch (err) {
      console.error(err);
      setUserSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  const updateSelectSetting = async (key: string, value: string) => {
    if (!currentUser) return;
    setUserSettings(prev => ({ ...prev, [key]: value }));
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: value
      });
    } catch (err) {
      console.error(err);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || 'Ennvo',
    username: '@ennvo_official',
    email: currentUser?.email || 'user@ennvo.com',
    phone: '',
    bio: 'Digital creator & artist 🎨'
  });

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: profileData.name,
        bio: profileData.bio,
        phone: profileData.phone
      });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile', err);
      alert('Failed to save profile');
    }
    setIsSaving(false);
  };

  const tabs = [
    { name: 'Account', icon: User },
    { name: 'Privacy', icon: Lock },
    { name: 'Notifications', icon: Bell },
    { name: 'Security', icon: Shield },
    { name: 'Theme', icon: Palette },
    { name: 'Help', icon: HelpCircle },
  ];

  return (
    <div className="h-full w-full bg-[#fafafa] flex justify-center p-0 md:p-8 overflow-hidden md:overflow-y-auto">
      <div className="w-full max-w-[1000px] bg-white md:rounded-3xl md:shadow-sm md:border border-gray-100 flex flex-col md:flex-row h-full md:min-h-[700px] md:h-auto overflow-hidden relative">
        
        {/* Settings Sidebar */}
        <div className={`w-full md:w-[320px] border-r border-gray-100 bg-gray-50/50 flex flex-col absolute md:relative inset-0 z-10 transition-transform duration-300 ${showMobileContent ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
          <div className="flex items-center p-5 border-b border-gray-100 bg-white">
            <button onClick={() => popPage()} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Settings</h2>
          </div>
          <div className="space-y-1 flex-1 overflow-y-auto p-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name && !showMobileContent;
              return (
                <button
                  key={tab.name}
                  onClick={() => { setActiveTab(tab.name); setShowMobileContent(true); }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-[0.98] ${
                    isActive 
                      ? 'bg-white shadow-sm border border-gray-200 text-blue-600 font-bold' 
                      : 'bg-white md:bg-transparent border border-gray-100 md:border-transparent text-gray-700 hover:bg-white md:hover:bg-gray-100 font-medium mb-2 md:mb-0 shadow-sm md:shadow-none'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                     <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-50' : 'bg-gray-100'}`}>
                       <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                     </div>
                     <span className="text-[15px]">{tab.name}</span>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-100 bg-white md:bg-transparent">
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="w-full flex items-center justify-center space-x-3 p-3.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-bold transition-all active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Settings Content */}
        <div className={`flex-1 bg-white flex flex-col absolute md:relative inset-0 z-20 transition-transform duration-300 ${showMobileContent ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          <div className="md:hidden flex items-center p-4 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-30">
            <button onClick={() => setShowMobileContent(false)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{activeTab}</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-10">
            <h3 className="hidden md:block text-[28px] font-black tracking-tight text-gray-900 mb-8">{activeTab}</h3>
          
          {activeTab === 'Account' && (
            <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
              <div className="flex items-center space-x-4 mb-4">
                <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/80/80"} alt="Profile" className="w-20 h-20 rounded-full object-cover border border-gray-200 shadow-sm" />
                <div>
                  <button className="bg-gray-100 flex items-center space-x-2 border border-gray-200 hover:bg-gray-200 text-gray-900 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm active:scale-95">
                    <Palette className="w-4 h-4" />
                    <span>Change Photo</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Name</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData(p => ({...p, name: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Username</label>
                  <input type="text" value={profileData.username} onChange={e => setProfileData(p => ({...p, username: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Email (Private)</label>
                  <input type="email" value={profileData.email} onChange={e => setProfileData(p => ({...p, email: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Phone Number</label>
                  <input type="tel" value={profileData.phone} onChange={e => setProfileData(p => ({...p, phone: e.target.value}))} placeholder="+1 (555) 000-0000" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Bio</label>
                <textarea value={profileData.bio} onChange={e => setProfileData(p => ({...p, bio: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] font-medium leading-relaxed"></textarea>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-gray-100">
                <button onClick={handleSaveProfile} disabled={isSaving} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-sm active:scale-95 text-[15px] disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="pt-8 border-t border-gray-100 mt-8">
                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl">
                  <h4 className="text-red-700 font-bold mb-2 flex items-center"><AlertTriangle className="w-5 h-5 mr-2" /> Danger Zone</h4>
                  <p className="text-sm text-red-600/80 mb-4 leading-relaxed">Deactivating your account will hide your profile. Deleting your account will permanently remove your data.</p>
                  <button onClick={() => { if(window.confirm('Are you sure you want to request account deletion?')) alert('Account deletion requested.') }} className="w-full md:w-auto bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold py-3 px-6 rounded-xl transition-all active:scale-95 text-sm shadow-sm">
                    Deactivate / Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Privacy' && (
            <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-3">
                <h4 className="font-bold text-lg text-gray-900 tracking-tight">Account Visibility</h4>
                {[
                  { icon: Lock, title: 'Private Account', desc: 'Only approved followers can see your posts.', key: 'isPrivate' },
                  { icon: Globe, title: 'Public Search', desc: 'Allow your profile to appear in search engines.', key: 'publicSearch' },
                  { icon: Activity, title: 'Activity Status', desc: 'Show when you are online and active.', key: 'showActivity' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => toggleSetting(item.key)}>
                    <div className="flex items-center space-x-4">
                      <div className="bg-white p-2.5 rounded-full shadow-sm border border-gray-100">
                        <item.icon className="w-5 h-5 text-gray-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                        <p className="text-[13px] text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${userSettings[item.key] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${userSettings[item.key] ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-100">
                <h4 className="font-bold text-lg text-gray-900 tracking-tight">Interactions</h4>
                
                <div className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center space-x-3">
                       <MessageSquare className="w-5 h-5 text-gray-600" />
                       <h4 className="font-bold text-gray-900 text-sm">Who can message you</h4>
                     </div>
                   </div>
                   <select 
                     value={userSettings.whoCanMessage} 
                     onChange={(e) => updateSelectSetting('whoCanMessage', e.target.value)}
                     className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                   >
                     <option value="everyone">Everyone</option>
                     <option value="followers">Followers Only</option>
                     <option value="nobody">Nobody</option>
                   </select>
                </div>
                
                <div className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center space-x-3">
                       <AtSign className="w-5 h-5 text-gray-600" />
                       <h4 className="font-bold text-gray-900 text-sm">Follow & Friend Requests</h4>
                     </div>
                   </div>
                   <select 
                     value={userSettings.followRequests} 
                     onChange={(e) => updateSelectSetting('followRequests', e.target.value)}
                     className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                   >
                     <option value="everyone">Everyone</option>
                     <option value="nobody">Nobody</option>
                   </select>
                </div>
              </div>

               <div className="space-y-3 pt-6 border-t border-gray-100">
                 <h4 className="font-bold text-lg text-gray-900 tracking-tight">Restricted Accounts</h4>
                 <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-gray-50/50">
                   <div className="flex items-center space-x-3">
                     <UserX className="w-5 h-5 text-gray-600" />
                     <div>
                       <h4 className="font-bold text-gray-900 text-sm">Blocked Users</h4>
                       <p className="text-[13px] text-gray-500">Manage accounts you have blocked</p>
                     </div>
                   </div>
                   <ChevronRight className="w-5 h-5 text-gray-400" />
                 </div>
               </div>
            </div>
          )}
          
          {activeTab === 'Notifications' && (
            <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               
               <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => toggleSetting('pushNotifications')}>
                 <div className="flex items-center space-x-4">
                   <div className="bg-blue-100 p-2.5 rounded-full">
                     <Bell className="w-5 h-5 text-blue-600" />
                   </div>
                   <div>
                     <h4 className="font-bold text-blue-900 text-sm">Push Notifications</h4>
                     <p className="text-[13px] text-blue-600/80 mt-0.5">Pause all push notifications</p>
                   </div>
                 </div>
                 <div className={`w-11 h-6 rounded-full relative transition-colors ${userSettings.pushNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}>
                   <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${userSettings.pushNotifications ? 'right-0.5' : 'left-0.5'}`}></div>
                 </div>
               </div>
               
               <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-orange-50/50 hover:bg-orange-50 transition-colors cursor-pointer" onClick={() => toggleSetting('silentMode')}>
                 <div className="flex items-center space-x-4">
                   <div className="bg-orange-100 p-2.5 rounded-full">
                     <Moon className="w-5 h-5 text-orange-600" />
                   </div>
                   <div>
                     <h4 className="font-bold text-orange-900 text-sm">Do Not Disturb (Silent Mode)</h4>
                     <p className="text-[13px] text-orange-600/80 mt-0.5">Mute notification sounds and vibrations</p>
                   </div>
                 </div>
                 <div className={`w-11 h-6 rounded-full relative transition-colors ${userSettings.silentMode ? 'bg-orange-500' : 'bg-gray-200'}`}>
                   <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${userSettings.silentMode ? 'right-0.5' : 'left-0.5'}`}></div>
                 </div>
               </div>

              <div className="space-y-2 pt-4">
                <h4 className="font-bold text-lg text-gray-900 tracking-tight mb-4">Alert Types</h4>
                {[
                  { title: 'Likes & Reactions', desc: 'When someone likes your post', key: 'likeAlerts' },
                  { title: 'Comments', desc: 'When someone comments on your post', key: 'commentAlerts' },
                  { title: 'New Followers', desc: 'When someone starts following you', key: 'followAlerts' },
                  { title: 'Direct Messages', desc: 'When you receive a new message', key: 'messageAlerts' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer" onClick={() => toggleSetting(item.key)}>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                      <p className="text-[13px] text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${userSettings[item.key] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${userSettings[item.key] ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer bg-gray-50/50">
                   <Shield className="w-6 h-6 text-blue-600 mb-3" />
                   <h4 className="font-bold text-gray-900 text-sm">Password</h4>
                   <p className="text-[13px] text-gray-500 mt-1">Change your account password</p>
                 </div>
                 <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer bg-gray-50/50">
                   <Smartphone className="w-6 h-6 text-indigo-600 mb-3" />
                   <h4 className="font-bold text-gray-900 text-sm">Two-Factor Auth</h4>
                   <p className="text-[13px] text-gray-500 mt-1">Add extra security layer</p>
                 </div>
               </div>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-lg text-gray-900 tracking-tight">Login Activity</h4>
                <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">MacBook Pro (Active)</h4>
                        <p className="text-[12px] text-gray-500">Dhaka, Bangladesh • Chrome</p>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">Now</div>
                </div>

                <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">iPhone 14 Pro</h4>
                        <p className="text-[12px] text-gray-500">Sylhet, Bangladesh • App</p>
                    </div>
                  </div>
                  <button className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors active:scale-95">Log Out</button>
                </div>
                
                <button className="w-full text-center py-3 text-red-600 font-bold text-sm hover:underline active:scale-95 transition-all">
                  Log out of all devices
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                 <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => toggleSetting('suspiciousLogins')}>
                    <div className="flex items-center space-x-4">
                      <div className="bg-white p-2.5 rounded-full shadow-sm border border-gray-100">
                        <AlertTriangle className="w-5 h-5 text-gray-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Suspicious Login Alerts</h4>
                        <p className="text-[13px] text-gray-500 mt-0.5">Get notified on unrecognized logins</p>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${userSettings.suspiciousLogins ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${userSettings.suspiciousLogins ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 mt-2">
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center space-x-3">
                         <MessageSquare className="w-5 h-5 text-gray-600" />
                         <h4 className="font-bold text-gray-900 text-sm">Comment Controls</h4>
                       </div>
                     </div>
                     <select 
                       value={userSettings.whoCanComment} 
                       onChange={(e) => updateSelectSetting('whoCanComment', e.target.value)}
                       className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                     >
                       <option value="everyone">Everyone</option>
                       <option value="followers">Followers Only</option>
                       <option value="off">Off (Nobody)</option>
                     </select>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'Theme' && (
            <div className="max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-blue-600 rounded-2xl p-4 cursor-pointer relative shadow-sm bg-gray-50/50">
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div className="w-full h-32 bg-gray-50 rounded-xl mb-3 flex flex-col p-2 space-y-2 border border-gray-100">
                    <div className="w-full h-4 bg-white rounded-md shadow-sm border border-gray-100"></div>
                    <div className="w-3/4 h-4 bg-white rounded-md shadow-sm border border-gray-100"></div>
                  </div>
                  <h4 className="font-bold text-center text-gray-900 text-sm">Light Mode</h4>
                </div>
                <div className="border-2 border-gray-200 rounded-2xl p-4 cursor-pointer hover:border-gray-300 transition-colors bg-white">
                  <div className="w-full h-32 bg-gray-900 rounded-xl mb-3 flex flex-col p-2 space-y-2">
                    <div className="w-full h-4 bg-gray-800 rounded-md"></div>
                    <div className="w-3/4 h-4 bg-gray-800 rounded-md"></div>
                  </div>
                  <h4 className="font-bold text-center text-gray-900 text-sm">Dark Mode</h4>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'Help' && (
            <div className="max-w-md space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-gray-50/50">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Help Center</h4>
                  <p className="text-[13px] text-gray-500 mt-0.5">Find answers to your questions</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-gray-50/50">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Report a Problem</h4>
                  <p className="text-[13px] text-gray-500 mt-0.5">Let us know if something is broken</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              <div className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-gray-50/50">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Privacy and Security Help</h4>
                  <p className="text-[13px] text-gray-500 mt-0.5">Learn how to protect your account</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
