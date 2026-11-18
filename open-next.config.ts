import {defineCloudflareConfig} from '@opennextjs/cloudflare';

// Account data is dynamic and must never enter a shared page cache.
// No R2, D1, KV, image service or paid storage is provisioned for this MVP.
export default defineCloudflareConfig();
