/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import updateNotifier from "update-notifier"
import semver         from "semver"

import pkg            from "../package.json" with { type: "json" }

/*  determination of current and available ASE versions  */
export default class Version {
    /*  return current ASE version  */
    static current (): string {
        return pkg.version
    }

    /*  return latest ASE version known from the NPM registry
        (cached background check or, if requested, immediate direct check,
        both falling back to the current version)  */
    static async latest (direct = false): Promise<string> {
        const notifier = updateNotifier({
            pkg,
            updateCheckInterval: 1000 * 60 * 60
        })

        /*  optionally query the NPM registry directly, where only
            a successful query supersedes the cached update information  */
        let update = notifier.update
        if (direct) {
            const info = await Promise.resolve(notifier.fetchInfo()).catch(() => undefined)
            if (info !== undefined)
                update = info
        }

        /*  re-persist the update information, as update-notifier consumes it on read,
            but only while it still denotes a newer version (it is never cleared otherwise)  */
        const latest = update?.latest
        if (latest === undefined || !semver.valid(latest) || !semver.gt(latest, Version.current()))
            return Version.current()
        notifier.config?.set("update", update)
        return latest
    }
}
