require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function testGemini() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: "Say hello in one short sentence."
        });

        console.log("SUCCESS:");
        console.log(response.text);

    } catch (error) {
        console.error("GEMINI TEST ERROR:");
        console.error(error);
    }
}

testGemini();