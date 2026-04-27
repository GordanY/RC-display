#!/usr/bin/env python3
"""Repair double-encoded UTF-8 filenames under public/artifacts/.

Background: before the multer fix in server/index.ts, the Node dev server
decoded multipart `filename` parameters as latin1, then Node's fs re-encoded
the resulting JS string as UTF-8 — producing filenames with 18 bytes where
9 were intended. This tool finds those names and renames them, and patches
any matching paths in public/artifacts/data.json.

Defaults to dry-run. Pass --apply to execute. Handles nested dirs (renames
deepest first) and mirrors file moves in data.json string values.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "artifacts"
DATA_FILE = ROOT / "data.json"


def try_repair(name: str) -> str | None:
    """Return the repaired name if `name` is double-encoded UTF-8, else None."""
    try:
        repaired = name.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None
    return repaired if repaired != name else None


def scan() -> list[tuple[Path, Path]]:
    """Return (old_path, new_path) pairs, ordered deepest-first."""
    pairs: list[tuple[Path, Path]] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        for n in filenames + dirnames:
            repaired = try_repair(n)
            if repaired is None:
                continue
            old = Path(dirpath) / n
            new = Path(dirpath) / repaired
            pairs.append((old, new))
    pairs.sort(key=lambda p: len(p[0].parts), reverse=True)
    return pairs


def patch_data_json(pairs: list[tuple[Path, Path]], apply: bool) -> list[tuple[str, str]]:
    """Return list of (old_relpath, new_relpath) updates applied in-memory.

    Only substitutes path segments that exactly match a renamed component, so
    a `data.json` entry like `a/b/mojibake.obj` becomes `a/b/repaired.obj`
    without mangling unrelated strings.
    """
    if not DATA_FILE.exists():
        return []
    raw = DATA_FILE.read_text(encoding="utf-8")
    data = json.loads(raw)

    updates: list[tuple[str, str]] = []
    for old, new in pairs:
        old_rel = str(old.relative_to(ROOT)).replace(os.sep, "/")
        new_rel = str(new.relative_to(ROOT)).replace(os.sep, "/")
        if old_rel in raw:
            updates.append((old_rel, new_rel))

    if not updates:
        return []

    # Replace in the parsed tree to respect structure (not blind text replace),
    # then re-serialize once at the end.
    def walk(node):
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(v) for v in node]
        if isinstance(node, str):
            for old_rel, new_rel in updates:
                if node == old_rel or node.startswith(old_rel + "/"):
                    node = new_rel + node[len(old_rel):]
            return node
        return node

    data = walk(data)

    if apply:
        tmp = DATA_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(DATA_FILE)

    return updates


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="execute renames (default: dry-run)")
    args = ap.parse_args()

    if not ROOT.exists():
        print(f"error: {ROOT} does not exist", file=sys.stderr)
        return 2

    pairs = scan()
    print(f"[scan] {len(pairs)} double-encoded entr{'y' if len(pairs) == 1 else 'ies'} under {ROOT}")
    for old, new in pairs:
        print(f"  {old.relative_to(ROOT)}")
        print(f"    -> {new.relative_to(ROOT)}")

    updates = patch_data_json(pairs, apply=args.apply)
    print(f"\n[data.json] {len(updates)} path reference{'s' if len(updates) != 1 else ''} to update")
    for old_rel, new_rel in updates:
        print(f"  {old_rel}\n    -> {new_rel}")

    if not args.apply:
        print("\n[dry-run] no changes written. Re-run with --apply to execute.")
        return 0

    # Deepest-first rename order means child paths resolve against the old
    # parent until after their own rename — we only rename directory names
    # after every file inside them is already renamed.
    errors = 0
    for old, new in pairs:
        if new.exists():
            print(f"  skip: destination already exists: {new}")
            continue
        try:
            old.rename(new)
            print(f"  renamed: {old.name} -> {new.name}")
        except OSError as e:
            print(f"  FAIL: {old} -> {new}: {e}", file=sys.stderr)
            errors += 1

    print(f"\n[done] {len(pairs) - errors}/{len(pairs)} renamed, data.json {'updated' if updates else 'unchanged'}.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
