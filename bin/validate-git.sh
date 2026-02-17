#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# validate-git.sh — Gordian Open Integrity Git-Level Validation
# ═══════════════════════════════════════════════════════════════════════
#
# Reference validation script for the Gordian Open Integrity pattern.
# See: WP-2026-01-GordianOpenIntegrity.md §5 (Verification)
#
# This script validates a repository's git-level integrity using ONLY
# standard git and shell tools — no Gordian cryptographic stack required.
#
# ── CHECKS COVERED (git-only, no Gordian stack needed) ───────────────
#
#   ✅  §5.1 Step 1  — Provenance history exists
#                       Finds all commits that touched the inception
#                       envelope and extracts the mark from each version.
#
#   ✅  §5.1 Step 2  — Mark uniqueness across versions (weak monotonicity)
#                       Verifies that the hex mark changes between every
#                       provenance version. Full sequence monotonicity
#                       requires the Gordian stack to decode the mark's
#                       integer sequence number; hex inequality is the
#                       strongest check possible without it.
#
#   ✅  §5.1 Step 3  — Published mark matches latest
#                       If --mark is provided, compares it against the
#                       mark field from the most recent provenance version.
#
#   ✅  §5.1 Step 5  — Commit signature audit
#                       Extracts SSH public keys from the envelope's
#                       human-readable comments, builds an allowed-signers
#                       file, and runs git verify-commit on every commit.
#
#   ✅  §5.1 Step 7  — Inception commit is empty
#                       Verifies the root commit's tree hash equals the
#                       well-known empty tree (4b825dc642cb6eb9a060e54bf8d69288fbee4904).
#
#   ✅  §5.1 Step 7  — Repository DID derivation
#                       Derives and displays did:repo:<inception-hash>.
#
#   ✅  §6.1         — Inception commit message format
#                       Checks that the inception commit message starts
#                       with the [GordianOpenIntegrity] prefix.
#
#   ✅  §1.1         — Required file existence
#                       Checks that .o/GordianOpenIntegrity.yaml exists
#                       in the working tree.
#
#   ✅  §1.2         — Generator not committed
#                       Scans all tracked files across history to ensure
#                       no generator files (*-generator.yaml) were ever
#                       committed to the repository.
#
# ── CHECKS NOT COVERED (require Gordian cryptographic stack) ─────────
#
#   ❌  §5.1 Step 2  — Full provenance mark sequence monotonicity
#                       Requires decoding the binary provenance mark from
#                       the Gordian Envelope to extract integer sequence
#                       numbers. This script checks hex inequality only.
#
#   ❌  §5.1 Step 4  — SSH key extraction from envelope assertions
#                       Requires decoding the Gordian Envelope UR string
#                       to extract the "GordianOpenIntegrity" assertion.
#                       This script falls back to parsing SSH keys from
#                       the human-readable comment section.
#
#   ❌  §5.1 Step 6  — XID stability across versions
#                       Requires decoding the Gordian Envelope to extract
#                       the XID subject from each version.
#
#   ❌  §5.2 Step 2  — Document self-reference assertion verification
#                       Requires Gordian Envelope decoding.
#
#   ❌  §5.2 Step 3  — Documents map verification
#                       Requires Gordian Envelope decoding.
#
#   ❌  §5.2 Step 4  — Document XID stability
#                       Requires Gordian Envelope decoding.
#
# ── USAGE ────────────────────────────────────────────────────────────
#
#   ./validate-git.sh [--repo <path>] [--mark <hex>] [--verbose]
#
#     --repo <path>   Repository to validate (default: current directory)
#     --mark <hex>    Published provenance mark to verify against
#     --verbose       Print detailed output for each check
#
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────

readonly PROVENANCE_FILE=".o/GordianOpenIntegrity.yaml"
readonly EMPTY_TREE="4b825dc642cb6eb9a060e54bf8d69288fbee4904"

# ── Argument parsing ─────────────────────────────────────────────────

REPO_DIR="."
PUBLISHED_MARK=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)    REPO_DIR="$2"; shift 2 ;;
        --mark)    PUBLISHED_MARK="$2"; shift 2 ;;
        --verbose) VERBOSE=true; shift ;;
        -h|--help)
            sed -n '/^# ── USAGE/,/^# ═══/p' "$0" | head -n -1
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# ── State ────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0

# ── Helpers ──────────────────────────────────────────────────────────

pass() {
    PASS=$((PASS + 1))
    echo "  ✅  $1"
}

fail() {
    FAIL=$((FAIL + 1))
    echo "  ❌  $1"
}

warn() {
    WARN=$((WARN + 1))
    echo "  ⚠️   $1"
}

info() {
    if $VERBOSE; then
        echo "      $1"
    fi
}

# Extract the mark field from a provenance YAML document.
# Parses the machine-readable section (before the --- separator).
extract_mark() {
    local content="$1"
    # Get content before the --- separator, then extract the mark value
    echo "$content" | awk '/^---$/{exit} {print}' | \
        grep -E '^mark:\s*' | \
        head -1 | \
        sed 's/^mark:\s*"*//; s/"*\s*$//'
}

# Extract SSH public keys from the human-readable comment section.
# Looks for lines matching: # "GordianOpenIntegrity": "ssh-ed25519 ..."
# This is a best-effort fallback — full extraction requires Gordian Envelope decoding.
extract_ssh_keys() {
    local yaml="$1"
    echo "$yaml" | \
        grep -oE 'ssh-ed25519 [A-Za-z0-9+/=]+ [^ ]*' || true
}

# ── Validation ───────────────────────────────────────────────────────

echo ""
echo "Gordian Open Integrity — Git-Level Validation"
echo "Repository: $(cd "$REPO_DIR" && pwd)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Verify this is a git repository ───────────────────────────────

if ! git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    fail "Not a git repository: $REPO_DIR"
    echo ""
    echo "Result: FAIL ($FAIL failed)"
    exit 1
fi

# ── 2. Check inception commit (§5.1 Step 7) ─────────────────────────

echo "Inception Commit"

INCEPTION_HASH=$(git -C "$REPO_DIR" rev-list --max-parents=0 HEAD 2>/dev/null | head -1)

if [[ -z "$INCEPTION_HASH" ]]; then
    fail "No root commit found"
else
    info "Hash: $INCEPTION_HASH"

    # Verify empty tree
    TREE_HASH=$(git -C "$REPO_DIR" log --format=%T -1 "$INCEPTION_HASH")
    if [[ "$TREE_HASH" == "$EMPTY_TREE" ]]; then
        pass "Inception commit has empty tree"
    else
        fail "Inception commit is not empty (tree: $TREE_HASH)"
    fi

    # Derive repository DID
    DID="did:repo:$INCEPTION_HASH"
    pass "Repository DID: $DID"

    # Check inception commit message format (§6.1)
    INCEPTION_MSG=$(git -C "$REPO_DIR" log --format=%s -1 "$INCEPTION_HASH")
    if [[ "$INCEPTION_MSG" == "[GordianOpenIntegrity]"* ]] || [[ "$INCEPTION_MSG" == "[RepositoryIdentifier]"* ]]; then
        pass "Inception commit message has recognized prefix"
    else
        fail "Inception commit message missing [GordianOpenIntegrity] or [RepositoryIdentifier] prefix"
        info "Got: $INCEPTION_MSG"
    fi
fi

echo ""

# ── 3. Check provenance file exists (§1.1) ──────────────────────────

echo "Provenance Files"

if [[ -f "$REPO_DIR/$PROVENANCE_FILE" ]]; then
    pass "Inception envelope exists: $PROVENANCE_FILE"
else
    fail "Inception envelope missing: $PROVENANCE_FILE"
fi

# Check that generator files were never committed (§1.2)
# Note: .git/o/ is the intended location (untracked by design), but we also
# check for any *-generator.yaml in tracked paths in case of misconfiguration.
GENERATOR_FILES=$(git -C "$REPO_DIR" log --all --diff-filter=A --name-only --format= -- '*-generator.yaml' 2>/dev/null | sort -u | grep -v '^$' || true)
if [[ -z "$GENERATOR_FILES" ]]; then
    pass "No generator files found in commit history"
else
    fail "Generator files were committed to the repository"
    if $VERBOSE; then
        echo "$GENERATOR_FILES" | while read -r gf; do
            info "Committed generator: $gf"
        done
    fi
fi

echo ""

# ── 4. Collect provenance history (§5.1 Step 1) ─────────────────────

echo "Provenance History"

# Find all commits that modified the inception envelope
PROVENANCE_HASHES=$(git -C "$REPO_DIR" log --all --reverse --format=%H -- "$PROVENANCE_FILE" 2>/dev/null)

if [[ -z "$PROVENANCE_HASHES" ]]; then
    fail "No provenance documents found in repository history"
    echo ""
    echo "Result: FAIL ($FAIL failed)"
    exit 1
fi

# Extract the mark from each provenance version
declare -a MARKS=()
declare -a ALL_SSH_KEYS=()
VERSION_COUNT=0

while IFS= read -r hash; do
    VERSION_COUNT=$((VERSION_COUNT + 1))

    # Extract the file content at this commit
    YAML_CONTENT=$(git -C "$REPO_DIR" show "$hash:$PROVENANCE_FILE" 2>/dev/null || true)

    if [[ -z "$YAML_CONTENT" ]]; then
        warn "Could not read $PROVENANCE_FILE at commit $hash"
        continue
    fi

    # Extract mark
    MARK=$(extract_mark "$YAML_CONTENT")
    if [[ -n "$MARK" ]]; then
        MARKS+=("$MARK")
        info "Version $VERSION_COUNT: mark=$MARK (commit ${hash:0:8})"
    else
        warn "Could not extract mark from version $VERSION_COUNT (commit ${hash:0:8})"
    fi

    # Extract SSH keys from human-readable section (best-effort, §5.1 Step 4)
    while IFS= read -r key; do
        if [[ -n "$key" ]]; then
            # Deduplicate using a flag variable
            _found=false
            for existing in "${ALL_SSH_KEYS[@]+"${ALL_SSH_KEYS[@]}"}"; do
                if [[ "$existing" == "$key" ]]; then
                    _found=true
                    break
                fi
            done
            if ! $_found; then
                ALL_SSH_KEYS+=("$key")
                info "Found SSH key: ${key:0:40}..."
            fi
        fi
    done <<< "$(extract_ssh_keys "$YAML_CONTENT")"

done <<< "$PROVENANCE_HASHES"

if [[ ${#MARKS[@]} -gt 0 ]]; then
    pass "Found ${#MARKS[@]} provenance version(s) across $VERSION_COUNT commit(s)"
else
    fail "No valid provenance marks extracted"
fi

echo ""

# ── 5. Verify mark uniqueness / weak monotonicity (§5.1 Step 2) ─────

echo "Mark Integrity"

if [[ ${#MARKS[@]} -ge 2 ]]; then
    MARKS_UNIQUE=true
    for ((i = 1; i < ${#MARKS[@]}; i++)); do
        if [[ "${MARKS[$i]}" == "${MARKS[$((i - 1))]}" ]]; then
            MARKS_UNIQUE=false
            fail "Mark unchanged between version $i and $((i + 1)): ${MARKS[$i]}"
        fi
    done
    if $MARKS_UNIQUE; then
        pass "All marks are unique across ${#MARKS[@]} versions (weak monotonicity)"
    fi
elif [[ ${#MARKS[@]} -eq 1 ]]; then
    pass "Single provenance version — monotonicity trivially satisfied"
fi

# ── 6. Verify published mark (§5.1 Step 3) ──────────────────────────

if [[ -n "$PUBLISHED_MARK" ]]; then
    LATEST_MARK="${MARKS[${#MARKS[@]} - 1]}"
    if [[ "$PUBLISHED_MARK" == "$LATEST_MARK" ]]; then
        pass "Published mark matches latest: $PUBLISHED_MARK"
    else
        fail "Published mark mismatch: expected=$PUBLISHED_MARK actual=$LATEST_MARK"
    fi
else
    info "No published mark provided (--mark), skipping mark comparison"
fi

echo ""

# ── 7. Audit commit signatures (§5.1 Step 5) ────────────────────────

echo "Commit Signatures"

# Get total commit count
ALL_COMMITS=$(git -C "$REPO_DIR" log --all --format=%H)
TOTAL_COMMITS=$(echo "$ALL_COMMITS" | wc -l | tr -d ' ')

if [[ ${#ALL_SSH_KEYS[@]} -eq 0 ]]; then
    warn "No SSH keys extracted from provenance — cannot verify signatures"
    warn "Full signature audit requires the Gordian stack to decode envelope assertions"
    info "Falling back to checking if commits have signatures at all"

    # Even without keys, we can check if commits are signed
    UNSIGNED=0
    while IFS= read -r hash; do
        # Check if the commit has a signature at all
        SIG=$(git -C "$REPO_DIR" log --format=%GG -1 "$hash" 2>/dev/null || true)
        if [[ -z "$SIG" ]]; then
            UNSIGNED=$((UNSIGNED + 1))
            info "Unsigned commit: ${hash:0:8}"
        fi
    done <<< "$ALL_COMMITS"

    if [[ $UNSIGNED -eq 0 ]]; then
        pass "All $TOTAL_COMMITS commit(s) have signatures (keys not verified)"
    else
        fail "$UNSIGNED of $TOTAL_COMMITS commit(s) are unsigned"
    fi
else
    info "Found ${#ALL_SSH_KEYS[@]} SSH key(s) for signature verification"

    # Build temporary allowed-signers file
    TMPFILE=$(mktemp)
    trap 'rm -f "$TMPFILE"' EXIT

    for key in "${ALL_SSH_KEYS[@]}"; do
        echo "xid-verifier@provenance namespaces=\"git\" $key" >> "$TMPFILE"
    done

    VALID=0
    INVALID=0

    while IFS= read -r hash; do
        # Verify the commit signature against our allowed signers
        VERIFY_OUTPUT=$(git -C "$REPO_DIR" \
            -c gpg.ssh.allowedSignersFile="$TMPFILE" \
            verify-commit "$hash" 2>&1 || true)

        if echo "$VERIFY_OUTPUT" | grep -q 'Good "git" signature'; then
            VALID=$((VALID + 1))
        else
            INVALID=$((INVALID + 1))
            info "Invalid/missing signature: ${hash:0:8}"
        fi
    done <<< "$ALL_COMMITS"

    if [[ $INVALID -eq 0 ]]; then
        pass "All $TOTAL_COMMITS commit(s) have valid signatures"
    else
        fail "$INVALID of $TOTAL_COMMITS commit(s) have invalid or missing signatures"
    fi

    pass "Verified against ${#ALL_SSH_KEYS[@]} SSH key(s)"
fi

echo ""

# ── 8. Check for decision documents ─────────────────────────────────

echo "Decision Documents"

# Find all .yaml files under .o/ that aren't the inception envelope or lifehashes
DOC_FILES=$(find "$REPO_DIR/.o" -name '*.yaml' -not -name 'GordianOpenIntegrity.yaml' 2>/dev/null || true)

if [[ -z "$DOC_FILES" ]]; then
    info "No decision documents found under .o/"
else
    DOC_COUNT=$(echo "$DOC_FILES" | wc -l | tr -d ' ')
    pass "Found $DOC_COUNT decision document(s)"

    # For each document, check it has provenance history
    while IFS= read -r doc_path; do
        REL_PATH="${doc_path#"$REPO_DIR/"}"
        DOC_HASHES=$(git -C "$REPO_DIR" log --all --reverse --format=%H -- "$REL_PATH" 2>/dev/null || true)
        if [[ -n "$DOC_HASHES" ]]; then
            DOC_VERSIONS=$(echo "$DOC_HASHES" | wc -l | tr -d ' ')
            info "$REL_PATH: $DOC_VERSIONS version(s) in history"
        else
            warn "$REL_PATH: no commit history found"
        fi
    done <<< "$DOC_FILES"
fi

echo ""

# ── Summary ──────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -eq 0 ]]; then
    echo "Result: PASS ($PASS passed"$([ $WARN -gt 0 ] && echo ", $WARN warning(s)")")"
    exit 0
else
    echo "Result: FAIL ($FAIL failed, $PASS passed"$([ $WARN -gt 0 ] && echo ", $WARN warning(s)")")"
    exit 1
fi
