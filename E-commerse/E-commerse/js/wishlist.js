/* Wishlist page */
(function () {
    const { $, App, Catalog, Wishlist, productCard, icon, link } = SE;

    function render() {
        const ids = Wishlist.ids();
        const items = ids.map((id) => Catalog.byId(id)).filter(Boolean);
        $("#wish-count").textContent = items.length ? `${items.length} saved ${items.length === 1 ? "item" : "items"}` : "";
        $("#wish-grid").innerHTML = items.length
            ? items.map(productCard).join("")
            : `<div class="empty" style="grid-column:1/-1">${icon("heart")}<h2>Your wishlist is empty</h2><p>Tap the heart on any product to save it here for later.</p><a class="btn btn-primary" href="${link("products.html")}">Browse products</a></div>`;
        Wishlist.paint();
    }

    App.start(() => {
        Catalog.subscribe(render);
        // re-render when an item is removed from the list
        window.addEventListener("wishlist:change", render);
    });
})();
