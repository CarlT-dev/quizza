import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';

export function RegisterPage() {
  const navigate = useNavigate();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle registration logic here
    navigate('/quiz');
  };

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Register to start quizzing</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <Input id="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <Input id="password" type="password" placeholder="••••••••" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium">Confirm Password</label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" required />
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" size="lg" className="w-full">
              Register
            </Button>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate('/')}>
              Already have an account? Sign in
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}