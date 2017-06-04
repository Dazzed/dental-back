export function generateRandomEmail() {
  const randomEmail = `${(Math.random() * 100).toFixed(0)}${new Date().getTime()}`;
  return `auto-${randomEmail}@dentalhq.com`;
}
