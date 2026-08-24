/**
 * Sign in to Microsoft 365 (including GCC High) from the HTML app.
 * Device-code flow — works with a public-client app registration.
 */
(function (root) {
  const TOKEN_KEY = "capacity-tracker.token.v1";

  function cloudFromSite(siteUrl) {
    const gov = /sharepoint\.us/i.test(siteUrl || "") || /microsoftonline\.us/i.test(siteUrl || "");
    if (gov) {
      return {
        login: "https://login.microsoftonline.us",
        graph: "https://graph.microsoft.us",
        scope: "https://graph.microsoft.us/Sites.ReadWrite.All offline_access"
      };
    }
    return {
      login: "https://login.microsoftonline.com",
      graph: "https://graph.microsoft.com",
      scope: "https://graph.microsoft.com/Sites.ReadWrite.All offline_access"
    };
  }

  function readToken() {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeToken(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    } catch (err) {
      /* ignore */
    }
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function isExpired(token) {
    if (!token || !token.access_token) return true;
    const exp = Number(token.expires_at || 0);
    return Date.now() > exp - 60 * 1000;
  }

  async function formPost(url, params) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString()
    });
    const body = await response.json().catch(function () {
      return {};
    });
    if (!response.ok && body.error !== "authorization_pending" && body.error !== "slow_down") {
      throw new Error(body.error_description || body.error || "Sign-in failed");
    }
    return body;
  }

  const CapacityAuth = {
    cloudFromSite: cloudFromSite,

    hasToken() {
      return !isExpired(readToken());
    },

    getAccessToken() {
      const token = readToken();
      return token && !isExpired(token) ? token.access_token : "";
    },

    signOut() {
      clearToken();
    },

    async requestDeviceCode(settings) {
      const cloud = cloudFromSite(settings.sharepointSiteUrl);
      const tenant = String(settings.tenantId || "organizations").trim() || "organizations";
      const clientId = String(settings.clientId || "").trim();
      if (!clientId) throw new Error("Paste the Application (client) ID from IT first.");
      const body = await formPost(cloud.login + "/" + tenant + "/oauth2/v2.0/devicecode", {
        client_id: clientId,
        scope: cloud.scope
      });
      if (!body.device_code) throw new Error(body.error_description || "Could not start sign-in.");
      return {
        deviceCode: body.device_code,
        userCode: body.user_code,
        verifyUrl: body.verification_uri || body.verification_uri_complete,
        interval: Math.max(5, Number(body.interval) || 5),
        expiresIn: Number(body.expires_in) || 900,
        cloud: cloud,
        tenant: tenant,
        clientId: clientId
      };
    },

    async waitForToken(challenge) {
      const url = challenge.cloud.login + "/" + challenge.tenant + "/oauth2/v2.0/token";
      const started = Date.now();
      let wait = challenge.interval * 1000;
      while (Date.now() - started < challenge.expiresIn * 1000) {
        await new Promise(function (resolve) {
          setTimeout(resolve, wait);
        });
        const body = await formPost(url, {
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: challenge.clientId,
          device_code: challenge.deviceCode
        });
        if (body.access_token) {
          const token = {
            access_token: body.access_token,
            refresh_token: body.refresh_token || "",
            expires_at: Date.now() + Number(body.expires_in || 3600) * 1000
          };
          writeToken(token);
          return token;
        }
        if (body.error === "slow_down") wait += 2000;
      }
      throw new Error("Sign-in timed out. Try again.");
    }
  };

  root.CapacityAuth = CapacityAuth;
})(typeof globalThis !== "undefined" ? globalThis : this);
