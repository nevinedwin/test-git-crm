export async function main (event){
    console.log({event});
    let {index, operation} = event.iterator;
    let {step, nextIndexValue=null} = event.iterator;
    let {count} = event;
    
    if(index === -1){
        index = 0;
    }else{
        index += step;
    }

    return {
            index,
            step,
            count,
            continue: index < count && count !==0,
            nextIndexValue,
            operation
    };
}