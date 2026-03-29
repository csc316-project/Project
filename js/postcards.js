/**
 * Postcard interactions:
 * 1) Accordion behavior: only one postcard open at a time.
 * 2) Add a "Flip back" button on the content side.
 */
(function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".postcard"));
    if (!cards.length) return;

    function closeOthers(activeCard) {
        cards.forEach(function (card) {
            if (card !== activeCard) card.removeAttribute("open");
        });
    }

    cards.forEach(function (card) {
        var content = card.querySelector(".postcard-content");

        if (content && !content.querySelector(".postcard-close")) {
            var closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "postcard-close";
            closeBtn.textContent = "Flip back";
            closeBtn.addEventListener("click", function (ev) {
                ev.preventDefault();
                card.removeAttribute("open");
            });
            content.insertBefore(closeBtn, content.firstChild);
        }

        card.addEventListener("toggle", function () {
            // if (card.open) closeOthers(card);
        });
    });
})();
