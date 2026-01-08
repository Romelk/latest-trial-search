import { loadCatalog, type Product } from "../lib/catalog";

// This test requires the server to be running
// Run: npm run dev
// Then: npm run bundle-smoke

async function testBundleBuilder() {
  const query = "smart casual outfit for nyc dinner";
  const scenarioId = "nyc_dinner";
  const audience = "women";

  try {
    const response = await fetch("http://localhost:3000/api/cart/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        provider: "openai",
        audience,
        scenarioId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const bundles = data.carts;

    console.log("Testing bundle builder for nyc_dinner + women...\n");
    console.log(`Query: "${query}"\n`);

    let passed = 0;
    let failed = 0;
    const failures: string[] = [];

    function test(desc: string, condition: boolean, error?: string) {
      if (condition) {
        console.log(`✓ ${desc}`);
        passed++;
      } else {
        console.error(`✗ ${desc}`);
        if (error) console.error(`  ${error}`);
        failed++;
        failures.push(desc);
      }
    }

    // Test 1: Exactly 3 bundles
    test("Returns exactly 3 bundles", bundles.length === 3, `Expected 3 bundles, got ${bundles.length}`);

    for (const bundle of bundles) {
      console.log(`\nTesting ${bundle.name} bundle:`);

      // Test 2: Each bundle has exactly 3 items
      test(
        `${bundle.name} bundle has 3 items`,
        bundle.items.length === 3,
        `Expected 3 items, got ${bundle.items.length}`
      );

      // Test 3: Template A or B satisfied
      const categories = bundle.items.map((i: any) => i.category);
      const roles = bundle.items.map((i: any) => i.role);

      // Check Template A
      const hasPrimary = ["Dresses", "Dress", "Jumpsuit", "Jumpsuits"].some((c) =>
        categories.includes(c)
      );
      const hasFootwearA = ["Heels", "Flats", "Loafers", "Sneakers"].some((c) =>
        categories.includes(c)
      );
      const hasAddOn = ["Blazers", "Jackets", "Clutches", "Handbags"].some((c) =>
        categories.includes(c)
      );
      const templateA = hasPrimary && hasFootwearA && hasAddOn;

      // Check Template B
      const hasTop = ["Blouses", "Tops", "Shirts"].some((c) => categories.includes(c));
      const hasBottom = ["Trousers", "Pants", "Skirts", "Jeans"].some((c) =>
        categories.includes(c)
      );
      const hasFootwearB = ["Heels", "Flats", "Loafers", "Sneakers"].some((c) =>
        categories.includes(c)
      );
      const templateB = hasTop && hasBottom && hasFootwearB;

      test(
        `${bundle.name} bundle satisfies Template A or B`,
        templateA || templateB,
        `Categories: ${categories.join(", ")}, Roles: ${roles.join(", ")}`
      );

      // Test 4: No T-Shirts when query has 'smart' without 'casual' or 'relaxed'
      const lowerQuery = query.toLowerCase();
      const hasSmart = lowerQuery.includes("smart");
      const hasCasualOrRelaxed = lowerQuery.includes("casual") || lowerQuery.includes("relaxed");
      const hasTees = categories.includes("Tees") || categories.includes("T-Shirts");

      if (hasSmart && !hasCasualOrRelaxed) {
        test(
          `${bundle.name} bundle has no T-Shirts (smart query guardrail)`,
          !hasTees,
          `Found T-Shirts: ${categories.filter((c: string) => c === "Tees" || c === "T-Shirts").join(", ")}`
        );
      } else {
        // If query allows T-Shirts, test passes
        test(
          `${bundle.name} bundle T-Shirt check (query allows T-Shirts)`,
          true
        );
      }

      // Test 5: All items have role field
      test(
        `${bundle.name} bundle items have role field`,
        bundle.items.every((i: any) => i.role),
        `Missing roles: ${bundle.items.filter((i: any) => !i.role).map((i: any) => i.id).join(", ")}`
      );

      // Test 6: All items are from correct scenario and audience
      const catalog = loadCatalog();
      for (const item of bundle.items) {
        const product = catalog.find((p) => p.id === item.id);
        if (product) {
          test(
            `${bundle.name} item ${item.id} has correct scenarioId`,
            product.scenarioId === scenarioId,
            `Expected ${scenarioId}, got ${product.scenarioId}`
          );
          test(
            `${bundle.name} item ${item.id} has correct audience`,
            product.audience === audience,
            `Expected ${audience}, got ${product.audience}`
          );
        }
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("Test Summary:");
    console.log(`Total tests: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log("\nFailures:");
      failures.forEach((failure, idx) => {
        console.log(`${idx + 1}. ${failure}`);
      });
      process.exit(1);
    } else {
      console.log("\n✅ All tests passed!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error running bundle smoke test:", error);
    console.error("\nMake sure the dev server is running: npm run dev");
    process.exit(1);
  }
}

testBundleBuilder();
