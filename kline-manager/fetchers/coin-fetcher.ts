import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

const env = await load();

export async function fetchCoins() {
  try {
    const url = env["COIN_SIFTER_URL"] + "/coins/formatted-symbols";
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": env["SECRET_TOKEN"],
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const coins = data.symbols;

    return coins;
  } catch (error) {
    console.error("Failed to fetch or parse coins data:", error);
    throw error;
  }
}
