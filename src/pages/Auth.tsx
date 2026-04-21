import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, Chrome, Github } from 'lucide-react';
import { useAppStore } from '../store';
import { signUp, signIn, signInWithGoogle } from '../services/authService';
import { EnnvoLogo } from '../components/EnnvoLogo';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentUser } = useAppStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    username: ''
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      let user;
      if (isLogin) {
        user = await signIn(formData.email, formData.password);
      } else {
        user = await signUp(formData.email, formData.password, formData.name, formData.username);
      }
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isLogin, formData, setCurrentUser]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = useCallback(() => {
    setIsLogin(prev => !prev);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[1000px] flex flex-col md:flex-row items-center justify-center md:space-x-12 lg:space-x-20">
        
        {/* Left Side - Branding (PC Only) */}
        <div className="hidden md:flex flex-col max-w-[400px] mb-12 md:mb-0">
          <div className="mb-6 w-28 h-28 rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
            <EnnvoLogo className="w-full h-full" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm mb-4 select-none">
            Ennvo
          </h1>
          <p className="text-2xl font-medium text-gray-900 leading-tight">
            Ennvo helps you connect and share with the people in your life.
          </p>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="w-full max-w-[350px] space-y-4">
          {/* Main Auth Card */}
          <div className="bg-white border border-gray-200 p-8 flex flex-col items-center shadow-sm rounded-sm">
            {/* Logo (Mobile Only) */}
            <div className="md:hidden flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 shadow-lg border border-gray-100">
                <EnnvoLogo className="w-full h-full" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm select-none">
                Ennvo
              </h1>
            </div>

            {error && (
              <div className="w-full p-3 bg-red-50 border border-red-100 rounded-md text-red-600 text-xs font-bold mb-4 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <input 
                      type="text" 
                      required
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-[3px] px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400"
                    />
                    <input 
                      type="text" 
                      required
                      placeholder="Username"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-[3px] px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <input 
                  type="email" 
                  required
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-[3px] px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400"
                />
              </div>

              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-[3px] px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-900 hover:text-gray-600 transition-colors px-1"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-2 rounded-[4px] text-sm transition-all active:scale-[0.98] flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  isLogin ? 'Log In' : 'Sign Up'
                )}
              </button>

              <div className="flex items-center space-x-4 py-2">
                <div className="flex-1 h-[1px] bg-gray-200"></div>
                <span className="text-[13px] font-bold text-gray-400 uppercase">OR</span>
                <div className="flex-1 h-[1px] bg-gray-200"></div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center space-x-2 text-[#385185] font-bold text-sm hover:opacity-80 transition-opacity"
              >
                <Chrome className="w-4 h-4" />
                <span>Log in with Google</span>
              </button>

              {isLogin && (
                <div className="text-center pt-2">
                  <button type="button" className="text-xs text-[#00376b] hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Toggle Card */}
          <div className="bg-white border border-gray-200 p-6 text-center shadow-sm rounded-sm">
            <p className="text-sm text-gray-900">
              {isLogin ? "Don't have an account?" : "Have an account?"}{' '}
              <button 
                onClick={toggleMode}
                className="text-blue-500 font-bold hover:underline"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>


          {/* App Info */}
          <div className="text-center space-y-4 pt-2">
            <p className="text-sm text-gray-900">Get the app.</p>
            <div className="flex justify-center space-x-2">
              <div className="w-32 h-10 bg-black rounded-md flex items-center justify-center text-white text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-left leading-tight">
                  <div className="text-[8px] opacity-70">Download on the</div>
                  <div className="text-sm">App Store</div>
                </div>
              </div>
              <div className="w-32 h-10 bg-black rounded-md flex items-center justify-center text-white text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-left leading-tight">
                  <div className="text-[8px] opacity-70">GET IT ON</div>
                  <div className="text-sm">Google Play</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 w-full max-w-[1000px]">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500 font-medium px-4">
          {['Meta', 'About', 'Blog', 'Jobs', 'Help', 'API', 'Privacy', 'Terms', 'Locations', 'Instagram Lite', 'Threads', 'Contact Uploading & Non-Users', 'Meta Verified'].map(link => (
            <button key={link} className="hover:underline">{link}</button>
          ))}
        </div>
        <div className="mt-4 text-center text-xs text-gray-500 font-medium">
          © 2026 Ennvo
        </div>
      </footer>
    </div>
  );
}
