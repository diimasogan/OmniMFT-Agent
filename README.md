# OmniMFT Agent — AI Ops Copilot for Managed File Transfer

AI operations copilot that connects **Axway SecureTransport**, **Boomi AtomSphere** and an MCP server
so MFT operators can track transfers, guard certificate expiry, trigger/reprocess Boomi integrations
and onboard partners in natural language.

- 📄 Documentation (EN): https://diimasogan.github.io/OmniMFT-Agent/docs/OmniMFT-Ops-Copilot-Documentation.html
- 📄 Dokumentasi (ID): https://diimasogan.github.io/OmniMFT-Agent/docs/id/OmniMFT-Ops-Copilot-Dokumentasi.html
- 🖥️ Portal UI (static preview — live features need `portal/portal_server.py`): https://diimasogan.github.io/OmniMFT-Agent/portal/

## Structure
| Path | What |
|---|---|
| `server.py` | MCP server exposing the `omnimft` tools |
| `omnimft/` | SecureTransport & Boomi API clients |
| `bridge_worker.py`, `relay.py` | Boomi ↔ local bridge |
| `portal/` | Web portal (chat + ops UI) |
| `active-development/` | Boomi process & connector components (XML) |
| `agent/` | Agent Garden build script |
| `docs/` | Documentation, presentation & sources |

## Setup
Copy your credentials into a local `.env` (never committed), create a venv and install deps, then run `start-demo.sh`.
Some Boomi connector components that contain account-specific details are intentionally not published.
