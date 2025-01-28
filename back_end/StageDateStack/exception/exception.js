export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  return event;
}