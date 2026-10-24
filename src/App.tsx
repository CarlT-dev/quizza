import { Layout } from '@/shared/components/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';

function App() {
  return (
    <Layout title="Quizza">
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Welcome to Quizza</CardTitle>
          <CardDescription>Your mobile-first quiz application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-300">
            A modern quiz app built with React, TypeScript, and Tailwind CSS.
          </p>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full">
              Start Quiz
            </Button>
            <Button variant="outline" size="lg" className="w-full">
              Create Quiz
            </Button>
            <Button variant="ghost" size="lg" className="w-full">
              View Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

export default App;