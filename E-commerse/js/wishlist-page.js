/* =========================
   WISHLIST PAGE
========================= */


/* =========================
   ELEMENTS
========================= */

const wishlistContainer =
    document.getElementById("wishlist-container");

const emptyWishlist =
    document.getElementById("empty-wishlist");

const wishlistCount =
    document.getElementById("wishlist-count");


/* =========================
   DISPLAY WISHLIST
========================= */

function displayWishlist() {

    if (!wishlistContainer) {
        return;
    }


    const wishlist =
        getWishlist();


    /* Clear old products */

    wishlistContainer.innerHTML = "";


    /* =========================
       EMPTY WISHLIST
    ========================= */

    if (wishlist.length === 0) {

        emptyWishlist.style.display =
            "block";

        wishlistCount.textContent =
            "0 items";

        return;
    }


    emptyWishlist.style.display =
        "none";


    /* =========================
       FIND PRODUCTS
    ========================= */

    const wishlistProducts =
        products.filter(product =>
            wishlist.includes(product.id)
        );


    /* =========================
       CREATE PRODUCT CARDS
    ========================= */

    wishlistProducts.forEach(product => {

        const card =
            document.createElement("article");

        card.className =
            "product-card wishlist-card";


        card.innerHTML = `

            <div class="product-image">

                ${
                    product.badge
                        ? `
                            <span class="product-badge ${
                                product.badge === "SALE" ||
                                product.badge.includes("%")
                                    ? "sale"
                                    : ""
                            }">
                                ${product.badge}
                            </span>
                        `
                        : ""
                }


                <img
                    src="${product.image}"
                    alt="${product.name}"
                    loading="lazy"
                >


                <button
                    class="wishlist-btn active"
                    data-id="${product.id}"
                    type="button"
                    aria-label="Remove from wishlist"
                >
                    ♥
                </button>

            </div>


            <div class="product-info">

                <p class="product-category">
                    ${product.categoryName}
                </p>


                <h3>
                    ${product.name}
                </h3>


                <div class="product-rating">

                    ${"★".repeat(
                        Math.floor(product.rating)
                    )}

                    <span>
                        (${product.reviews})
                    </span>

                </div>


                <div class="product-bottom">

    <p class="product-price">
        NPR ${product.price.toLocaleString()}
    </p>

    <a
        href="product.html?id=${product.id}"
        class="add-cart-btn"
    >
        View
    </a>

</div>

<button
    class="wishlist-add-cart-btn"
    data-id="${product.id}"
    type="button"
>
    🛒 Add to Cart
</button>


                <button
                    class="wishlist-remove-btn"
                    data-id="${product.id}"
                    type="button"
                >
                    Remove from Wishlist
                </button>

            </div>

        `;


        wishlistContainer.appendChild(card);

    });


    /* =========================
       UPDATE COUNT
    ========================= */

    wishlistCount.textContent =
        `${wishlistProducts.length} ${
            wishlistProducts.length === 1
                ? "item"
                : "items"
        }`;

}


/* =========================
   REMOVE BUTTON
========================= */

document.addEventListener(
    "click",
    function (event) {

        const removeButton =
            event.target.closest(
                ".wishlist-remove-btn"
            );


        if (!removeButton) {
            return;
        }


        const productId =
            Number(removeButton.dataset.id);


        const wishlist =
            getWishlist();


        const updatedWishlist =
            wishlist.filter(
                id => id !== productId
            );


        saveWishlist(
            updatedWishlist
        );


        displayWishlist();

        updateWishlistCount();

    }
);


/* =========================
   HEART BUTTON
========================= */

document.addEventListener(
    "click",
    function (event) {

        const heart =
            event.target.closest(
                "#wishlist-container .wishlist-btn"
            );


        if (!heart) {
            return;
        }


        event.preventDefault();


        const productId =
            Number(heart.dataset.id);


        toggleWishlist(productId);


        displayWishlist();

    }
);


/* =========================
   INITIAL LOAD
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        displayWishlist();

    }
);

/* =========================
   ADD WISHLIST PRODUCT TO CART
========================= */

function addWishlistProductToCart(productId) {

    const product =
        products.find(
            item => item.id === productId
        );


    if (!product) {
        return;
    }


    let cart =
        JSON.parse(
            localStorage.getItem("cart")
        ) || [];


    const existingProduct =
        cart.find(
            item => item.id === product.id
        );


    /* Product already in cart */

    if (existingProduct) {

        existingProduct.quantity += 1;

    }


    /* New product */

    else {

        cart.push({

            id: product.id,

            name: product.name,

            price: product.price,

            image: product.image,

            quantity: 1

        });

    }


    /* Save cart */

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );


    /* Update cart count */

    updateWishlistCartCount();


    /* Button feedback */

    const button =
        document.querySelector(
            `.wishlist-add-cart-btn[data-id="${productId}"]`
        );


    if (button) {

        button.textContent =
            "✓ Added to Cart";

        button.classList.add("added");


        setTimeout(() => {

            button.textContent =
                "🛒 Add to Cart";

            button.classList.remove("added");

        }, 1500);

    }

}
/* =========================
   UPDATE CART COUNT
========================= */

function updateWishlistCartCount() {

    const cart =
        JSON.parse(
            localStorage.getItem("cart")
        ) || [];


    const totalItems =
        cart.reduce(
            (total, item) =>
                total + item.quantity,
            0
        );


    document
        .querySelectorAll(".cart-count")
        .forEach(count => {

            count.textContent =
                totalItems;

        });

}
/* =========================
   ADD TO CART BUTTON EVENT
========================= */

document.addEventListener(
    "click",
    function (event) {

        const button =
            event.target.closest(
                ".wishlist-add-cart-btn"
            );


        if (!button) {
            return;
        }


        const productId =
            Number(button.dataset.id);


        addWishlistProductToCart(
            productId
        );

    }
);
