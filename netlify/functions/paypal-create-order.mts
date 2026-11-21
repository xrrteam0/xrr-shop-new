import { getStore } from "@netlify/blobs";

const store = getStore("xrr-shop-catalog");
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const clientId = Netlify.env.get("PAYPAL_CLIENT_ID");
  const secret = Netlify.env.get("PAYPAL_CLIENT_SECRET");
  const env = Netlify.env.get("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  if (!clientId || !secret) return Response.json({ error: "PayPal is not configured yet." }, { status: 503 });
  const { productId } = await req.json();
  const products = await store.get("products", { type: "json" }) as any[] | null;
  const product = (products ?? []).find(p => p.id === productId && p.active !== false);
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
  const basic = btoa(`${clientId}:${secret}`);
  const tokenRes = await fetch(`${env}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return Response.json({ error: "Could not authenticate with PayPal." }, { status: 502 });
  const orderRes = await fetch(`${env}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: product.id, description: product.name.slice(0, 127), amount: { currency_code: "EUR", value: Number(product.price).toFixed(2) } }], application_context: { brand_name: "XRR", user_action: "PAY_NOW", return_url: `${new URL(req.url).origin}/success.html`, cancel_url: `${new URL(req.url).origin}/?cancelled=1` } }) });
  const order = await orderRes.json();
  if (!orderRes.ok) return Response.json({ error: "PayPal could not create the order." }, { status: 502 });
  const approval = order.links?.find((x: any) => x.rel === "approve")?.href;
  if (!approval) return Response.json({ error: "PayPal did not return an approval link." }, { status: 502 });
  return Response.json({ id: order.id, approvalUrl: approval });
};