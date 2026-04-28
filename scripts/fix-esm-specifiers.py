from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent / "packages"
JS_EXTENSIONS = (".js", ".mjs", ".cjs", ".json", ".node", ".wasm")
FROM_PATTERN = re.compile(
    r"(?P<prefix>\b(?:import|export)\b[^\n]*?\bfrom\s+[\"'])(?P<spec>\.{1,2}/[^\"']+)(?P<suffix>[\"'])"
)
DYNAMIC_IMPORT_PATTERN = re.compile(
    r"(?P<prefix>\bimport\s*\(\s*)(?P<quote>[\"'])(?P<spec>\.{1,2}/[^\"']+)(?P=quote)(?P<suffix>\s*\))"
)
ASSIGNMENT_PATTERN = re.compile(
    r"(?P<prefix>(?:=|:)\s*)(?P<quote>[\"'])(?P<spec>\.{1,2}/[^\"']+)(?P=quote)"
)


def resolve_specifier(path: Path, spec: str) -> str:
    if spec.endswith(JS_EXTENSIONS):
        target = (path.parent / spec).resolve()
        if target.exists():
            return spec
        for ext in JS_EXTENSIONS:
            if spec.endswith(ext):
                base_spec = spec[: -len(ext)]
                index_candidate = (path.parent / base_spec).resolve() / f"index{ext}"
                if index_candidate.exists():
                    return f"{base_spec}/index{ext}"
        return spec

    target = (path.parent / spec).resolve()
    for ext in JS_EXTENSIONS:
        appended_candidate = (path.parent / f"{spec}{ext}").resolve()
        if appended_candidate.exists():
            return f"{spec}{ext}"
        candidate = target.with_suffix(ext)
        if candidate.exists():
            return f"{spec}{ext}"

    for ext in JS_EXTENSIONS:
        index_candidate = target / f"index{ext}"
        if index_candidate.exists():
            return f"{spec}/index{ext}"

    return spec


for path in ROOT.rglob("*.js"):
    if "dist" not in path.parts and "build" not in path.parts:
        continue

    text = path.read_text()
    updated = FROM_PATTERN.sub(
        lambda match: (
            f"{match.group('prefix')}"
            f"{resolve_specifier(path, match.group('spec'))}"
            f"{match.group('suffix')}"
        ),
        text,
    )
    updated = DYNAMIC_IMPORT_PATTERN.sub(
        lambda match: (
            f"{match.group('prefix')}"
            f"{match.group('quote')}"
            f"{resolve_specifier(path, match.group('spec'))}"
            f"{match.group('quote')}"
            f"{match.group('suffix')}"
        ),
        updated,
    )
    updated = ASSIGNMENT_PATTERN.sub(
        lambda match: (
            f"{match.group('prefix')}"
            f"{match.group('quote')}"
            f"{resolve_specifier(path, match.group('spec'))}"
            f"{match.group('quote')}"
        ),
        updated,
    )
    if updated != text:
        path.write_text(updated)
