
'use server';
/**
 * @fileOverview A flow for the AI chatbot assistant.
 */
import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import type { Message } from 'genkit/generate';
import {
  getStudentAttendance,
  getStudentFeeBalance,
  getStudentNextExam,
  getTeacherPendingTasks,
  getAdminStudentCount,
  getOverallAttendanceSummary,
} from '@/ai/tools/chatbot-tools';
import type { Tool } from 'genkit/tool';

const ChatbotInputSchema = z.object({
  userId: z.string().describe("The user's unique ID (student ID or staff ID)."),
  userRole: z.enum(['student', 'teacher', 'admin']).describe("The role of the user asking the question."),
  query: z.string().describe("The user's question for the chatbot."),
  history: z.array(z.object({
    role: z.enum(['user', 'bot']),
    content: z.string()
  })).optional().describe("The conversation history.")
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

const ChatbotOutputSchema = z.object({
  answer: z.string().describe('A helpful and concise answer to the user query.'),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;


// --- TOOL DEFINITIONS ---
const studentTools: Tool<any, any>[] = [getStudentAttendance, getStudentFeeBalance, getStudentNextExam];
const teacherTools: Tool<any, any>[] = [getTeacherPendingTasks];
const adminTools: Tool<any, any>[] = [getStudentAttendance, getStudentFeeBalance, getStudentNextExam, getTeacherPendingTasks, getAdminStudentCount, getOverallAttendanceSummary];


const chatbotFlow = ai.defineFlow(
  {
    name: 'chatbotFlow',
    inputSchema: ChatbotInputSchema,
    outputSchema: ChatbotOutputSchema,
  },
  async (input) => {
    // 1. Convert frontend history to Genkit message format
    const history: Message[] = (input.history || []).map(h => ({
      role: h.role === 'bot' ? 'model' : 'user',
      content: [{ text: h.content }]
    }));
    
    // 2. Select tools and system prompt based on user role
    let toolsForRole: Tool<any, any>[] = [];
    let systemPrompt = ''; 
    
    switch (input.userRole) {
        case 'student':
            toolsForRole = studentTools;
            systemPrompt = `You are EduSphere AI, a friendly personal academic assistant for a university. You are speaking to a student with the ID: ${input.userId}. Your goal is to help them with their academic journey.

            **Your process is as follows:**
            1.  **Analyze the user's query:** Understand what the student is asking.
            2.  **Check your tools:** If the query is about their *own* attendance, fees, or exams, you MUST use your tools to provide this information. When using tools, always use the student ID "${input.userId}".
            3.  **Answer from general knowledge:** If the query is a general knowledge question, an educational concept, a request for writing help (like for a speech), or anything unrelated to their personal university data, answer it to the best of your ability as a helpful and encouraging AI assistant.
            4.  **Privacy Boundary:** You MUST politely decline any request for information about another student, a teacher, or internal college database details.
            
            Always be friendly and supportive.`;
            break;
        case 'teacher':
            toolsForRole = teacherTools;
            systemPrompt = `You are EduSphere AI, a helpful teaching assistant for a university. Your primary function is to assist teachers with their tasks using a limited set of tools. You must also protect student privacy. You can also answer general knowledge and educational questions.

            **Your process is as follows:**
            1.  **Analyze the user's query:** Understand the user's intent.
            2.  **Check your tools:** Your tools are for your own tasks (e.g., \`getTeacherPendingTasks\`). Use them when asked. Your teacher ID is: ${input.userId}.
            3.  **Strict Privacy Boundary:** You MUST politely decline any request for a specific student's personal data (like attendance, fees, marks), even for students in your own classes. Guide the teacher to use the main ERP portal for these specific tasks. This is a strict privacy rule. You cannot access details about other users.
            4.  **Answer from general knowledge:** If the query is a general knowledge question, an educational concept, a request for writing help, or anything that does *not* match your specific tools, answer it to the best of your ability as a helpful AI assistant.
            
            Always be professional, supportive, and mindful of privacy.`;
            break;
        case 'admin':
            toolsForRole = adminTools;
            systemPrompt = `You are EduSphere AI, a powerful administrative assistant for a university. Your primary function is to provide accurate, data-driven answers using a set of specialized tools. You have full access to the database via your tools.

            **Your process is as follows:**
            1.  **Analyze the user's query:** Understand the user's intent. Are they asking for specific data (e.g., a student's attendance, total enrollment numbers) or general information?
            2.  **Check your tools:** If the query directly maps to one of your available tools (like \`getStudentAttendance\`, \`getAdminStudentCount\`), you MUST use the tool to get the most up-to-date information. The user must provide any necessary IDs (like a studentId) for the tools.
            3.  **Answer from general knowledge:** If the query is a general knowledge question, an educational concept, a request for writing help, or anything that does *not* match a tool, answer it to the best of your ability as a helpful AI assistant. Do not mention your tools in this case.
            
            Always be concise, professional, and helpful.`;
            break;
    }

    const messages: Message[] = [
      ...history,
      { role: 'user', content: [{ text: input.query }] }
    ];

    // 3. Call the AI model with the appropriate configuration.
    // We are using Gemini 1.5 Pro, a powerful multimodal model with a large context window,
    // which is excellent for understanding conversational history and performing tool use.
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-pro',
      system: systemPrompt,
      messages: messages,
      tools: toolsForRole,
      config: {
          safetySettings: [
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          ]
      }
    });

    const text = llmResponse.text;
    
    // Defensive check to prevent crashes on empty AI response
    if (!text) {
      console.error("Chatbot flow failed to get a text response from the LLM. Full response:", JSON.stringify(llmResponse, null, 2));
      return { answer: "Sorry, I couldn't process that request. Please try rephrasing your question." };
    }
    
    return { answer: text };
  }
);


export async function chatbot(input: ChatbotInput): Promise<ChatbotOutput> {
  return chatbotFlow(input);
}
