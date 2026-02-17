// MercadoLibre webhook handler
// Receives notifications for: questions, orders, messages

import { NextRequest, NextResponse } from "next/server";
import { handleQuestion } from "@/lib/mercadolibre/questions";
import { handleOrderNotification } from "@/lib/mercadolibre/orders";
import { handleMessageNotification } from "@/lib/mercadolibre/messages";
import { addActivityLog, getBotEnabled } from "@/lib/storage";
import { notifyError } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, resource, user_id, application_id } = body;

    console.log(`[v0] Webhook received: topic=${topic}, resource=${resource}`);

    // Check if bot is enabled before processing
    if (!getBotEnabled()) {
      console.log("[v0] Bot is paused, skipping webhook");
      addActivityLog({
        type: "message",
        message: `Webhook ignorado (bot pausado): ${topic}`,
        details: resource,
      });
      return NextResponse.json({ status: "ok", skipped: true });
    }

    addActivityLog({
      type: "message",
      message: `Webhook recibido: ${topic}`,
      details: `resource=${resource} | user_id=${user_id}`,
    });

    switch (topic) {
      case "questions": {
        await handleQuestion(resource);
        break;
      }

      case "orders_v2": {
        const result = await handleOrderNotification(resource);
        console.log(`[v0] Order result: action=${result.action}, message=${result.message}`);
        break;
      }

      case "messages": {
        console.log(`[v0] Processing messages: ${resource} for user ${user_id}`);
        await handleMessageNotification(resource, String(user_id));
        break;
      }

      default: {
        console.log(`[v0] Unhandled webhook topic: ${topic}`);
        addActivityLog({
          type: "error",
          message: `Webhook no manejado: ${topic}`,
          details: JSON.stringify(body).slice(0, 200),
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    console.error("[v0] Webhook error:", message, stack);

    addActivityLog({
      type: "error",
      message: `Error en webhook: ${message.slice(0, 120)}`,
      details: `${message} | Stack: ${(stack || "").slice(0, 200)}`,
    });

    await notifyError("webhook", message).catch(() => {});

    // Always return 200 to ML so it doesn't retry endlessly
    return NextResponse.json({ status: "error", message }, { status: 200 });
  }
}

// ML sends a GET to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "active", bot: "Roblox Argentina" });
}
