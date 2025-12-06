import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';

import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { AppRoute } from './types';

// Auth Context Setup
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Route wrapper for protected pages that require user data
const RequireAuth: React.FC<{ children: (user: User) => React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();
  return user ? children(user) : <Navigate to="/login" />;
};

// Internal Layout Wrapper to handle Navigation prop injection
const AppContent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'LOGIN': navigate('/login'); break;
      case 'SIGNUP': navigate('/signup'); break;
      case 'DASHBOARD': navigate('/dashboard'); break;
      case 'LANDING': navigate('/'); break;
      default: navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar user={user} onNavigate={handleNavigate} />
      <Routes>
        <Route path="/" element={<Landing onNavigate={handleNavigate} />} />
        <Route path="/login" element={<Login onNavigate={handleNavigate} />} />
        <Route path="/signup" element={<Signup onNavigate={handleNavigate} />} />
        <Route 
          path="/dashboard" 
          element={
            <RequireAuth>
              {(user) => <Dashboard user={user} />}
            </RequireAuth>
          } 
        />
      </Routes>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;