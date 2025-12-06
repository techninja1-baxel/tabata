import { GoogleGenAI, Type } from "@google/genai";
import { PlanSession, WorkoutType } from '../types';
import { GEMINI_API_KEY } from '../config';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const generateTrainingPlan = async (focus: string[], duration: string, clientName: string, notes: string): Promise<PlanSession[]> => {
  try {
    // Check if API key is configured
    if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
      throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your environment variables.');
    }
    
    // 1. Optimization: Move Persona to System Instruction
    // This pre-loads the context, allowing the model to focus immediately on the task.
    const systemInstruction = "You are an elite Strength and Conditioning Coach with a PhD in Sports Science. You create highly specific, safe, and effective training plans. You communicate in structured JSON only.";

    const prompt = `
      Create a ${duration} training plan for ${clientName}.
      
      Primary Focus: ${focus.join(', ')}.
      Client Context & Constraints: ${notes}.

      Requirements:
      1. Break down every workout into specific exercises.
      2. Ensure progressive overload principles are applied implicitly.
      3. For "type", use one of: "Warm Up", "Main Workout", "Cool Down".
      4. "remarks" should be short, technical cues (max 10 words).
      
      Return a flat JSON array of sessions.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        // Removed explicit temperature setting to restore default (creative) behavior
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayLabel: { type: Type.STRING, description: "e.g., 'Week 1 - Day 1' or 'Monday'" },
              targetFocus: { type: Type.STRING, description: "Main goal of this specific session" },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING }, 
                    sets: { type: Type.STRING },
                    reps: { type: Type.STRING },
                    remarks: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    });

    let sessions = [];
    try {
      sessions = JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("Failed to parse JSON response:", response.text);
      throw new Error("Invalid JSON format from AI");
    }
    
    if (!Array.isArray(sessions)) {
       console.warn("AI did not return an array, wrapping result.");
       sessions = [sessions];
    }

    // Add IDs to the generated sessions and exercises
    return sessions.map((s: any) => ({
      ...s,
      id: crypto.randomUUID(),
      exercises: Array.isArray(s.exercises) ? s.exercises.map((e: any) => ({
        ...e,
        id: crypto.randomUUID(),
        // Normalize type if needed, default to MAIN if unknown
        type: Object.values(WorkoutType).includes(e.type as WorkoutType) ? e.type : WorkoutType.MAIN
      })) : []
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a visible error object that the UI can handle or display
    throw error; 
  }
};