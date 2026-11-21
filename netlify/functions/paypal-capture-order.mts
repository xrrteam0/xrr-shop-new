import { getDeployStore } from "@netlify/blobs";

// Same deploy-specific catalog as the other functions; isolated from production.
const store = getDeployStore("xrr-shop-catalog");
const defaultProducts = [
  { id: "starter-template", name: "Website Starter Kit", price: 9.90, active: true, deliveryUrl: "" },
  { id: "automation-pack", name: "Automation Pack", price: 14.90, active: true, deliveryUrl: "" },
  { id: "developer-toolkit", name: "Developer Toolkit", price: 19.90, active: true, deliveryUrl: "" }
];

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const clientId = Netlify.env.get("PAYPAL_CLIENT_ID");
  const secret = Netlify.env.get("PAYPAL_CLIENT_SECRET");
  const env = Netlify.env.get("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  if (!clientId || !secret) return Response.json({ error: "PayPal is not configured." }, { status: 503 });
  const { orderId } = await req.json();
  if (typeof orderId !== "string" || !/^[A-Z0-9]+$/i.test(orderId)) return Response.json({ error: "Invalid order." }, { status: 400 });
  const basic = btoa(`${clientId}:${secret}`);
  const tokenRes = await fetch(`${env}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return Response.json({ error: "PayPal authentication failed." }, { status: 502 });
  const captureRes = await fetch(`${env}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" } });
  const capture = await captureRes.json();
  if (!captureRes.ok || capture.status !== "COMPLETED") return Response.json({ error: "Payment is not confirmed as completed." }, { status: 402 });
  const productId = capture.purchase_units?.[0]?.reference_id;
  const products = (await store.get("products", { type: "json" }) as any[] | null) ?? defaultProducts;
  const product = (products ?? []).find(p => p.id === productId);
  if (!product) return Response.json({ error: "Payment completed, but the product could not be found. Contact XRR support." }, { status: 500 });
  if (!product.deliveryUrl) return Response.json({ paid: true, delivered: false, message: "Payment confirmed. Contact XRR to receive your product." });
  return Response.json({ paid: true, delivered: true, downloadUrl: product.deliveryUrl });
};