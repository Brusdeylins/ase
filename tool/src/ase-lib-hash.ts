/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { createHash }        from "node:crypto"

/*  the alphabet and length of the NanoId-style hashes  */
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const NANOID = 10

/*  derive the short NanoId-style hash of a hint: the SHA-1 digest of
    the hint, base62-encoded and truncated to its lowest digits  */
export const nanoid = (hint: string): string => {
    let n  = BigInt(`0x${createHash("sha1").update(hint).digest("hex")}`)
    let id = ""
    for (let i = 0; i < NANOID; i++) {
        id += BASE62[Number(n % 62n)]
        n  /= 62n
    }
    return id
}

