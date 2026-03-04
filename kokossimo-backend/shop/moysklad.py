import base64
import gzip
import json
import socket
import ssl
import time
from urllib.parse import urlparse, parse_qs, urljoin
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from django.conf import settings


class MoySkladError(Exception):
    """Ошибка при запросе к API МойСклад."""


class MoySkladConfigError(MoySkladError):
    """Ошибка конфигурации интеграции МойСклад."""


class MoySkladClient:
    def __init__(self):
        self.base_url = getattr(
            settings,
            "MOYSKLAD_API_BASE_URL",
            "https://api.moysklad.ru/api/remap/1.2",
        ).rstrip("/")
        self.login = getattr(settings, "MOYSKLAD_LOGIN", "")
        self.password = getattr(settings, "MOYSKLAD_PASSWORD", "")
        self.token = getattr(settings, "MOYSKLAD_TOKEN", "")
        self.timeout = int(getattr(settings, "MOYSKLAD_TIMEOUT_SECONDS", 15))
        self.verify_ssl = bool(getattr(settings, "MOYSKLAD_VERIFY_SSL", True))
        self.max_retries = max(0, int(getattr(settings, "MOYSKLAD_MAX_RETRIES", 3)))
        self.retry_delay_seconds = max(0.2, float(getattr(settings, "MOYSKLAD_RETRY_DELAY_SECONDS", 1.5)))

        if self.token:
            self._auth_header = f"Bearer {self.token}"
        elif self.login and self.password:
            token = base64.b64encode(f"{self.login}:{self.password}".encode("utf-8")).decode("ascii")
            self._auth_header = f"Basic {token}"
        else:
            raise MoySkladConfigError(
                "Интеграция не настроена: укажите MOYSKLAD_TOKEN или пару MOYSKLAD_LOGIN/MOYSKLAD_PASSWORD."
            )

    def _request(self, method, path, query=None):
        if not path.startswith("/"):
            path = f"/{path}"

        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"

        request = Request(
            url=url,
            method=method.upper(),
            headers={
                "Authorization": self._auth_header,
                "Accept-Encoding": "gzip",
                "Content-Type": "application/json",
            },
        )

        ssl_context = ssl.create_default_context() if self.verify_ssl else ssl._create_unverified_context()

        attempts = self.max_retries + 1
        for attempt in range(1, attempts + 1):
            try:
                with urlopen(request, timeout=self.timeout, context=ssl_context) as response:
                    raw_payload = response.read()
                    content_encoding = (response.headers.get("Content-Encoding") or "").lower()
                    if "gzip" in content_encoding:
                        raw_payload = gzip.decompress(raw_payload)

                    payload = raw_payload.decode("utf-8")
                    if not payload.strip():
                        return {}
                    try:
                        return json.loads(payload)
                    except json.JSONDecodeError as exc:
                        raise MoySkladError("API МойСклад вернул невалидный JSON-ответ.") from exc
            except HTTPError as exc:
                body = exc.read().decode("utf-8", errors="ignore")
                retryable_http = exc.code in (429, 500, 502, 503, 504)
                if retryable_http and attempt < attempts:
                    time.sleep(self.retry_delay_seconds * attempt)
                    continue
                raise MoySkladError(
                    f"API МойСклад вернул HTTP {exc.code}: {body or exc.reason}"
                ) from exc
            except (URLError, TimeoutError, socket.timeout, ConnectionResetError) as exc:
                if attempt < attempts:
                    time.sleep(self.retry_delay_seconds * attempt)
                    continue
                reason = getattr(exc, "reason", str(exc))
                raise MoySkladError(f"Не удалось подключиться к API МойСклад: {reason}") from exc

    def _ssl_context(self):
        return ssl.create_default_context() if self.verify_ssl else ssl._create_unverified_context()

    def _absolute_href(self, href):
        parsed = urlparse(href or "")
        if parsed.scheme and parsed.netloc:
            return href
        return urljoin(f"{self.base_url}/", str(href or "").lstrip("/"))

    def ping(self):
        # Минимальный запрос для проверки авторизации и доступности API.
        return self._request("GET", "/entity/assortment", query={"limit": 1, "offset": 0})

    def get_assortment(self, limit=20, offset=0, search="", filter_expr=""):
        query = {"limit": max(1, min(int(limit), 100)), "offset": max(0, int(offset))}
        if search:
            query["search"] = search.strip()
        if filter_expr:
            query["filter"] = filter_expr.strip()
        # Явно разворачиваем папку, иначе в некоторых ответах нет корректной связи с productFolder.
        query["expand"] = "images,productFolder"
        return self._request("GET", "/entity/assortment", query=query)

    def get_assortment_item(self, external_id):
        # Для assortment безопаснее искать через filter=id=..., а не /assortment/{id}.
        payload = self._request(
            "GET",
            "/entity/assortment",
            query={"filter": f"id={external_id}", "limit": 1, "offset": 0, "expand": "images,productFolder"},
        )
        rows = payload.get("rows", []) or []
        return rows[0] if rows else {}

    def get_product_folders(self, limit=100, offset=0):
        query = {"limit": max(1, min(int(limit), 1000)), "offset": max(0, int(offset))}
        return self._request("GET", "/entity/productfolder", query=query)

    def _path_from_href(self, href):
        parsed = urlparse(href)
        path = parsed.path
        base_path = urlparse(self.base_url).path.rstrip("/")
        if path.startswith(base_path):
            path = path[len(base_path):]
        if not path.startswith("/"):
            path = f"/{path}"
        query = {k: v[-1] for k, v in parse_qs(parsed.query).items() if v}
        return path, query

    def get_images_rows_from_meta(self, images_meta, limit=1):
        href = (images_meta or {}).get("href")
        if not href:
            return []
        path, query = self._path_from_href(href)
        query["limit"] = str(limit)
        payload = self._request("GET", path, query=query)
        return payload.get("rows", []) or []

    def download_binary(self, href):
        if not href:
            raise MoySkladError("Пустая ссылка на изображение.")

        url = self._absolute_href(href)
        request = Request(
            url=url,
            method="GET",
            headers={
                "Authorization": self._auth_header,
                "Accept-Encoding": "identity",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout, context=self._ssl_context()) as response:
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                payload = response.read()
                return payload, content_type
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise MoySkladError(
                f"Не удалось скачать изображение (HTTP {exc.code}): {body or exc.reason}"
            ) from exc
        except URLError as exc:
            raise MoySkladError(f"Ошибка сети при скачивании изображения: {exc.reason}") from exc
