import { PullToRefreshProvider } from '@/features/refresh/context/PullToRefreshContext';
import { GlobalPullToRefresh } from '@/features/refresh/components/GlobalPullToRefresh';
import { AppRoutes } from '@/app/routes';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { BackButtonProvider } from '@/shared/context/BackButtonContext';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastProvider } from '@/shared/components/ui';
import { OfflineBanner } from '@/shared/components/ui';

function App() {
  return (
    <ToastProvider>
      <QueryProvider>
        <AuthProvider>
          <BackButtonProvider>
            <PullToRefreshProvider>
              <GlobalPullToRefresh>
                <OfflineBanner />
                <AppRoutes />
              </GlobalPullToRefresh>
            </PullToRefreshProvider>
          </BackButtonProvider>
        </AuthProvider>
      </QueryProvider>
    </ToastProvider>
  );
}

export default App;