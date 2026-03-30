import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_PATHS = [
  /^\/repos\/[^/]+\/[^/]+\/releases$/,
  /^\/repos\/[^/]+\/[^/]+$/,
  /^\/repos\/[^/]+\/[^/]+\/contributors$/,
  /^\/repos\/[^/]+\/[^/]+\/commits$/,
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const path = req.query.path as string | undefined;
  if (!path) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  const decodedPath = decodeURIComponent(path);
  if (!ALLOWED_PATHS.some((pattern) => pattern.test(decodedPath))) {
    return res.status(403).json({ error: "Path not allowed" });
  }

  const queryString = req.query.qs as string | undefined;
  const url = `https://api.github.com${decodedPath}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Flick-Web",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const upstream = await fetch(url, { headers });
    const body = await upstream.text();

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=60",
    );
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: "Failed to reach GitHub API" });
  }
}
