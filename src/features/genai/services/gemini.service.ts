/**
 * Gemini API Service
 * Handles communication with Google Generative AI
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { QuizRequest, QuizResponse } from '../schema';
import { validateQuizResponse } from '../schema/quiz-response';
import { buildCompletePrompt } from '../utils/prompt-builder';

// Lazy initialization to avoid issues with Vite env vars
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY is not set in environment variables');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel(): GenerativeModel {
  if (!model) {
    // Use gemini-1.5-flash-latest which is the current stable alias
    // Fallback to gemini-1.5-flash if needed
    const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash-latest';
    console.log('[Gemini] Using model:', modelName);
    model = getGenAI().getGenerativeModel({ model: modelName });
  }
  return model;
}

export interface GenerationResult {
  success: boolean;
  data?: QuizResponse;
  error?: string;
}

/**
 * Generates a quiz using Gemini API with retry logic
 */
export async function generateQuiz(request: QuizRequest): Promise<GenerationResult> {
  const { systemPrompt, userPrompt } = buildCompletePrompt(request);
  const model = getModel();

  // Configure generation
  const generationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  };

  // Use generateContent directly (simpler, faster than chat session)
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  // Retry logic with exponential backoff for 503/429 errors
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Send with timeout (60 seconds)
      const TIMEOUT_MS = 60000;
      const generatePromise = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
        generationConfig,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 60 seconds')), TIMEOUT_MS)
      );

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = result.response.text();

      // Parse and validate response
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse Gemini response as JSON:', responseText);
        return {
          success: false,
          error: 'Failed to parse AI response. Please try again.',
        };
      }

      if (!validateQuizResponse(parsedData)) {
        console.error('Invalid quiz response structure:', parsedData);
        return {
          success: false,
          error: 'AI returned invalid quiz format. Please try again.',
        };
      }

      // Ensure question count matches request
      if (parsedData.questions.length !== request.itemCount) {
        console.warn(`Expected ${request.itemCount} questions, got ${parsedData.questions.length}`);
      }

      return {
        success: true,
        data: parsedData,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Gemini API error (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message);

      // Check if we should retry (503, 429, timeout, network errors)
      const shouldRetry =
        lastError.message.includes('503') ||
        lastError.message.includes('429') ||
        lastError.message.includes('quota') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('fetch') ||
        lastError.message.includes('Service Unavailable') ||
        lastError.message.includes('high demand');

      if (shouldRetry && attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry - return error
      break;
    }
  }

  // All retries exhausted
  console.error('Gemini API error (all retries failed):', lastError);

  // Provide user-friendly error messages
  if (lastError) {
    if (lastError.message.includes('API_KEY')) {
      return { success: false, error: 'Invalid API key. Please check configuration.' };
    }
    if (lastError.message.includes('quota') || lastError.message.includes('429')) {
      return { success: false, error: 'Rate limit exceeded. Please wait a moment and try again.' };
    }
    if (lastError.message.includes('network') || lastError.message.includes('fetch')) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
    if (lastError.message.includes('503') || lastError.message.includes('Service Unavailable') || lastError.message.includes('high demand')) {
      return { success: false, error: 'AI service is temporarily overloaded. Please try again in a moment.' };
    }
    if (lastError.message.includes('timeout')) {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    return { success: false, error: lastError.message };
  }

  return {
    success: false,
    error: 'Failed to generate quiz. Please try again.',
  };
}

/**
 * Health check for the Gemini API
 */
export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const model = getModel();
    const result = await model.generateContent('Say "OK" if you can hear me.');
    return result.response.text().includes('OK');
  } catch {
    return false;
  }
}

/**
 * List available models for this API key
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    // Use the REST API directly to list models
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error('List models error:', response.status, errorText);
      return [];
    }
    const data = await response.json();
    return data.models?.map((m: any) => m.name.replace('models/', '')) || [];
  } catch (error) {
    console.error('Failed to list models:', error);
    return [];
  }
}