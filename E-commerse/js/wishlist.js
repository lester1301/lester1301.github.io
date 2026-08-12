/* =========================
   WISHLIST
========================= */


/* =========================
   GET WISHLIST
========================= */

function getWishlist() {

    return JSON.parse(
        localStorage.getItem("wishlist")
    ) || [];

}


/* =========================
   SAVE WISHLIST
========================= */

function saveWishlist(wishlist) {

    localStorage.setItem(
        "wishlist",
        JSON.stringify(wishlist)
    );

}


/* =========================
   TOGGLE WISHLIST
========================= */

function toggleWishlist(productId) {

    const wishlist =
        getWishlist();

    const index =
        wishlist.indexOf(productId);


    if (index !== -1) {

        wishlist.splice(index, 1);

    }

    else {

        wishlist.push(productId);

    }


    saveWishlist(wishlist);

    updateWishlistButtons();

    updateWishlistCount();

}


/* =========================
   UPDATE HEART BUTTONS
========================= */

function updateWishlistButtons() {

    const wishlist =
        getWishlist();


    document
        .querySelectorAll(".wishlist-btn")
        .forEach(button => {

            const productId =
                Number(button.dataset.id);


            if (wishlist.includes(productId)) {

                button.classList.add("active");

                button.innerHTML = "♥";

                button.setAttribute(
                    "aria-label",
                    "Remove from wishlist"
                );

            }

            else {

                button.classList.remove("active");

                button.innerHTML = "♡";

                button.setAttribute(
                    "aria-label",
                    "Add to wishlist"
                );

            }

        });

}


/* =========================
   WISHLIST COUNT
========================= */

function updateWishlistCount() {

    const wishlist =
        getWishlist();


    document
        .querySelectorAll(".wishlist-count")
        .forEach(count => {

            count.textContent =
                wishlist.length;

        });

}


/* =========================
   HEART CLICK
========================= */

document.addEventListener(
    "click",
    function (event) {

        const button =
            event.target.closest(".wishlist-btn");


        if (!button) {
            return;
        }


        event.preventDefault();


        const productId =
            Number(button.dataset.id);


        toggleWishlist(productId);

    }
);


/* =========================
   INITIALIZE
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateWishlistButtons();

        updateWishlistCount();

    }
);