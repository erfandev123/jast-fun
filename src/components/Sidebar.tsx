import React from 'react';
import { Home, Search, PlaySquare, MessageCircle, Heart, PlusSquare, User, Menu, Bell } from 'lucide-react';
import { useAppStore } from '../store';

export default function Sidebar({ currentPage }: { currentPage: string }) {
  const { currentUser, pushPage, notificationCount, messageCount, setViewingUser } = useAppStore();
  const isCollapsed = currentPage === 'reels' || currentPage === 'messages';
  const lastClickRef = React.useRef<{ [key: string]: number }>({});

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: PlaySquare, label: 'Reels', path: '/reels' },
    { icon: MessageCircle, label: 'Messages', path: '/messages', badge: messageCount },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: notificationCount },
    { icon: PlusSquare, label: 'Create', path: '/create' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className={`h-screen border-r border-gray-200 bg-white flex flex-col px-3 py-5 flex-shrink-0 transition-all duration-300 z-50 ${isCollapsed ? 'w-[72px]' : 'w-[72px] md:w-[244px]'}`}>
      
      {/* Logo */}
      <div className="mb-8 px-3 flex items-center h-10 cursor-pointer space-x-3" onClick={() => pushPage('home')}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-gray-100">
          <img src="/Ennvo.png" alt="Ennvo Logo" className="w-full h-full object-cover" />
        </div>
        <div className={`hidden ${isCollapsed ? 'hidden' : 'md:block'} overflow-hidden`}>
          <span className="font-black text-[26px] tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">Ennvo</span>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const pageName = item.path === '/' ? 'home' : item.path.substring(1);
          const isActive = currentPage === pageName;
          const Icon = item.icon;
          
          return (
            <div 
              key={item.label}
              onClick={() => {
              const now = Date.now();
              const lastClick = lastClickRef.current[pageName] || 0;
              const isDoubleClick = now - lastClick < 300;
              lastClickRef.current[pageName] = now;

              if (pageName === 'profile') setViewingUser(null);
              
              if (isDoubleClick) {
                if (pageName === 'reels' && currentPage === 'reels') {
                  document.getElementById('global-reels-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                  window.dispatchEvent(new Event('refreshReels'));
                } else if (pageName === 'home' && currentPage === 'home') {
                  const homeTarget = document.getElementById('home-scroll-container');
                  if (homeTarget) {
                    homeTarget.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }
              }

              pushPage(pageName as any);
            }}
              className="group relative flex items-center p-3 rounded-xl cursor-pointer overflow-hidden transition-all duration-300"
            >
              {/* Animated Background Pill */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ease-out ${isActive ? 'bg-gray-100 scale-100 opacity-100' : 'bg-gray-100 scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100'}`}></div>
              
              <div className="relative z-10 flex items-center w-full">
                <div className="relative">
                  {item.label === 'Profile' ? (
                    <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/32/32"} className={`w-6 h-6 rounded-full object-cover border ${isActive ? 'border-black' : 'border-transparent'}`} alt="Profile" />
                  ) : (
                    <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'text-black stroke-[2.5px] scale-110' : 'text-gray-700 group-hover:scale-110'}`} />
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </div>
                <span className={`hidden ${isCollapsed ? 'hidden' : 'md:block'} ml-4 text-[16px] transition-all duration-300 ${isActive ? 'font-bold text-black translate-x-1' : 'font-medium text-gray-700 group-hover:translate-x-1'}`}>
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-1">
        <div 
          onClick={() => pushPage('settings')}
          className="group relative flex items-center p-3 rounded-xl cursor-pointer overflow-hidden transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gray-100 rounded-xl scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-out"></div>
          <div className="relative z-10 flex items-center w-full">
            <Menu className="w-6 h-6 text-gray-700 group-hover:scale-110 transition-transform duration-300" />
            <span className={`hidden ${isCollapsed ? 'hidden' : 'md:block'} ml-4 text-[16px] font-medium text-gray-700 group-hover:translate-x-1 transition-transform duration-300`}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
