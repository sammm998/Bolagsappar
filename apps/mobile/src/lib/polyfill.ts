// Motorerna räknar kontrollsummor med crypto.subtle (avtal och filer). Hermes saknar det, expo-crypto fyller i.
import * as Crypto from 'expo-crypto';

const g = globalThis as any;
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = (a: any) => Crypto.getRandomValues(a);
if (!g.crypto.randomUUID) g.crypto.randomUUID = () => Crypto.randomUUID();
if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest: async (alg: string, data: ArrayBuffer | Uint8Array) => {
      const name = String(alg).toUpperCase().replace('-', '') === 'SHA256' ? Crypto.CryptoDigestAlgorithm.SHA256 : Crypto.CryptoDigestAlgorithm.SHA1;
      return Crypto.digest(name, (data instanceof Uint8Array ? data : new Uint8Array(data)) as any);
    }
  };
}
if (!g.structuredClone) g.structuredClone = (x: any) => JSON.parse(JSON.stringify(x));
