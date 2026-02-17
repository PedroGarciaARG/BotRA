// Handle incoming questions on listings.
// Two-tier system: keyword match -> GPT fallback.

import { getQuestion, answerQuestion, getItem, getItemDescription } from "./api";
import { findQuestionResponse } from "@/lib/product-config";
import { generateQuestionResponse } from "@/lib/openai";
import { addActivityLog } from "@/lib/storage";

export async function handleQuestion(resourceId: string): Promise<void> {
  // resourceId is the question path, e.g., "/questions/QUESTION_ID"
  const questionId = resourceId.replace("/questions/", "");

  const question = await getQuestion(questionId);

  // Skip if already answered
  if (question.status === "ANSWERED") {
    return;
  }

  const questionText = question.text;

  // Try keyword matching first
  let responseText = findQuestionResponse(questionText);
  let method = "keywords";

  // If no match, use GPT
  if (!responseText) {
    const item = await getItem(question.item_id);
    const description = await getItemDescription(question.item_id);
    responseText = await generateQuestionResponse(
      questionText,
      item.title,
      description
    );
    method = "GPT";
  }

  // Answer the question
  await answerQuestion(question.id, responseText);

  addActivityLog({
    type: "question",
    message: `Pregunta respondida (${method})`,
    details: `Q: "${questionText.slice(0, 100)}" -> R: "${responseText.slice(0, 100)}..."`,
  });
}
