import React from "react";
import { LogIn } from "lucide-react";

export const Login: React.FC = () => {
  const handleLogin = () => {
    window.location.href = "http://localhost:4000/api/v1/auth/google";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <LogIn className="h-8 w-8 text-indigo-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-500 mb-8">Schedule and manage your emails with ease.</p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-sm"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            className="h-5 w-5 mr-3" 
          />
          Sign in with Google
        </button>
        
        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
          ReachInbox Email Scheduler Assignment
        </div>
      </div>
    </div>
  );
};
