const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TARGET_URL =
  "https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI";

async function scrapeProduct() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });

    const data = await page.evaluate(() => {
      const cleanText = (el) =>
        el?.textContent?.replace(/\s+/g, " ").trim() || null;
      let jsonLd = null;
      const ldScripts = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );

      for (const script of ldScripts) {
        try {
          const parsed = JSON.parse(script.textContent);
          if (parsed && (parsed.name || parsed["@type"])) {
            jsonLd = parsed;
            break;
          }
        } catch (e) {}
      }
      const title =
        cleanText(document.querySelector("h1")) || jsonLd?.name || null;
      let price = null;
      let sale_price = null;

      if (jsonLd?.offers) {
        const offers = Array.isArray(jsonLd.offers)
          ? jsonLd.offers[0]
          : jsonLd.offers;

        if (offers) {
          price = offers.price ? parseFloat(offers.price) : null;
        }
      }

      if (!price) {
        const priceEl = document.querySelector('[class*="price"]');
        if (priceEl) {
          const match = priceEl.textContent.match(/([\d,.]+)/);
          if (match) price = parseFloat(match[1].replace(/,/g, ""));
        }
      }
      const image_url =
        jsonLd?.image || document.querySelector("img")?.src || null;

      const additional_image_urls = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => src && src.startsWith("http"))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 10);
      const description =
        jsonLd?.description ||
        cleanText(document.querySelector('[class*="description"]')) ||
        null;
      let availability = null;
      const bodyText = document.body.innerText.toLowerCase();

      if (bodyText.includes("in stock")) availability = "in_stock";
      else if (bodyText.includes("out of stock")) availability = "out_of_stock";
      else if (bodyText.includes("pre-order")) availability = "pre_order";
      const breadcrumbEls = document.querySelectorAll("nav a, .breadcrumb a");

      const category_tree = Array.from(breadcrumbEls).map((el) => ({
        name: cleanText(el),
        url: el.href || null,
      }));

      const product_category = category_tree
        .map((c) => c.name)
        .filter(Boolean)
        .join(" > ");
      const specs = [];

      const specRows = document.querySelectorAll(
        ".spec, .product-spec, table tr",
      );

      specRows.forEach((row) => {
        const cols = row.querySelectorAll("td, th");

        if (cols.length >= 2) {
          const name = cleanText(cols[0]);
          const value = cleanText(cols[1]);

          if (name && value) {
            specs.push({ name, value });
          }
        }
      });
      let star_rating = null;
      let review_count = null;

      const ratingText = document.body.innerText;

      const ratingMatch = ratingText.match(/([\d.]+)\s*\/\s*5/);
      if (ratingMatch) star_rating = parseFloat(ratingMatch[1]);

      const reviewMatch = ratingText.match(/(\d+)\s+review/i);
      if (reviewMatch) review_count = parseInt(reviewMatch[1]);

      return {
        title,
        price,
        sale_price,
        image_url,
        additional_image_urls,
        description,
        availability,
        category_tree,
        product_category,
        specs,
        star_rating,
        review_count,
      };
    });
    const output = {
      url: TARGET_URL,
      item_id: TARGET_URL.split("/").pop() || null,
      title: data.title,
      brand: "MSI",
      product_category: data.product_category,
      category_tree: data.category_tree,
      description: data.description,
      price: data.price,
      sale_price: data.sale_price,
      availability: data.availability,
      image_url: data.image_url,
      additional_image_urls: data.additional_image_urls,
      specs: data.specs,
      star_rating: data.star_rating,
      review_count: data.review_count,
      gtin: null,
      mpn: null,
      scraped_at: new Date().toISOString(),
    };

    const outputDir = path.join(__dirname, "../output");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, "product.json"),
      JSON.stringify(output, null, 2),
    );

    console.log("OK -> output/product.json created");
    console.log(output);
  } catch (err) {
    console.error("Scraping error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapeProduct();
