import type { IFoo } from "./IFoo.js"

/** A foo implementation. */
export class Foo implements IFoo {
    /** Compute the bar. */
    bar(): number { return 42 }
}
