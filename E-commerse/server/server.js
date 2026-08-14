const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;


// =====================================================
// GEMINI AI CLIENT
// =====================================================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());


// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "ShopEase AI Server is running!"
    });

});


// =====================================================
// AI CHAT ROUTE
// =====================================================

app.post("/api/chat", async (req, res) => {

    try {

        const userMessage = req.body.message;
        const products = req.body.products || [];


        // -------------------------------------------------
        // CHECK MESSAGE
        // -------------------------------------------------

        if (!userMessage || !userMessage.trim()) {

            return res.status(400).json({
                success: false,
                message: "Message is required."
            });

        }


        // -------------------------------------------------
        // PRODUCT DATA
        // -------------------------------------------------

        const productContext = products.length
            ? JSON.stringify(products, null, 2)
            : "No product data is currently available.";


        // -------------------------------------------------
        // SYSTEM INSTRUCTIONS
        // -------------------------------------------------

        const systemInstruction = `

You are ShopEase AI, the intelligent shopping assistant
for the ShopEase e-commerce website.

You help users with:

- Product recommendations
- Product information
- Product comparisons
- Budget shopping
- Categories
- Shopping advice
- General questions
- Everyday questions

You can also answer general knowledge questions.

For general questions such as:

- Nepal
- trekking
- travel
- technology
- general knowledge

answer normally and helpfully.

When the user asks about ShopEase products,
use ONLY the product data provided below.


=====================================================
SHOP EASE PRODUCT DATA
=====================================================

${productContext}


=====================================================
IMPORTANT PRODUCT RULES
=====================================================

1. NEVER invent a ShopEase product.

2. NEVER invent a ShopEase price.

3. NEVER invent product features.

4. Only recommend products that exist in the
   provided product data.

5. Use these product fields:

   - id
   - name
   - category
   - categoryName
   - price
   - rating
   - reviews
   - image
   - badge

6. If the user provides a budget such as:

   "under NPR 2000"
   "below 3000"
   "2000 ke andar"
   "2000 tak"

   only recommend products whose actual price
   is equal to or below that amount.

7. If no product matches the budget, clearly say
   that no matching product was found.

8. When recommending products, consider:

   - category
   - price
   - rating
   - reviews
   - badge
   - user's request

9. Recommend only the most relevant products.
   Do not list the entire catalog.

10. Use NPR when discussing ShopEase prices.

11. Keep responses friendly, natural and concise.

12. Never mention APIs, JavaScript, server,
    productContext or internal code.

13. Do not claim that you added something to cart.
    The website frontend handles cart actions.

14. If the user asks a general question unrelated
    to ShopEase products, answer normally.


=====================================================
RESPONSE FORMAT
=====================================================

You MUST return valid JSON.

For a normal/general question:

{
    "reply": "your answer here",
    "productIds": []
}

For a product recommendation:

{
    "reply": "short helpful explanation",
    "productIds": [1, 5, 8]
}

IMPORTANT:

- productIds must contain ONLY IDs from the provided
  ShopEase product data.
- If no ShopEase products are relevant,
  return an empty array.
- Do not put product names inside productIds.
- Do not use markdown code fences.
- Return ONLY valid JSON.


=====================================================
PERSONALITY
=====================================================

Friendly
Helpful
Natural
Professional
Concise

You are ShopEase AI.
`;


        // -------------------------------------------------
        // CALL GEMINI
        // -------------------------------------------------

        const response = await ai.models.generateContent({

            model: "gemini-3.5-flash-lite",

            contents: userMessage,

            config: {

                systemInstruction: systemInstruction

            }

        });


        // -------------------------------------------------
        // GET AI TEXT
        // -------------------------------------------------

        const rawText =
            response.text ||
            "";


        // -------------------------------------------------
        // PARSE AI JSON
        // -------------------------------------------------

        let aiData;


        try {

            aiData =
                JSON.parse(rawText);

        } catch (parseError) {

            console.error(
                "JSON PARSE ERROR:",
                parseError
            );

            console.error(
                "AI RAW RESPONSE:",
                rawText
            );


            // Fallback if AI returns normal text

            aiData = {

                reply: rawText,

                productIds: []

            };

        }


        // -------------------------------------------------
        // VALIDATE PRODUCT IDS
        // -------------------------------------------------

        const validProductIds =
            Array.isArray(aiData.productIds)
                ? aiData.productIds
                    .map(Number)
                    .filter(id =>
                        products.some(
                            product =>
                                Number(product.id) === id
                        )
                    )
                : [];


        // -------------------------------------------------
        // SEND RESPONSE
        // -------------------------------------------------

        res.json({

            success: true,

            reply:
                aiData.reply ||
                "Sorry, I couldn't generate a response.",

            productIds:
                validProductIds

        });


    } catch (error) {

        console.error(
            "AI ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message: "AI response failed."

        });

    }

});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `ShopEase AI Server running on http://localhost:${PORT}`
    );

});