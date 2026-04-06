##
##  Agentic Software Engineering (ASE)
##  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
##

CLAUDE = ~/.local/bin/claude

all: update

install:
	$(CLAUDE) plugin marketplace add ./
	$(CLAUDE) plugin install ase@ase

update:
	$(CLAUDE) plugin update ase@ase

reinstall:
	$(CLAUDE) plugin uninstall ase@ase
	$(CLAUDE) plugin install ase@ase

uninstall:
	$(CLAUDE) plugin uninstall ase@ase
	$(CLAUDE) plugin marketplace remove ase

