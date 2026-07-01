const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TARGET_URL =
  "https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI";

async function scrapeProduct() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("Загружаю страницу");
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });
    const productData = await page.evaluate(() => {
      const title = document.querySelector("h1")?.textContent?.trim() || null;
      const priceElements = document.querySelectorAll('[class*="price"]');
      let price = null;
      for (let el of priceElements) {
        const text = el.textContent || "";
        const match = text.match(/\$?([\d,]+\.?\d*)/);
        if (match) {
          price = parseFloat(match[1].replace(/,/g, ""));
          break;
        }
      }
      const imageUrl =
        document.querySelector(
          'img[alt*="product"], .product-image img, [class*="image"] img',
        )?.src || null;
      const additionalImages = Array.from(
        document.querySelectorAll(
          '[class*="gallery"] img, [class*="image"] img',
        ),
      )
        .map((img) => img.src)
        .filter((url, idx, arr) => url && arr.indexOf(url) === idx)
        .slice(0, 5);
      const description =
        document
          .querySelector('[class*="description"], .product-description')
          ?.textContent?.trim() || null;
      let availability = null;
      const availabilityText = document.body.innerText.toLowerCase();
      if (availabilityText.includes("in stock")) availability = "in_stock";
      else if (availabilityText.includes("out of stock"))
        availability = "out_of_stock";
      else if (availabilityText.includes("pre-order"))
        availability = "pre_order";
      const specs = [];
      document.querySelectorAll('[class*="spec"], tr').forEach((row) => {
        const cells = row.querySelectorAll('td, [class*="value"]');
        if (cells.length >= 2) {
          specs.push({
            name: cells[0]?.textContent?.trim() || "",
            value: cells[1]?.textContent?.trim() || null,
          });
        }
      });

      return {
        title,
        price,
        imageUrl,
        additionalImages,
        description,
        availability,
        specs: specs.slice(0, 10),
      };
    });
    const output = {
      url: TARGET_URL,
      item_id: productData.item_id || null,
      title: productData.title || null,
      brand: productData.brand || "MSI",
      product_category: productData.category || null,
      category_tree: productData.categoryTree || [],
      description: productData.description || null,
      price: productData.price || null,
      sale_price: productData.salePrice || null,
      availability: productData.availability || null,
      image_url: productData.imageUrl || null,
      additional_image_urls: productData.additionalImages || [],
      specs: productData.specs || [],
      star_rating: productData.rating || null,
      review_count: productData.reviewCount || null,
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

    console.log("Успешно! Результат в output/product.json");
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("Ошибка:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapeProduct();
