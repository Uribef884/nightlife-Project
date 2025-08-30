// src/app/auth/pageClient.tsx
'use client';

import { useEffect, useState } from 'react';
import AuthLayout from '@/components/domain/auth/AuthLayout';
import LoginForm from '@/components/domain/auth/LoginForm';
import RegisterForm from '@/components/domain/auth/RegisterForm';

type Tab = 'login' | 'register';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<Tab>('login');

  // Read initial tab from URL hash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = (window.location.hash || '').replace('#', '') as Tab;
      setActiveTab(hash === 'register' ? 'register' : 'login');
    }
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace('#', '') as Tab;
      setActiveTab(hash === 'register' ? 'register' : 'login');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Tabs callback
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab; // keep URL in sync (#login | #register)
    }
  };

  const title = activeTab === 'register'
    ? 'Regístrate para una mejor experiencia'
    : 'Bienvenido de vuelta!';

  return (
    <AuthLayout
      title={title}
      showSkip
      skipHref="/"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'register' ? <RegisterForm /> : <LoginForm />}
    </AuthLayout>
  );
}
