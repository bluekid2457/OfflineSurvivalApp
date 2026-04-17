#!/usr/bin/env python3
"""Discover and scrape survival guide pages into structured JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence
from urllib.parse import urljoin, urlparse, urlunparse

try:
    import requests
except ImportError:
    requests = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


DEFAULT_DISCOVERY_PATTERN = re.compile(
    r"survival|guide|preparedness|wilderness|emergency|first[- ]aid|shelter|water|fire|food|navigation",
    re.IGNORECASE,
)
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_DELAY_SECONDS = 0.0
DEFAULT_CATEGORY = "survival"
SCHEMA_VERSION = "1.0"
USER_AGENT = "OfflineSurvivalAppScraper/1.0 (+https://github.com/bluekid2457/LocalVectorDB)"


def _require_dependencies() -> None:
    missing: List[str] = []
    if requests is None:
        missing.append("requests")
    if BeautifulSoup is None:
        missing.append("beautifulsoup4")
    if missing:
        raise ImportError(
            "Missing Python dependencies: "
            + ", ".join(missing)
            + ". Install them with: pip install requests beautifulsoup4"
        )


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _normalize_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    clean = parsed._replace(fragment="")
    return urlunparse(clean)


def _unique_urls(urls: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for raw_url in urls:
        normalized = _normalize_url(raw_url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _read_urls_from_input(input_path: Path) -> List[str]:
    raw_text = input_path.read_text(encoding="utf-8")
    if input_path.suffix.lower() == ".json":
        payload = json.loads(raw_text)
        if isinstance(payload, list):
            return [str(item) for item in payload]
        if isinstance(payload, dict):
            for key in ("urls", "seed_urls", "links"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [str(item) for item in value]
        raise ValueError("Input JSON must be a list or contain a urls/seed_urls/links list")

    urls: List[str] = []
    for line in raw_text.splitlines():
        candidate = line.strip()
        if not candidate or candidate.startswith("#"):
            continue
        urls.append(candidate)
    return urls


def _matches_allowed_domain(url: str, allowed_domain: Optional[str]) -> bool:
    if not allowed_domain:
        return True
    netloc = urlparse(url).netloc.lower()
    domain = allowed_domain.lower().lstrip(".")
    return netloc == domain or netloc.endswith(f".{domain}")


def _make_document_id(url: str) -> str:
    parsed = urlparse(url)
    slug = re.sub(r"[^a-z0-9]+", "-", f"{parsed.netloc}{parsed.path}".lower()).strip("-")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    return f"{slug or 'document'}-{digest}"


def _first_non_empty(values: Iterable[str]) -> str:
    for value in values:
        text = _normalize_text(value)
        if text:
            return text
    return ""


def _truncate_excerpt(content: str, max_chars: int = 280) -> str:
    if len(content) <= max_chars:
        return content
    excerpt = content[: max_chars - 3].rsplit(" ", 1)[0].strip()
    return f"{excerpt or content[: max_chars - 3].strip()}..."


def _default_source_name(urls: Sequence[str]) -> str:
    for url in urls:
        parsed = urlparse(url)
        if parsed.netloc:
            return parsed.netloc
    return "web"


def _collect_links(root: Any, base_url: str) -> List[Dict[str, str]]:
    links: List[Dict[str, str]] = []
    seen = set()
    for anchor in root.find_all("a", href=True):
        absolute_url = _normalize_url(urljoin(base_url, anchor.get("href", "")))
        if not absolute_url or absolute_url in seen:
            continue
        seen.add(absolute_url)
        links.append(
            {
                "text": _normalize_text(anchor.get_text(" ", strip=True)),
                "url": absolute_url,
            }
        )
    return links


def _collect_images(root: Any, base_url: str) -> List[Dict[str, str]]:
    images: List[Dict[str, str]] = []
    seen = set()
    for image in root.find_all("img", src=True):
        source_url = _normalize_url(urljoin(base_url, image.get("src", "")))
        if not source_url or source_url in seen:
            continue
        seen.add(source_url)
        images.append(
            {
                "alt": _normalize_text(image.get("alt", "")),
                "src": source_url,
            }
        )
    return images


def _collect_headings(root: Any) -> List[str]:
    headings: List[str] = []
    for heading in root.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        text = _normalize_text(heading.get_text(" ", strip=True))
        if text and text not in headings:
            headings.append(text)
    return headings


def _collect_content_blocks(root: Any) -> List[str]:
    blocks: List[str] = []
    for element in root.find_all(["p", "li", "blockquote", "pre", "td"]):
        text = _normalize_text(element.get_text(" ", strip=True))
        if text:
            blocks.append(text)

    if blocks:
        return blocks

    fallback = [_normalize_text(text) for text in root.stripped_strings]
    return [text for text in fallback if text]


def load_seed_urls(urls: Optional[Sequence[str]] = None, input_path: Optional[Path] = None) -> List[str]:
    """Load and de-duplicate seed URLs from CLI values and an optional input file."""
    seed_urls: List[str] = list(urls or [])
    if input_path:
        seed_urls.extend(_read_urls_from_input(input_path))
    return _unique_urls(seed_urls)


def fetch_html(url: str, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> str:
    """Fetch HTML from a URL using requests."""
    _require_dependencies()
    assert requests is not None

    response = requests.get(
        url,
        timeout=timeout_seconds,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    response.raise_for_status()
    return response.text


def discover_guide_urls(
    index_url: str,
    allowed_domain: Optional[str] = None,
    link_pattern: Optional[str] = None,
    limit: Optional[int] = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> List[str]:
    """Discover likely guide links from an index page."""
    _require_dependencies()
    assert BeautifulSoup is not None

    html = fetch_html(index_url, timeout_seconds=timeout_seconds)
    soup = BeautifulSoup(html, "html.parser")
    pattern = re.compile(link_pattern, re.IGNORECASE) if link_pattern else DEFAULT_DISCOVERY_PATTERN

    discovered: List[str] = []
    for anchor in soup.find_all("a", href=True):
        absolute_url = _normalize_url(urljoin(index_url, anchor.get("href", "")))
        if not absolute_url:
            continue
        if not _matches_allowed_domain(absolute_url, allowed_domain):
            continue

        anchor_text = _normalize_text(anchor.get_text(" ", strip=True))
        haystack = f"{absolute_url} {anchor_text}"
        if not pattern.search(haystack):
            continue

        discovered.append(absolute_url)
        if limit is not None and len(_unique_urls(discovered)) >= limit:
            break

    return _unique_urls(discovered)


def extract_document(
    url: str,
    html: str,
    source_name: str,
    category: str,
    discovered_from: Optional[str] = None,
) -> Dict[str, Any]:
    """Extract structured text content from a single HTML document."""
    _require_dependencies()
    assert BeautifulSoup is not None

    soup = BeautifulSoup(html, "html.parser")
    warnings: List[str] = []

    for tag in soup(["script", "style", "noscript", "iframe", "svg", "canvas", "form"]):
        tag.decompose()

    content_root = soup.find("main") or soup.find("article") or soup.body or soup
    for tag in content_root.find_all(["nav", "aside", "footer"]):
        tag.decompose()

    title = _first_non_empty(
        [
            soup.find("meta", property="og:title").get("content", "") if soup.find("meta", property="og:title") else "",
            content_root.find("h1").get_text(" ", strip=True) if content_root.find("h1") else "",
            soup.title.get_text(" ", strip=True) if soup.title else "",
        ]
    )
    if not title:
        warnings.append("No title could be extracted")
        title = url

    headings = _collect_headings(content_root)
    links = _collect_links(content_root, base_url=url)
    images = _collect_images(content_root, base_url=url)
    content_blocks = _collect_content_blocks(content_root)
    content = "\n\n".join(content_blocks)

    if not content:
        warnings.append("No document content could be extracted")

    return {
        "id": _make_document_id(url),
        "source_name": source_name,
        "source_url": url,
        "discovered_from": discovered_from,
        "category": category,
        "title": title,
        "content": content,
        "excerpt": _truncate_excerpt(content),
        "headings": headings,
        "links": links,
        "images": images,
        "metadata": {
            "word_count": len(content.split()),
            "parser": "beautifulsoup4",
            "warnings": warnings,
        },
    }


def scrape_url(
    url: str,
    source_name: str,
    category: str,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    discovered_from: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch and extract a single URL."""
    html = fetch_html(url, timeout_seconds=timeout_seconds)
    return extract_document(
        url=url,
        html=html,
        source_name=source_name,
        category=category,
        discovered_from=discovered_from,
    )


def scrape_urls(
    urls: Sequence[str],
    source_name: str,
    category: str,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    delay_seconds: float = DEFAULT_DELAY_SECONDS,
    discovered_from_map: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """Scrape multiple URLs, continuing past individual failures."""
    documents: List[Dict[str, Any]] = []
    unique_urls = _unique_urls(urls)

    for index, url in enumerate(unique_urls):
        try:
            documents.append(
                scrape_url(
                    url=url,
                    source_name=source_name,
                    category=category,
                    timeout_seconds=timeout_seconds,
                    discovered_from=(discovered_from_map or {}).get(url),
                )
            )
        except Exception as exc:
            print(f"Failed to scrape {url}: {exc}", file=sys.stderr)

        if delay_seconds > 0 and index < len(unique_urls) - 1:
            time.sleep(delay_seconds)

    return documents


def write_output(output_path: Path, documents: Sequence[Dict[str, Any]]) -> None:
    """Write scraped documents to a JSON payload."""
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "documents": list(documents),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Discover and scrape survival guide pages into JSON")
    parser.add_argument("--url", action="append", default=[], help="Guide URL to scrape directly; repeat as needed")
    parser.add_argument("--input", help="Optional text or JSON file containing URLs to scrape")
    parser.add_argument("--index-url", help="Optional index page used to discover guide URLs")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument("--category", default=DEFAULT_CATEGORY, help="Category label stored on each document")
    parser.add_argument("--source-name", help="Logical source name stored on each document")
    parser.add_argument("--allowed-domain", help="Restrict discovered links to this domain or its subdomains")
    parser.add_argument(
        "--link-pattern",
        help="Regex used to filter discovered links; defaults to a built-in survival-guide heuristic",
    )
    parser.add_argument("--limit", type=int, help="Maximum number of URLs to discover from --index-url")
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds for each request",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help="Delay between requests in seconds",
    )

    args = parser.parse_args(argv)
    if not args.url and not args.input and not args.index_url:
        parser.error("Provide at least one --url, --input, or --index-url")
    if args.limit is not None and args.limit <= 0:
        parser.error("--limit must be greater than 0")
    if args.timeout_seconds <= 0:
        parser.error("--timeout-seconds must be greater than 0")
    if args.delay_seconds < 0:
        parser.error("--delay-seconds cannot be negative")

    return args


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI entry point."""
    args = parse_args(argv)
    input_path = Path(args.input) if args.input else None

    seed_urls = load_seed_urls(urls=args.url, input_path=input_path)
    discovered_from_map: Dict[str, str] = {}

    if args.index_url:
        discovered_urls = discover_guide_urls(
            index_url=args.index_url,
            allowed_domain=args.allowed_domain,
            link_pattern=args.link_pattern,
            limit=args.limit,
            timeout_seconds=args.timeout_seconds,
        )
        for discovered_url in discovered_urls:
            discovered_from_map[discovered_url] = args.index_url
        seed_urls.extend(discovered_urls)

    all_urls = _unique_urls(seed_urls)
    if not all_urls:
        print("No URLs were provided or discovered.", file=sys.stderr)
        return 1

    source_name = args.source_name or _default_source_name([args.index_url or "", *all_urls])
    documents = scrape_urls(
        urls=all_urls,
        source_name=source_name,
        category=args.category,
        timeout_seconds=args.timeout_seconds,
        delay_seconds=args.delay_seconds,
        discovered_from_map=discovered_from_map,
    )
    if not documents:
        print("No documents were scraped successfully.", file=sys.stderr)
        return 1

    write_output(Path(args.output), documents)

    print(f"Scraped {len(documents)} documents -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())