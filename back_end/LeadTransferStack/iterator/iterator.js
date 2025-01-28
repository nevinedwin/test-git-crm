/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

export async function main(event) {
  let { index } = event.iterator;
  const { step } = event.iterator;
  const { count } = event;
  if (index === -1) {
    index = 0;
  } else {
    index += step;
  }
  return {
    index,
    step,
    count,
    continue: index < count,
  };
}
