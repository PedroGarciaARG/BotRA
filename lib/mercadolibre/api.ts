// MercadoLibre API wrapper with automatic token injection

import { getAccessToken } from "./auth";

const ML_API = "https://api.mercadolibre.com";

interface MLApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  skipAuth?: boolean;
}

/**
 * Make an authenticated request to the MercadoLibre API.
 * Includes automatic retry with exponential backoff for rate limiting (429).
 */
export async function mlFetch<T = unknown>(
  path: string,
  options: MLApiOptions = {}
): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (!skipAuth) {
      const token = await getAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = path.startsWith("http") ? path : `${ML_API}${path}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting with exponential backoff (ML best practice)
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 8000);
      console.log(`[v0] ML API rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ML API ${method} ${path} failed (${res.status}): ${errText}`);
    }

    return res.json() as Promise<T>;
  }

  throw new Error(`ML API ${method} ${path} failed after ${MAX_RETRIES} retries (rate limited)`);
}

/**
 * Get question details by ID.
 */
export async function getQuestion(questionId: string) {
  return mlFetch<{
    id: number;
    text: string;
    item_id: string;
    seller_id: number;
    status: string;
  }>(`/questions/${questionId}`);
}

/**
 * Answer a question on a listing.
 */
export async function answerQuestion(questionId: number, text: string) {
  return mlFetch("/answers", {
    method: "POST",
    body: { question_id: questionId, text },
  });
}

/**
 * Get item (listing) details.
 */
export async function getItem(itemId: string) {
  return mlFetch<{
    id: string;
    title: string;
    price: number;
    category_id: string;
    descriptions?: Array<{ id: string }>;
  }>(`/items/${itemId}`);
}

/**
 * Get item description text.
 */
export async function getItemDescription(itemId: string) {
  try {
    const data = await mlFetch<{ plain_text: string }>(`/items/${itemId}/description`);
    return data.plain_text || "";
  } catch {
    return "";
  }
}

/**
 * Get order details by ID.
 */
export async function getOrder(orderId: string) {
  return mlFetch<{
    id: number;
    status: string;
    order_items: Array<{
      item: { id: string; title: string };
      quantity: number;
    }>;
    buyer: { id: number; nickname: string };
    seller: { id: number };
    pack_id: number | null;
  }>(`/orders/${orderId}`);
}

/**
 * Get a single message by its resource path from a webhook notification.
 * ML webhook sends resource like "/messages-mp-v2/123456" or "/messages/123456"
 * which can be fetched directly to get the message with pack_id info.
 */
export async function getMessageByResource(resource: string) {
  try {
    const data = await mlFetch<{
      id?: string;
      message_id?: string;
      from?: { user_id: number | string };
      to?: { user_id: number | string };
      text?: string;
      resource?: string;
      // The pack or conversation reference
      conversation_id?: { pack_id?: string; order_id?: string };
      // Some formats use message_resources
      message_resources?: Array<{
        id: string;
        name: string;
      }>;
    }>(resource);
    return data;
  } catch (err) {
    console.log(`[v0] getMessageByResource failed for ${resource}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get messages for a pack/order.
 * ML docs: "Si el pack_id es null, usar el order_id pero manteniendo la
 * estructura del endpoint /messages/packs/{id}/sellers/{sellerId}".
 * The endpoint is ALWAYS /messages/packs/ even when using order_id.
 */
export async function getPackMessages(packId: string, sellerId: string) {
  // Message shape returned by ML (fields vary between old/new endpoint)
  type MLMessage = {
    id?: string;
    message_id?: string;
    from: { user_id: string; role?: string };
    to: { user_id: string; role?: string };
    text: string;
    created_at?: string;
    date_created?: string;
  };

  // Normalize messages from either endpoint format
  function normalize(msgs: MLMessage[]) {
    return msgs.map(m => ({
      id: m.id || m.message_id || "",
      from: { user_id: String(m.from.user_id), role: m.from.role || "" },
      to: { user_id: String(m.to?.user_id || ""), role: m.to?.role || "" },
      text: m.text || "",
      created_at: m.created_at || m.date_created || "",
    }));
  }

  // Try new /marketplace/ endpoint first
  try {
    const data = await mlFetch<{
      messages: MLMessage[];
      paging: { total: number };
    }>(`/marketplace/messages/packs/${packId}?tag=post_sale`);
    if (data.messages && data.messages.length > 0) {
      return { messages: normalize(data.messages), paging: data.paging || { total: data.messages.length } };
    }
  } catch (err) {
    console.log(`[v0] getPackMessages (new endpoint) failed for packId=${packId}:`, err instanceof Error ? err.message : err);
  }

  // Fallback to legacy endpoint
  try {
    const data = await mlFetch<{
      messages: MLMessage[];
      paging: { total: number };
    }>(`/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`);
    return { messages: normalize(data.messages || []), paging: data.paging || { total: 0 } };
  } catch (err) {
    console.log(`[v0] getPackMessages (legacy) also failed for packId=${packId}:`, err instanceof Error ? err.message : err);
    return { messages: [], paging: { total: 0 } };
  }
}

/**
 * Get available conversation options for a pack (action_guide).
 * ML requires sellers to choose a "motivo" before sending the first message
 * when using Mercado Envios 2 (Fulfillment, Cross docking, Drop off, Flex).
 */
export async function getActionGuide(packId: string) {
  try {
    return await mlFetch<{
      options: Array<{
        id: string;
        internal_description?: string;
        template_id?: string;
      }>;
    }>(`/messages/action_guide/packs/${packId}?tag=post_sale`);
  } catch (err) {
    console.log(`[v0] getActionGuide failed for pack ${packId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Initialize a post-sale conversation by selecting the "OTHER" option.
 * This is required by ML before sending free-form messages.
 * Returns true if successful or if action_guide is not required.
 */
export async function initConversation(packId: string, text: string): Promise<boolean> {
  try {
    const guide = await getActionGuide(packId);
    if (!guide || !guide.options || guide.options.length === 0) {
      // action_guide not required for this pack (e.g. "acordar con el vendedor")
      console.log(`[v0] No action_guide required for pack ${packId}`);
      return true;
    }

    // Prefer "OTHER" option for free-form text
    const otherOption = guide.options.find(o => o.id === "OTHER");
    const optionId = otherOption?.id || guide.options[0]?.id;

    if (!optionId) {
      console.log(`[v0] No valid option found in action_guide for pack ${packId}`);
      return true; // proceed anyway
    }

    console.log(`[v0] Initializing conversation for pack ${packId} with option=${optionId}`);

    const body: Record<string, unknown> = {
      option_id: optionId,
    };
    // For "OTHER" we can include text directly
    if (optionId === "OTHER") {
      body.text = text.slice(0, 350);
    }

    await mlFetch(
      `/messages/action_guide/packs/${packId}/option?tag=post_sale`,
      { method: "POST", body }
    );

    console.log(`[v0] Conversation initialized for pack ${packId}`);
    return true;
  } catch (err) {
    console.log(`[v0] initConversation failed for pack ${packId}:`, err instanceof Error ? err.message : err);
    // Don't fail the whole flow - try sending directly
    return false;
  }
}

/**
 * Send a post-sale message to the buyer.
 * ML limit: 350 chars per message (ISO-8859-1).
 *
 * Tries the new /marketplace/messages/packs/ endpoint first (simpler body: {text}).
 * Falls back to the legacy /messages/packs/.../sellers/... endpoint if the new one fails.
 */
export async function sendMessage(
  packId: string,
  sellerId: string,
  text: string,
  buyerId?: string
) {
  // Truncate to 350 chars to respect ML limit
  const truncated = text.slice(0, 350);

  // Try NEW marketplace endpoint first (Dec 2025 docs)
  try {
    const result = await mlFetch(
      `/marketplace/messages/packs/${packId}`,
      {
        method: "POST",
        body: { text: truncated },
      }
    );
    console.log(`[v0] sendMessage OK (new endpoint) pack=${packId}`);
    return result;
  } catch (newErr) {
    console.log(`[v0] New endpoint failed for pack=${packId}: ${newErr instanceof Error ? newErr.message : newErr}, trying legacy...`);
  }

  // Fallback: legacy endpoint
  const numericSellerId = Number(sellerId);
  const messageBody: Record<string, unknown> = {
    from: { user_id: numericSellerId },
    text: truncated,
  };

  if (buyerId) {
    messageBody.to = { user_id: Number(buyerId) };
  }

  try {
    const result = await mlFetch(
      `/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`,
      {
        method: "POST",
        body: messageBody,
      }
    );
    console.log(`[v0] sendMessage OK (legacy endpoint) pack=${packId}`);
    return result;
  } catch (legacyErr) {
    console.log(`[v0] Legacy endpoint also failed for pack=${packId}: ${legacyErr instanceof Error ? legacyErr.message : legacyErr}`);
    throw legacyErr;
  }
}

/**
 * Send multiple messages in sequence (for long content split into chunks).
 * Adds a small delay between messages to avoid rate limiting.
 */
export async function sendMessages(
  packId: string,
  sellerId: string,
  messages: string[],
  buyerId?: string
) {
  for (let i = 0; i < messages.length; i++) {
    await sendMessage(packId, sellerId, messages[i], buyerId);
    if (i < messages.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ---- Seller Questions ----

/**
 * Search seller questions with pagination.
 */
export async function getSellerQuestions(
  sellerId: string,
  status: "ANSWERED" | "UNANSWERED" = "ANSWERED",
  limit = 50,
  offset = 0
) {
  return mlFetch<{
    questions: Array<{
      id: number;
      text: string;
      answer: { text: string; date_created: string } | null;
      item_id: string;
      date_created: string;
      status: string;
      from: { id: number };
    }>;
    total: number;
    limit: number;
    offset: number;
  }>(
    `/questions/search?seller_id=${sellerId}&api_version=4&status=${status}&sort_fields=date_created&sort_types=DESC&limit=${limit}&offset=${offset}`
  );
}

// ---- Seller Orders (historical) ----

/**
 * Search seller orders with pagination (newest first).
 */
export async function getSellerOrders(
  sellerId: string,
  limit = 50,
  offset = 0
) {
  return mlFetch<{
    results: Array<{
      id: number;
      status: string;
      date_created: string;
      order_items: Array<{
        item: { id: string; title: string };
        quantity: number;
        unit_price: number;
      }>;
      buyer: { id: number; nickname: string };
      seller: { id: number };
      pack_id: number | null;
      shipping: { id: number | null };
      payments: Array<{ status: string }>;
    }>;
    paging: { total: number; offset: number; limit: number };
  }>(`/orders/search?seller=${sellerId}&sort=date_desc&limit=${limit}&offset=${offset}`);
}

// ---- Order Details (with shipping info) ----

/**
 * Get full order details including shipping ID.
 */
export async function getOrderDetails(orderId: string) {
  return mlFetch<{
    id: number;
    status: string;
    shipping: { id: number | null };
    order_items: Array<{
      item: { id: string; title: string };
      quantity: number;
    }>;
    buyer: { id: number; nickname: string };
    pack_id: number | null;
  }>(`/orders/${orderId}`);
}

// ---- Mark Shipment Delivered ----

/**
 * Mark a shipment as delivered (for virtual products).
 */
export async function markShipmentDelivered(shipmentId: number) {
  return mlFetch(`/shipments/${shipmentId}`, {
    method: "PUT",
    body: {
      status: "delivered",
      substatus: "delivered_to_buyer",
    },
  });
}
