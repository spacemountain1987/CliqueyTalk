
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
}

interface PageContextType {
  pageTitle: string;
  setPageTitle: (title: string) => void;
  headerActions: ReactNode | null;
  setHeaderActions: (actions: ReactNode | null) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  discordId: string | null;
  setDiscordId: (id: string | null) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  clearNotifications: () => void;
  audioContext: AudioContext | null;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export const PageProvider = ({ children }: { children: ReactNode }) => {
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);


  // On initial mount, try to load the discordId from localStorage
  useEffect(() => {
    try {
      const storedId = localStorage.getItem('discordUserId');
      if (storedId) {
        setDiscordId(storedId);
      }
      // Initialize AudioContext lazily after first user interaction.
      // This is now handled in the VoiceChannel component before joining.
    } catch (error) {
        console.warn("Could not access localStorage. Running in a non-browser environment?");
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: new Date().toISOString(),
      createdAt: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);


  return (
    <PageContext.Provider value={{ 
        pageTitle, setPageTitle, 
        headerActions, setHeaderActions, 
        showSidebar, setShowSidebar, 
        discordId, setDiscordId, 
        isChatOpen, setIsChatOpen,
        notifications, addNotification, clearNotifications,
        audioContext
    }}>
      {children}
    </PageContext.Provider>
  );
};

export const usePage = () => {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
};
