import crypto from "crypto";
import { base58Decode } from "../utils";

class Tronix {
    // https://www.julianhaight.com/javascript.shtml
    static isAddress(address: string) {
        if (address.startsWith("T")) {
            const decoded = base58Decode(address);
            if (decoded.length !== 25) return false;

            const checksum = decoded.subarray(decoded.length - 4);
            const data = decoded.subarray(0, decoded.length - 4);

            const first = crypto.createHash("sha256").update(data).digest();
            const second = crypto.createHash("sha256").update(first).digest();

            const hash = second.subarray(0, 4);
            return checksum.equals(hash);
        }
        return false;
    }
}

export default Tronix;