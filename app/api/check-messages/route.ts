// Manually check for new messages and process them (since ML webhooks for messages may not work)

import { NextResponse } from "next/server";
import { getAccessToken, getSellerId } from "@/lib/mercadolibre/auth";
import { getSellerOrders, getPackMessages } from "@/lib/mercadolibre/api";
import { handleMessageNotification } from "@/lib/mercadolibre/messages";
import { getBotEnabled } from "@/lib/storage";

/**
 * Core logic to check for new messages and respond.
 * Used by both POST endpoint and webhook handler.
 */
export async function checkMessagesAndRespond() {
  if (!getBotEnabled()) {
    return { status: "bot_paused", processed: 0, checked: 0, responded: 0 };
  }

  await getAccessToken();
  const sellerId = getSellerId();
  if (!sellerId) {
    throw new Error("Not authenticated");
  }

  // Get recent orders (last 10)
  const ordersData = await getSellerOrders(sellerId, 10, 0);
  const orders = ordersData.results || [];

  let processedCount = 0;
  let respondedCount = 0;

  for (const order of orders) {
    if (order.status !== "paid") continue;

    const packId = String(order.pack_id || order.id);
    const buyerId = String(order.buyer.id);

    try {
      // Get messages for this pack
      const msgsData = await getPackMessages(packId, sellerId);
      const allMessages = (msgsData.messages || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      if (allMessages.length === 0) continue;

      processedCount++;

      // Check if last message is from buyer (needs response)
      const lastMsg = allMessages[allMessages.length - 1];
      if (String(lastMsg.from.user_id) !== String(sellerId)) {
        // Last message is from buyer - process it
        console.log(`[v0] check-messages: responding to pack ${packId}`);
        await handleMessageNotification(`/messages/packs/${packId}`, buyerId);
        respondedCount++;
      }
    } catch (err) {
      console.log(`[v0] check-messages: error processing pack ${packId}:`, err);
    }
  }

  return { 
    status: "ok", 
    processed: processedCount,
    responded: respondedCount,
    checked: orders.length 
  };
}

export async function POST() {
  try {
    const result = await checkMessagesAndRespond();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[v0] check-messages error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
