# ase-service-status(1) -- Report Whether the Background Service Is Running

## SYNOPSIS

`ase service status`
\[`-h`|`--help`\]

## DESCRIPTION

**ase service status** reports whether the per-project background
service of *ASE* (see `ase-service`(1)) is running. It probes the port
persisted in `.ase/service.yaml` via an HTTP `OPTIONS /` request and
verifies that the responding service belongs to the current project
(by its project id). It prints one of the following lines on standard
output:

- `service: running on port` *port* `(uptime:` *duration*`)`:
  A service of this project is running.

- `service: not running (no port configured)`:
  No port is persisted in `.ase/service.yaml`.

- `service: not running (port` *port* `not responding)`:
  Nothing listens on the persisted port.

- `service: not running (port` *port* `in use by foreign service)`:
  The persisted port is answered by something else, e.g., the service
  of another project.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## FILES

- `.ase/service.yaml`:
  The persisted port of the service.

## EXIT STATUS

`0` if the service of the project is running, else `1`.

## EXAMPLES

```sh
$ ase service status
service: running on port 42817 (uptime: 12 minutes 3.4 seconds)
```

## SEE ALSO

`ase`(1), `ase-service`(1), `ase-service-start`(1),
`ase-service-stop`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
