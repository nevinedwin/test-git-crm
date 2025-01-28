const utils = {
  findArraySymmetricDifference: (arrA, arrB) => {
    console.log(arrA);
    console.log(arrB);
    const added = arrA.filter((x) => !arrB.includes(x)) || [];
    const removed = arrB.filter((x) => !arrA.includes(x)) || [];
    const diff = added.concat(removed) || [];
    return { added, removed, diff };
  },
};
export default utils;
