// Handle incoming questions on listings.
// Three-tier system: keyword match -> GPT fallback -> Telegram alert (no answer).
// If neither keywords nor GPT can answer, the question is NOT answered automatically
// and a Telegram notification is sent so the seller can respond manually.

import { getQuestion, answerQuestion, getItem, getItemDescription } from "./api";
import { findQuestionResponse } from "@/lib/product-config";
import { generateQuestionResponse } from "@/lib/openai";
import { notifyUnhandledQuestion } from "@/lib/telegram";
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

  // Get item info upfront (needed for both keyword matching and GPT)
  const item = await getItem(question.item_id);
  const itemTitle = item.title || "";

  // ---- Tier 1: keyword matching (with item title context) ----
  let responseText = findQuestionResponse(questionText, itemTitle);
  let method = "keywords";

  // ---- Tier 2: GPT fallback ----
  if (!responseText) {
    const description = await getItemDescription(question.item_id);
    const gptResponse = await generateQuestionResponse(
      questionText,
      itemTitle,
      description
    );

    if (gptResponse) {
      responseText = gptResponse;
      method = "GPT";
    }
  }

  // ---- Tier 3: cannot answer -> notify Telegram, do NOT answer ----
  if (!responseText) {
    addActivityLog({
      type: "human",
      message: "Pregunta no respondida (enviada a Telegram)",
      details: `Q: "${questionText.slice(0, 150)}" | Item: ${itemTitle}`,
    });

    await notifyUnhandledQuestion(
      String(question.id),
      questionText,
      itemTitle,
      question.item_id
    );

    return; // Do NOT answer the question on ML
  }

  // Answer the question on MercadoLibre
  await answerQuestion(question.id, responseText);

  addActivityLog({
    type: "question",
    message: `Pregunta respondida (${method})`,
    details: `Q: "${questionText.slice(0, 100)}" -> R: "${responseText.slice(0, 100)}..."`,
  });
}
