"""Gera catalogo.json a partir das músicas na pasta faixas/.

Roda no GitHub Actions antes de publicar no GitHub Pages.
- Título e artista vêm das tags do arquivo (ID3 etc.); sem tags, usa o nome do arquivo.
- Capa: um .jpg/.png com o mesmo nome da música, ou a capa embutida no arquivo.
- Ordem: as enviadas mais recentemente aparecem primeiro.
- Nome do site, frase e artista padrão: faixas/site.json (opcional).
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

try:
    import mutagen
except ImportError:  # sem mutagen, segue só com o nome do arquivo
    mutagen = None

ROOT = Path(__file__).resolve().parents[2]
FAIXAS = ROOT / "faixas"
CAPAS_GERADAS = FAIXAS / "_capas"
AUDIO = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm"}
IMAGENS = (".jpg", ".jpeg", ".png", ".webp")

SITE_PADRAO = {
    "name": "AS Brasil Music",
    "tagline": "Dê o play e continue ouvindo enquanto usa outros apps.",
    "artist": "AS Brasil Music",
}


def url(p: Path) -> str:
    return quote(p.relative_to(ROOT).as_posix())


def titulo_do_arquivo(nome: str) -> str:
    t = re.sub(r"_+", " ", Path(nome).stem)
    t = re.sub(r"^\d{1,3}\s*[-.]\s*", "", t)
    return re.sub(r"\s+", " ", t).strip() or "Sem título"


def data_no_git(p: Path) -> int:
    try:
        out = subprocess.run(
            ["git", "log", "--diff-filter=A", "--format=%ct", "-1", "--", str(p.relative_to(ROOT))],
            cwd=ROOT, capture_output=True, text=True, check=False,
        ).stdout.strip()
        return int(out) if out else int(p.stat().st_mtime)
    except Exception:
        return int(p.stat().st_mtime)


def ler_tags(p: Path):
    info = {"title": "", "artist": "", "album": "", "dur": 0, "capa": None}
    if not mutagen:
        return info
    try:
        f = mutagen.File(p)
    except Exception:
        return info
    if f is None:
        return info
    if getattr(f, "info", None) and getattr(f.info, "length", None):
        info["dur"] = int(round(f.info.length))
    tags = f.tags or {}

    def pega(*chaves):
        for k in chaves:
            try:
                v = tags.get(k)
            except Exception:
                v = None
            if v:
                v = v[0] if isinstance(v, (list, tuple)) else v
                v = getattr(v, "text", [v])
                v = v[0] if isinstance(v, (list, tuple)) else v
                if str(v).strip():
                    return str(v).strip()
        return ""

    info["title"] = pega("TIT2", "\xa9nam", "title", "TITLE")
    info["artist"] = pega("TPE1", "\xa9ART", "artist", "ARTIST")
    info["album"] = pega("TALB", "\xa9alb", "album", "ALBUM")

    # capa embutida
    try:
        for k in list(tags.keys()):
            if str(k).startswith("APIC"):
                info["capa"] = tags[k].data
                break
        if not info["capa"] and "covr" in tags:
            info["capa"] = bytes(tags["covr"][0])
        if not info["capa"] and getattr(f, "pictures", None):
            info["capa"] = f.pictures[0].data
    except Exception:
        pass
    return info


def main():
    site = dict(SITE_PADRAO)
    cfg = FAIXAS / "site.json"
    if cfg.is_file():
        try:
            dados = json.loads(cfg.read_text(encoding="utf-8"))
            for k in site:
                if isinstance(dados.get(k), str) and dados[k].strip():
                    site[k] = dados[k].strip()
        except Exception as e:
            print("Aviso: faixas/site.json inválido:", e)

    faixas = []
    if FAIXAS.is_dir():
        for p in sorted(FAIXAS.iterdir()):
            if not p.is_file() or p.suffix.lower() not in AUDIO:
                continue
            tags = ler_tags(p)
            h = hashlib.sha1(p.name.encode("utf-8")).hexdigest()
            capa = None
            for ext in IMAGENS:
                irma = p.with_suffix(ext)
                if irma.is_file():
                    capa = url(irma)
                    break
            if not capa and tags["capa"]:
                CAPAS_GERADAS.mkdir(exist_ok=True)
                destino = CAPAS_GERADAS / f"{h[:16]}.jpg"
                destino.write_bytes(tags["capa"])
                capa = url(destino)
            faixas.append({
                "id": "t" + h[:12],
                "title": tags["title"] or titulo_do_arquivo(p.name),
                "artist": tags["artist"],
                "album": tags["album"],
                "dur": tags["dur"],
                "file": url(p),
                "cover": capa,
                "hue": 255 + int(h[12:16], 16) % 65,
                "added": data_no_git(p),
            })

    faixas.sort(key=lambda t: (-t["added"], t["title"].lower()))
    cat = {"v": 1, "site": site, "tracks": faixas}
    (ROOT / "catalogo.json").write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"catalogo.json gerado com {len(faixas)} faixa(s).")


if __name__ == "__main__":
    main()
