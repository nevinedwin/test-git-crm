/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import {
  postResources,
  updateResources,
  deleteResources,
  getResourceJSON,
} from "../libs/db";
import { failure } from "../libs/response-lib";

/* const listBrokers = (event) => {
    const hbidParam = event && event.pathParameters && event.pathParameters.hbid ? event.pathParameters.hbid : 0;
    const rel_id = event && event.pathParameters && event.pathParameters.rel_id ? event.pathParameters.rel_id : 0;
    const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByHBId,
        KeyConditionExpression: "hb_id = :hb_id and #type = :type",
        ExpressionAttributeNames: {
            "#type": "type",
        },
        ExpressionAttributeValues: {
            ":hb_id": hbidParam,
            ":type": "broker"
        },
        FilterExpression: 'rel_id = :rel_id'
    };
    console.log(params);
    return getResources(params);
} */

export const updateBrokerRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "broker",
      id: data.rel_id,
      hb_id: data.hb_id,
      fname: data.fname,
      lname: data.lname,
      fullname: `${data.fname} ${data.lname || ""}`,
      jdt: data.jdt,
      mdt: Date.now(),
      cdt: data.cdt,
      email: data.email,
      phone: data.phone,
      rel_id: data.rel_id,
      stat: data.stat,
      spec: data.spec,
      data: `agency#${data.hb_id}`,
      entity: `broker#${data.hb_id}#${data.id}`,
    },
  };
  return postResources(params);
};

/* const getBroker = (event) => {
    console.log("In getbroker");
    console.log("event: " + JSON.stringify(event));
    const idParam = event && event.pathParameters && event.pathParameters.id ? event.pathParameters.id : 0;
    console.log("idParam: " + idParam);
    const params = {
        TableName: process.env.entitiesTableName,
        KeyConditionExpression: "#id = :id and #type = :type",
        ExpressionAttributeNames: {
            "#id": "id",
            "#type": "type"
        },
        ExpressionAttributeValues: {
            ":id": idParam,
            ":type": 'broker'
        }
    };
    console.log(params);
    return getResources(params);
} */

const getBrokerDetails = async (relId, hbid, id) => {
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": relId,
      ":entity": `broker#${hbid}#${id}`,
    },
  };
  console.log(params);

  return getResourceJSON(params);
};

const updateBroker = async (data) => {
  const {
    id = "",
    rel_id: relId = "",
    hb_id: hbid = "",
    attrn: propName = "",
    attrv: propVal = "",
  } = data;
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: relId,
      entity: `broker#${hbid}#${id}`,
    },
    UpdateExpression: `set ${propName} = :pval, mdt = :modDate`,
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDt,
    },
  };

  const brokerDetails = await getBrokerDetails(relId, hbid, id);
  console.log("brokerDetails: ", brokerDetails);

  const brokerFname =
    brokerDetails && brokerDetails.length ? brokerDetails[0].fname : "";
  const brokerLname =
    brokerDetails && brokerDetails.length ? brokerDetails[0].lname : "";

  if (propName === "fname") {
    params.UpdateExpression = `set ${propName} = :pval, mdt = :modDate, fullname = :fullname`;
    params.ExpressionAttributeValues[
      ":fullname"
    ] = `${propVal} ${brokerLname}`;
  }
  
  if (propName === "lname" && brokerFname) {
    params.UpdateExpression = `set ${propName} = :pval, mdt = :modDate, fullname = :fullname`;
    params.ExpressionAttributeValues[":fullname"] = `${brokerFname} ${
      propVal || ""
    }`;
  }

  console.log(params);
  return updateResources(params);
};

const deleteBroker = (data) => {
  const { id = "", rel_id: relId = "", hb_id: hbid = "" } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: relId,
      entity: `broker#${hbid}#${id}`,
    },
  };
  console.log(params);
  return deleteResources(params);
};

export async function main(event) {
  let response;
  try {
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        response = failure();
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "update") {
          response = await updateBroker(data);
        } else if (action === "delete") {
          response = await deleteBroker(data);
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
