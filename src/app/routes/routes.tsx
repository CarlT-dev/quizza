import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/shared/components/layout';
import { HomePage } from '@/features/home';
import { RegisterPage } from '@/features/register';
import { NotFoundPage } from '@/features/not-found';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout title="Quizza"><HomePage /></Layout>} />
        <Route path="/register" element={<Layout title="Register"><RegisterPage /></Layout>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}