# P0 #254 – Tenant-Hostname muss zu konfigurierter Ingress-Domain gehören

**Stand:** 31.10.2026 · **Basis:** [Draft PR #265](https://github.com/Veselin-Takev/Klar-Dating/pull/265), SHA `50f2fddb447b08770c4b0a608c3a6adda32a0c2d` · **Governance:** BLOCKED / NO-GO.

## Nachweisbarer Befund

`src/server/multitenant/tenantAuth.ts:subdomainHint()` nimmt einen optionalen, serverseitig konfigurierten Parameter `trustedBaseDomain`. Vor dieser Korrektur ergab ein angefragter Hostname **außerhalb** des Basisdomain-Suffixes `null` („kein Tenant-Hint“). Ein gültiger Firebase-JWT mit korrekt zugelassenem Tenant-Claim sowie ein passender `X-Tenant-ID`-Header konnten deshalb die Tenant-Authentifizierung **auch auf einer fremden oder falsch konfigurierten Host-Domain** bestehen. Dies ist eine Host-/Ingress-Bindungslücke, **keine nachgewiesene JWT-Fälschung oder Rechteausweitung**. Sie kann die erwartete Tenant-Routing-Policy unter Proxy-/Host-Verwechslungen unterlaufen.

## Isolierter Fail-Closed-Fix

- Wenn `trustedBaseDomain` konfiguriert ist, sind nur der genaue, gemeinsam genutzte Apex-Host (z. B. `klar.example`) oder ein gültiger einfacher Tenant-Subdomain-Host (`tenant-one.klar.example`) zulässig. Für Subdomains wird der signierte Tenant-Claim wie bisher strikt mit dem Routenhinweis abgeglichen.
- Hostnamen außerhalb dieser Domain führen ab sofort zu `TenantAccessDenied(403)`, **vor** jedem Tenant-/Membership-Firestore-Lesezugriff. Explizit nicht zugelassen sind fremde Hosts, angehängte fremde Suffixe, Host-Pfade mit Port, abschließendem Punkt oder leere Hosts. Der gegebene HTTP-Host wird im Validator nur auf Kleinbuchstaben normalisiert; sonstige externe Proxy-Normalisierung ist bewusst nicht stillschweigend erlaubt.
- Wenn `trustedBaseDomain` **nicht** konfiguriert ist, bleibt die bisherige reine JWT-/Header-basierte Prüfung unverändert; das ist ausdrücklich **kein Nachweis einer gebundenen Ingress-Domain**. Für spätere produktive Tenant-Routen muss die Basisdomain verpflichtend und von vertrauenswürdigen Serverkonfigurationsquellen gesetzt werden.
- Zwei neue Tests prüfen sowohl die reine `authorizeTenant()`-Schicht als auch die echte Express-Middleware: Zahlreiche fremde Hostwerte müssen 403 ergeben, keinen Tenant-Kontext ausstellen und **keine** Mitgliedschaftsdatenbankabfrage auslösen; Apex-Hosts bleiben explizit erlaubt.

## Operative / Compliance-Grenzen

Express `req.hostname` kann von der Proxy-Konfiguration und ggf. untrusted `X-Forwarded-Host`-Headern abhängen. Diese Korrektur ersetzt **nicht** eine freigegebene Ingress-Host-Allowlist, `trust proxy`-Härtung, TLS-/Origin-/Cookie-Policy und Staging-Tests hinter dem tatsächlich eingesetzten Load Balancer. Ein Domain-Lookalike wird abgewiesen, aber aktive Reverse-Proxy-Einbindungen sind nicht nachgewiesen. Die Tenant-Foundation wird bisher nicht nachweislich von sämtlichen Legacy-Routen verwendet.

Weiterhin ausstehend: verifizierte Firestore-/Storage-Rules und Admin-SDK-Policies, Tenant-Isolation von Chat/KYC/Payments, DSGVO Art. 17 sowie externe Security-Gates (Issue #8), unabhängig attestierte CI und AppSec-/Datenschutz-/SRE-/Release-Freigaben. **Kein Merge, keine Produktion, kein Deployment; Production BLOCKED / NO-GO.**
