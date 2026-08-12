/* =========================
   PRODUCT DETAILS PAGE
========================= */

const productDetails =
    document.getElementById("product-details");

const relatedProducts =
    document.getElementById("related-products");


/* =========================
   GET PRODUCT ID FROM URL
========================= */

const urlParams =
    new URLSearchParams(window.location.search);

const productId =
    Number(urlParams.get("id"));


/* =========================
   FIND PRODUCT
========================= */

const product =
    products.find(item => item.id === productId);


/* =========================
   DISPLAY PRODUCT
========================= */

function displayProduct(product) {

    if (!product) {

        productDetails.innerHTML = `
            <div class="empty-products">
                <div class="empty-icon">😕</div>

                <h2>
                    Product Not Found
                </h2>

                <p>
                    The product you're looking for
                    doesn't exist.
                </p>

                <br>

                <a
                    href="products.html"
                    class="btn btn-primary"
                >
                    Back to Products
                </a>
            </div>
        `;

        return;
    }


    productDetails.innerHTML = `

        <!-- Product Image -->

        <div class="details-image">

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
            >

        </div>


        <!-- Product Information -->

        <div class="details-content">

            <p class="details-category">
                ${product.categoryName}
            </p>


            <h1>
                ${product.name}
            </h1>


            <div class="details-rating">

                <span class="details-stars">
                    ${"★".repeat(Math.floor(product.rating))}
                </span>

                <span>
                    ${product.rating} (${product.reviews} reviews)
                </span>

            </div>


            <p class="details-price">
                NPR ${product.price.toLocaleString()}
            </p>


            <p class="details-description">
                Experience quality, comfort and style with
                our ${product.name}. Carefully selected for
                everyday use, this product combines modern
                design with reliable performance.
            </p>


            <div class="details-divider"></div>


            <!-- Quantity -->

            <div class="quantity-wrapper">

                <label>
                    Quantity
                </label>

                <div class="quantity-control">

                    <button
                        id="quantity-minus"
                        type="button"
                    >
                        −
                    </button>

                    <span id="quantity">
                        1
                    </span>

                    <button
                        id="quantity-plus"
                        type="button"
                    >
                        +
                    </button>

                </div>

            </div>


            <!-- Actions -->

            <div class="details-actions">

                <button
                    class="details-add-cart"
                    id="details-add-cart"
                    type="button"
                >
                    🛒 Add to Cart
                </button>

                <button
                    class="details-wishlist"
                    type="button"
                    aria-label="Add to wishlist"
                >
                    ♡
                </button>

            </div>

        </div>

    `;


    setupQuantity();

    setupAddToCart();

}


/* =========================
   QUANTITY
========================= */

function setupQuantity() {

    const quantityElement =
        document.getElementById("quantity");

    const minusButton =
        document.getElementById("quantity-minus");

    const plusButton =
        document.getElementById("quantity-plus");


    let quantity = 1;


    plusButton.addEventListener(
        "click",
        () => {

            if (quantity < 10) {

                quantity++;

                quantityElement.textContent =
                    quantity;
            }

        }
    );


    minusButton.addEventListener(
        "click",
        () => {

            if (quantity > 1) {

                quantity--;

                quantityElement.textContent =
                    quantity;
            }

        }
    );

}


/* =========================
   ADD TO CART
========================= */

function setupAddToCart() {

    const addButton =
        document.getElementById("details-add-cart");

    addButton.addEventListener(
        "click",
        () => {

            const quantity =
                Number(
                    document.getElementById("quantity")
                        .textContent
                );


            addToCart(product, quantity);

        }
    );

}


/* =========================
   CART FUNCTION
========================= */

function addToCart(product, quantity) {

    let cart =
        JSON.parse(
            localStorage.getItem("cart")
        ) || [];


    const existingProduct =
        cart.find(
            item => item.id === product.id
        );


    if (existingProduct) {

        existingProduct.quantity += quantity;

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price: product.price,

            image: product.image,

            quantity: quantity

        });

    }


    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );


    updateCartCount();


    /* Button feedback */

    const addButton =
        document.getElementById("details-add-cart");

    addButton.textContent =
        "✓ Added to Cart";

    addButton.style.background =
        "#25a56a";


    setTimeout(() => {

        addButton.textContent =
            "🛒 Add to Cart";

        addButton.style.background =
            "";

    }, 1500);

}


/* =========================
   CART COUNT
========================= */

function updateCartCount() {

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
   RELATED PRODUCTS
========================= */

function displayRelatedProducts() {

    if (!product || !relatedProducts) {
        return;
    }


    const related =
        products
            .filter(item =>
                item.category === product.category &&
                item.id !== product.id
            )
            .slice(0, 4);


    relatedProducts.innerHTML = "";


    related.forEach(item => {

        const card =
            document.createElement("article");

        card.className =
            "product-card";


        card.innerHTML = `

            <div class="product-image">

                ${
                    item.badge
                        ? `
                            <span class="product-badge ${
                                item.badge === "SALE" ||
                                item.badge.includes("%")
                                    ? "sale"
                                    : ""
                            }">
                                ${item.badge}
                            </span>
                        `
                        : ""
                }

                <img
                    src="${item.image}"
                    alt="${item.name}"
                    loading="lazy"
                >

                <button
                    class="wishlist-btn"
                    type="button"
                >
                    ♡
                </button>

            </div>


            <div class="product-info">

                <p class="product-category">
                    ${item.categoryName}
                </p>

                <h3>
                    ${item.name}
                </h3>

                <div class="product-rating">

                    ${"★".repeat(Math.floor(item.rating))}

                    <span>
                        (${item.reviews})
                    </span>

                </div>

                <div class="product-bottom">

                    <p class="product-price">
                        NPR ${item.price.toLocaleString()}
                    </p>

                    <a
                        href="product.html?id=${item.id}"
                        class="add-cart-btn"
                    >
                        View
                    </a>

                </div>

            </div>

        `;


        relatedProducts.appendChild(card);

    });

}


/* =========================
   INITIALIZE PAGE
========================= */

if (productDetails) {

    displayProduct(product);

    displayRelatedProducts();

}

updateCartCount();