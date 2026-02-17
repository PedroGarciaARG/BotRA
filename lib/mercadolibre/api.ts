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
 */
export async function mlFetch<T = unknown>(
  path: string,
  options: MLApiOptions = {}
): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;

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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ML API ${method} ${path} failed (${res.status}): ${errText}`);
  }

  return res.json() as Promise<T>;
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
 */
export async function getPackMessages(packId: string, sellerId: string) {
  return mlFetch<{
    messages: Array<{
      id: string;
      from: { user_id: string; role: string };
      to: { user_id: string; role: string };
      text: string;
      created_at: string;
    }>;
    paging: { total: number };
  }>(`/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`);
}

/**
 * Send a post-sale message to the buyer.
 * ML limit: 350 chars per message (ISO-8859-1).
 */
export async function sendMessage(
  packId: string,
  sellerId: string,
  text: string
) {
  // Truncate to 350 chars to respect ML limit
  const truncated = text.slice(0, 350);

  return mlFetch(
    `/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`,
    {
      method: "POST",
      body: { text: truncated },
    }
  );
}

/**
 * Send multiple messages in sequence (for long content split into chunks).
 * Adds a small delay between messages to avoid rate limiting.
 */
export async function sendMessages(
  packId: string,
  sellerId: string,
  messages: string[]
) {
  for (let i = 0; i < messages.length; i++) {
    await sendMessage(packId, sellerId, messages[i]);
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
