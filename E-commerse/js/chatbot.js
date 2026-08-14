/* =========================================================
   SHOPEASE AI CHATBOT
========================================================= */


/* =========================================================
   CHATBOT BUTTON
========================================================= */

const chatbotButton = document.createElement("button");

chatbotButton.className = "chatbot-button";
chatbotButton.type = "button";

chatbotButton.setAttribute(
    "aria-label",
    "Open ShopEase AI Assistant"
);

chatbotButton.innerHTML = "💬";

document.body.appendChild(chatbotButton);


/* =========================================================
   CHATBOT WINDOW
========================================================= */

const chatbotWindow = document.createElement("div");

chatbotWindow.className = "chatbot-window";

chatbotWindow.innerHTML = `

    <div class="chatbot-header">

        <div class="chatbot-title">

            <div class="chatbot-avatar">
                🤖
            </div>

            <div>

                <h3>ShopEase AI</h3>

                <span>
                    Shopping Assistant
                </span>

            </div>

        </div>


        <button
            class="chatbot-close"
            type="button"
            aria-label="Close chatbot"
        >
            ×
        </button>

    </div>


    <div class="chatbot-messages">

        <div class="chat-message bot-message">

            <div class="message-avatar">
                🤖
            </div>

            <div class="message-content">

                <p>
                    Hi! 👋 I'm ShopEase AI.
                </p>

                <p>
                    I can help you find products,
                    compare prices and answer
                    shopping questions.
                </p>

            </div>

        </div>

    </div>


    <div class="chatbot-input-area">

        <input
            type="text"
            class="chatbot-input"
            placeholder="Ask me anything..."
            autocomplete="off"
        >

        <button
            class="chatbot-send"
            type="button"
            aria-label="Send message"
        >
            ➤
        </button>

    </div>

`;

document.body.appendChild(chatbotWindow);


/* =========================================================
   ELEMENTS
========================================================= */

const closeChatbot =
    chatbotWindow.querySelector(".chatbot-close");

const chatbotInput =
    chatbotWindow.querySelector(".chatbot-input");

const chatbotSend =
    chatbotWindow.querySelector(".chatbot-send");

const chatbotMessages =
    chatbotWindow.querySelector(".chatbot-messages");


/* =========================================================
   OPEN CHATBOT
========================================================= */

chatbotButton.addEventListener("click", () => {

    chatbotWindow.classList.add("active");

    chatbotInput.focus();

});


/* =========================================================
   CLOSE CHATBOT
========================================================= */

closeChatbot.addEventListener("click", () => {

    chatbotWindow.classList.remove("active");

});


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   GET PRODUCTS
========================================================= */

function getProducts() {

    if (
        typeof products === "undefined" ||
        !Array.isArray(products)
    ) {

        return [];

    }

    return products;

}


/* =========================================================
   ADD NORMAL MESSAGE
========================================================= */

function addMessage(message, sender) {

    const messageWrapper =
        document.createElement("div");

    messageWrapper.className =
        `chat-message ${sender}-message`;


    const avatar =
        sender === "bot"
            ? "🤖"
            : "👤";


    messageWrapper.innerHTML = `

        <div class="message-avatar">
            ${avatar}
        </div>

        <div class="message-content">

            <p>
                ${escapeHTML(message)}
            </p>

        </div>

    `;


    chatbotMessages.appendChild(
        messageWrapper
    );


    chatbotMessages.scrollTop =
        chatbotMessages.scrollHeight;

}


/* =========================================================
   ADD AI RESPONSE
========================================================= */

function addAIResponse(reply, productIds) {

    const messageWrapper =
        document.createElement("div");

    messageWrapper.className =
        "chat-message bot-message";


    /* -----------------------------------------------------
       FIND PRODUCTS FROM PRODUCT IDS
    ----------------------------------------------------- */

    const allProducts =
        getProducts();


    const productsFound =
        Array.isArray(productIds)
            ? productIds
                .map(id =>
                    allProducts.find(
                        product =>
                            Number(product.id) === Number(id)
                    )
                )
                .filter(Boolean)
            : [];


    /* -----------------------------------------------------
       CREATE PRODUCT CARDS
    ----------------------------------------------------- */

    let productHTML = "";


    productsFound.forEach(product => {

        productHTML += `

            <div class="chat-product-card">

                <img
                    src="${escapeHTML(product.image)}"
                    alt="${escapeHTML(product.name)}"
                >


                <div class="chat-product-info">

                    <strong>
                        ${escapeHTML(product.name)}
                    </strong>


                    <span>
                        ${escapeHTML(
                            product.categoryName || ""
                        )}
                    </span>


                    <div class="chat-product-rating">

                        ${"★".repeat(
                            Math.floor(
                                Number(product.rating || 0)
                            )
                        )}

                        <small>
                            (${Number(
                                product.reviews || 0
                            )})
                        </small>

                    </div>


                    <b>
                        NPR ${Number(
                            product.price
                        ).toLocaleString()}
                    </b>


                    <div class="chat-product-actions">

                        <a
                            href="product.html?id=${product.id}"
                            class="chat-product-view"
                        >
                            View Product
                        </a>


                        <button
                            type="button"
                            class="chat-product-cart"
                            data-product-id="${product.id}"
                        >
                            Add to Cart
                        </button>

                    </div>

                </div>

            </div>

        `;

    });


    /* -----------------------------------------------------
       MESSAGE HTML
    ----------------------------------------------------- */

    messageWrapper.innerHTML = `

        <div class="message-avatar">
            🤖
        </div>


        <div class="message-content chat-results-content">

            <p>
                ${escapeHTML(reply)}
            </p>


            ${
                productHTML
                    ? `
                        <div class="chat-products-list">
                            ${productHTML}
                        </div>
                    `
                    : ""
            }

        </div>

    `;


    chatbotMessages.appendChild(
        messageWrapper
    );


    chatbotMessages.scrollTop =
        chatbotMessages.scrollHeight;

}


/* =========================================================
   GET AI RESPONSE
========================================================= */

async function getAIResponse(message) {

    try {

        const response =
            await fetch(
                "https://shopease-ai-backend.onrender.com/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        message: message,

                        products: getProducts()

                    })

                }
            );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message ||
                "AI response failed."
            );

        }


        return {

            reply:
                data.reply ||
                "Sorry, I couldn't generate a response.",

            productIds:
                Array.isArray(data.productIds)
                    ? data.productIds
                    : []

        };


    } catch (error) {

        console.error(
            "AI CHAT ERROR:",
            error
        );


        return {

            reply:
                "Sorry 😕 I'm having trouble connecting to my AI right now.",

            productIds: []

        };

    }

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    const message =
        chatbotInput.value.trim();


    /* -----------------------------------------------------
       EMPTY MESSAGE
    ----------------------------------------------------- */

    if (!message) {

        return;

    }


    /* -----------------------------------------------------
       SHOW USER MESSAGE
    ----------------------------------------------------- */

    addMessage(
        message,
        "user"
    );


    /* -----------------------------------------------------
       CLEAR INPUT
    ----------------------------------------------------- */

    chatbotInput.value = "";


    /* -----------------------------------------------------
       DISABLE SEND BUTTON
    ----------------------------------------------------- */

    chatbotSend.disabled = true;


    /* -----------------------------------------------------
       SHOW THINKING MESSAGE
    ----------------------------------------------------- */

    const thinkingMessage =
        document.createElement("div");

    thinkingMessage.className =
        "chat-message bot-message";


    thinkingMessage.innerHTML = `

        <div class="message-avatar">
            🤖
        </div>

        <div class="message-content">

            <p>
                Thinking... 🤔
            </p>

        </div>

    `;


    chatbotMessages.appendChild(
        thinkingMessage
    );


    chatbotMessages.scrollTop =
        chatbotMessages.scrollHeight;


    try {

        /* -------------------------------------------------
           GET AI RESPONSE
        ------------------------------------------------- */

        const aiResponse =
            await getAIResponse(message);


        /* -------------------------------------------------
           REMOVE THINKING MESSAGE
        ------------------------------------------------- */

        thinkingMessage.remove();


        /* -------------------------------------------------
           SHOW AI RESPONSE + PRODUCTS
        ------------------------------------------------- */

        addAIResponse(
            aiResponse.reply,
            aiResponse.productIds
        );


    } catch (error) {

        console.error(
            "SEND MESSAGE ERROR:",
            error
        );


        thinkingMessage.remove();


        addMessage(
            "Sorry 😕 Something went wrong while connecting to the AI.",
            "bot"
        );

    }


    /* -----------------------------------------------------
       ENABLE SEND BUTTON
    ----------------------------------------------------- */

    chatbotSend.disabled = false;

    chatbotInput.focus();

}


/* =========================================================
   SEND BUTTON
========================================================= */

chatbotSend.addEventListener(
    "click",
    sendMessage
);


/* =========================================================
   ENTER KEY
========================================================= */

chatbotInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();

        }

    }
);


/* =========================================================
   CHATBOT ADD TO CART
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".chat-product-cart"
            );


        if (!button) {

            return;

        }


        /* -------------------------------------------------
           GET PRODUCT ID
        ------------------------------------------------- */

        const productId =
            Number(
                button.dataset.productId
            );


        /* -------------------------------------------------
           FIND PRODUCT
        ------------------------------------------------- */

        const product =
            getProducts().find(
                item =>
                    Number(item.id) === productId
            );


        if (!product) {

            addMessage(
                "Sorry 😕 I couldn't find that product.",
                "bot"
            );

            return;

        }


        /* -------------------------------------------------
           GET EXISTING CART
        ------------------------------------------------- */

        let cart =
            JSON.parse(
                localStorage.getItem("cart")
            ) || [];


        /* -------------------------------------------------
           CHECK EXISTING PRODUCT
        ------------------------------------------------- */

        const existingProduct =
            cart.find(
                item =>
                    Number(item.id) === productId
            );


        /* -------------------------------------------------
           INCREASE QUANTITY
        ------------------------------------------------- */

        if (existingProduct) {

            existingProduct.quantity =
                (existingProduct.quantity || 1) + 1;

        }


        /* -------------------------------------------------
           ADD NEW PRODUCT
        ------------------------------------------------- */

        else {

            cart.push({

                id:
                    product.id,

                name:
                    product.name,

                price:
                    product.price,

                image:
                    product.image,

                categoryName:
                    product.categoryName,

                quantity:
                    1

            });

        }


        /* -------------------------------------------------
           SAVE CART
        ------------------------------------------------- */

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );


        /* -------------------------------------------------
           BUTTON FEEDBACK
        ------------------------------------------------- */

        const originalText =
            button.textContent;


        button.textContent =
            "✓ Added";


        button.disabled = true;


        setTimeout(() => {

            button.textContent =
                originalText;

            button.disabled = false;

        }, 1200);


        /* -------------------------------------------------
           CONFIRMATION
        ------------------------------------------------- */

        addMessage(
            `✅ ${product.name} has been added to your cart.`,
            "bot"
        );


        /* -------------------------------------------------
           UPDATE CART COUNT
        ------------------------------------------------- */

        if (
            typeof updateCartCount === "function"
        ) {

            updateCartCount();

        }

    }
);