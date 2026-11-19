// Minimal app bindings. OpenNext supplies the rest of CloudflareEnv.
interface NihongoRateLimitBinding {
  limit(options: {key: string}): Promise<{success: boolean}>;
}
interface CloudflareEnv {
  NIHONGO_AUTH_SENSITIVE: NihongoRateLimitBinding;
  NIHONGO_AUTH_STANDARD: NihongoRateLimitBinding;
  NIHONGO_AUTH_STATUS: NihongoRateLimitBinding;
  NIHONGO_PROGRESS: NihongoRateLimitBinding;
}
