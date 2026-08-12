/* =========================
   SHOP EASE - GLOBAL JS
========================= */


/* =========================
   MOBILE MENU
========================= */

const menuButton =
    document.querySelector(".menu-btn");

const navigationMenu =
    document.querySelector(".nav-menu");


if (menuButton && navigationMenu) {

    menuButton.addEventListener(
        "click",
        () => {

            navigationMenu.classList.toggle(
                "active"
            );

        }
    );


    /* Close menu after clicking a link */

    navigationMenu
        .querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    navigationMenu.classList.remove(
                        "active"
                    );

                }
            );

        });

}


/* =========================
   HOME PAGE ADD TO CART
========================= */

document
    .querySelectorAll(".add-cart-btn[data-id]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const productId =
                    Number(button.dataset.id);


                const selectedProduct =
                    products.find(
                        product => product.id === productId
                    );


                if (!selectedProduct) {
                    return;
                }


                addToCart(
                    selectedProduct,
                    1
                );


                /* Button Feedback */

                button.textContent =
                    "✓ Added";


                button.style.background =
                    "#25a56a";


                setTimeout(() => {

                    button.textContent =
                        "+ Cart";

                    button.style.background =
                        "";

                }, 1500);

            }
        );

    });