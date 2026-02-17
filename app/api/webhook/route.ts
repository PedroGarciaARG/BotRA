// MercadoLibre webhook handler
// Receives notifications for: questions, orders, messages

import { NextRequest, NextResponse } from "next/server";
import { handleQuestion } from "@/lib/mercadolibre/questions";
import { handleOrderNotification } from "@/lib/mercadolibre/orders";
import { handleMessageNotification } from "@/lib/mercadolibre/messages";
import { addActivityLog, getBotEnabled, getConfig } from "@/lib/storage";
import { notifyError } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, resource, user_id, application_id } = body;

    console.log(`[v0] Webhook received: topic=${topic}, resource=${resource}, app_id=${application_id}`);

    // Validate application_id matches our app (ML security best practice)
    const myAppId = getConfig().ML_APP_ID;
    if (myAppId && application_id && String(application_id) !== String(myAppId)) {
      console.log(`[v0] Ignoring webhook for different app: ${application_id} (ours: ${myAppId})`);
      return NextResponse.json({ status: "ok", skipped: true });
    }

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
        console.log(`[v0] Processing question: ${resource}`);
        try {
          await handleQuestion(resource);
          console.log(`[v0] Question processed successfully`);
        } catch (qErr) {
          const qMsg = qErr instanceof Error ? qErr.message : String(qErr);
          console.log(`[v0] Question handling FAILED: ${qMsg}`);
          addActivityLog({
            type: "error",
            message: `Error procesando pregunta: ${qMsg.slice(0, 120)}`,
            details: resource,
          });
          await notifyError("question", qMsg).catch(() => {});
        }
        break;
      }

      case "orders_v2": {
        console.log(`[v0] Processing order: ${resource}`);
        try {
          const result = await handleOrderNotification(resource);
          console.log(`[v0] Order result: action=${result.action}, message=${result.message}`);
          if (result.action === "error") {
            addActivityLog({
              type: "error",
              message: `Error en orden: ${result.message.slice(0, 120)}`,
              details: resource,
            });
            await notifyError("order", result.message).catch(() => {});
          }
        } catch (oErr) {
          const oMsg = oErr instanceof Error ? oErr.message : String(oErr);
          console.log(`[v0] Order handling FAILED: ${oMsg}`);
          addActivityLog({
            type: "error",
            message: `Error procesando orden: ${oMsg.slice(0, 120)}`,
            details: resource,
          });
          await notifyError("order", oMsg).catch(() => {});
        }
        break;
      }

      case "messages": {
        console.log(`[v0] Processing message: ${resource} for user ${user_id}`);
        try {
          await handleMessageNotification(resource, String(user_id));
          console.log(`[v0] Message processed successfully`);
        } catch (mErr) {
          const mMsg = mErr instanceof Error ? mErr.message : String(mErr);
          console.log(`[v0] Message handling FAILED: ${mMsg}`);
          addActivityLog({
            type: "error",
            message: `Error procesando mensaje: ${mMsg.slice(0, 120)}`,
            details: resource,
          });
          await notifyError("message", mMsg).catch(() => {});
        }
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
