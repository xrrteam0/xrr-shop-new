import { getDeployStore } from "@netlify/blobs";

// Isolated per-deploy catalog: sandbox previews cannot overwrite the main catalog.
const store = getDeployStore("xrr-shop-catalog");
const defaults = [
  { id: "starter-template", name: "Website Starter Kit", category: "Templates", price: 9.90, currency: "EUR", description: "A clean, responsive website starter for your next project.", deliveryUrl: "", featured: true, active: true },
  { id: "automation-pack", name: "Automation Pack", category: "Automation", price: 14.90, currency: "EUR", description: "Original workflow examples and productivity automations.", deliveryUrl: "", featured: true, active: true },
  { id: "developer-toolkit", name: "Developer Toolkit", category: "Developer Tools", price: 19.90, currency: "EUR", description: "Developer resources, snippets and project utilities.", deliveryUrl: "", featured: false, active: true }
];

export default async (req: Request) => {
  if (req.method === "GET") {
    const saved = await store.get("products", { type: "json" }) as typeof defaults | null;
    return Response.json(saved ?? defaults);
  }
  if (req.method === "PUT") {
    const password = Netlify.env.get("ADMIN_PASSWORD");
    const auth = req.headers.get("authorization") || "";
    if (!password || auth !== `Bearer ${password}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const products = await req.json();
    if (!Array.isArray(products) || products.length > 250) return Response.json({ error: "Invalid catalog" }, { status: 400 });
    for (const p of products) {
      if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !Number.isFinite(Number(p.price)) || Number(p.price) <= 0) return Response.json({ error: "Invalid product data" }, { status: 400 });
    }
    await store.setJSON("products", products);
    return Response.json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, PUT" } });
};