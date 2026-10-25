import { PullToRefreshProvider } from '@/features/refresh/context/PullToRefreshContext';
import { GlobalPullToRefresh } from '@/features/refresh/components/GlobalPullToRefresh';
import { AppRoutes } from '@/app/routes';
import { AuthProvider } from '@/features/auth/context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <PullToRefreshProvider>
        <GlobalPullToRefresh>
          <AppRoutes />
        </GlobalPullToRefresh>
      </PullToRefreshProvider>
    </AuthProvider>
  );
}

export default App;