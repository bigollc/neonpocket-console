import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import neonProxyHandler from "./api/neon-proxy-handler";

function neonProxyDevServer(): Plugin {
  return {
    name: "neon-proxy-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/neon-proxy", async (req, res) => {
        try {
          if (req.method === "OPTIONS") {
            const response = await neonProxyHandler(new Request("http://localhost/api/neon-proxy", { method: "OPTIONS" }));
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end();
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) headers.append(key, item);
            } else if (value !== undefined) {
              headers.set(key, value);
            }
          }

          const request = new Request(`http://localhost${req.url ?? "/api/neon-proxy"}`, {
            method: req.method,
            headers,
            body: chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined,
          });
          const response = await neonProxyHandler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error: any) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error?.message || "Local Neon proxy failed" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), neonProxyDevServer(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
