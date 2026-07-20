# Mac mini Home Assistant and Orbit setup

This runbook prepares a dedicated Apple-silicon Mac mini to run Home Assistant
OS in a virtual machine and to serve as an Orbit development workstation. The
bootstrap is staged, reviewable, and safe to rerun. It does not collect account
credentials, weaken Codex approvals, expose Orbit to the LAN, or substitute a
container when Home Assistant OS cannot be installed.

## Target configuration

- Apple-silicon Mac mini with macOS 14 or newer, at least 8 GB RAM, and at
  least 40 GB free disk
- Wi-Fi networking for the host and a bridged Home Assistant VM
- Home Assistant OS with 2 vCPUs and 2-4 GB RAM
- Home Assistant reachable on the home LAN
- Orbit bound only to `127.0.0.1` and reached locally or through SSH
- Node.js 24, Codex CLI, Git, and the locked Orbit dependencies
- Native encrypted Home Assistant backups copied to Google Drive

Home Assistant OS is the selected installation because it includes the managed
update, app, and backup experience. Home Assistant documents VirtualBox on
Apple silicon and UTM only as a fallback when VirtualBox is unsupported:

- [Home Assistant installation types](https://www.home-assistant.io/installation/)
- [Home Assistant on macOS](https://www.home-assistant.io/installation/macos)

## Before starting

1. Connect the Mac to power and install all available macOS updates.
2. Sign in with the account that will own the VirtualBox VM and Orbit checkout.
   It must be an administrator, but do not run the bootstrap itself as `root`.
3. Confirm that the Mac has a stable Wi-Fi connection. The VM will receive a
   separate DHCP address from the router.
4. Have another trusted device ready for the Home Assistant backup emergency
   kit. Do not store the only copy inside the VM or only in the same Google
   Drive account as the backups.
5. Keep the Mac attached to a display and keyboard for the first pass. Later
   administration can use Screen Sharing or SSH.

## Obtain and inspect the bootstrap

If Git and the Orbit checkout already exist, run the repository copy directly:

```bash
cd ~/src/Orbit
less scripts/bootstrap-macos.sh
/bin/bash scripts/bootstrap-macos.sh --dry-run
```

On a fresh Mac, download the script without piping it directly into a shell:

```bash
curl --fail --location --show-error \
  https://raw.githubusercontent.com/choover-prog/Orbit/main/scripts/bootstrap-macos.sh \
  --output /tmp/orbit-bootstrap-macos.sh
less /tmp/orbit-bootstrap-macos.sh
/bin/bash /tmp/orbit-bootstrap-macos.sh --dry-run
```

After reviewing the dry run, start the staged setup:

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase all
```

The script records only completed phase names under
`~/.local/state/orbit-bootstrap` and writes operational logs under
`~/Library/Logs/Orbit`. Logs contain commands and health results, not OAuth
codes, API keys, Home Assistant records, or smart-home data.

## Stages and checkpoints

### 1. Preflight

The preflight checks architecture, macOS version, RAM, disk space, Apple
virtualization support, the Wi-Fi interface, administrator membership, and
access to the official GitHub and Codex endpoints. It stops before making a
partial installation if any hard requirement is missing.

Run it independently with:

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase preflight
```

### 2. Tooling and Codex

The tooling phase installs or validates:

- Apple Command Line Tools
- Homebrew in `/opt/homebrew`
- Git, `jq`, and Homebrew's `node@24`
- Oracle VirtualBox
- the official Codex standalone CLI

The script downloads the Homebrew and Codex installers to a temporary file,
prints each SHA-256 value for the local audit log, and asks before execution.
Codex sign-in remains an interactive browser operation. Use ChatGPT sign-in
unless a deliberate usage-based API-key workflow is required; never paste an
API key into the bootstrap.

The script adds one marked block to `~/.zprofile` so Homebrew, Node 24, and the
standalone Codex command are available in future shells. Existing shell content
is preserved.

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase tooling
codex --version
codex login status
```

Codex should retain its normal sandbox and approval behavior. The repository's
`AGENTS.md` supplies Orbit-specific working agreements; do not configure Codex
as Orbit's product runtime.

### 3. Home Assistant OS

The HAOS phase queries the latest release from
[`home-assistant/operating-system`](https://github.com/home-assistant/operating-system),
selects exactly one `generic-aarch64` VDI asset, and verifies the GitHub release
asset's SHA-256 digest. A specific release can be requested for troubleshooting:

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase haos --haos-version 18.1
```

The generated VM is named `Home Assistant` and uses:

- EFI firmware
- 2 vCPUs
- 4 GB RAM on a host with at least 16 GB, otherwise 2 GB
- the release-provided dynamically sized VDI
- a bridged adapter attached to the detected macOS Wi-Fi interface
- non-rotational and discard hints for the virtual SSD

Open `http://homeassistant.local:8123` after boot. If mDNS does not resolve,
find the `Home Assistant` client in the router and open its DHCP address on port
8123. Create the first Home Assistant owner account in the browser; do not put
the password in a shell command, Codex prompt, repository file, or bootstrap
log.

Wi-Fi bridging is supported by the documented VirtualBox flow, but discovery
must be tested with real devices. If VirtualBox cannot provide the ARM64 guest
type or stable bridged networking, stop and follow the official macOS guide's
UTM fallback. Continue using the verified ARM64 HAOS image. Do not silently
switch to Home Assistant Container.

When the router supports it, reserve the VM's DHCP address by its virtual MAC
address. A reservation is preferred to configuring a static address inside the
guest.

### 4. Orbit workstation

The Orbit phase clones the public repository into `~/src/Orbit` unless
`--repo-dir` specifies another absolute path. If the path already contains a
Git checkout, the script preserves it and performs no pull, reset, checkout,
clean, or stash operation.

It then runs:

```bash
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
```

Orbit remains in fixture mode on macOS. The current live Calendar, Gmail, and
Google Nest credential stores require Windows DPAPI and intentionally fail
closed on other platforms. Do not replace them with plaintext files or copy
credentials from another workstation.

Start Orbit on demand:

```bash
cd ~/src/Orbit
npm run dev
```

From another computer, create an SSH tunnel and then open
`http://127.0.0.1:3000` on that computer:

```bash
ssh -L 3000:127.0.0.1:3000 <mac-user>@<mac-mini-address>
```

Orbit deliberately rejects direct LAN hosts. Do not change its bind address or
place it behind a LAN proxy until a separately reviewed authentication and
remote-access design exists.

### 5. Dedicated-host settings

After one successful manual Home Assistant boot, the host phase can:

- prevent system sleep;
- enable restart after a power failure;
- enable Remote Login for SSH;
- enable the macOS application firewall if it is off; and
- install a root-owned launchd job that starts the VM as its owning user.

Every system change requires confirmation. Automatic login remains disabled.
The launchd helper retries VM startup for five minutes so Wi-Fi has time to
associate after boot.

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase host
```

Before a planned Mac shutdown, request a clean HAOS shutdown and wait for the VM
to stop:

```bash
VBoxManage controlvm "Home Assistant" acpipowerbutton
VBoxManage list runningvms
```

After host setup, reboot the Mac without logging in. Confirm that Home Assistant
returns on the reserved address. If it does not, inspect:

```bash
sudo launchctl print system/com.orbit.home-assistant-vm
tail -n 100 ~/Library/Logs/Orbit/home-assistant-vm.error.log
VBoxManage showvminfo "Home Assistant"
```

## Home Assistant onboarding

### Backups and Google Drive

Use Home Assistant's native
[Google Drive integration](https://www.home-assistant.io/integrations/google_drive/),
not the older community Google Drive Backup add-on.

1. In Home Assistant, add **Google Drive** under **Settings > Devices &
   services** and follow the current official credential instructions.
2. Open **Settings > System > Backups** and configure automatic backups.
3. Select daily backups and retain seven copies locally and in Google Drive.
4. Leave backup encryption enabled for Google Drive.
5. Initially exclude media and the shared folder to keep recovery files small;
   include them later only when their content is understood and required.
6. Download the backup emergency kit to a different trusted device. Home
   Assistant cannot recover an encrypted backup if its matching key is lost.
7. Create one manual backup and verify that it appears both locally and in the
   Home Assistant folder in Google Drive.
8. Record a restore drill, but do not destructively restore the new instance
   merely to test it.

See the official [backup emergency kit](https://www.home-assistant.io/more-info/backup-emergency-kit/)
and [backup procedures](https://www.home-assistant.io/common-tasks/general/).

### Google and Nest devices

Home Assistant cannot import every device merely because it appears in Google
Home. First allow normal LAN discovery, then add each supported built-in vendor
integration deliberately.

For supported Nest thermostats, cameras, doorbells, and sensors, use the
built-in [Nest integration](https://www.home-assistant.io/integrations/nest/).
Before paying Google's current Device Access registration fee, confirm that the
specific devices and Google account type are supported. Use a consumer Google
account; Workspace and Advanced Protection accounts have documented
limitations. Start by inventorying and observing entities. Do not create
consequential automations during initial onboarding.

## Repository adoption decisions

The following decisions were reviewed on July 20, 2026. Recheck release and
security status before adopting a deferred project.

| Repository | Decision | Reason |
| --- | --- | --- |
| `home-assistant/operating-system` | Use as the HAOS image source | Official, managed installation selected for this Mac |
| `home-assistant/core` | Reference through the installed HAOS release | Built-in integrations should remain Supervisor-managed, not cloned from source |
| `home-assistant/addons` | Use through the built-in app store | The official repository is already supplied by HAOS |
| `sabeechen/hassio-google-drive-backup` | Do not install by default | The native Google Drive backup location now meets this setup's requirement |
| `hacs/integration` | Defer | Adds third-party code and update trust; install only for a demonstrated integration gap |
| `esphome/esphome` | Defer | No ESPHome devices are in the initial inventory |
| `music-assistant/server` | Defer | Media orchestration is outside the initial reliable-home baseline |
| OpenCode / Big Pickle | Do not install | Big Pickle is a hosted coding model, not a Home Assistant automation repository |

Matter, Thread, Zigbee, Z-Wave, ESPHome, HACS, and community app repositories
require a new device-driven review. Do not install broad catalogs preemptively.

## Verification and recovery

Run the final read-only verification phase:

```bash
/bin/bash /tmp/orbit-bootstrap-macos.sh --phase verify
```

Completion requires:

- Codex is installed and signed in.
- Node reports major version 24.
- Orbit's check and E2E suites passed during the Orbit phase.
- The VM is registered, running, and reachable through mDNS or its DHCP address.
- Home Assistant returns after a Mac reboot without an interactive login.
- SSH tunneling reaches Orbit while direct LAN access remains unavailable.
- One encrypted backup exists locally and in Google Drive.
- The matching emergency kit is stored outside Home Assistant.

The bootstrap never deletes a VM, VDI, repository checkout, backup, credential,
or launchd definition. Removal is a separate destructive operation and should
begin with a verified Home Assistant backup and exact-path inspection.
