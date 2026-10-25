import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/features/auth/context/AuthContext';

export function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Welcome to Quizza</CardTitle>
        <CardDescription>Your mobile-first quiz application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}