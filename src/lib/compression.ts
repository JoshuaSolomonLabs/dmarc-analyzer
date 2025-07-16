import { createGunzip } from "zlib";
import { Readable } from "node:stream";

export async function decompressGzip(buffer: Buffer): Promise<string> {
    const chunks: Buffer[] = [];
    const readable = Readable.from(buffer);
    const gunzip = createGunzip();

    return new Promise((resolve, reject) => {
        readable
            .pipe(gunzip)
            .on("data", (chunk) => chunks.push(chunk))
            .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
            .on("error", reject);
    });
}
