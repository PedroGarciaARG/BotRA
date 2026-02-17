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
 * Get messages for a pack/order.
 * ML messaging API uses /messages/packs/{packId}/sellers/{sellerId} for pack orders
 * and /messages/orders/{orderId}/sellers/{sellerId} for individual orders without pack.
 */
export async function getPackMessages(packId: string, sellerId: string, isOrderFallback?: boolean) {
  const basePath = isOrderFallback
    ? `/messages/orders/${packId}/sellers/${sellerId}?tag=post_sale`
    : `/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`;

  try {
    return await mlFetch<{
      messages: Array<{
        id: string;
        from: { user_id: string; role: string };
        to: { user_id: string; role: string };
        text: string;
        created_at: string;
      }>;
      paging: { total: number };
    }>(basePath);
  } catch (err) {
    // If pack endpoint fails and we haven't tried order endpoint yet, try it as fallback
    if (!isOrderFallback) {
      console.log(`[v0] Pack messages failed for ${packId}, trying order fallback`);
      try {
        return await mlFetch<{
          messages: Array<{
            id: string;
            from: { user_id: string; role: string };
            to: { user_id: string; role: string };
            text: string;
            created_at: string;
          }>;
          paging: { total: number };
        }>(`/messages/orders/${packId}/sellers/${sellerId}?tag=post_sale`);
      } catch {
        // Return empty if both fail
        console.log(`[v0] Order messages fallback also failed for ${packId}`);
        return { messages: [], paging: { total: 0 } };
      }
    }
    throw err;
  }
}

/**
 * Send a post-sale message to the buyer.
 * ML limit: 350 chars per message (ISO-8859-1).
 * Tries pack endpoint first, falls back to order endpoint.
 */
export async function sendMessage(
  packId: string,
  sellerId: string,
  text: string,
  buyerId?: string
) {
  // Truncate to 350 chars to respect ML limit
  const truncated = text.slice(0, 350);

  // ML messaging API requires from.user_id as a number
  const numericSellerId = Number(sellerId);

  const messageBody: Record<string, unknown> = {
    from: { user_id: numericSellerId },
    text: truncated,
  };

  // Include buyer ID if available
  if (buyerId) {
    messageBody.to = { user_id: Number(buyerId) };
  }

  try {
    return await mlFetch(
      `/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`,
      {
        method: "POST",
        body: messageBody,
      }
    );
  } catch (err) {
    // Fallback: try order-based endpoint
    console.log(`[v0] sendMessage pack endpoint failed for ${packId}, trying order endpoint`);
    return mlFetch(
      `/messages/orders/${packId}/sellers/${sellerId}?tag=post_sale`,
      {
        method: "POST",
        body: messageBody,
      }
    );
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
