import type { QuizRequest } from '../schema';

/**
 * Builds the system prompt for quiz generation
 */
export function buildSystemPrompt(): string {
  return `Expert quiz generator. Output ONLY valid JSON matching the schema.

RULES:
1. Questions: accurate, clear, unambiguous
2. Distractors: plausible but clearly wrong
3. Explanations: concise, educational
4. Difficulty: Easy=recall, Medium=application, Hard=synthesis/evaluation
5. True/False: exactly 2 options ("True","False")
6. Multiple Choice: exactly 4 options (A,B,C,D)
7. Identification: question with blank, correct answer + 2-3 alternatives
8. Enumeration: ordered list (if sequence implied) or unordered set
9. All matching: CASE-INSENSITIVE`;
}

/**
 * Builds the user prompt with the quiz request parameters
 */
export function buildUserPrompt(request: QuizRequest): string {
  const { topic, questionTypes, difficulties, itemCount, additionalContext } = request;

  const typeMap: Record<string, string> = {
    multiple_choice: 'Multiple Choice (4 options A,B,C,D)',
    true_false: 'True/False (2 options)',
    identification: 'Identification (fill-in-blank with answer + alternatives)',
    enumeration: 'Enumeration (ordered/unordered list)',
  };

  const diffMap: Record<string, string> = {
    easy: 'Easy (basic recall)',
    medium: 'Medium (application)',
    hard: 'Hard (synthesis/evaluation)',
  };

  const typeDesc = questionTypes.map(t => typeMap[t]).join(', ');
  const diffDesc = difficulties.map(d => diffMap[d]).join(', ');

  // Calculate distribution
  const questionsPerType = Math.floor(itemCount / questionTypes.length);
  const remainder = itemCount % questionTypes.length;

  return `Generate ${itemCount} questions on "${topic}" with mixed types and difficulties.

QUESTION TYPES: ${typeDesc}
DIFFICULTIES: ${diffDesc}

DISTRIBUTION GUIDE:
${questionTypes.map((t, i) => {
  const count = questionsPerType + (i < remainder ? 1 : 0);
  return `- ${typeMap[t]}: ~${count} questions spread across ${diffDesc}`;
}).join('\n')}

${additionalContext ? `Context: ${additionalContext}` : ''}

OUTPUT (JSON only):
{
  "questions": [
    {"id":"q1","question":"...","options":[],"correctAnswerIndex":0,"explanation":"...","difficulty":"easy|medium|hard","type":"multiple_choice|true_false|identification|enumeration"}
  ],
  "metadata":{"topic":"${topic}","totalQuestions":${itemCount},"questionTypes":${JSON.stringify(questionTypes)},"difficulties":${JSON.stringify(difficulties)},"generatedAt":"${new Date().toISOString()}","model":"auto"}
}

IMPORTANT: Mix question types and difficulties as specified. Each question must have its own type and difficulty. Unique questions covering different aspects.`;
}

/**
 * Builds minimal few-shot examples for all supported types
 */
export function buildFewShotExamples(): string {
  return `Examples:
Multiple Choice: {"id":"q1","question":"Capital of France?","options":["London","Paris","Berlin","Madrid"],"correctAnswerIndex":1,"explanation":"Paris is France's capital.","difficulty":"easy","type":"multiple_choice"}
True/False: {"id":"q1","question":"Earth is 3rd from Sun.","options":["True","False"],"correctAnswerIndex":0,"explanation":"Earth orbits 3rd.","difficulty":"easy","type":"true_false"}
Identification: {"id":"q1","question":"Capital of Japan is _____.","options":[],"correctAnswer":"Tokyo","acceptableAnswers":["Tōkyō","Tokio"],"explanation":"Since 1868.","difficulty":"easy","type":"identification"}
Enumeration: {"id":"q1","question":"First 3 planets from Sun.","options":[],"correctAnswers":["Mercury","Venus","Earth"],"explanation":"Inner planets in order.","difficulty":"easy","type":"enumeration"}`;
}

/**
 * Builds the complete prompt (system + user + few-shot)
 */
export function buildCompletePrompt(request: QuizRequest): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(request);
  const fewShot = buildFewShotExamples();

  return {
    systemPrompt,
    userPrompt: `${fewShot}\n\n${userPrompt}`,
  };
}