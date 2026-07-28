/* Soft password gate. Client-side only — keeps the page unlisted, not secured. */
(function () {
  var PASS = "euler901";
  var form = document.getElementById("gate-form");
  var input = document.getElementById("gate-input");
  var err = document.getElementById("gate-error");
  var card = document.querySelector(".gate-card");

  function unlock() {
    try { sessionStorage.setItem("gapmap_unlocked", "1"); } catch (e) {}
    document.documentElement.classList.remove("locked");
  }

  if (!form) return;
  if (document.documentElement.classList.contains("locked")) {
    setTimeout(function () { input && input.focus(); }, 60);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.value === PASS) {
      unlock();
    } else {
      err.hidden = false;
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      input.value = "";
      input.focus();
    }
  });
})();
