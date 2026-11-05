import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/components/layout';
import { HomePage } from '@/features/home';
import { LoginPage } from '@/features/login';
import { RegisterPage } from '@/features/register';
import { ForgotPasswordPage } from '@/features/forgot-password';
import { NotFoundPage } from '@/features/not-found';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { CreateQuizPage } from '@/features/create-quiz';
import { QuizzesPage } from '@/features/quizzes';
import { SearchPage } from '@/features/search';
import { QuizPage, ScorePage, ResultPage, StatusPage } from '@/features/[quiz]';
import { ProfilePage } from '@/features/users';
import { MessagesPage, ConvoPage } from '@/features/messages';

export function AppRoutes() {
  return (
    <BrowserRouter>
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
          <Route path="/status" element={<Layout title="Status" showFooterNav><StatusPage /></Layout>} />
          <Route path="/messages" element={<Layout title="Messages" showFooterNav><MessagesPage /></Layout>} />
          <Route path="/messages/:uid" element={<Layout title="Conversation"><ConvoPage /></Layout>} />
          <Route path="/user" element={<Navigate to="/404" replace />} />
          <Route path="/user/:uid" element={<Layout title="Profile"><ProfilePage /></Layout>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}