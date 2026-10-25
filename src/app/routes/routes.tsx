import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/shared/components/layout';
import { HomePage } from '@/features/home';
import { LoginPage } from '@/features/login';
import { RegisterPage } from '@/features/register';
import { ForgotPasswordPage } from '@/features/forgot-password';
import { NotFoundPage } from '@/features/not-found';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { CreateQuizPage } from '@/features/create-quiz';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Layout title="Login"><LoginPage /></Layout>} />
        <Route path="/register" element={<Layout title="Register"><RegisterPage /></Layout>} />
        <Route path="/forgot-password" element={<Layout title="Forgot Password"><ForgotPasswordPage /></Layout>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout title="Quizza" showFooterNav><HomePage /></Layout>} />
          <Route path="/create-quiz" element={<Layout><CreateQuizPage /></Layout>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}