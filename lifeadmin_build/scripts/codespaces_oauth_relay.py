"""Private Codespaces browser relay for a manual rclone OAuth rehearsal.

Development only. No credentials, tokens, or backup data are stored here.
Do not forward rclone's own port 53682: Codespaces probes of its root URL can
be mistaken for OAuth callbacks and terminate rclone without a code.

Run in a separate Codespaces terminal:
    python3 lifeadmin_build/scripts/codespaces_oauth_relay.py

Forward ONLY port 53683 as Private. Open its HTTPS URL in iPad Safari.
Paste the localhost /auth link from a running rclone authorize session into
the Start form. After Google redirects to an unreachable localhost URL,
copy that entire URL into the Finish form. This relay sends it to rclone
over loopback, without putting the one-time code into the forwarded URL.
"""
from __future__ import annotations

import html
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

RELAY_PORT = 53683
RCLONE_PORT = 53682
MAX_FORM_BYTES = 8192


def validate_local_url(value: str, path: str, required: str) -> str:
    """Accept only rclone's exact loopback address and expected query."""
    url = urlsplit(value.strip())
    if (
        url.scheme != "http"
        or url.hostname not in ("127.0.0.1", "localhost")
        or url.port != RCLONE_PORT
        or url.path != path
        or url.username is not None
        or url.password is not None
        or url.fragment
    ):
        raise ValueError("This is not the expected rclone localhost URL.")
    params = parse_qs(url.query, keep_blank_values=True)
    if not params.get("state") or not params.get(required):
        raise ValueError("The rclone URL is missing its authorisation fields.")
    if any(len(v) != 1 for v in params.values()):
        raise ValueError("Unexpected repeated authorisation fields.")
    return url.path + "?" + url.query


def local_rclone_request(target: str) -> tuple[int, str | None]:
    connection = http.client.HTTPConnection("127.0.0.1", RCLONE_PORT, timeout=15)
    try:
        connection.request("GET", target, headers={"Host": "127.0.0.1:53682"})
        response = connection.getresponse()
        location = response.getheader("Location")
        response.read()
        return response.status, location
    finally:
        connection.close()


def page(message: str = "") -> bytes:
    notice = f"<p role='status'>{html.escape(message)}</p>" if message else ""
    return f"""<!doctype html>
<html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LifeAdmin test-only Google authorisation relay</title>
<style>
body{{font:17px system-ui,sans-serif;max-width:620px;margin:2em auto;padding:0 1em;line-height:1.5}}
input{{box-sizing:border-box;width:100%;font:16px system-ui;padding:.7em;margin:.4em 0}}
button{{font:16px system-ui;padding:.7em 1em;margin:.5em 0 1.5em}}
small{{display:block;color:#555}}
</style>
<h2>LifeAdmin: private Google sign-in helper</h2>
<p>This is a temporary, test-only helper. Never paste passwords, client secrets or access tokens here.</p>
{notice}
<h3>1. Start Google sign-in</h3>
<p>Paste the complete <code>http://127.0.0.1:53682/auth?state=...</code>
link printed by the running <code>rclone authorize</code> terminal.</p>
<form method="post" action="/start" autocomplete="off">
<label>Rclone authorisation link<input name="authorization_url" required></label>
<button type="submit">Open Google sign-in</button></form>
<h3>2. Finish after Google approval</h3>
<p>Google will redirect Safari to a localhost address that cannot load on the iPad.
Copy that complete address from Safari, return to this page, and paste it below.</p>
<form method="post" action="/finish" autocomplete="off">
<label>Failed localhost callback address<input name="callback_url" required></label>
<button type="submit">Send code privately to rclone</button></form>
<small>Private Codespaces port 53683 only. Nothing is saved to disk. Do not
share callback URLs or terminal token output in chat or screenshots.</small>
</html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        # Do not print request paths, form fields or one-time OAuth codes.
        pass

    def respond(self, status: int, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
        )
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/":
            self.respond(200, page())
        else:
            self.respond(404, page("Page not found."))

    def do_POST(self) -> None:
        route = urlsplit(self.path).path
        if route not in ("/start", "/finish"):
            self.respond(404, page("Page not found."))
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_FORM_BYTES:
                raise ValueError("The submitted address is too long or missing.")
            form = parse_qs(self.rfile.read(size).decode("utf-8"), keep_blank_values=True)
            field = "authorization_url" if route == "/start" else "callback_url"
            values = form.get(field, [])
            if len(values) != 1:
                raise ValueError("Paste one complete localhost URL.")
            target = validate_local_url(
                values[0], "/auth" if route == "/start" else "/",
                "state" if route == "/start" else "code",
            )
            status, location = local_rclone_request(target)
            if route == "/start":
                if status not in (301, 302, 303, 307, 308) or not location:
                    raise ValueError("Rclone did not return a Google sign-in link.")
                if urlsplit(location).scheme != "https" or urlsplit(location).hostname not in (
                    "accounts.google.com", "www.google.com"
                ):
                    raise ValueError("Rclone returned an unexpected sign-in destination.")
                self.send_response(303)
                self.send_header("Location", location)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Referrer-Policy", "no-referrer")
                self.end_headers()
            elif status == 200:
                self.respond(200, page("Callback delivered. Check the rclone authorize terminal. Do not share its token output."))
            else:
                raise ValueError("Rclone did not accept the callback.")
        except (ValueError, OSError, http.client.HTTPException) as exc:
            # Do not include exception details: they may contain a token URL.
            self.respond(400, page("Unable to continue. Check that rclone is still waiting for code and the localhost URL is complete."))


if __name__ == "__main__":
    print("Private OAuth relay listening on 127.0.0.1:53683")
    print("Forward port 53683 as Private. Do NOT forward rclone port 53682.")
    print("No authorisation codes, client secrets or tokens will be logged.")
    ThreadingHTTPServer(("127.0.0.1", RELAY_PORT), Handler).serve_forever()
