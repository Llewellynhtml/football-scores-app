const siteUrl = process.env.SITE_URL;
const secret = process.env.CRON_SECRET;
const mode = process.env.CRON_MODE || "fixtures";

if (!siteUrl || !secret) {
  console.error("SITE_URL and CRON_SECRET are required.");
  process.exit(1);
}

const url = new URL("/api/cron/warm", siteUrl);
url.searchParams.set("mode", mode);

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await response.text();
console.log(response.status, body);

if (!response.ok) process.exit(1);
