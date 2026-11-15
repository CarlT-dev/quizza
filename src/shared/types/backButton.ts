/**
 * Back Button Handler Types
 * Centralized types for Android physical back button handling
 */

export type OverlayPriority = 1 | 2 | 3; // 1=highest (dialog), 2=bottomsheet, 3=slidepanel

export interface BackButtonHandler {
  id: string;
  priority: OverlayPriority;
  close: () => void;
  isActive: boolean;
}

export interface BackButtonRegistry {
  register: (handler: Omit<BackButtonHandler, 'isActive'>) => () => void;
  unregister: (id: string) => void;
  getHighestPriorityHandler: () => BackButtonHandler | null;
}

export interface BackButtonContextValue {
  registry: BackButtonRegistry;
}