import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 pb-20">
      <div className="text-center mb-15">
        <img
          src="/page-not-found.png"
          alt="Page not found"
          className="mx-auto w-40"
        />
        <p className="text-[#2b5ecc] dark:text-gray-300 mb-5">
          Page not found
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => navigate('/')}>
            Go Home
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}