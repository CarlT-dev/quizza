import type { QuizRequest } from '../schema';
import { allocateQuestionCounts } from './question-distribution';

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
8. Enumeration: ordered list (if sequence implied) or unordered set; set enumerationOrdered=true for ordered, false for unordered
9. Title: generate a concise, descriptive quiz title based on the topic
10. All matching: CASE-INSENSITIVE
11. Order: output questions grouped by type in this exact order: multiple_choice first, then true_false, then identification, then enumeration. Never interleave types.
12. Uniqueness: each fact or concept is tested at most once in the whole quiz, no matter the question type. Never re-ask, rephrase, or convert another question's fact into a different question type.
13. No leaks: no question, option, or explanation may reveal, define, or hint at another question's answer.
14. IDs: unique sequential ids (q1, q2, ... qN), one per question, never reused.`;
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
    enumeration: 'Enumeration (ordered if sequence implied, unordered if a set; set enumerationOrdered accordingly)',
  };

  const diffMap: Record<string, string> = {
    easy: 'Easy (basic recall)',
    medium: 'Medium (application)',
    hard: 'Hard (synthesis/evaluation)',
  };

  const diffDesc = difficulties.map(d => diffMap[d]).join(', ');

  // Rank-weighted per-type counts, already in presentation priority order
  // (multiple_choice → true_false → identification → enumeration).
  const allocation = allocateQuestionCounts(itemCount, questionTypes);

  return `Generate ${itemCount} questions on "${topic}" using the question types and difficulties selected below.

DIFFICULTIES: ${diffDesc}

DISTRIBUTION AND ORDER:
Output the types below as separate consecutive groups, in this exact order:
${allocation.map((a, i) => {
  const unit = a.count === 1 ? 'question' : 'questions';
  return `${i + 1}. ${typeMap[a.type]} — exactly ${a.count} ${unit}`;
}).join('\n')}
Follow these counts exactly — do not add, drop, or substitute questions. Mix difficulties within each group.

UNIQUENESS (critical):
- Test each fact or concept at most once across the whole quiz, regardless of question type.
- Never re-ask another question's fact in a different format (e.g. a fact used in a multiple-choice question must not reappear as an identification or enumeration question).
- No question, option, or explanation may give away another question's answer.

${additionalContext ? `Context: ${additionalContext}` : ''}

OUTPUT (JSON only):
{
  "questions": [
    {"id":"q1","question":"...","options":[],"correctAnswerIndex":0,"explanation":"...","difficulty":"easy|medium|hard","type":"multiple_choice|true_false|identification|enumeration"}
  ],
  "metadata":{"title":"...","topic":"${topic}","totalQuestions":${itemCount},"questionTypes":${JSON.stringify(questionTypes)},"difficulties":${JSON.stringify(difficulties)},"generatedAt":"${new Date().toISOString()}","model":"auto"}
}

IMPORTANT: Output all questions of each type together in the grouped order above, with the exact counts listed. Mix difficulties within each group. Every question must test a fact not used by any other question.`;
}

/**
 * Builds minimal few-shot examples for all supported types
 */
export function buildFewShotExamples(): string {
  return `Examples:
Multiple Choice: {"id":"q1","question":"Capital of France?","options":["London","Paris","Berlin","Madrid"],"correctAnswerIndex":1,"explanation":"Paris is France's capital.","difficulty":"easy","type":"multiple_choice"}
True/False: {"id":"q2","question":"Earth is 3rd from Sun.","options":["True","False"],"correctAnswerIndex":0,"explanation":"Earth orbits 3rd.","difficulty":"easy","type":"true_false"}
Identification: {"id":"q3","question":"Capital of Japan is _____.","options":[],"correctAnswer":"Tokyo","acceptableAnswers":["Tōkyō","Tokio"],"explanation":"Since 1868.","difficulty":"easy","type":"identification"}
Enumeration: {"id":"q4","question":"First 3 planets from Sun.","options":[],"correctAnswers":["Mercury","Venus","Earth"],"enumerationOrdered":true,"explanation":"Inner planets in order.","difficulty":"easy","type":"enumeration"}`;
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
