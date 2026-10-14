# ase-service-send(1) -- Send a Command to the Background Service

## SYNOPSIS

`ase service send`
\[`-h`|`--help`\]
*cmd*

## DESCRIPTION

**ase service send** dispatches the command token *cmd* to the
per-project background service of *ASE* (see `ase-service`(1)) via an
HTTP `POST /command` request with the JSON body `{ "command":` *cmd*
`}`, and prints the raw response body (a JSON object) on standard
output. If the service is not running, it is auto-started first (like
`ase service start`).

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *cmd*:
  The command token to dispatch. The service currently understands:

    - `ping`:
      Answer with `{"ok":true,"pong":true}`.
    - `status`:
      Answer with the service identity, i.e., `ok`, the project id
      `projectId`, the `port`, and the uptime `uptimeMs` in
      milliseconds.

  Any other token is answered with an `unknown command` error (HTTP
  status `400`).

## EXIT STATUS

`0` if the service answered with a success status, `1` if it answered
with an error status (e.g., for an unknown *cmd*), or if it could not
be started or reached.

## EXAMPLES

```sh
$ ase service send ping
{"ok":true,"pong":true}

$ ase service send status
{"ok":true,"projectId":"ase","port":42817,"uptimeMs":723456}
```

## SEE ALSO

`ase`(1), `ase-service`(1), `ase-service-status`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
