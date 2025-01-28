import { initiateBuilderImport } from "../getconfig/getconfig";

export async function main(event) {
  console.log(event);
  const {
    after = [],
    hasAfter = true,
    count = 100,
    step = 100,
    hb_id: hbId,
    doImport = false,
  } = event;
  let { index = -1 } = event;
  // Check whether doImport exists.
  // That indicates, this is not the initial iteration.
  // So, spawn a new execution, with updated index
  if (doImport) {
    await initiateBuilderImport({ hb_id: hbId, index, count, after, hasAfter });
    return { continue: false };
  }
  if (index === -1) {
    index = 0;
  } else {
    index += step;
  }
  return {
    after,
    hasAfter,
    index,
    step,
    count,
    continue: index < count,
  };
}
