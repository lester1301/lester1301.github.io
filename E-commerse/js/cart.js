/* =========================
   CART PAGE
========================= */

const cartContainer =
    document.getElementById("cart-container");

const emptyCart =
    document.getElementById("empty-cart");

const cartSummary =
    document.getElementById("cart-summary");

const cartSubtotal =
    document.getElementById("cart-subtotal");

const cartShipping =
    document.getElementById("cart-shipping");

const cartTotal =
    document.getElementById("cart-total");

const checkoutButton =
    document.getElementById("checkout-btn");


/* =========================
   GET CART
========================= */

function getCart() {

    return JSON.parse(
        localStorage.getItem("cart")
    ) || [];

}


/* =========================
   SAVE CART
========================= */

function saveCart(cart) {

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

}


/* =========================
   DISPLAY CART
========================= */

function displayCart() {

    const cart = getCart();

    cartContainer.innerHTML = "";


    /* Empty Cart */

    if (cart.length === 0) {

        emptyCart.style.display = "block";

        cartSummary.style.display = "none";

        updateCartCount();

        return;
    }


    emptyCart.style.display = "none";

    cartSummary.style.display = "block";


    /* Create Cart Items */

    cart.forEach(item => {

        const cartItem =
            document.createElement("article");

        cartItem.className = "cart-item";


        const itemTotal =
            item.price * item.quantity;


        cartItem.innerHTML = `

            <!-- Product Image -->

            <div class="cart-item-image">

                <img
                    src="${item.image}"
                    alt="${item.name}"
                    loading="lazy"
                >

            </div>


            <!-- Product Information -->

            <div class="cart-item-info">

                <p class="cart-item-category">
                    Product
                </p>

                <h3>
                    ${item.name}
                </h3>

                <p class="cart-item-price">
                    NPR ${item.price.toLocaleString()}
                </p>


                <!-- Quantity -->

                <div class="cart-quantity">

                    <button
                        type="button"
                        class="cart-minus"
                        data-id="${item.id}"
                    >
                        −
                    </button>

                    <span>
                        ${item.quantity}
                    </span>

                    <button
                        type="button"
                        class="cart-plus"
                        data-id="${item.id}"
                    >
                        +
                    </button>

                </div>

            </div>


            <!-- Right Side -->

            <div class="cart-item-right">

                <p class="cart-item-total">
                    NPR ${itemTotal.toLocaleString()}
                </p>

                <button
                    type="button"
                    class="remove-cart-item"
                    data-id="${item.id}"
                >
                    Remove
                </button>

            </div>

        `;


        cartContainer.appendChild(cartItem);

    });


    calculateTotals();

    setupCartEvents();

    updateCartCount();

}


/* =========================
   CALCULATE TOTALS
========================= */

function calculateTotals() {

    const cart = getCart();


    const subtotal =
        cart.reduce(
            (total, item) => {

                return total +
                    (item.price * item.quantity);

            },
            0
        );


    /*
       For now shipping is FREE.
    */

    const shipping = 0;

    const total =
        subtotal + shipping;


    cartSubtotal.textContent =
        `NPR ${subtotal.toLocaleString()}`;


    cartShipping.textContent =
        shipping === 0
            ? "FREE"
            : `NPR ${shipping.toLocaleString()}`;


    cartTotal.textContent =
        `NPR ${total.toLocaleString()}`;

}


/* =========================
   CART EVENTS
========================= */

function setupCartEvents() {


    /* Increase Quantity */

    document
        .querySelectorAll(".cart-plus")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    changeQuantity(
                        Number(button.dataset.id),
                        1
                    );

                }
            );

        });


    /* Decrease Quantity */

    document
        .querySelectorAll(".cart-minus")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    changeQuantity(
                        Number(button.dataset.id),
                        -1
                    );

                }
            );

        });


    /* Remove Product */

    document
        .querySelectorAll(".remove-cart-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeFromCart(
                        Number(button.dataset.id)
                    );

                }
            );

        });

}


/* =========================
   CHANGE QUANTITY
========================= */

function changeQuantity(
    productId,
    change
) {

    const cart = getCart();


    const item =
        cart.find(
            product => product.id === productId
        );


    if (!item) {
        return;
    }


    item.quantity += change;


    /* Minimum quantity = 1 */

    if (item.quantity < 1) {

        item.quantity = 1;

    }


    saveCart(cart);

    displayCart();

}


/* =========================
   REMOVE FROM CART
========================= */

function removeFromCart(productId) {

    let cart = getCart();


    cart =
        cart.filter(
            item => item.id !== productId
        );


    saveCart(cart);

    displayCart();

}


/* =========================
   CART COUNT
========================= */

function updateCartCount() {

    const cart = getCart();


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
   CHECKOUT BUTTON
========================= */

if (checkoutButton) {

    checkoutButton.addEventListener(
        "click",
        () => {

            const cart = getCart();


            if (cart.length === 0) {

                alert(
                    "Your cart is empty."
                );

                return;
            }


            window.location.href =
                "checkout.html";

        }
    );

}


/* =========================
   INITIALIZE
========================= */

if (cartContainer) {

    displayCart();

}