import { PublicKey } from "@solana/web3.js";

class Solana {
    static isAddress(address: string) {
        try {
            return PublicKey.isOnCurve(address);
        } catch {
            return false;
        }
    }
}

export default Solana;