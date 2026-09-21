const crypto = require("crypto");
const store = require("./lib/store");
const { hashPassword } = require("./lib/util");

const defaultSettings = () => ({
    storeName: "ShopEase",
    tagline: "Your everyday online shopping destination.",
    email: "",
    phone: "",
    address: "",
    shippingFee: 100,
    freeShippingThreshold: 3000,
    commissionPercent: 10,
    lowStockAt: 5,
    autoApproveProducts: false,
    announcement: "Free delivery on orders above NPR 3,000. Cash on delivery available.",
    codEnabled: true,
    onlineEnabled: true,
    onlineInstructions:
        "Pay with eSewa, Khalti or bank transfer, then enter the transaction ID below. We confirm your payment within a few hours.",
    socials: { instagram: "", facebook: "", twitter: "" },
    categories: [
        { slug: "fashion", name: "Fashion" },
        { slug: "shoes", name: "Shoes" },
        { slug: "electronics", name: "Electronics" },
        { slug: "accessories", name: "Accessories" }
    ]
});

const SIZES_APPAREL = ["S", "M", "L", "XL"];
const SIZES_SHOES = ["39", "40", "41", "42", "43", "44"];

/* Demo catalogue (from the original site). Edit or delete from Admin > Products. */
const demoProducts = [
    {
        name: "Classic Oversized T-Shirt", category: "fashion", price: 1499, comparePrice: 0, badge: "NEW", sizes: SIZES_APPAREL,
        description: "A relaxed, drop-shoulder tee with a small chest print. Easy to wear with jeans, cargos or shorts.",
        features: ["Oversized, relaxed fit", "Soft and breathable fabric", "Small chest print", "Machine washable"]
    },
    {
        name: "Urban Street Sneakers", category: "shoes", price: 3999, comparePrice: 4999, badge: "", sizes: SIZES_SHOES,
        description: "Black-and-white low-top sneakers with a cushioned sole and a grippy outsole for daily wear.",
        features: ["Low-top black and white design", "Cushioned sole", "Grippy outsole", "Lace-up fit"]
    },
    {
        name: "Wireless Headphones", category: "electronics", price: 4999, comparePrice: 0, badge: "NEW", sizes: [],
        description: "Over-ear wireless headphones with cushioned ear cups and an adjustable headband for long listening sessions.",
        features: ["Bluetooth wireless connection", "Cushioned over-ear cups", "Adjustable headband", "Foldable design"]
    },
    {
        name: "Minimal Smart Watch", category: "accessories", price: 6499, comparePrice: 8124, badge: "", sizes: [],
        description: "A slim smart watch with a bright rectangular display and a soft silicone strap.",
        features: ["Bright touch display", "Soft silicone strap", "Slim everyday design", "Shows time, date and heart rate"]
    },
    {
        name: "Premium Cotton Hoodie", category: "fashion", price: 2499, comparePrice: 0, badge: "NEW", sizes: SIZES_APPAREL,
        description: "A soft sage-green hoodie with a kangaroo pocket and drawstring hood. Your go-to layer for cool days.",
        features: ["Soft cotton feel", "Drawstring hood", "Front kangaroo pocket", "Ribbed cuffs and hem"]
    },
    {
        name: "Everyday Running Shoes", category: "shoes", price: 3499, comparePrice: 4299, badge: "", sizes: SIZES_SHOES,
        description: "Lightweight grey running shoes with a breathable knit upper and a cushioned midsole.",
        features: ["Breathable knit upper", "Cushioned midsole", "Lightweight build", "Lace-up fit"]
    },
    {
        name: "Portable Bluetooth Speaker", category: "electronics", price: 2999, comparePrice: 0, badge: "NEW", sizes: [],
        description: "A compact cylindrical Bluetooth speaker with a carry loop. Take your music anywhere.",
        features: ["Bluetooth wireless connection", "Compact cylindrical design", "Carry loop", "Fabric grille"]
    },
    {
        name: "Classic Leather Wallet", category: "accessories", price: 1299, comparePrice: 0, badge: "", sizes: [],
        description: "A dark brown bi-fold wallet with stitched edges and slots for your cards and cash.",
        features: ["Bi-fold design", "Multiple card slots", "Stitched edges", "Slim pocket fit"]
    },
    {
        name: "Relaxed Fit Cargo Pants", category: "fashion", price: 2199, comparePrice: 0, badge: "NEW", sizes: ["28", "30", "32", "34", "36"],
        description: "Olive cargo pants with roomy pockets, a drawstring waist and elasticated cuffs.",
        features: ["Relaxed fit", "Multiple cargo pockets", "Drawstring waist", "Elasticated cuffs"]
    },
    {
        name: "Classic Casual Sneakers", category: "shoes", price: 4299, comparePrice: 0, badge: "", sizes: SIZES_SHOES,
        description: "Clean white low-top sneakers that go with almost everything in your wardrobe.",
        features: ["Clean white design", "Low-top cut", "Lace-up fit", "Cushioned insole"]
    },
    {
        name: "Smart Fitness Earbuds", category: "electronics", price: 2799, comparePrice: 3499, badge: "", sizes: [],
        description: "True wireless earbuds with a compact charging case, made for workouts and daily commutes.",
        features: ["True wireless design", "Compact charging case", "LED charge indicators", "Bluetooth connection"]
    },
    {
        name: "Minimalist Analog Watch", category: "accessories", price: 5499, comparePrice: 0, badge: "NEW", sizes: [],
        description: "A black-dial analog watch with gold-tone markers and a black leather strap.",
        features: ["Black dial with gold-tone markers", "Leather strap", "Minimal, dressy look", "Analog display"]
    }
];

async function seed() {
    const db = store.db();
    let changed = false;

    if (!db.settings) {
        db.settings = defaultSettings();
        changed = true;
    } else {
        // add any newly introduced setting keys without touching existing values
        const fresh = defaultSettings();
        for (const key of Object.keys(fresh)) {
            if (db.settings[key] === undefined) {
                db.settings[key] = fresh[key];
                changed = true;
            }
        }
    }

    /* ---------- first admin ---------- */
    if (!db.users.some((u) => u.role === "admin")) {
        const email = (process.env.ADMIN_EMAIL || "admin@shopease.local").toLowerCase();
        const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
        const generated = !process.env.ADMIN_PASSWORD;

        db.users.push({
            id: store.uid(),
            name: "Store Admin",
            email,
            phone: "",
            passwordHash: await hashPassword(password),
            role: "admin",
            status: "active",
            addresses: [],
            wishlist: [],
            createdAt: new Date().toISOString()
        });
        changed = true;

        console.log("=====================================================");
        console.log(" First admin account created");
        console.log("   Email    :", email);
        console.log("   Password :", generated ? password + "   (auto-generated, change it after login)" : "(from ADMIN_PASSWORD)");
        console.log("=====================================================");
    }

    /* ---------- demo products ---------- */
    if (db.products.length === 0 && !db.counters.seeded) {
        const admin = db.users.find((u) => u.role === "admin");
        demoProducts.forEach((p, index) => {
            const id = store.nextProductId();
            db.products.push({
                id,
                sellerId: admin.id,
                name: p.name,
                category: p.category,
                price: p.price,
                comparePrice: p.comparePrice,
                stock: 25,
                description: p.description,
                features: p.features,
                images: [`images/products/product-${index + 1}.jpg`],
                sizes: p.sizes,
                badge: p.badge,
                status: "active",
                approved: true,
                rejectReason: "",
                sold: 0,
                createdAt: new Date(Date.now() - (demoProducts.length - index) * 3600 * 1000).toISOString(),
                updatedAt: new Date().toISOString()
            });
        });
        db.counters.seeded = true;
        changed = true;
    }

    if (changed) store.flush();
}

module.exports = { seed, defaultSettings, demoProducts };
