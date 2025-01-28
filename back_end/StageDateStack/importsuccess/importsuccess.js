export async function main(event) {
  console.log(`import success : ${JSON.stringify(event)}`);
  return event;
}