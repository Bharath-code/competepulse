/// <reference types="astro/client" />

/**
 * Build-time environment. Only `PUBLIC_`-prefixed values are readable here, and
 * all of them are inlined into the static output — never put a secret in one.
 * See `.env.example` for what each value does.
 */
interface ImportMetaEnv {
  /** Canonical origin of the deployed site, e.g. `https://competepulse.com`. */
  readonly PUBLIC_SITE_URL?: string;
  /** Calendly event link, e.g. `https://calendly.com/<user>/15min`. */
  readonly PUBLIC_CALENDLY_URL?: string;
  /** Reply-to address used for the email fallback. */
  readonly PUBLIC_CONTACT_EMAIL?: string;
  /** Worker origin, when the dashboard should be linked from the footer. */
  readonly PUBLIC_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
