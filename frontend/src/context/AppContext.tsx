import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, SystemSettings } from '../api/client';
import { getCurrentCycle } from '../types';

interface AppContextType {
  settings: SystemSettings | null;
  currentCycle: string;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const data = await api.settings.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await refreshSettings();
      setIsLoading(false);
    };
    init();
  }, []);

  const currentCycle = settings?.current_cycle || getCurrentCycle();

  return (
    <AppContext.Provider value={{ settings, currentCycle, isLoading, refreshSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
