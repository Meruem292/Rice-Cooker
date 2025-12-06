import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, API calls might be proxied through a backend to protect the key,
// or use Firebase App Check. For this demo, we use the env variable directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSmartCookingAdvice = async (userQuery: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userQuery,
      config: {
        systemInstruction: `You are an expert chef controlling a smart IoT Rice Cooker. 
      The user will ask for advice on cooking rice (e.g., 'I want to cook 2 cups of sushi rice' or 'How to make brown rice fluffy').
      
      Based on the query, output a JSON configuration for the rice cooker.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riceCups: { type: Type.NUMBER, description: "Number of cups of rice to dispense/use" },
            waterRatio: { type: Type.NUMBER, description: "Water to rice ratio (e.g. 1.2 for sushi, 1.5 for white)" },
            mode: { type: Type.STRING, description: "Cooking mode: white, brown, sushi, porridge, quick" },
            estimatedTimeMinutes: { type: Type.NUMBER, description: "Estimated cooking time in minutes" },
            explanation: { type: Type.STRING, description: "Brief explanation of why these settings were chosen" }
          },
          required: ["riceCups", "waterRatio", "mode", "estimatedTimeMinutes", "explanation"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};