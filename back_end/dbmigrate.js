const fs = require('fs');
const fsPromises = fs.promises;
var content = fs.readFileSync('./dbexported.json');
console.log(content);
var parsedContent = JSON.parse(content);
console.log(parsedContent);
let array = [];
var Items = parsedContent.Items;
let grbycArray = [];
let agencyUnderRealtorArr = []
const getAgentIdReplacement = (id) => {
    let replacementId = '';
    switch(id) {
        case '0a1f3ae7-c7d0-4119-a480-be3c5e82fed3': replacementId =  '7b53fb59-ebfd-4bd2-8ce1-8fd6f242123e';
            break;
        case '2c65f9f9-f716-4e8b-b8c9-c36224a8940f': replacementId =  '109a6d17-4572-4534-bb96-c19541af0347';
        break;
        case '39276c54-08f9-4aed-96c1-d224326f6644': replacementId =  'f9b38268-0b89-4899-a6cc-d19bd653ce91';
        break;
        case '440b8571-3f1e-47cb-a895-3c36f25197c1': replacementId =  'b3ce6b8a-9ee4-4e28-91ba-6df0d2a04a52';
        break;
        case '5b1cb910-f5aa-4c1c-b9c9-598a3f3cc2a0': replacementId =  'e39b3205-2c99-47d4-858b-620acff7ca4d';
        break;
        case '9887b463-72d0-4e3e-a39b-b5cc5db5b01b': replacementId =  '4e412769-1b06-413b-8824-33b26905f9c4';
        break;
        case '9949dcaf-6ab5-4750-8523-6eec26ba0c2b': replacementId =  '90fb9787-cc9c-4892-a61a-20c458d3b24e';
        break;
        case 'c8ae6c7d-b79a-4260-afd3-0f9e06fa775f': replacementId =  '72b39e86-5c17-40b8-81cb-756e7daa40d0';
        break;
    }
    return replacementId;
}
Items.forEach((element) => {
    let tempElement = { ...element }
    let newObject;
    let type = tempElement.type.S;
    if (type == "infl" || type == "cntm" || type == "exp" || type == "spec" || type == "grade" || type == "psrc" || type == "metro" || type == "community") {
        tempElement.entity = {
            S: `${tempElement.type.S}#${tempElement.hb_id.S}`
        }
        newObject = {
            PutRequest: {
                Item: tempElement
            }
        }
        if(type == "metro") {
            console.log(`metro name tempElement: ${JSON.stringify(tempElement.name)}`);
            console.log(`metro name: ${JSON.stringify(newObject.PutRequest.Item.name)}`);
        }
        array.push(newObject);
        //console.log(newObject)
    } else if (type == "activity") {
        let relObj = Items.find(item => {
            return item.id.S === tempElement.rel_id.S
        });
        let hb_id = relObj ? relObj.hb_id.S : 0
        tempElement.entity = {
            S: `${tempElement.type.S}#${hb_id}#${tempElement.atype.S}#${tempElement.id.S}`
        }
        tempElement.data = {
            S: tempElement.id.S
        }
        tempElement.id = {
            S: tempElement.rel_id.S
        }
        newObject = {
            PutRequest: {
                Item: tempElement
            }
        }
        if(tempElement.assi && tempElement.assi.S) {
            tempElement.assi.S = getAgentIdReplacement(tempElement.assi.S);
        }
        if(tempElement.wit && tempElement.wit.S) {
            tempElement.wit.S = getAgentIdReplacement(tempElement.wit.S);
        }
        if (relObj) {
            array.push(newObject);
        }
    } else if (type == 'agency') {
        tempElement.entity = {
            S: `${tempElement.type.S}#${tempElement.hb_id.S}`
        }
        tempElement.data = {
            S: `${tempElement.type.S}#${tempElement.hb_id.S}`
        }
        if(tempElement.crby && tempElement.crby.S) {
            tempElement.crby.S = getAgentIdReplacement(tempElement.crby.S);
        }
        newObject = {
            PutRequest: {
                Item: tempElement
            }
        }
        tempElement.m_id.L.forEach(metro => {
            let metroObj = Items.find(metroEl => {
                return metro.S === metroEl.id.S
            })
            if (metroObj) {
                let metroObj1 = { ...metroObj }
                metroObj1['data'] = metroObj.id;
                delete metroObj1.id;
                delete metroObj1.name;
                let metroCreateJson = { id: tempElement.id, entity: { S: `metro#${tempElement.hb_id.S}#agency#${metroObj1.data.S}` }, ...metroObj1 }
                let newObject1 = {
                    PutRequest: {
                        Item: metroCreateJson
                    }
                }
                array.push(newObject1)
            }
        })
        array.push(newObject);
    } else if (type == 'broker') {
        tempElement.entity = {
            S: `${tempElement.type.S}#${tempElement.hb_id.S}#${tempElement.id.S}`
        }
        tempElement.data = {
            S: `agency#${tempElement.hb_id.S}`
        }
        tempElement.id = {
            S: tempElement.rel_id.S
        }
        newObject = {
            PutRequest: {
                Item: tempElement
            }
        }
        array.push(newObject);
    } else if (type == 'builder') {
        console.log(`In Builder`);
        tempElement.entity = {
            S: `builder`
        }
        newObject = {
            PutRequest: {
                Item: tempElement
            }
        }
        array.push(newObject);
    } else if (type === 'realtor') {
        let realtorCreateItem = { ...tempElement }
        realtorCreateItem.data = {
            S: `realtor#${tempElement.hb_id.S}`
        }
        realtorCreateItem.entity = {
            S: `realtor#${tempElement.hb_id.S}`
        }
        if(realtorCreateItem.crby && realtorCreateItem.crby.S) {
            realtorCreateItem.crby.S = getAgentIdReplacement(realtorCreateItem.crby.S);
        }
        newObject = {
            PutRequest: {
                Item: realtorCreateItem
            }
        }
        array.push(newObject);

        if (tempElement.rel_id.S) {
            let RealtorAgCreateItem = { ...tempElement };
            RealtorAgCreateItem.data = {
                S: tempElement.id.S
            }
            RealtorAgCreateItem.entity = {
                S: `realtor#${tempElement.hb_id.S}#agency#${tempElement.id.S}`
            }
            RealtorAgCreateItem.id = {
                S: `${tempElement.rel_id.S}`
            }
            let newObject11 = {
                PutRequest: {
                    Item: RealtorAgCreateItem
                }
            }
            agencyUnderRealtorArr.push(RealtorAgCreateItem)
            array.push(newObject11);
            //
            let agencyRow = Items.find(agElement => {
                return agElement.id.S === tempElement.rel_id.S;
            })
            if (agencyRow) {
                let agencyRowTemp = { ...agencyRow };
                delete agencyRowTemp.id;
                delete agencyRowTemp.entity;
                delete agencyRowTemp.data;
                agencyRowTemp.id = {
                    S: `${tempElement.id.S}`
                }
                agencyRowTemp.data = {
                    S: `realtor#${tempElement.hb_id.S}`
                }
                agencyRowTemp.entity = {
                    S: `agency#${tempElement.hb_id.S}#realtor#${tempElement.rel_id.S}`
                }
                let agencyCreateItem = {
                    PutRequest: {
                        Item: agencyRowTemp
                    }
                }
                array.push(agencyCreateItem);
                let comm = [];
                agencyRowTemp.m_id.L.forEach(metroId => {
                    let commObj = Items.filter(commElement => {
                        if (commElement.rel_id && commElement.type.S === 'community') {

                            return commElement.rel_id.S === metroId.S
                        }
                    })
                    if (commObj[0]) {
                        let commArray = commObj.map(i => {
                            return i.id.S
                        })
                        comm = [...comm, ...commArray]
                    }
                })

                if (comm.length) {
                    getCommCreateArr(comm, tempElement)
                    //create realtor obj under community
                }
            }
        }
    } else if (type === 'cobuyer') {
        let cobuyerCreateItem = { ...tempElement }
        cobuyerCreateItem.data = {
            S: tempElement.id.S
        }
        cobuyerCreateItem.id = {
            S: tempElement.rel_id.S
        }
        cobuyerCreateItem.entity = {
            S: `cobuyer#${tempElement.hb_id.S}#${tempElement.id.S}`
        }
        if(cobuyerCreateItem.crby && cobuyerCreateItem.crby.S) {
            cobuyerCreateItem.crby.S = getAgentIdReplacement(cobuyerCreateItem.crby.S);
        }
        newObject = {
            PutRequest: {
                Item: cobuyerCreateItem
            }
        }
        array.push(newObject);
    }
    else if (type.indexOf('question_') !== -1) {
        let demoGCreateItem = { ...tempElement }
        const typeItem = type.split('_')[1];
        demoGCreateItem.data = {
            S: `question#${tempElement.hb_id.S}`
        }
        demoGCreateItem.entity = {
            S: `question#${tempElement.hb_id.S}#${typeItem}`
        }
        newObject = {
            PutRequest: {
                Item: demoGCreateItem
            }
        }
        array.push(newObject);
    }
    else if (type === 'agent' || type === 'admin' || type === 'online_agent') {
        let agentCreateItem = { ...tempElement }
        agentCreateItem.data = {
            S: `agent#${tempElement.hb_id.S}`
        }
        agentCreateItem.entity = {
            S: `agent#${tempElement.hb_id.S}#${type}`
        }
        agentCreateItem.id.S = getAgentIdReplacement(agentCreateItem.id.S);
        newObject = {
            PutRequest: {
                Item: agentCreateItem
            }
        }
        array.push(newObject);
    }
})

Items.forEach((element) => {
    let tempCustomer;
    if (element.type.S === 'customer') {
        tempCustomer = { ...element }

        tempCustomer.id = {
            S: element.id.S
        }
        tempCustomer.entity = {
            S: `customer#${element.hb_id.S}`
        }
        if(tempCustomer.crby && tempCustomer.crby.S) {
            tempCustomer.crby.S = getAgentIdReplacement(tempCustomer.crby.S);
        }
        if (element.rltr.M.id) {
            let getRltrByComm = grbycArray.find(grbycObj => {
                return grbycObj.entity.S === `realtor#${tempCustomer.hb_id.S}#community#${element.rltr.M.id.S}`
            })
            if(getRltrByComm) {
                tempCustomer.rltr = {
                    M: getRltrByComm
                }
            }
            else {
                tempCustomer.rltr = {
                    M: {}
                };
            }
        }
        else {
            tempCustomer.rltr = {
                M: {}
            };
        }


        let customerCreateItem = {
            PutRequest: {
                Item: tempCustomer
            }
        }
        array.push(customerCreateItem);
        // create customer under realtor
        let tempCustomer1;
        if (Object.keys(element.rltr.M).length) {
            tempCustomer1 = { ...element };
            tempCustomer1.data = {
                S: element.id.S
            }
            tempCustomer1.id = {
                S: element.rltr.M.id.S
            }
            tempCustomer1.entity = {
                S: `customer#${element.hb_id.S}#${convertStageToKey(element.stage.S)}#${element.cdt.N}`
            }
            let customerUnderRealtor = {
                PutRequest: {
                    Item: tempCustomer1
                }
            }
            array.push(customerUnderRealtor);

            // get agency obj under realtor and create customer under agency
            let tempCustomer2 = { ...element };
            tempCustomer2.id = {
                S: element.rltr.M.rel_id.S
            }
            tempCustomer2.entity = {
                S: `customer#${element.hb_id.S}#${convertStageToKey(element.stage.S)}#${element.cdt.N}`
            }
            let agencyCreateItem1 = {
                PutRequest: {
                    Item: tempCustomer2
                }
            }
            array.push(agencyCreateItem1)


        }

    }
})

function getCommCreateArr(comm, realtorItem1) {


    for (let communityId of comm) {
        let realtorItem = { ...realtorItem1 }
        let realtorUUID = realtorItem1.id.S
        delete realtorItem.data;
        delete realtorItem.id;
        delete realtorItem.entity;
        realtorItem.id = {
            S: communityId
        }
        realtorItem.data = {
            S: realtorUUID
        }
        realtorItem.entity = {
            S: `realtor#${realtorItem.hb_id.S}#community#${realtorUUID}`
        }
        let realtorCommResource = {
            PutRequest: {
                Item: realtorItem
            }
        }
        grbycArray.push(realtorItem);
        array.push(realtorCommResource);

    }
}
function convertStageToKey(stage) {
    switch (stage) {
        case "Bust Out":
            stage = "Bust_Out";
            break;
        case "Dead Lead":
            stage = "Dead_Lead";
            break;
        default:
            break;
    }
    return stage;
}
let cc = Object.keys(Items).length
console.log(cc)

console.log(array.length);
initWriteFile();
async function initWriteFile() {
    let i = 0;
    while (i <= array.length) {
        let outputContent;
        console.log(`In initWriteFile i: ${i}`);
        let items = array.slice(i, i+25);
        let outputObj = {
            "crm-betav2-entities-dev-db": items
        }
        console.log(`items.length: ${items.length}`);
        outputContent = JSON.stringify(outputObj);
        try {
            await writeFile(outputContent, i);
        }
        catch(e) {
            console.log(`e: ${e.message}`);
        }
        i += 25;
    }
}
async function writeFile(outputContent, i) {
    fsPromises.writeFile(`./restored/batchRequest_${i}.json`, outputContent);
}
/* var outputObj = {
    "crm-hhh-entities-dev-db": array
}
var outputContent = JSON.stringify(outputObj)
fs.writeFile(`exporteDB.json`, outputContent, 'utf8', err => {
    // Checking for errors
    if (err) throw err;
    console.log("Done writing"); // Success
}); */