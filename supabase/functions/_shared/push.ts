export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function importApnsKey(pem: string): Promise<CryptoKey> {
  const contents = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(contents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function b64url(input: string | ArrayBuffer): string {
  const str =
    typeof input === "string"
      ? btoa(input)
      : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function apnsJwt(teamId: string, keyId: string, key: CryptoKey): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function sendApnsPush(
  deviceToken: string,
  payload: PushPayload,
  bundleId = "com.ceilimelbourne.app"
): Promise<void> {
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");

  if (!teamId || !keyId || !privateKeyPem) {
    console.log("APNs not configured, skipping push");
    return;
  }

  try {
    const key = await importApnsKey(privateKeyPem);
    const jwt = await apnsJwt(teamId, keyId, key);
    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
      },
      ...payload.data,
    });
    const headers = {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    };

    let res = await fetch(`https://api.push.apple.com/3/device/${deviceToken}`, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403 && text.includes("BadEnvironmentKeyInToken")) {
        console.log("Production token mismatch, retrying with development endpoint...");
        res = await fetch(`https://api.development.push.apple.com/3/device/${deviceToken}`, { method: "POST", headers, body });
        if (!res.ok) {
          console.error("APNs dev error:", res.status, await res.text());
        } else {
          console.log("Push sent via dev endpoint:", deviceToken.slice(0, 8) + "...");
        }
      } else {
        console.error("APNs error:", res.status, text);
      }
    } else {
      console.log("Push sent:", deviceToken.slice(0, 8) + "...");
    }
  } catch (e) {
    console.error("sendApnsPush failed:", e);
  }
}
