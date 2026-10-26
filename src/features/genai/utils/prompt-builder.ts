/**
 * Prompt Builder for Quiz Generation
 * Converts QuizRequest into structured prompts for Gemini
 */

import type { QuizRequest } from '../schema';

/**
 * Builds the system prompt for quiz generation
 */
export function buildSystemPrompt(): string {
  return `You are an expert quiz generator. Create high-quality, well-structured quizzes based on the given topic and parameters.

RULES:
1. Output ONLY valid JSON matching the exact schema provided
2. Questions must be accurate, clear, and unambiguous
3. Distractors (wrong answers) must be plausible but clearly incorrect
4. Explanations should be educational and concise
5. Difficulty must match the requested level:
   - Easy: Basic recall, straightforward concepts
   - Medium: Application, analysis, some critical thinking
   - Hard: Synthesis, evaluation, complex reasoning
6. For true/false questions, use exactly 2 options: "True" and "False"
7. For multiple choice, use exactly 4 options`;
}

/**
 * Builds the user prompt with the quiz request parameters
 */
export function buildUserPrompt(request: QuizRequest): string {
  const { topic, questionType, difficulty, itemCount, additionalContext } = request;

  const typeInstruction = questionType === 'multiple_choice'
    ? 'Generate multiple choice questions with exactly 4 options each (A, B, C, D).'
    : 'Generate true/false questions with exactly 2 options: "True" and "False".';

  const difficultyGuidance = {
    easy: 'Questions should test basic knowledge and recall. Use clear, direct language.',
    medium: 'Questions should require understanding and application of concepts. Some analysis needed.',
    hard: 'Questions should require synthesis, evaluation, and complex reasoning. Multi-step thinking.',
  }[difficulty];

  return `Generate a quiz with the following specifications:

TOPIC: "${topic}"

PARAMETERS:
- Question Type: ${questionType.replace('_', ' ')}
- Difficulty: ${difficulty}
- Number of Questions: ${itemCount}
${additionalContext ? `- Additional Context: ${additionalContext}` : ''}

${typeInstruction}
${difficultyGuidance}

OUTPUT FORMAT (JSON only, no markdown, no extra text):
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Brief explanation of why this is correct",
      "difficulty": "${difficulty}",
      "type": "${questionType}"
    }
  ],
  "metadata": {
    "topic": "${topic}",
    "totalQuestions": ${itemCount},
    "questionType": "${questionType}",
    "difficulty": "${difficulty}",
    "generatedAt": "${new Date().toISOString()}",
    "model": "gemini-1.5-flash"
  }
}

Generate exactly ${itemCount} questions. Ensure all questions are unique and cover different aspects of the topic.`;
}

/**
 * Builds few-shot examples for better consistency
 */
export function buildFewShotExamples(questionType: 'multiple_choice' | 'true_false'): string {
  if (questionType === 'multiple_choice') {
    return `EXAMPLES:

Example 1 (Multiple Choice - Easy):
{
  "id": "q1",
  "question": "What is the capital of France?",
  "options": ["London", "Paris", "Berlin", "Madrid"],
  "correctAnswerIndex": 1,
  "explanation": "Paris is the capital city of France.",
  "difficulty": "easy",
  "type": "multiple_choice"
}

Example 2 (Multiple Choice - Medium):
{
  "id": "q2",
  "question": "Which planet has the most moons in our solar system?",
  "options": ["Jupiter", "Saturn", "Uranus", "Neptune"],
  "correctAnswerIndex": 1,
  "explanation": "As of 2024, Saturn has 146 confirmed moons, the most of any planet.",
  "difficulty": "medium",
  "type": "multiple_choice"
}`;
  }

  return `EXAMPLES:

Example 1 (True/False - Easy):
{
  "id": "q1",
  "question": "The Earth is the third planet from the Sun.",
  "options": ["True", "False"],
  "correctAnswerIndex": 0,
  "explanation": "Earth orbits the Sun at the third position in our solar system.",
  "difficulty": "easy",
  "type": "true_false"
}

Example 2 (True/False - Medium):
{
  "id": "q2",
  "question": "Photosynthesis occurs in the mitochondria of plant cells.",
  "options": ["True", "False"],
  "correctAnswerIndex": 1,
  "explanation": "Photosynthesis occurs in chloroplasts, not mitochondria. Mitochondria are for cellular respiration.",
  "difficulty": "medium",
  "type": "true_false"
}`;
}

/**
 * Builds the complete prompt (system + user + few-shot)
 */
export function buildCompletePrompt(request: QuizRequest): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(request);
  const fewShot = buildFewShotExamples(request.questionType);

  return {
    systemPrompt,
    userPrompt: `${fewShot}\n\n${userPrompt}`,
  };
}