export async function main(event) {
    console.log(event);
    let { index } = event.iterator;
    const { step ,nextIndexValue = null} = event.iterator;
    const { count} = event;
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
      nextIndexValue
    };
  }
  