'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  User, 
  Ticket, 
  Calendar, 
  Menu, 
  ShoppingCart, 
  Megaphone, 
  Users,
  Music,
  Settings,
  X,
  Sparkles
} from 'lucide-react';

interface ClubOwnerSidebarProps {
  selectedClub: string | null;
  activeSection?: string;
}

export function ClubOwnerSidebar({ selectedClub }: ClubOwnerSidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Only show hamburger menu on club owner dashboard pages
  const isClubOwnerDashboard = pathname.startsWith('/dashboard/club-owner');

  const navigationItems = [
    {
      name: 'Perfil del Club',
      href: '/dashboard/club-owner/club-profile',
      icon: Sparkles,
      active: pathname === '/dashboard/club-owner/club-profile'
    },
    {
      name: 'Gestión de Entradas',
      href: '/dashboard/club-owner/tickets',
      icon: Ticket,
      active: pathname === '/dashboard/club-owner/tickets'
    },
    {
      name: 'Gestión de Eventos',
      href: '/dashboard/club-owner/events',
      icon: Calendar,
      active: pathname === '/dashboard/club-owner/events'
    },
    {
      name: 'Gestión del Menú',
      href: '/dashboard/club-owner/menu',
      icon: Menu,
      active: pathname === '/dashboard/club-owner/menu'
    },
    {
      name: 'Historial de Compras',
      href: '/dashboard/club-owner/purchases',
      icon: ShoppingCart,
      active: pathname === '/dashboard/club-owner/purchases'
    },
    {
      name: 'Gestor de Anuncios',
      href: '/dashboard/club-owner/ads',
      icon: Megaphone,
      active: pathname === '/dashboard/club-owner/ads'
    },
    {
      name: 'Gestión de Personal',
      href: '/dashboard/club-owner/staff',
      icon: Users,
      active: pathname === '/dashboard/club-owner/staff'
    },
    {
      name: 'Configuración',
      href: '/dashboard/club-owner/settings',
      icon: Settings,
      active: pathname === '/dashboard/club-owner/settings'
    }
  ];

  // Don't render anything if not on club owner dashboard pages
  if (!isClubOwnerDashboard) {
    return null;
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Navigation */}
        <nav className="p-4 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

      </div>
    </>
  );
}
