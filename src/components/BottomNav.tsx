import React from 'react';
import { Home, PlaySquare, PlusSquare, MessageCircle, User, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../store';

export default function BottomNav() {
  const { currentPage, pushPage, currentUser, notificationCount, messageCount, setViewingUser } = useAppStore();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'reels', icon: PlaySquare, label: 'Reels' },
    { id: 'create', icon: PlusSquare, label: 'New' },
    { id: 'messages', icon: MessageCircle, label: 'Chat', badge: messageCount + notificationCount },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const lastClickRef = React.useRef<{ [key: string]: number }>({});

  const isReels = currentPage === 'reels';

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 ${isReels ? 'bg-black border-[#222]' : 'bg-white border-gray-100'} border-t flex items-center justify-around h-16 z-50 shadow-lg px-2 pb-safe transition-colors duration-1000`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => {
              const now = Date.now();
              const lastClick = lastClickRef.current[item.id] || 0;
              const isDoubleClick = now - lastClick < 300;
              lastClickRef.current[item.id] = now;

              if (item.id === 'profile') setViewingUser(null);
              
              if (isDoubleClick) {
                if (item.id === 'reels' && currentPage === 'reels') {
                  document.getElementById('global-reels-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                  window.dispatchEvent(new Event('refreshReels'));
                } else if (item.id === 'home' && currentPage === 'home') {
                  const homeTarget = document.getElementById('home-scroll-container');
                  if (homeTarget) {
                    homeTarget.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }
              }

              pushPage(item.id as any);
            }}
            className="flex flex-col items-center justify-center flex-1 h-full relative transition-all active:scale-95"
          >
            <div className="flex flex-col items-center">
              <div className="relative">
                {item.id === 'profile' ? (
                  <div className={`rounded-full transition-all duration-300 ${isActive ? (isReels ? 'ring-2 ring-white p-[1px]' : 'ring-2 ring-blue-600 p-[1px]') : ''}`}>
                    <img 
                      src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}&background=random`} 
                      className={`w-6 h-6 rounded-full object-cover shadow-sm`} 
                      alt="Profile" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <Icon 
                    className={`w-6 h-6 transition-all duration-300 ${isActive ? (isReels ? 'text-white scale-110' : 'text-blue-600 scale-110') : (isReels ? 'text-gray-500' : 'text-gray-400')}`} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
                
                {item.id === 'messages' && (messageCount + notificationCount) > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border-2 border-white px-0.5">
                    {messageCount + notificationCount > 9 ? '9+' : messageCount + notificationCount}
                  </div>
                )}
              </div>
              
              {isActive && (
                <motion.span 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-[9px] font-black mt-0.5 tracking-tighter uppercase transition-colors duration-1000 ${isReels ? 'text-white' : 'text-blue-600'}`}
                >
                  {item.label}
                </motion.span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
