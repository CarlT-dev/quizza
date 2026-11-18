import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { Layout } from '@/shared/components/layout';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { BackButtonListener } from '@/shared/components/BackButtonListener';
import { DelayedSuspense } from '@/shared/components/ui';

// Lazy load all route components for code splitting
const LoginPage = lazy(() => import('@/features/login').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/register').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/features/forgot-password').then(m => ({ default: m.ForgotPasswordPage })));
const NotFoundPage = lazy(() => import('@/features/not-found').then(m => ({ default: m.NotFoundPage })));
const HomePage = lazy(() => import('@/features/home').then(m => ({ default: m.HomePage })));
const QuizzesPage = lazy(() => import('@/features/quizzes').then(m => ({ default: m.QuizzesPage })));
const SearchPage = lazy(() => import('@/features/search').then(m => ({ default: m.SearchPage })));
const CreateQuizPage = lazy(() => import('@/features/create-quiz').then(m => ({ default: m.CreateQuizPage })));
const ProfilePage = lazy(() => import('@/features/profile').then(m => ({ default: m.ProfilePage })));
const ViewProfilePage = lazy(() => import('@/features/users').then(m => ({ default: m.ProfilePage })));
const MessagesPage = lazy(() => import('@/features/messages').then(m => ({ default: m.MessagesPage })));
const ConvoPage = lazy(() => import('@/features/messages').then(m => ({ default: m.ConvoPage })));
const QuizPage = lazy(() => import('@/features/[quiz]').then(m => ({ default: m.QuizPage })));
const ScorePage = lazy(() => import('@/features/[quiz]').then(m => ({ default: m.ScorePage })));
const ResultPage = lazy(() => import('@/features/[quiz]').then(m => ({ default: m.ResultPage })));
const OwnerResultsPage = lazy(() => import('@/features/[quiz]').then(m => ({ default: m.OwnerResultsPage })));
const OwnerResultDetailPage = lazy(() => import('@/features/[quiz]').then(m => ({ default: m.OwnerResultDetailPage })));

/** Lightweight loading fallback shown while route chunks load (after 200ms delay) */
function LoadingFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" aria-label="Loading page" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <DelayedSuspense fallback={<LoadingFallback />} delayMs={200}>
        <Routes>
          <Route path="/login" element={<Layout title="Login"><LoginPage /></Layout>} />
          <Route path="/register" element={<Layout title="Register"><RegisterPage /></Layout>} />
          <Route path="/forgot-password" element={<Layout title="Forgot Password"><ForgotPasswordPage /></Layout>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout title="Quizza" showFooterNav><HomePage /></Layout>} />
            <Route path="/quizzes" element={<Layout title="My Quizzes" showFooterNav><QuizzesPage /></Layout>} />
            <Route path="/search" element={<Layout title="Search" showFooterNav><SearchPage /></Layout>} />
            <Route path="/create-quiz" element={<Layout><CreateQuizPage /></Layout>} />
            <Route path="/quiz" element={<Navigate to="/404" replace />} />
            <Route path="/quiz/:quiz" element={<Layout><QuizPage /></Layout>} />
            <Route path="/quiz/:quiz/score" element={<Layout><ScorePage /></Layout>} />
            <Route path="/quiz/:quiz/result" element={<Layout><ResultPage /></Layout>} />
            <Route path="/quiz/:quiz/results" element={<Layout><OwnerResultsPage /></Layout>} />
            <Route path="/quiz/:quiz/results/:uid" element={<Layout><OwnerResultDetailPage /></Layout>} />
            <Route path="/profile" element={<Layout title="Profile" showFooterNav><ProfilePage /></Layout>} />
            <Route path="/messages" element={<Layout title="Messages" showFooterNav><MessagesPage /></Layout>} />
            <Route path="/messages/:uid" element={<Layout title="Conversation" minHeight={false}><ConvoPage /></Layout>} />
            <Route path="/user" element={<Navigate to="/404" replace />} />
            <Route path="/user/:uid" element={<Layout title="Profile"><ViewProfilePage /></Layout>} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </DelayedSuspense>
      <BackButtonListener />
    </BrowserRouter>
  );
}