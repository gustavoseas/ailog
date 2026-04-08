'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// The authContext definition ensures typescript understands user and perfil
interface AuthContextType {
  user: User | null;
  perfil: string;
  nome: string;
  loading: boolean;
  logout: () => void;
  sessionKey: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: 'visualizador',
  nome: '',
  loading: true,
  logout: () => {},
  sessionKey: 0
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<string>('visualizador');
  const [nome, setNome] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionKey, setSessionKey] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    // onAuthStateChange fires INITIAL_SESSION on setup (replaces getSession)
    // and TOKEN_REFRESHED when the access token is renewed
    const { data: { subscription } } = db.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      await handleSession(session);
      // Increment sessionKey on token refresh so DataContext reloads with valid token
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSessionKey(k => k + 1);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  const handleSession = async (session: any) => {
    if (session?.user) {
      setUser(session.user);
      setLoading(false); // Unblock screen instantly
      
      try {
        const { data: perfilData } = await db.from('perfis').select('*').eq('id', session.user.id).single();
        if (perfilData?.perfil) {
          setPerfil(perfilData.perfil);
        }
        if (perfilData?.nome) {
          setNome(perfilData.nome);
        } else {
          setNome(session.user.email?.split('@')[0] || '');
        }
      } catch (err) {
        console.error('Error fetching perfil:', err);
        setNome(session.user.email?.split('@')[0] || '');
      }
    } else {
      setUser(null);
      setPerfil('visualizador');
      setNome('');
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await db.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Force clear state and redirect regardless of signOut result
    setUser(null);
    setPerfil('visualizador');
    setNome('');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="loading-screen" style={{ display: 'flex' }}>
        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: '24px', color: 'var(--accent)' }}>SEAS</div>
        <div className="spinner"></div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Carregando...</div>
      </div>
    );
  }

  // Prevent flash of protected content while redirecting
  if (!user && pathname !== '/login') {
    return null; 
  }

  return (
    <AuthContext.Provider value={{ user, perfil, nome, loading, logout, sessionKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
