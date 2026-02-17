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
  console.log(`[v0] handleQuestion: start, questionId=${questionId}`);

  let question;
  try {
    question = await getQuestion(questionId);
    console.log(`[v0] handleQuestion: fetched question, status=${question.status}, text="${question.text?.slice(0, 80)}"`);
  } catch (err) {
    console.log(`[v0] handleQuestion: ERROR fetching question ${questionId}:`, err);
    throw err;
  }

  // Skip if already answered
  if (question.status === "ANSWERED") {
    console.log(`[v0] handleQuestion: already answered, skipping`);
    return;
  }

  const questionText = question.text;

  // Get item info upfront (needed for both keyword matching and GPT)
  let item;
  try {
    item = await getItem(question.item_id);
    console.log(`[v0] handleQuestion: item="${item.title}"`);
  } catch (err) {
    console.log(`[v0] handleQuestion: ERROR fetching item ${question.item_id}:`, err);
    throw err;
  }
  const itemTitle = item.title || "";

  // ---- Tier 1: keyword matching (with item title context) ----
  let responseText = findQuestionResponse(questionText, itemTitle);
  let method = "keywords";
  console.log(`[v0] handleQuestion: keyword match result=${responseText ? "MATCH" : "NO_MATCH"}`);

  // ---- Tier 2: GPT fallback ----
  if (!responseText) {
    console.log(`[v0] handleQuestion: trying GPT fallback`);
    try {
      const description = await getItemDescription(question.item_id);
      const gptResponse = await generateQuestionResponse(
        questionText,
        itemTitle,
        description
      );
      console.log(`[v0] handleQuestion: GPT result=${gptResponse ? "GOT_RESPONSE" : "NO_RESPONSE"}`);

      if (gptResponse) {
        responseText = gptResponse;
        method = "GPT";
      }
    } catch (err) {
      console.log(`[v0] handleQuestion: GPT ERROR:`, err);
    }
  }

  // ---- Tier 3: cannot answer -> notify Telegram, do NOT answer ----
  if (!responseText) {
    console.log(`[v0] handleQuestion: no response found, notifying Telegram`);
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
  console.log(`[v0] handleQuestion: answering via ${method}, response="${responseText.slice(0, 80)}..."`);
  try {
    await answerQuestion(question.id, responseText);
    console.log(`[v0] handleQuestion: answer posted successfully`);
  } catch (err) {
    console.log(`[v0] handleQuestion: ERROR posting answer:`, err);
    throw err;
  }

  addActivityLog({
    type: "question",
    message: `Pregunta respondida (${method})`,
    details: `Q: "${questionText.slice(0, 100)}" -> R: "${responseText.slice(0, 100)}..."`,
  });
}
