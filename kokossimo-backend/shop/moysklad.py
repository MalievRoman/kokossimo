import base64
import gzip
import json
import socket
import ssl
import time
from urllib.parse import urlparse, parse_qs, urljoin, urlunparse
from urllib.parse import urlencode
from urllib.request import Request, urlopen, build_opener, HTTPErrorProcessor, HTTPRedirectHandler, HTTPSHandler
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
        self._basic_auth_header = ""
        if self.login and self.password:
            basic_token = base64.b64encode(f"{self.login}:{self.password}".encode("utf-8")).decode("ascii")
            self._basic_auth_header = f"Basic {basic_token}"

        if self.token:
            self._auth_header = f"Bearer {self.token}"
        elif self.login and self.password:
            self._auth_header = self._basic_auth_header
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

    def _binary_url_candidates(self, href):
        absolute = self._absolute_href(href)
        candidates = [absolute]
        parsed = urlparse(absolute)
        path = parsed.path or ""
        if path and not path.endswith("/download"):
            with_download = urlunparse(parsed._replace(path=f"{path.rstrip('/')}/download"))
            candidates.append(with_download)
        elif path.endswith("/download"):
            without_download = urlunparse(parsed._replace(path=path[:-9]))
            candidates.append(without_download)

        uniq = []
        seen = set()
        for url in candidates:
            if url and url not in seen:
                uniq.append(url)
                seen.add(url)
        return uniq

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

    def get_image_by_href(self, href):
        """Загружает сущность изображения по meta.href и возвращает её (с meta.downloadHref для оригинала)."""
        if not href:
            return {}
        path, query = self._path_from_href(href)
        return self._request("GET", path, query=query or None)

    def get_entity_by_href(self, href, expand=None):
        """Загружает сущность по meta.href (например, товар с expand=images)."""
        if not href:
            return {}
        path, query = self._path_from_href(href)
        if expand:
            query = dict(query) if query else {}
            query["expand"] = expand
        return self._request("GET", path, query=query if query else None)

    def _download_via_api_download(self, url, auth_headers):
        """Запрос к api.moysklad.ru/download/ с Accept: application/json;charset=utf-8.
        Сервер может вернуть 302 на бинарный файл или 200 с JSON с URL.
        Редирект обрабатываем вручную и запрашиваем Location с Accept: image/*.
        """
        class NoRedirect(HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        ssl_context = self._ssl_context()
        for auth_header in auth_headers:
            headers = {
                "Accept": "application/json;charset=utf-8",
                "Accept-Encoding": "gzip",
            }
            if auth_header:
                headers["Authorization"] = auth_header
            try:
                request = Request(url, method="GET", headers=headers)
                opener = build_opener(
                    NoRedirect,
                    HTTPSHandler(context=ssl_context),
                    HTTPErrorProcessor(),
                )
                response = opener.open(request, timeout=self.timeout)
                content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                payload = response.read()
                enc = (response.headers.get("Content-Encoding") or "").lower()
                if "gzip" in enc and payload:
                    try:
                        payload = gzip.decompress(payload)
                    except Exception:
                        pass
                if content_type.startswith("image/") and payload:
                    return payload, response.headers.get("Content-Type", "application/octet-stream")
                if content_type == "application/json" and payload:
                    try:
                        data = json.loads(payload.decode("utf-8", errors="replace"))
                        redirect_url = (
                            (data.get("meta") or {}).get("downloadHref")
                            or data.get("url")
                            or data.get("downloadUrl")
                            or (data.get("meta") or {}).get("href")
                        )
                        if redirect_url:
                            out = self._fetch_binary_from_url(redirect_url, auth_headers)
                            if out is not None:
                                return out
                    except (json.JSONDecodeError, KeyError, TypeError):
                        pass
            except HTTPError as exc:
                if exc.code in (301, 302, 303, 307) and exc.headers.get("Location"):
                    location = exc.headers.get("Location")
                    if location:
                        location = urljoin(url, location)
                        out = self._fetch_binary_from_url(location, auth_headers)
                        if out is not None:
                            return out
                continue
            except (URLError, TimeoutError, socket.timeout, ConnectionResetError):
                continue
        return None

    def _fetch_binary_from_url(self, target_url, auth_headers):
        """Скачивает бинарный файл по URL (например, после редиректа 302).
        Временные URL хранилища часто работают только без Authorization — пробуем без auth первым.
        """
        ssl_context = self._ssl_context()
        # Сначала без auth (temp URL с подписью), затем с auth
        order = [""] + [h for h in auth_headers if h]
        for auth_header in order:
            headers = {"Accept": "image/*", "Accept-Encoding": "identity"}
            if auth_header:
                headers["Authorization"] = auth_header
            try:
                request = Request(target_url, method="GET", headers=headers)
                with urlopen(request, timeout=self.timeout, context=ssl_context) as response:
                    ct = response.headers.get("Content-Type", "application/octet-stream")
                    payload = response.read()
                    if (ct or "").lower().startswith("image/") and payload:
                        return payload, ct
            except (HTTPError, URLError, TimeoutError, socket.timeout, ConnectionResetError):
                continue
        return None

    def download_binary(self, href):
        if not href:
            raise MoySkladError("Пустая ссылка на изображение.")

        urls_to_try = self._binary_url_candidates(href)
        auth_headers = [self._auth_header]
        if (
            self._basic_auth_header
            and self._basic_auth_header not in auth_headers
        ):
            auth_headers.append(self._basic_auth_header)
        auth_headers.append("")

        # Эндпоинт api.moysklad.ru/download/ принимает только Accept: application/json;charset=utf-8.
        for url in urls_to_try:
            if "api.moysklad.ru" in (url or "") and "/download" in (url or ""):
                result = self._download_via_api_download(url, auth_headers)
                if result is not None:
                    return result
                break

        accept_headers = [
            "image/*",
            "image/png, image/jpeg, image/gif, image/webp",
            "*/*",
        ]
        # С декабря 2023 api.moysklad.ru требует Accept-Encoding: gzip, иначе 415.
        last_http_error = None
        last_network_error = ""
        network_attempts = self.max_retries + 1
        ssl_context = self._ssl_context()

        for url in urls_to_try:
            if "api.moysklad.ru" in (url or "") and "/download" in (url or ""):
                continue
            accept_encoding = "identity"
            for auth_header in auth_headers:
                for accept_header in accept_headers:
                    headers = {
                        "Accept": accept_header,
                        "Accept-Encoding": accept_encoding,
                    }
                    if auth_header:
                        headers["Authorization"] = auth_header

                    for net_try in range(1, network_attempts + 1):
                        request = Request(
                            url=url,
                            method="GET",
                            headers=headers,
                        )
                        try:
                            with urlopen(request, timeout=self.timeout, context=ssl_context) as response:
                                content_type = response.headers.get("Content-Type", "application/octet-stream")
                                payload = response.read()
                                enc_resp = (response.headers.get("Content-Encoding") or "").lower()
                                if "gzip" in enc_resp and payload:
                                    try:
                                        payload = gzip.decompress(payload)
                                    except Exception:
                                        pass
                                if content_type.lower().startswith("image/") and payload:
                                    return payload, content_type
                                last_http_error = (415, f"Неверный content-type для media: {content_type}")
                                break
                        except HTTPError as exc:
                            body = exc.read().decode("utf-8", errors="ignore")
                            last_http_error = (exc.code, body or exc.reason)
                            break
                        except (URLError, TimeoutError, socket.timeout, ConnectionResetError) as exc:
                            reason = getattr(exc, "reason", str(exc))
                            last_network_error = str(reason)
                            if net_try < network_attempts:
                                time.sleep(self.retry_delay_seconds * net_try)
                                continue
                            break
                    if last_http_error and last_http_error[0] == 415:
                        continue
                    break
                if last_http_error and last_http_error[0] == 415:
                    continue
                break
            if last_network_error:
                break

        if last_http_error:
            code, body = last_http_error
            raise MoySkladError(f"Не удалось скачать изображение (HTTP {code}): {body}")

        if last_network_error:
            raise MoySkladError(f"Ошибка сети при скачивании изображения: {last_network_error}")

        raise MoySkladError("Не удалось скачать изображение: неизвестная ошибка.")
