import { PullToRefreshProvider } from '@/features/refresh/context/PullToRefreshContext';
import { GlobalPullToRefresh } from '@/features/refresh/components/GlobalPullToRefresh';
import { AppRoutes } from '@/app/routes';

function App() {
  return (
    <PullToRefreshProvider>
      <GlobalPullToRefresh>
        <AppRoutes />
      </GlobalPullToRefresh>
    </PullToRefreshProvider>
  );
}

export default App;