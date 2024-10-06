import crypto from "crypto";
import { bech32 } from "bech32";
import { base58Decode } from "../utils";

class Litecoin {
    // https://www.julianhaight.com/javascript.shtml
    static isAddress(address: string) {
        if (address.startsWith("L") || address.startsWith("M")) { // p2pkh, p2sh
            const decoded = base58Decode(address);
            if (decoded.length !== 25) return false;

            const checksum = decoded.subarray(decoded.length - 4);
            const data = decoded.subarray(0, decoded.length - 4);

            const first = crypto.createHash("sha256").update(data).digest();
            const second = crypto.createHash("sha256").update(first).digest();

            const hash = second.subarray(0, 4);
            return checksum.equals(hash);
        } else if (address.startsWith("ltc1")) { // bech32
            const decoded = bech32.decodeUnsafe(address);
            if (!decoded) return false; // Invalid address
            return decoded.prefix === "ltc"; // Not a Litecoin address
        }
        return false;
    }
}

export default Litecoin;