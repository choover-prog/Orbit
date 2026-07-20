#!/bin/bash

# Bootstrap an Apple-silicon Mac mini for Home Assistant OS and Orbit.
#
# This script is intentionally staged and interactive. It never accepts OAuth
# credentials or API keys, never exposes Orbit to the LAN, and never switches
# from Home Assistant OS to a container installation as a fallback.

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_VERSION="1.0.0"
readonly DEFAULT_REPOSITORY_URL="https://github.com/choover-prog/Orbit.git"
readonly DEFAULT_REPOSITORY_DIR="${HOME}/src/Orbit"
readonly HAOS_REPOSITORY="home-assistant/operating-system"
readonly HAOS_API_ROOT="https://api.github.com/repos/${HAOS_REPOSITORY}/releases"
readonly VM_NAME="Home Assistant"
readonly LAUNCHD_LABEL="com.orbit.home-assistant-vm"

PHASE="all"
DRY_RUN=0
REPOSITORY_DIR="${DEFAULT_REPOSITORY_DIR}"
HAOS_VERSION="latest"
STATE_DIR="${XDG_STATE_HOME:-${HOME}/.local/state}/orbit-bootstrap"
LOG_DIR="${HOME}/Library/Logs/Orbit"
DOWNLOAD_DIR="${HOME}/Library/Caches/Orbit/bootstrap"
LOG_FILE=""
STATE_FILE=""
TEMP_DIR=""
WIFI_INTERFACE=""
BREW_BIN=""
VBOXMANAGE_BIN=""
CURRENT_USER=""

usage() {
  cat <<'EOF'
Usage: bootstrap-macos.sh [options]

Prepare a dedicated Apple-silicon Mac mini for Home Assistant OS and Orbit.

Options:
  --phase <name>          all, preflight, tooling, haos, orbit, host, or verify
  --repo-dir <path>       Orbit checkout path (default: ~/src/Orbit)
  --haos-version <value>  Home Assistant OS release tag (default: latest)
  --dry-run               Print mutating commands without running them
  --help                  Show this help
  --version               Show the script version

The script can be rerun safely. Interactive account creation, OAuth consent,
Codex login, router configuration, and backup recovery-key storage remain
manual checkpoints by design.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

timestamp() {
  date '+%Y-%m-%dT%H:%M:%S%z'
}

log() {
  local message
  message="[$(timestamp)] $*"
  printf '%s\n' "${message}"
  if [[ -n "${LOG_FILE}" ]]; then
    printf '%s\n' "${message}" >>"${LOG_FILE}"
  fi
}

quote_command() {
  local quoted=()
  local argument
  for argument in "$@"; do
    printf -v argument '%q' "${argument}"
    quoted+=("${argument}")
  done
  printf '%s' "${quoted[*]}"
}

run() {
  if ((DRY_RUN)); then
    printf '[dry-run] '
    quote_command "$@"
    printf '\n'
    return 0
  fi

  log "Running: $(quote_command "$@")"
  "$@"
}

confirm() {
  local prompt="$1"
  local answer

  if ((DRY_RUN)); then
    log "Dry run: would ask: ${prompt}"
    return 0
  fi

  [[ -t 0 ]] || die "Interactive confirmation required: ${prompt}"
  read -r -p "${prompt} [y/N] " answer
  [[ "${answer}" =~ ^[Yy]$ ]]
}

pause_for_user() {
  local message="$1"
  if ((DRY_RUN)); then
    log "Dry run: would pause: ${message}"
    return 0
  fi
  [[ -t 0 ]] || die "Interactive checkpoint required: ${message}"
  printf '\n%s\n' "${message}"
  read -r -p "Press Return to continue. "
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

mark_state() {
  local key="$1"
  ((DRY_RUN)) && return 0
  if ! grep -qxF "${key}=complete" "${STATE_FILE}" 2>/dev/null; then
    printf '%s=complete\n' "${key}" >>"${STATE_FILE}"
  fi
}

has_state() {
  local key="$1"
  [[ -f "${STATE_FILE}" ]] && grep -qxF "${key}=complete" "${STATE_FILE}"
}

cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf -- "${TEMP_DIR}"
  fi
}

on_error() {
  local exit_code=$?
  local line_number="${1:-unknown}"
  log "Failed at line ${line_number} with exit code ${exit_code}. Rerun the same phase after correcting the reported problem."
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'on_error ${LINENO}' ERR

while (($#)); do
  case "$1" in
    --phase)
      (($# >= 2)) || die "--phase requires a value"
      PHASE="$2"
      shift 2
      ;;
    --repo-dir)
      (($# >= 2)) || die "--repo-dir requires a value"
      REPOSITORY_DIR="$2"
      shift 2
      ;;
    --haos-version)
      (($# >= 2)) || die "--haos-version requires a value"
      HAOS_VERSION="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --version)
      printf '%s\n' "${SCRIPT_VERSION}"
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

case "${PHASE}" in
  all|preflight|tooling|haos|orbit|host|verify) ;;
  *) die "Unsupported phase: ${PHASE}" ;;
esac

[[ "${REPOSITORY_DIR}" = /* ]] || die "--repo-dir must be an absolute path"
[[ "${HAOS_VERSION}" =~ ^(latest|[0-9]+([.][0-9]+)*)$ ]] || die "Invalid --haos-version value"

if ((!DRY_RUN)); then
  mkdir -p -- "${STATE_DIR}" "${LOG_DIR}" "${DOWNLOAD_DIR}"
  chmod 700 "${STATE_DIR}" "${LOG_DIR}" "${DOWNLOAD_DIR}"
  LOG_FILE="${LOG_DIR}/bootstrap-$(date '+%Y%m%d-%H%M%S').log"
  STATE_FILE="${STATE_DIR}/state"
  : >"${LOG_FILE}"
  chmod 600 "${LOG_FILE}"
  touch "${STATE_FILE}"
  chmod 600 "${STATE_FILE}"
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/orbit-bootstrap.XXXXXX")"

detect_brew() {
  if [[ -x /opt/homebrew/bin/brew ]]; then
    BREW_BIN="/opt/homebrew/bin/brew"
  elif command -v brew >/dev/null 2>&1; then
    BREW_BIN="$(command -v brew)"
  else
    BREW_BIN=""
  fi
}

detect_virtualbox() {
  if command -v VBoxManage >/dev/null 2>&1; then
    VBOXMANAGE_BIN="$(command -v VBoxManage)"
  elif [[ -x /usr/local/bin/VBoxManage ]]; then
    VBOXMANAGE_BIN="/usr/local/bin/VBoxManage"
  elif [[ -x /Applications/VirtualBox.app/Contents/MacOS/VBoxManage ]]; then
    VBOXMANAGE_BIN="/Applications/VirtualBox.app/Contents/MacOS/VBoxManage"
  else
    VBOXMANAGE_BIN=""
  fi
}

detect_wifi_interface() {
  if command -v networksetup >/dev/null 2>&1; then
    WIFI_INTERFACE="$(networksetup -listallhardwareports 2>/dev/null | awk '
      /^Hardware Port: (Wi-Fi|AirPort)$/ {
        getline
        sub(/^Device: /, "")
        print
        exit
      }
    ')"
  fi
}

version_major() {
  printf '%s' "${1%%.*}"
}

phase_preflight() {
  log "Starting preflight checks"

  [[ "$(uname -s)" == "Darwin" ]] || die "This bootstrap runs only on macOS"
  [[ "$(uname -m)" == "arm64" ]] || die "This approved bootstrap requires Apple silicon (arm64)"

  CURRENT_USER="$(id -un)"
  [[ "${CURRENT_USER}" != "root" ]] || die "Run as the intended Mac user, not root"
  id -Gn "${CURRENT_USER}" | tr ' ' '\n' | grep -qx admin || die "The current user must be a macOS administrator"

  local macos_version macos_major memory_bytes free_kb free_gb hypervisor
  macos_version="$(sw_vers -productVersion)"
  macos_major="$(version_major "${macos_version}")"
  ((macos_major >= 14)) || die "macOS 14 or newer is required; found ${macos_version}"

  memory_bytes="$(sysctl -n hw.memsize)"
  ((memory_bytes >= 8 * 1024 * 1024 * 1024)) || die "At least 8 GB of RAM is required"

  free_kb="$(df -Pk "${HOME}" | awk 'NR == 2 {print $4}')"
  free_gb=$((free_kb / 1024 / 1024))
  ((free_gb >= 40)) || die "At least 40 GB of free disk is required; found ${free_gb} GB"

  hypervisor="$(sysctl -n kern.hv_support 2>/dev/null || printf '0')"
  [[ "${hypervisor}" == "1" ]] || die "Apple Hypervisor support is unavailable on this Mac"

  detect_wifi_interface
  [[ -n "${WIFI_INTERFACE}" ]] || die "No macOS Wi-Fi hardware interface was detected"

  require_command curl
  curl --fail --silent --show-error --head --max-time 10 https://api.github.com/ >/dev/null || die "GitHub is not reachable"
  curl --fail --silent --show-error --head --max-time 10 https://chatgpt.com/codex/install.sh >/dev/null || die "The official Codex installer is not reachable"

  log "Preflight passed: macOS ${macos_version}, arm64, ${free_gb} GB free, Wi-Fi interface ${WIFI_INTERFACE}"
  mark_state preflight
}

ensure_command_line_tools() {
  if xcode-select -p >/dev/null 2>&1; then
    log "Xcode Command Line Tools are installed"
    return 0
  fi

  confirm "Open Apple's Command Line Tools installer?" || die "Command Line Tools are required"
  run xcode-select --install
  pause_for_user "Complete the Apple Command Line Tools installer before continuing."
  ((DRY_RUN)) || xcode-select -p >/dev/null 2>&1 || die "Command Line Tools installation was not detected"
}

install_homebrew() {
  detect_brew
  [[ -n "${BREW_BIN}" ]] && return 0

  local installer="${TEMP_DIR}/homebrew-install.sh"
  run curl --fail --location --show-error --silent \
    https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \
    --output "${installer}"
  if ((!DRY_RUN)); then
    chmod 700 "${installer}"
    log "Downloaded Homebrew installer SHA-256: $(shasum -a 256 "${installer}" | awk '{print $1}')"
  fi
  confirm "Run the downloaded official Homebrew installer?" || die "Homebrew is required"
  run /bin/bash "${installer}"
  detect_brew
  ((DRY_RUN)) || [[ "${BREW_BIN}" == "/opt/homebrew/bin/brew" ]] || die "Homebrew was not installed in the supported Apple-silicon prefix"
}

ensure_profile_paths() {
  local profile="${HOME}/.zprofile"
  local begin="# >>> Orbit bootstrap paths >>>"

  if [[ -f "${profile}" ]] && grep -qxF "${begin}" "${profile}"; then
    log "Orbit PATH block already exists in ${profile}"
    return 0
  fi

  if ((DRY_RUN)); then
    log "Dry run: would append the Orbit PATH block to ${profile}"
    return 0
  fi

  cat >>"${profile}" <<'EOF'

# >>> Orbit bootstrap paths >>>
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH"
# <<< Orbit bootstrap paths <<<
EOF
  log "Added the Orbit PATH block to ${profile}"
}

install_codex() {
  export PATH="${HOME}/.local/bin:${PATH}"
  if command -v codex >/dev/null 2>&1; then
    log "Codex is already installed: $(codex --version)"
  else
    local installer="${TEMP_DIR}/codex-install.sh"
    run curl --fail --location --show-error --silent \
      https://chatgpt.com/codex/install.sh \
      --output "${installer}"
    if ((!DRY_RUN)); then
      chmod 700 "${installer}"
      log "Downloaded Codex installer SHA-256: $(shasum -a 256 "${installer}" | awk '{print $1}')"
    fi
    confirm "Run the downloaded official Codex installer?" || die "Codex installation was declined"
    if ((DRY_RUN)); then
      log "Dry run: would run Codex installer with CODEX_NON_INTERACTIVE=1"
    else
      CODEX_NON_INTERACTIVE=1 /bin/sh "${installer}"
    fi
  fi

  ((DRY_RUN)) && return 0
  require_command codex
  codex --version
  if ! codex login status >/dev/null 2>&1; then
    confirm "Start Codex browser sign-in now?" || die "Run 'codex login' before the verify phase"
    codex login
  fi
  codex login status
}

phase_tooling() {
  phase_preflight
  log "Installing and validating host tooling"

  ensure_command_line_tools
  install_homebrew
  detect_brew

  if ((DRY_RUN)) && [[ -z "${BREW_BIN}" ]]; then
    BREW_BIN="/opt/homebrew/bin/brew"
  fi
  [[ -n "${BREW_BIN}" ]] || die "Homebrew is unavailable"

  run "${BREW_BIN}" install git jq node@24
  if ! "${BREW_BIN}" list --cask virtualbox >/dev/null 2>&1; then
    confirm "Install Oracle VirtualBox for the Home Assistant OS VM?" || die "VirtualBox is required for the selected HAOS installation"
    run "${BREW_BIN}" install --cask virtualbox
    if ((!DRY_RUN)); then
      pause_for_user "If macOS requested approval for VirtualBox, approve it in System Settings and restart if required. Then rerun --phase tooling."
    fi
  fi

  ensure_profile_paths
  export PATH="/opt/homebrew/opt/node@24/bin:${HOME}/.local/bin:${PATH}"
  install_codex

  if ((!DRY_RUN)); then
    [[ "$(node --version)" =~ ^v24[.] ]] || die "Orbit requires Node 24; found $(node --version)"
    git --version
    node --version
    npm --version
    detect_virtualbox
    [[ -n "${VBOXMANAGE_BIN}" ]] || die "VBoxManage was not found after VirtualBox installation"
    "${VBOXMANAGE_BIN}" --version
  fi

  mark_state tooling
}

resolve_haos_release() {
  local metadata_file="$1"
  local release_url
  if [[ "${HAOS_VERSION}" == "latest" ]]; then
    release_url="${HAOS_API_ROOT}/latest"
  else
    release_url="${HAOS_API_ROOT}/tags/${HAOS_VERSION}"
  fi

  run curl --fail --location --show-error --silent \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "User-Agent: Orbit-bootstrap/${SCRIPT_VERSION}" \
    "${release_url}" --output "${metadata_file}"
}

find_arm_linux_ostype() {
  "${VBOXMANAGE_BIN}" list ostypes | awk '
    BEGIN { RS = ""; FS = "\n" }
    {
      id = ""; description = ""; architecture = ""
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^ID:/) { id = $i; sub(/^ID:[[:space:]]*/, "", id) }
        if ($i ~ /^Description:/) { description = $i }
        if ($i ~ /^Architecture:/) { architecture = $i }
      }
      if (description ~ /Oracle Linux.*64-bit/ && architecture ~ /(ARM|arm64)/) {
        print id
        exit
      }
    }
  '
}

vm_is_registered() {
  "${VBOXMANAGE_BIN}" list vms 2>/dev/null | grep -Fq "\"${VM_NAME}\""
}

vm_is_running() {
  "${VBOXMANAGE_BIN}" list runningvms 2>/dev/null | grep -Fq "\"${VM_NAME}\""
}

vm_configuration_is_complete() {
  local config="$1"
  local vdi_path="$2"
  local memory_mb="$3"

  grep -Eqi '^firmware="?efi"?$' <<<"${config}" &&
    grep -qx 'cpus=2' <<<"${config}" &&
    grep -qx "memory=${memory_mb}" <<<"${config}" &&
    grep -qx 'nic1="bridged"' <<<"${config}" &&
    grep -Fqx "bridgeadapter1=\"${WIFI_INTERFACE}\"" <<<"${config}" &&
    grep -Eq '^storagecontrollername[0-9]+="SATA"$' <<<"${config}" &&
    grep -Fqx "\"SATA-0-0\"=\"${vdi_path}\"" <<<"${config}"
}

reconcile_vm_configuration() {
  local vdi_path="$1"
  local os_type="$2"
  local memory_mb="$3"
  local config attachment

  config="$("${VBOXMANAGE_BIN}" showvminfo "${VM_NAME}" --machinereadable)"
  if vm_configuration_is_complete "${config}" "${vdi_path}" "${memory_mb}"; then
    log "VirtualBox VM '${VM_NAME}' configuration is complete"
    return 0
  fi

  if vm_is_running; then
    die "The registered Home Assistant VM is running with incomplete configuration. Shut it down cleanly, then rerun --phase haos so Orbit can repair it."
  fi

  log "Reconciling the registered Home Assistant VM configuration"
  run "${VBOXMANAGE_BIN}" modifyvm "${VM_NAME}" \
    --ostype "${os_type}" --memory "${memory_mb}" --cpus 2 --firmware efi \
    --nic1 bridged --bridgeadapter1 "${WIFI_INTERFACE}"

  config="$("${VBOXMANAGE_BIN}" showvminfo "${VM_NAME}" --machinereadable)"
  if ! grep -Eq '^storagecontrollername[0-9]+="SATA"$' <<<"${config}"; then
    run "${VBOXMANAGE_BIN}" storagectl "${VM_NAME}" \
      --name "SATA" --add sata --controller IntelAhci
  fi

  config="$("${VBOXMANAGE_BIN}" showvminfo "${VM_NAME}" --machinereadable)"
  attachment="$(sed -n 's/^"SATA-0-0"="\(.*\)"$/\1/p' <<<"${config}")"
  case "${attachment}" in
    "${vdi_path}")
      log "The expected Home Assistant disk is already attached"
      ;;
    ""|none)
      run "${VBOXMANAGE_BIN}" storageattach "${VM_NAME}" \
        --storagectl "SATA" --port 0 --device 0 --type hdd \
        --medium "${vdi_path}" --nonrotational on --discard on
      ;;
    *)
      die "SATA port 0 already contains a different disk. Preserve it and inspect the VM manually; Orbit will not replace an attached disk."
      ;;
  esac

  config="$("${VBOXMANAGE_BIN}" showvminfo "${VM_NAME}" --machinereadable)"
  vm_configuration_is_complete "${config}" "${vdi_path}" "${memory_mb}" || \
    die "The Home Assistant VM remains incomplete after repair. Preserve the VM and inspect it with VBoxManage showvminfo before retrying."
}

phase_haos() {
  phase_preflight

  if ((DRY_RUN)); then
    log "Dry run: would install required tooling, select and verify the generic-aarch64 VDI, and reconcile the Home Assistant VM without replacing an attached disk"
    return 0
  fi

  detect_brew
  export PATH="/opt/homebrew/opt/node@24/bin:${HOME}/.local/bin:${PATH}"
  require_command jq
  detect_virtualbox
  [[ -n "${VBOXMANAGE_BIN}" ]] || die "VirtualBox is not ready; run --phase tooling first"
  detect_wifi_interface

  log "Preparing Home Assistant OS"
  local metadata_file="${TEMP_DIR}/haos-release.json"
  local asset_name asset_url asset_digest release_tag archive_path partial_path vm_dir vdi_path os_type memory_bytes memory_mb

  resolve_haos_release "${metadata_file}"

  release_tag="$(jq -er '.tag_name' "${metadata_file}")"
  asset_name="$(jq -er '[.assets[] | select(.name | test("^haos_generic-aarch64-[0-9.]+[.]vdi[.]zip$"))] | if length == 1 then .[0].name else error("expected exactly one ARM64 VDI") end' "${metadata_file}")"
  asset_url="$(jq -er --arg name "${asset_name}" '.assets[] | select(.name == $name) | .browser_download_url' "${metadata_file}")"
  asset_digest="$(jq -er --arg name "${asset_name}" '.assets[] | select(.name == $name) | .digest' "${metadata_file}")"
  [[ "${asset_digest}" =~ ^sha256:[0-9a-f]{64}$ ]] || die "The HAOS release asset does not provide a valid SHA-256 digest"

  archive_path="${DOWNLOAD_DIR}/${asset_name}"
  partial_path="${archive_path}.partial"
  if [[ ! -f "${archive_path}" ]]; then
    run curl --fail --location --show-error --continue-at - "${asset_url}" --output "${partial_path}"
    run mv -- "${partial_path}" "${archive_path}"
  else
    log "Using existing HAOS download ${archive_path}"
  fi

  local expected_hash actual_hash
  expected_hash="${asset_digest#sha256:}"
  actual_hash="$(shasum -a 256 "${archive_path}" | awk '{print $1}')"
  [[ "${actual_hash}" == "${expected_hash}" ]] || die "HAOS SHA-256 verification failed; remove ${archive_path} and retry"
  log "Verified Home Assistant OS ${release_tag} SHA-256"

  vm_dir="${HOME}/VirtualBox VMs/${VM_NAME}"
  mkdir -p -- "${vm_dir}"
  chmod 700 "${vm_dir}"
  vdi_path="${vm_dir}/${asset_name%.zip}"
  if [[ ! -f "${vdi_path}" ]]; then
    run ditto -x -k "${archive_path}" "${vm_dir}"
  fi
  [[ -f "${vdi_path}" ]] || die "Expected VDI was not extracted to ${vdi_path}"

  os_type="$(find_arm_linux_ostype)"
  [[ -n "${os_type}" ]] || die "VirtualBox does not report an ARM64 Oracle Linux guest type. Use the documented UTM fallback; do not switch to a container."

  memory_bytes="$(sysctl -n hw.memsize)"
  if ((memory_bytes >= 16 * 1024 * 1024 * 1024)); then
    memory_mb=4096
  else
    memory_mb=2048
  fi

  if vm_is_registered; then
    log "VirtualBox VM '${VM_NAME}' is already registered; validating it before reuse"
  else
    run "${VBOXMANAGE_BIN}" createvm --name "${VM_NAME}" --ostype "${os_type}" --register
  fi

  reconcile_vm_configuration "${vdi_path}" "${os_type}" "${memory_mb}"

  if vm_is_running; then
    log "Home Assistant VM is already running"
  else
    run "${VBOXMANAGE_BIN}" startvm "${VM_NAME}" --type headless
  fi

  log "Waiting up to ten minutes for Home Assistant at http://homeassistant.local:8123"
  local attempt
  for ((attempt = 1; attempt <= 60; attempt++)); do
    if curl --silent --show-error --max-time 3 --output /dev/null http://homeassistant.local:8123/; then
      log "Home Assistant is reachable at http://homeassistant.local:8123"
      mark_state haos
      return 0
    fi
    if ((attempt % 6 == 0)); then
      log "Home Assistant is still starting (${attempt}/60 checks)"
    fi
    sleep 10
  done

  log "The VM is running, but mDNS did not resolve. Find its address in the router's client list and open http://<address>:8123."
  mark_state haos
}

phase_orbit() {
  phase_preflight

  if ((DRY_RUN)); then
    log "Dry run: would validate Node 24, clone or preserve the Orbit checkout, install locked dependencies, and run Orbit checks"
    return 0
  fi

  detect_brew
  [[ -n "${BREW_BIN}" ]] || die "Homebrew is unavailable; run --phase tooling first"
  local node_prefix
  node_prefix="$("${BREW_BIN}" --prefix node@24)"
  export PATH="${node_prefix}/bin:${HOME}/.local/bin:${PATH}"
  require_command git
  require_command node
  require_command npm
  [[ "$(node --version)" =~ ^v24[.] ]] || die "Orbit requires Node 24; found $(node --version)"

  log "Preparing the Orbit checkout at ${REPOSITORY_DIR}"
  if [[ -e "${REPOSITORY_DIR}" ]]; then
    [[ -d "${REPOSITORY_DIR}/.git" ]] || die "The repository path exists but is not a Git checkout: ${REPOSITORY_DIR}"
    log "Existing checkout found; no pull, reset, checkout, or cleanup will be performed"
  else
    run mkdir -p -- "$(dirname "${REPOSITORY_DIR}")"
    run git clone "${DEFAULT_REPOSITORY_URL}" "${REPOSITORY_DIR}"
  fi

  local origin_url
  origin_url="$(git -C "${REPOSITORY_DIR}" remote get-url origin 2>/dev/null || true)"
  [[ "${origin_url}" == "${DEFAULT_REPOSITORY_URL}" || "${origin_url}" == "git@github.com:choover-prog/Orbit.git" ]] || \
    die "Unexpected Orbit origin: ${origin_url}"

  run npm --prefix "${REPOSITORY_DIR}" ci
  (
    cd "${REPOSITORY_DIR}"
    run npx playwright install chromium
    run npm run check
    run npm run test:e2e
  )

  log "Orbit is validated in fixture mode. Live Calendar, Gmail, and Google Nest credential stores remain unavailable on macOS because they require Windows DPAPI."
  mark_state orbit
}

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

install_launchd_job() {
  local destination="/Library/LaunchDaemons/${LAUNCHD_LABEL}.plist"
  local source="${TEMP_DIR}/${LAUNCHD_LABEL}.plist"
  local helper_destination="/Library/PrivilegedHelperTools/${LAUNCHD_LABEL}-start"
  local helper_source="${TEMP_DIR}/${LAUNCHD_LABEL}-start"
  local escaped_user escaped_home escaped_helper escaped_log_dir

  if [[ -f "${destination}" && -x "${helper_destination}" ]]; then
    log "Existing launchd definition and start helper preserved"
    return 0
  fi

  escaped_user="$(xml_escape "${CURRENT_USER}")"
  escaped_home="$(xml_escape "${HOME}")"
  escaped_helper="$(xml_escape "${helper_destination}")"
  escaped_log_dir="$(xml_escape "${LOG_DIR}")"

  cat >"${helper_source}" <<EOF
#!/bin/bash
set -u
export HOME=$(printf '%q' "${HOME}")
readonly VBOX=$(printf '%q' "${VBOXMANAGE_BIN}")
readonly VM=$(printf '%q' "${VM_NAME}")

for attempt in \$(seq 1 30); do
  if "\${VBOX}" list runningvms 2>/dev/null | grep -Fq "\"\${VM}\""; then
    exit 0
  fi
  if "\${VBOX}" startvm "\${VM}" --type headless; then
    exit 0
  fi
  sleep 10
done

echo "Home Assistant VM did not start after 30 attempts" >&2
exit 1
EOF
  chmod 755 "${helper_source}"

  cat >"${source}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>UserName</key>
  <string>${escaped_user}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${escaped_home}</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>${escaped_helper}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${escaped_log_dir}/home-assistant-vm.log</string>
  <key>StandardErrorPath</key>
  <string>${escaped_log_dir}/home-assistant-vm.error.log</string>
</dict>
</plist>
EOF

  plutil -lint "${source}" >/dev/null
  confirm "Install a system launchd job to start the Home Assistant VM at boot?" || return 0
  run sudo install -o root -g wheel -m 0755 "${helper_source}" "${helper_destination}"
  run sudo install -o root -g wheel -m 0644 "${source}" "${destination}"
  if ((!DRY_RUN)); then
    sudo launchctl bootstrap system "${destination}" 2>/dev/null || true
  fi
}

configure_remote_login() {
  local status
  status="$(sudo /usr/sbin/systemsetup -getremotelogin 2>/dev/null || true)"
  if [[ "${status}" == *"On"* ]]; then
    log "macOS Remote Login is enabled"
    return 0
  fi
  if confirm "Enable macOS Remote Login for SSH and Orbit tunneling?"; then
    run sudo /usr/sbin/systemsetup -setremotelogin on
  fi
}

configure_firewall() {
  local firewall_bin="/usr/libexec/ApplicationFirewall/socketfilterfw"
  [[ -x "${firewall_bin}" ]] || return 0
  local status
  status="$(sudo "${firewall_bin}" --getglobalstate 2>/dev/null || true)"
  if [[ "${status}" == *"enabled"* ]]; then
    log "macOS application firewall is enabled"
    return 0
  fi
  if confirm "Enable the macOS application firewall?"; then
    run sudo "${firewall_bin}" --setglobalstate on
  fi
}

phase_host() {
  phase_preflight

  if ((DRY_RUN)); then
    log "Dry run: would offer sleep, power recovery, SSH, firewall, and Home Assistant VM boot-job configuration"
    return 0
  fi

  CURRENT_USER="$(id -un)"
  detect_virtualbox
  [[ -n "${VBOXMANAGE_BIN}" ]] || die "VirtualBox is unavailable"
  vm_is_registered || die "Create the Home Assistant VM with --phase haos first"

  log "Configuring dedicated-host behavior"
  if confirm "Prevent system sleep and restart automatically after power loss?"; then
    run sudo pmset -a sleep 0 autorestart 1
  fi
  configure_remote_login
  configure_firewall
  install_launchd_job

  log "Automatic login remains disabled. Orbit remains loopback-only and is not installed as a background service."
  mark_state host
}

phase_verify() {
  phase_preflight

  if ((DRY_RUN)); then
    log "Dry run: would verify Node 24, Codex sign-in, the Orbit checkout, the running Home Assistant VM, network reachability, and the boot job"
    return 0
  fi

  log "Verifying the Mac mini bootstrap"

  detect_brew
  [[ -n "${BREW_BIN}" ]] || die "Homebrew is unavailable"
  local node_prefix
  node_prefix="$("${BREW_BIN}" --prefix node@24)"
  export PATH="${node_prefix}/bin:${HOME}/.local/bin:${PATH}"
  require_command git
  require_command node
  require_command npm
  require_command codex
  [[ "$(node --version)" =~ ^v24[.] ]] || die "Node 24 is not active"
  codex --version
  codex login status

  detect_virtualbox
  [[ -n "${VBOXMANAGE_BIN}" ]] || die "VBoxManage is unavailable"
  vm_is_registered || die "The Home Assistant VM is not registered"
  vm_is_running || die "The Home Assistant VM is not running"

  if curl --silent --show-error --max-time 5 --output /dev/null http://homeassistant.local:8123/; then
    log "Home Assistant responds at http://homeassistant.local:8123"
  else
    log "Home Assistant mDNS is not responding; verify the VM's DHCP address from the router"
  fi

  if [[ -d "${REPOSITORY_DIR}/.git" ]]; then
    log "Orbit checkout found at ${REPOSITORY_DIR}"
  else
    die "Orbit checkout not found at ${REPOSITORY_DIR}"
  fi

  local launchd_path="/Library/LaunchDaemons/${LAUNCHD_LABEL}.plist"
  if [[ -f "${launchd_path}" ]]; then
    plutil -lint "${launchd_path}" >/dev/null
    log "Home Assistant boot job is installed"
  else
    log "Home Assistant boot job is not installed; rerun --phase host after validating the VM"
  fi

  log "Verification complete"
  cat <<EOF

Manual acceptance checkpoints:
  1. Open Home Assistant locally and complete account onboarding.
  2. Reserve the VM address in the router if the router supports reservations.
  3. Add Home Assistant's native Google Drive integration, configure daily
     encrypted backups with seven retained copies, and store the emergency kit
     on a separate trusted device.
  4. Create one backup and confirm it appears locally and in Google Drive.
  5. Reboot the Mac and confirm Home Assistant returns without a user login.
  6. Start Orbit with: cd $(quote_command "${REPOSITORY_DIR}") && npm run dev
  7. From another computer, tunnel Orbit with:
       ssh -L 3000:127.0.0.1:3000 ${CURRENT_USER:-<user>}@<mac-mini-address>
EOF
  mark_state verify
}

run_selected_phase() {
  case "${PHASE}" in
    preflight) phase_preflight ;;
    tooling) phase_tooling ;;
    haos) phase_haos ;;
    orbit) phase_orbit ;;
    host) phase_host ;;
    verify) phase_verify ;;
    all)
      phase_tooling
      phase_haos
      pause_for_user "Complete Home Assistant's local account onboarding, then return here. Do not enter OAuth secrets into this script."
      phase_orbit
      phase_host
      phase_verify
      ;;
  esac
}

log "Orbit Mac mini bootstrap ${SCRIPT_VERSION}; phase=${PHASE}; dry-run=${DRY_RUN}"
run_selected_phase
log "Finished phase ${PHASE}"
