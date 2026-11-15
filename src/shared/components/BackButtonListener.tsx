import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useBackButtonRegistry } from '@/shared/context/BackButtonContext';

/**
 * Global Back Button Listener
 * Registers a single listener for the Android physical back button.
 * Handles priority-based overlay dismissal, navigation, and app minimization.
 */
export function BackButtonListener() {
  const location = useLocation();
  const navigate = useNavigate();
  const registry = useBackButtonRegistry();

  useEffect(() => {
    // Only register on Android (Capacitor)
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    const handleBackButton = () => {
      // 1. Check for active overlay handlers (highest priority first)
      const handler = registry.getHighestPriorityHandler();
      if (handler) {
        handler.close();
        return;
      }

      // 2. No active overlays - navigate back using React Router
      if (location.pathname !== '/') {
        navigate(-1);
        return;
      }

      // 3. At root route - minimize app instead of exiting
      App.minimizeApp();
    };

    // Add listener
    const listener = App.addListener('backButton', handleBackButton);

    // Cleanup
    return () => {
      listener.then((l: { remove: () => void }) => l.remove());
    };
  }, [location.pathname, navigate, registry]);

  return null; // This component renders nothing
}