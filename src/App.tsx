import { PullToRefreshProvider } from '@/features/refresh/context/PullToRefreshContext';
import { GlobalPullToRefresh } from '@/features/refresh/components/GlobalPullToRefresh';
import { AppRoutes } from '@/app/routes';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { BackButtonProvider } from '@/shared/context/BackButtonContext';

function App() {
  return (
    <AuthProvider>
      <BackButtonProvider>
        <PullToRefreshProvider>
          <GlobalPullToRefresh>
            <AppRoutes />
          </GlobalPullToRefresh>
        </PullToRefreshProvider>
      </BackButtonProvider>
    </AuthProvider>
  );
}

export default App;