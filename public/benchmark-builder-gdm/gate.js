/* Gate on the builder.
 *
 * The check runs server-side at /apply/api/gate, which keeps the passphrase out
 * of this file and lets us record who came in. It is a doorbell and a guest
 * book, not access control: the page's data files are static and fetchable
 * directly whatever this says.
 *
 * Off tacitlabs.co the endpoint doesn't exist, so local preview falls back to a
 * client-side check — but only on localhost, so a failing endpoint in
 * production can't be used to walk straight in. */
(function () {
  var ENDPOINT = "/apply/api/gate";
  var LOCAL_PASS = "euler901";           // local preview only
  var form = document.getElementById("gate-form");
  var email = document.getElementById("gate-email");
  var input = document.getElementById("gate-input");
  var submit = document.getElementById("gate-submit");
  var err = document.getElementById("gate-error");
  var card = document.querySelector(".gate-card");
  if (!form) return;

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                location.protocol === "file:";

  var source = location.pathname.split("/").filter(Boolean)[0] || "gapmap";

  /* Hint at the address we expect, so nobody on one customer's page is shown
     another customer's domain. The rule itself is enforced server-side. */
  var HINTS = {
    "benchmark-builder-gdm": "you@google.com",
    "benchmark-builder-nvidia": "you@nvidia.com"
  };
  if (email && HINTS[source]) email.placeholder = HINTS[source];

  function unlock() {
    try { sessionStorage.setItem("gapmap_unlocked_" + source, "1"); } catch (e) {}
    document.documentElement.classList.remove("locked");
  }

  function fail(msg) {
    err.textContent = msg;
    err.hidden = false;
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    input.value = "";
    input.focus();
  }

  function busy(on) {
    submit.disabled = on;
    submit.textContent = on ? "Checking…" : "Continue →";
  }

  if (document.documentElement.classList.contains("locked")) {
    setTimeout(function () { email && email.focus(); }, 60);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var addr = (email.value || "").trim();
    var pass = (input.value || "").trim();
    if (!addr || !pass) return;

    busy(true);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: addr,
        passphrase: pass,
        source: source,
      }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { status: res.status, body: body };
      });
    }).then(function (r) {
      busy(false);
      if (r.status === 200) return unlock();
      if (r.status === 401 || r.status === 400) {
        return fail(r.body.error || "That didn't work. Please try again.");
      }
      /* endpoint reachable but unhappy */
      if (isLocal && pass === LOCAL_PASS) return unlock();
      fail("Couldn't verify those details just now. Please try again.");
    }).catch(function () {
      busy(false);
      /* endpoint missing entirely — local preview, or the site is offline */
      if (isLocal && pass === LOCAL_PASS) return unlock();
      fail("Couldn't reach the sign-in service. Please try again.");
    });
  });
})();
