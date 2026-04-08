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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: 'visualizador',
  nome: '',
  loading: true,
  logout: () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<string>('visualizador');
  const [nome, setNome] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    // Check initial session
    db.auth.getSession().then(async ({ data: { session } }) => {
      if (isMounted) await handleSession(session);
    }).catch(err => {
      console.error('Session error:', err);
      if (isMounted) setLoading(false);
    });

    const { data: { subscription } } = db.auth.onAuthStateChange(async (event, session) => {
      if (isMounted) await handleSession(session);
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
    await db.auth.signOut();
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
    <AuthContext.Provider value={{ user, perfil, nome, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
