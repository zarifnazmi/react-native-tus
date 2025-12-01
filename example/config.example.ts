/**
 * Example Configuration File
 *
 * Copy this file to `config.ts` and update with your own values
 * for local development.
 *
 * The config.ts file is gitignored to keep your development
 * server details private.
 */

export const config = {
  /**
   * Your TUS server endpoint
   * For production/demo, use: 'https://tusd.tusdemo.net/files/'
   * For local development, use your own server URL
   */
  tusEndpoint: 'https://tusd.tusdemo.net/files/',

  /**
   * Additional server IPs for iOS App Transport Security (if using HTTP)
   * Leave empty array if using HTTPS only
   */
  httpExceptionDomains: [] as string[],
};
