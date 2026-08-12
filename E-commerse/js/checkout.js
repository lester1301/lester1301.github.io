/* =========================
   CHECKOUT PAGE
========================= */

const checkoutItems =
    document.getElementById("checkout-items");

const checkoutSubtotal =
    document.getElementById("checkout-subtotal");

const checkoutTotal =
    document.getElementById("checkout-total");

const placeOrderButton =
    document.getElementById("place-order-btn");


/* =========================
   GET CART
========================= */

function getCheckoutCart() {

    return JSON.parse(
        localStorage.getItem("cart")
    ) || [];

}


/* =========================
   DISPLAY ORDER SUMMARY
========================= */

function displayCheckoutItems() {

    const cart = getCheckoutCart();

    checkoutItems.innerHTML = "";


    /* Empty Cart */

    if (cart.length === 0) {

        checkoutItems.innerHTML = `

            <div class="checkout-empty">

                <p>
                    Your cart is empty.
                </p>

                <a
                    href="products.html"
                >
                    Continue Shopping
                </a>

            </div>

        `;

        checkoutSubtotal.textContent =
            "NPR 0";

        checkoutTotal.textContent =
            "NPR 0";

        placeOrderButton.disabled = true;

        placeOrderButton.style.opacity = "0.5";

        placeOrderButton.style.cursor = "not-allowed";

        return;
    }


    /* Enable button */

    placeOrderButton.disabled = false;

    placeOrderButton.style.opacity = "1";

    placeOrderButton.style.cursor = "pointer";


    /* Display Products */

    cart.forEach(item => {

        const itemTotal =
            item.price * item.quantity;


        const checkoutItem =
            document.createElement("div");

        checkoutItem.className =
            "checkout-item";


        checkoutItem.innerHTML = `

            <div class="checkout-item-image">

                <img
                    src="${item.image}"
                    alt="${item.name}"
                >

            </div>


            <div class="checkout-item-info">

                <h3>
                    ${item.name}
                </h3>

                <p>
                    Quantity: ${item.quantity}
                </p>

            </div>


            <p class="checkout-item-price">

                NPR ${itemTotal.toLocaleString()}

            </p>

        `;


        checkoutItems.appendChild(
            checkoutItem
        );

    });


    calculateCheckoutTotal();

}


/* =========================
   CALCULATE TOTAL
========================= */

function calculateCheckoutTotal() {

    const cart = getCheckoutCart();


    const subtotal =
        cart.reduce(
            (total, item) => {

                return total +
                    (item.price * item.quantity);

            },
            0
        );


    const shipping = 0;

    const total =
        subtotal + shipping;


    checkoutSubtotal.textContent =
        `NPR ${subtotal.toLocaleString()}`;


    checkoutTotal.textContent =
        `NPR ${total.toLocaleString()}`;

}


/* =========================
   FORM VALIDATION
========================= */

function validateCheckoutForm() {

    const fullName =
        document.getElementById("full-name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const address =
        document.getElementById("address").value.trim();

    const city =
        document.getElementById("city").value.trim();

    const postalCode =
        document.getElementById("postal-code").value.trim();


    /* Check empty fields */

    if (
        !fullName ||
        !email ||
        !phone ||
        !address ||
        !city ||
        !postalCode
    ) {

        alert(
            "Please fill in all required fields."
        );

        return false;

    }


    /* Basic email validation */

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailPattern.test(email)) {

        alert(
            "Please enter a valid email address."
        );

        return false;

    }


    /* Basic phone validation */

    const phonePattern =
        /^[0-9+\-\s]{7,15}$/;


    if (!phonePattern.test(phone)) {

        alert(
            "Please enter a valid phone number."
        );

        return false;

    }


    return true;

}


/* =========================
   PLACE ORDER
========================= */

function placeOrder() {

    const cart =
        getCheckoutCart();


    /* Check cart */

    if (cart.length === 0) {

        alert(
            "Your cart is empty."
        );

        return;

    }


    /* Validate form */

    if (!validateCheckoutForm()) {

        return;

    }


    /* Get payment method */

    const paymentMethod =
        document.querySelector(
            'input[name="payment"]:checked'
        ).value;


    /* Calculate total */

    const total =
        cart.reduce(
            (sum, item) =>
                sum +
                (item.price * item.quantity),
            0
        );


    /* Create order */

    const order = {

        orderId:
            "SE" +
            Date.now(),

        items:
            cart,

        total:
            total,

        paymentMethod:
            paymentMethod,

        createdAt:
            new Date().toISOString()

    };


    /* Save order */

    localStorage.setItem(
        "lastOrder",
        JSON.stringify(order)
    );


    /* Clear cart */

    localStorage.removeItem(
        "cart"
    );


    /* Show success */

    showOrderSuccess(
        order
    );

}


/* =========================
   ORDER SUCCESS
========================= */

function showOrderSuccess(order) {

    const checkoutSection =
        document.querySelector(
            ".checkout-section"
        );


    checkoutSection.innerHTML = `

        <div class="order-success">

            <div class="success-icon">
                ✓
            </div>


            <p class="section-tag">
                ORDER CONFIRMED
            </p>


            <h1>
                Thank You! 🎉
            </h1>


            <p class="success-message">

                Your order has been placed successfully.

            </p>


            <div class="order-details">

                <div>

                    <span>
                        Order ID
                    </span>

                    <strong>
                        ${order.orderId}
                    </strong>

                </div>


                <div>

                    <span>
                        Total
                    </span>

                    <strong>
                        NPR ${order.total.toLocaleString()}
                    </strong>

                </div>


                <div>

                    <span>
                        Payment
                    </span>

                    <strong>
                        ${
                            order.paymentMethod === "cod"
                                ? "Cash on Delivery"
                                : "Online Payment"
                        }
                    </strong>

                </div>

            </div>


            <div class="success-actions">

                <a
                    href="products.html"
                    class="btn btn-primary"
                >
                    Continue Shopping
                </a>

                <a
                    href="index.html"
                    class="btn btn-secondary"
                >
                    Back to Home
                </a>

            </div>

        </div>

    `;


    updateCartCount();

}


/* =========================
   CART COUNT
========================= */

function updateCartCount() {

    const cart =
        getCheckoutCart();


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
   BUTTON EVENT
========================= */

if (placeOrderButton) {

    placeOrderButton.addEventListener(
        "click",
        placeOrder
    );

}


/* =========================
   INITIALIZE
========================= */

if (checkoutItems) {

    displayCheckoutItems();

    updateCartCount();

}