import { loadProxySigner } from "../../worker/internalAuth";

/** Test-only key: bytes 0..31 (not a real secret). */
export const TEST_PROXY_KEY_B64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
export const TEST_PROXY_KEYS = JSON.stringify({ k1: TEST_PROXY_KEY_B64 });
export const testSigner = () => loadProxySigner(TEST_PROXY_KEYS, "k1");
