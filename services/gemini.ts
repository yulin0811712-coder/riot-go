import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDrillSergeantComment = async (
  name: string,
  score: number,
  accuracy: number
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      You are a tough, witty, sci-fi drill sergeant. 
      A recruit named "${name}" just finished a shooting simulation.
      Stats: Score: ${score}, Accuracy: ${Math.round(accuracy)}%.
      
      Provide a 1-sentence comment on their performance in Traditional Chinese (繁體中文).
      If score < 500, roast them gently. 
      If score > 1000, praise them begrudgingly.
      Keep it under 30 words.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "動作快點，士兵！沒什麼好說的。";
  } catch (error) {
    console.error("AI Generation failed", error);
    return "數據連結中斷。槍法不錯，士兵。";
  }
};