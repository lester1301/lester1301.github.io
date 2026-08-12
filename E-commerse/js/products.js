/* =========================
   PRODUCT DATA
========================= */

const products = [

    {
        id: 1,
        name: "Classic Oversized T-Shirt",
        category: "fashion",
        categoryName: "Fashion",
        price: 1499,
        rating: 4.8,
        reviews: 24,
        image: "images/products/product-1.jpeg",
        badge: "NEW"
    },

    {
        id: 2,
        name: "Urban Street Sneakers",
        category: "shoes",
        categoryName: "Shoes",
        price: 3999,
        rating: 4.7,
        reviews: 18,
        image: "images/products/product-2.jpeg",
        badge: "SALE"
    },

    {
        id: 3,
        name: "Wireless Headphones",
        category: "electronics",
        categoryName: "Electronics",
        price: 4999,
        rating: 4.9,
        reviews: 42,
        image: "images/products/product-3.jpeg",
        badge: "NEW"
    },

    {
        id: 4,
        name: "Minimal Smart Watch",
        category: "accessories",
        categoryName: "Accessories",
        price: 6499,
        rating: 4.6,
        reviews: 31,
        image: "images/products/product-4.jpeg",
        badge: "-20%"
    },

    {
        id: 5,
        name: "Premium Cotton Hoodie",
        category: "fashion",
        categoryName: "Fashion",
        price: 2499,
        rating: 4.7,
        reviews: 35,
        image: "images/products/product-5.jpeg",
        badge: "NEW"
    },

    {
        id: 6,
        name: "Everyday Running Shoes",
        category: "shoes",
        categoryName: "Shoes",
        price: 3499,
        rating: 4.5,
        reviews: 21,
        image: "images/products/product-6.jpeg",
        badge: "SALE"
    },

    {
        id: 7,
        name: "Portable Bluetooth Speaker",
        category: "electronics",
        categoryName: "Electronics",
        price: 2999,
        rating: 4.6,
        reviews: 27,
        image: "images/products/product-7.jpeg",
        badge: "NEW"
    },

    {
        id: 8,
        name: "Classic Leather Wallet",
        category: "accessories",
        categoryName: "Accessories",
        price: 1299,
        rating: 4.4,
        reviews: 16,
        image: "images/products/product-8.jpeg",
        badge: ""
    },

    {
        id: 9,
        name: "Relaxed Fit Cargo Pants",
        category: "fashion",
        categoryName: "Fashion",
        price: 2199,
        rating: 4.6,
        reviews: 19,
        image: "images/products/product-9.jpeg",
        badge: "NEW"
    },

    {
        id: 10,
        name: "Classic Casual Sneakers",
        category: "shoes",
        categoryName: "Shoes",
        price: 4299,
        rating: 4.8,
        reviews: 29,
        image: "images/products/product-10.jpeg",
        badge: ""
    },

    {
        id: 11,
        name: "Smart Fitness Earbuds",
        category: "electronics",
        categoryName: "Electronics",
        price: 2799,
        rating: 4.5,
        reviews: 23,
        image: "images/products/product-11.jpeg",
        badge: "SALE"
    },

    {
        id: 12,
        name: "Minimalist Analog Watch",
        category: "accessories",
        categoryName: "Accessories",
        price: 5499,
        rating: 4.7,
        reviews: 37,
        image: "images/products/product-12.jpeg",
        badge: "NEW"
    }

];


/* =========================
   PRODUCTS PAGE
========================= */

const productsContainer =
    document.getElementById("products-container");


if (productsContainer) {

    const searchInput =
        document.getElementById("product-search");

    const categoryFilter =
        document.getElementById("category-filter");

    const sortSelect =
        document.getElementById("sort-products");

    const productCount =
        document.getElementById("product-count");

    const emptyProducts =
        document.getElementById("empty-products");


    /* =========================
       DISPLAY PRODUCTS
    ========================= */

    function displayProducts(productList) {

        productsContainer.innerHTML = "";


        if (productList.length === 0) {

            emptyProducts.style.display = "block";

            productCount.textContent =
                "No products found";

            return;
        }


        emptyProducts.style.display = "none";


        productList.forEach(product => {

            const card =
                document.createElement("article");

            card.className = "product-card";


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
                        class="wishlist-btn"
                        data-id="${product.id}"
                        type="button"
                        aria-label="Add to wishlist"
                    >
                        ♡
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

                        ${"★".repeat(Math.floor(product.rating))}

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

                </div>

            `;


            productsContainer.appendChild(card);

        });


        productCount.textContent =
            `Showing ${productList.length} product${
                productList.length !== 1 ? "s" : ""
            }`;
    }


    /* =========================
       FILTER / SEARCH / SORT
    ========================= */

    function updateProducts() {

        const searchTerm =
            searchInput.value
                .toLowerCase()
                .trim();

        const selectedCategory =
            categoryFilter.value;

        const selectedSort =
            sortSelect.value;


        let filteredProducts =
            products.filter(product => {

                const matchesSearch =
                    product.name
                        .toLowerCase()
                        .includes(searchTerm);

                const matchesCategory =
                    selectedCategory === "all" ||
                    product.category === selectedCategory;

                return (
                    matchesSearch &&
                    matchesCategory
                );

            });


        if (selectedSort === "low-high") {

            filteredProducts.sort(
                (a, b) => a.price - b.price
            );

        }

        else if (selectedSort === "high-low") {

            filteredProducts.sort(
                (a, b) => b.price - a.price
            );

        }

        else if (selectedSort === "rating") {

            filteredProducts.sort(
                (a, b) => b.rating - a.rating
            );

        }


        displayProducts(filteredProducts);
    }


    /* =========================
       EVENTS
    ========================= */

    searchInput.addEventListener(
        "input",
        updateProducts
    );

    categoryFilter.addEventListener(
        "change",
        updateProducts
    );

    sortSelect.addEventListener(
        "change",
        updateProducts
    );


    /* =========================
       INITIAL LOAD
    ========================= */

    displayProducts(products);

}