/**
 * Ensure vexp-cli is available on the system.
 * Auto-installs from npm if not found.
 */
export declare function ensureVexp(): Promise<void>;
/**
 * Ensure the user has a vexp Pro or Team license.
 * If not, shows a promo offer and prompts for a license key.
 */
export declare function ensureVexpLicense(): Promise<void>;
