/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { getDefaultResttyRuntimeSession } from "restty/internal/runtime"

/*  the terminal emulator of the task terminal (loaded lazily as a chunk of its own, as it is big), and the
    initialization of its WebAssembly module in the session shared by all its terminals  */
export { Restty, getBuiltinTheme } from "restty"
export const warm = (): Promise<unknown> =>
    getDefaultResttyRuntimeSession().getWasm()
