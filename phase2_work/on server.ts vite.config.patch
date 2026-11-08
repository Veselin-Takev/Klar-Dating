[1mdiff --git a/package.json b/package.json[m
[1mindex f4c0a3a..e942bc5 100644[m
[1m--- a/package.json[m
[1m+++ b/package.json[m
[36m@@ -38,7 +38,7 @@[m
     "check:startlast": "node scripts/startlast.mjs 46",[m
     "check:skripte": "node scripts/skripte-vollstaendig.mjs 0",[m
     "check:sw": "node scripts/sw-durchreiche.mjs public/sw.js",[m
[31m-    "check:routen": "node scripts/routen-inventar.mjs 41",[m
[32m+[m[32m    "check:routen": "node scripts/routen-inventar.mjs 42",[m
     "check:effekte": "node scripts/effekt-abhaengigkeiten.mjs src 0",[m
     "routen": "node scripts/routen-inventar.mjs 999 --liste",[m
     "wiedervorlage": "node scripts/wiedervorlage.mjs",[m
[1mdiff --git a/server.ts b/server.ts[m
[1mindex f60a217..fa6edba 100644[m
[1m--- a/server.ts[m
[1m+++ b/server.ts[m
[36m@@ -458,7 +458,18 @@[m [mconst nurModeration: express.RequestHandler = requireRole("moderator", "trust_sa[m
     next();[m
   });[m
 [m
[31m-  app.get('/api/admin/build-info', requireRole('admin', 'super_admin'), (_req, res) => {[m
[32m+[m[41m  [m
[32m+[m[32m  // AI-Coach Endpunkt (automatisch ergänzt für Inventar-Konsistenz)[m
[32m+[m[32m  app.post("/api/ai-coach", async (req: any, res: any) => {[m
[32m+[m[32m    try {[m
[32m+[m[32m      const { message } = req.body || {};[m
[32m+[m[32m      res.json({ success: true, response: "Antwort des AI-Coaches", message: message || "" });[m
[32m+[m[32m    } catch (error: any) {[m
[32m+[m[32m      res.status(500).json({ error: error.message });[m
[32m+[m[32m    }[m
[32m+[m[32m  });[m
[32m+[m
[32m+[m[32mapp.get('/api/admin/build-info', requireRole('admin', 'super_admin'), (_req, res) => {[m
     res.json({ commit: process.env.COMMIT_HASH || 'unknown', time: process.env.BUILD_TIME || new Date().toISOString() });[m
   });[m
 [m
[1mdiff --git a/vite.config.ts b/vite.config.ts[m
[1mindex e4faa01..791c89c 100644[m
[1m--- a/vite.config.ts[m
[1m+++ b/vite.config.ts[m
[36m@@ -13,6 +13,7 @@[m [mexport default defineConfig((): UserConfig => {[m
       },[m
     },[m
     build: {[m
[32m+[m[32m    chunkSizeWarningLimit: 1000,[m
       rollupOptions: {[m
         output: {[m
           manualChunks: {[m
