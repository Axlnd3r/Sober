import { isIP } from "node:net";
import { z } from "zod";

export const publicHttpsUrl = z.url().refine(value => {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return url.protocol === "https:" && !url.username && !url.password && host !== "localhost"
    && !host.endsWith(".localhost") && !host.endsWith(".local") && !isIP(host);
}, "Use a public HTTPS URL");
