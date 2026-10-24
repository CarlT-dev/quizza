import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Welcome to Quizza</CardTitle>
        <CardDescription>Your mobile-first quiz application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => navigate('/quiz')}>
            Start Quiz
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/quiz')}>
            Create Quiz
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate('/results')}>
            View Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}