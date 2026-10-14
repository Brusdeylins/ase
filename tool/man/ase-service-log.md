# ase-service-log(1) -- Show the Log of the Background Service

## SYNOPSIS

`ase service log`
\[`-h`|`--help`\]
\[`-f`|`--follow`\]
\[`-n`|`--lines` *n*\]

## DESCRIPTION

**ase service log** shows the log file `.ase/service.log` of the
per-project background service of *ASE* (see `ase-service`(1)) on
standard output: by default the entire file, else its last lines
only. If no log file exists, nothing is shown and the command exits
with status `0`.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-f`|`--follow`\]:
  After showing the last *n* lines (default: `10`), keep following the
  file in the style of `tail -f` and show all newly appended lines,
  until interrupted (e.g., via `CTRL+C`), even once the service has
  stopped. When the log is trimmed on a service start, following
  continues at the new end of the file.

- \[`-n`|`--lines` *n*\]:
  Show the last *n* non-empty lines only, where *n* has to be a
  positive integer (default: all lines, or `10` with `--follow`).

## FILES

- `.ase/service.log`:
  The log of the detached service.

## EXIT STATUS

`0` on success, `1` on an invalid *n* or an unreadable log file.

## EXAMPLES

```sh
# show the last 50 log lines
$ ase service log -n 50

# follow the log
$ ase service log -f
```

## SEE ALSO

`ase`(1), `ase-service`(1), `ase-service-start`(1), `tail`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
