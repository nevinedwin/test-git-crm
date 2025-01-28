import { createDataInAllBuilder, doPaginatedQueryEllastic, fieldData, getResources, postResources } from "../libs/db";
import { failure, success } from "../libs/response-lib";

const {entitiesTableName} = process.env;

export const createFields = async (hbId, type)=>{
  try {
    const params = {
      TableName: entitiesTableName,
      Item: {
        id: hbId,
        entity: `${type}#required_dynamic_fields`,
        data: 'dynamic_required_fields',
        type,
        mdt: Date.now(),
        hb_id: hbId,
        required_fields: fieldData(type)
      }
    };
    const dbWriteResp = await postResources(params, true);
    if(!dbWriteResp.status) throw dbWriteResp?.error;
    return {status: true, data: `Fields for ${type} created successfully`};
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return {status: false, error: error?.message || error};
  };
};


export const createDynamicRequiredField = async (data, isJSONOnly=false)=>{
  try {
    console.log(`data: ${JSON.stringify(data)}`);
    const {hb_id: hbId = "", currentTypeIndex = 0} = data;
    if(!hbId) throw "hbId is Required";
    const types = ['customer', 'realtor', 'agency', 'cobuyer'];
    if(currentTypeIndex >= types.length) {
      if(isJSONOnly){
        return {status: true, message: "Required Fields added to the builder"};
      };
      return success({status: true, message: "Required Fields added to the builder"})
    };

    const createEachData = await createFields(hbId, types[currentTypeIndex]);
    if(!createEachData.status) throw createEachData?.error;
    return createDynamicRequiredField({...data, currentTypeIndex: currentTypeIndex+1}, isJSONOnly);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    if(isJSONOnly){
      return {status: false, error: error?.message || error }
    };
    return failure({status: false, error: error?.message || error });
  };
};

const typeAndIdValidation = (type="", hbid="")=>{
  try {
    if(!hbid || !type) throw `${hbid ? 'Type' : 'hbid'} not provided`
    const types = new Set(fieldData("", true));
    console.log(`types: ${JSON.stringify(types)}`);
    if(!types.has(type)) throw `Invalid Type`;
    return {status: true}
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`)
    return {status: false, error: error?.message || error};
  }
}

export const getDynamicRequiredFields = async (event, isJSONOnly = false)=>{
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    const {
      pathParameters: {
        id: hbid = "",
        type= "",
      }
    } = event;
    console.log(`hbid: ${hbid}, type: ${type}`);
    const validateInput = typeAndIdValidation(type, hbid);
    if(!validateInput.status) throw validateInput.error;

    const params = {
      TableName: entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": hbid,
        ":entity": `${type}#required_dynamic_fields`,
      },
    };
    console.log(`Params : ${JSON.stringify(params)}`);
    if(isJSONOnly){
      const getResourceResp = await getResources(params, true);
      if(!getResourceResp.status) throw getResourceResp.error;
      return {status: true, data: getResourceResp.data};
    };
    return getResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    if(isJSONOnly){
      return {status: false, error: error?.message ||error};
    };
    return failure({status: false, error: error?.message || error });
  };
};

export const updateDynamicRequiredField = async (data)=>{
  try {
    const {
      id: hbid = "",
      updatedData= {},
      type = ""
    } = data;
    const validateInput = typeAndIdValidation(type, hbid);
    if(!validateInput.status) throw validateInput.error;
    if(!Object.keys(updatedData).length) throw `Update Data Must Contains Values`;
    const intialData = fieldData(type);
    if(Object.keys(intialData).length !== Object.keys(updatedData).length) throw `Updated Data Contains Missing Values`;
    
    const params = {
      TableName: entitiesTableName,
      Item: {
        id: hbid,
        entity: `${type}#required_dynamic_fields`,
        data: 'dynamic_required_fields',
        type,
        mdt: Date.now(),
        hb_id: hbid,
        required_fields: updatedData
      }
    };

    console.log(`update params: ${JSON.stringify(params)}`);
    return postResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({status: false, error: error?.message || error });
  };
};

export const listDynamicRequiredFieldElastic = async (data)=>{
  try {
    const { hbid = ""} = data;
    if(!hbid) throw `hb_id is required`;

    const customQuery = [
      {
        match: {
          'data.keyword': 'dynamic_required_fields'
        }
      }
    ];

    console.log(`customQuery: ${JSON.stringify(customQuery)}`);

    const listFields = await doPaginatedQueryEllastic({
      hb_id: hbid,
      isCustomParam: true,
      customParams: customQuery
    });
    console.log(`listFields: ${JSON.stringify(listFields)}`);

    return success({status: true, data: listFields});
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({status: false, error: error?.message || error});
  };
};

export const createFieldsInExistingBuilder = async (data)=>{
  try {
    const {requestType = "", inputData = [] } = data;
    const types = ["customer", "realtor", "cobuyer", "agency"];
    const inputParam = inputData && inputData.length ? inputData : [];
    if(!inputParam.length){
      types.forEach((eachType)=>{
        inputParam.push({
          item: {
            id: "",
            entity: `${eachType}#required_dynamic_fields`,
            data: 'dynamic_required_fields',
            type: eachType,
            mdt: Date.now(),
            hb_id: "",
            required_fields: fieldData(eachType)
          },
          requestType: requestType || "PutRequest",
          keys: ['id', "hb_id"]
        });
      })
    }
    const createBuilderDataResp = await createDataInAllBuilder(entitiesTableName, inputParam);
    console.log(`createBuilderDataResp: ${JSON.stringify(createBuilderDataResp)}`); 
    if(!createBuilderDataResp.status) throw createBuilderDataResp.error;
    return success({status: true, data: createBuilderDataResp});
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({status: false, error: error?.message || error});
  };
};




/**
 * Dynamic Required Fields Main Function
 * @param {Object} event 
 * @returns {Object} 
 */

export async function main(event) {
    let response;
    try {
      console.log(`Event: ${JSON.stringify(event)}`);
      const action = event?.pathParameters?.action || 0;
      let data;
      switch (event.httpMethod) {
        case "GET":
          if (action === "get") {
            response = await getDynamicRequiredFields(event);
          } else {
            response = failure();
          }
          break;
        case "POST":
          data = JSON.parse(event.body);
          if (!data) {
            response = failure();
          } else if (action === "create") {
            response = await createDynamicRequiredField(data)
          } else if (action === "update") {
            response = await updateDynamicRequiredField(data);
          } else if (action === "list") {
            response = await listDynamicRequiredFieldElastic(data);
          } else if(action === "script"){
            response = await createFieldsInExistingBuilder(data);
          } else {
            response = failure();
          }
          break;
        default:
          response = failure();
          break;
      };
    } catch (error) {
      console.log(error);
      return failure({ status: false, error: error?.message || error });
    }
    return response;
  }