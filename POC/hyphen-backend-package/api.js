import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import { sendRequest } from './libs/search-lib';

/* const elasticsearch = require('elasticsearch');
const httpAwsEs = require('http-aws-es');

const { ES_ENDPOINT } = process.env;
const esDomain = {
    index: 'entitiessearchindex',
    doctype: '_doc'
};
const esParams = { hosts: ES_ENDPOINT };
esParams.connectionClass = httpAwsEs;
const es = new elasticsearch.Client(esParams); */
const getResources = async (params) => {
    try {
        const result = await dynamoDbLib.call("query", params);
        return success(result.Items);
    } catch (e) {
        console.log(e);
        return failure({ status: false, error: e.message });
    }
};
const postResources = async (params) => {
    try {
        await dynamoDbLib.call("put", params);        
        return success({ status: true, item: {id: params.Item.id} });
    } catch (e) {
        console.log(e);
        return failure({ status: false, error: e.message });
    }
};

const updateResources = async (params) => {
    try {
        await dynamoDbLib.call("update", params);
        return success({ status: true });
    } catch (e) {
        console.log(e);
        return failure({ status: false, error: e.message });
    }
};

const deleteResources = async (params) => {
    try {
        await dynamoDbLib.call("delete", params);
        return success({ status: true });
    } catch (e) {
        console.log(e);
        return failure({ status: false, error: e.message });
    }
};
/**
 * 
 * @param {Object} data Request Data
 * @param {Boolean} isReg create user after signup or not
 */
const getUserCreateJSON = (data, isReg) => {
    const type = data && data.hasOwnProperty('type') && data.type ? data.type : '';
    const org_id = data && data.hasOwnProperty('org_id') && data.org_id ? data.org_id : 0;
    const fname = data && data.hasOwnProperty('fname') && data.fname ? data.fname : '';
    const lname = data && data.hasOwnProperty('lname') && data.lname ? data.lname : '';
    const email = data && data.hasOwnProperty('email') && data.email ? data.email : '';
    const phone = data && data.hasOwnProperty('phone') && data.phone ? data.phone : '';
    const img = data && data.hasOwnProperty('img') && data.img ? data.img : '';
    const jdt = Date.now();
    const mod_dt = Date.now();
    const cdt = Date.now();
    const stage = data && data.hasOwnProperty('stage') && data.stage ? data.stage : '';
    const psrc = data && data.hasOwnProperty('psrc') && data.psrc ? data.psrc : '';
    const cntm = data && data.hasOwnProperty('cntm') && data.cntm ? data.cntm : '';
    const grade = data && data.hasOwnProperty('grade') && data.grade ? data.grade : '';
    const inte = data && data.hasOwnProperty('inte') && data.inte ? data.inte : [];
    const desf = data && data.hasOwnProperty('desf') && data.desf ? data.desf : {};
    const desm = data && data.hasOwnProperty('desm') && data.desm ? data.desm : '';
    const agent = data && data.hasOwnProperty('agent') && data.agent ? data.agent : 0;
    const infl = data && data.hasOwnProperty('infl') && data.infl ? data.infl : [];
    const rltr = data && data.hasOwnProperty('rltr') && data.rltr ? data.rltr : [];

    const params = {
        TableName: process.env.entitiesTableName,
        Item: {
            type: type,
            org_id: org_id,
            fname: fname,
            lname: lname,
            email: email,
            jdt: jdt,
            mdt: mod_dt,
            cdt: cdt,
            inte: inte,
            infl: infl,
            rltr: rltr,
            desf: desf,
            acti: [
                {
                    title: "Phone Call",
                    desc: "Hyphen Solution PoC Meeting",
                    date: 1561009874000,
                    type: "phone"
                },
                {
                    title: "Note",
                    desc: "Include Advanced Serach for the Customer List",
                    date: 1560951940000,
                    type: "note"
                },
                {
                    title: "Appointment",
                    desc: "Meeting with the CEO",
                    date: 1560921674000,
                    type: "appointment"
                },
                {
                    title: "Email Received",
                    desc: "Re: Thanks for the suggestions",
                    date: 1560659414000,
                    type: "mail_received"
                },
                {
                    title: "Email Sent",
                    desc: "Thanks for the suggestions",
                    date: 1560486614000,
                    type: "mail_send"
                },
                {
                    title: "Community Visit",
                    desc: "Park Ridge Home Builder Community Visit",
                    date: 1560486614000,
                    type: "community_visit"
                }
            ]
        }
    };
    // Setting non-mandatory fields based on it's availability
    if (img) {
        params.Item['img'] = img;
    }
    if (psrc) {
        params.Item['psrc'] = psrc;
    }
    if (cntm) {
        params.Item['cntm'] = cntm;
    }
    if (grade) {
        params.Item['grade'] = grade;
    }
    if (desm) {
        params.Item['desm'] = desm;
    }
    if (agent) {
        params.Item['agent'] = agent;
    }
    if (phone) {
        params.Item['phone'] = phone;
    }
    if (stage) {
        params.Item['stage'] = stage;
    }
    if (isReg) {
        const user_id = data && data.hasOwnProperty('user_id') ? data.user_id : '';
        params.Item['id'] = user_id;
    }
    else {
        params.Item['id'] = uuid.v1();
    }
    return params;
}
const listUsers = (event) => {
    const orgidParam = event && event.hasOwnProperty('pathParameters') && event.pathParameters.hasOwnProperty('orgid') ? event.pathParameters.orgid : 0;
    const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByOrgId,
        KeyConditionExpression: "org_id = :org_id and #type = :type",
        ExpressionAttributeNames: {
            "#type": "type",
        },
        ExpressionAttributeValues: {
            ":org_id": orgidParam,
            ":type": "customer"
        }
    };
    console.log(params);
    return getResources(params);
}
const createUser = (event, api) => {
    const data = JSON.parse(event.body);
    const params = api === 'create' ? getUserCreateJSON(data, false) : getUserCreateJSON(data, true);
    console.log(params);
    return postResources(params);
}
const getUser = (event) => {
    const idParam = event && event.hasOwnProperty('pathParameters') && event.pathParameters.hasOwnProperty('id') ? event.pathParameters.id : 0;
    const data = JSON.parse(event.body);
    const typeParam = data && data.hasOwnProperty('type') && data.type ? data.type : 'customer';
    const params = {
        TableName: process.env.entitiesTableName,
        KeyConditionExpression: "#id = :id and #type = :type",
        ExpressionAttributeNames: {
            "#id": "id",
            "#type": "type"
        },
        ExpressionAttributeValues: {
            ":id": idParam,
            ":type": typeParam
        }
    };
    console.log(params);
    return getResources(params);
}
const createBuilder = (event) => {
    const data = JSON.parse(event.body);
    const name = data && data.hasOwnProperty('name') ? data.name : '';
    const email = data && data.hasOwnProperty('email') ? data.email : '';
    const phone = data && data.hasOwnProperty('phone') ? data.phone : '';
    const cdt = Date.now();
    const mod_dt = Date.now();

    const params = {
        TableName: process.env.entitiesTableName,
        Item: {
            id: uuid.v1(),
            type: 'builder',
            name: name,
            email: email,
            phone: phone,
            address: '999 Commercial St. Ste 210, Palo Alto, CA 94303',
            cdt: cdt,
            mdt: mod_dt
        }
    };
    console.log(params);
    return postResources(params);
}
const listBuilders = () => {
    const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByType,
        KeyConditionExpression: "#type = :type",
        ExpressionAttributeNames: {
            "#type": "type",
        },
        ExpressionAttributeValues: {
            ":type": 'builder'
        }
    };
    console.log(params);
    return getResources(params);
}
const searchEntities = async (event, api) => {
    const offset = 0;
    const data = JSON.parse(event.body);
    const searchString = data && data.hasOwnProperty('search') && data.search ? data.search : '';
    const whiteSpaceSplit = searchString ? searchString.split(' ') : [];
    let isWhiteSpaceWord = 0;
    if (whiteSpaceSplit.length) {
        // Search String has Whitespaces
        if (whiteSpaceSplit.length === 2) {
            // Search String has two words only
            // If the second word is blank, then ignore it and consider as Search String without Whitespaces
            isWhiteSpaceWord = whiteSpaceSplit[1] ? whiteSpaceSplit.length : 0;
        }
        else {
            // Search String has more than two words
            isWhiteSpaceWord = whiteSpaceSplit.length;
        }
    }
    else {
        // Search String has only one word
        isWhiteSpaceWord = 0;
    }
    const defOp = isWhiteSpaceWord === 0 ? 'or' : 'and';    
    const params = {
        httpMethod: 'POST',
        requestPath: '/_search',
        payload: {
            from: offset,
            "query": {
                "simple_query_string": {
                    "query": `(${searchString}*)`,                    
                    "default_operator": defOp
                }
            },
            "highlight": {
                "fields": {
                    "*": {}
                }
            }
        }
    };
    if(api !== 'gsearch') {
        // Add field restriction for search results
        params.payload.query.simple_query_string["fields"] = ["fname", "lname", "phone", "email", "stage"];
    }
    const searchResult = await sendRequest(params)
        .then(result => {
            console.info(result);
            // result = JSON.parse(result);
            if (result.statusCode === 200) {
                const recordData = result && result.hasOwnProperty('body') && result.body.hasOwnProperty('hits')
                    && result.body.hits.hasOwnProperty('hits') ? result.body.hits.hits : [];
                return success({ status: true, result: recordData });
            }
            else {
                return failure({ status: false, error: result });
            }
        });
    return searchResult;
    // Search using elasticsearch.js and httpAwsEs npm modules
    /* const searchResult = await es.search({
        index: esDomain.index,
        body: {
            from: offset,
            "query": {
                "simple_query_string": {
                    "query": `(${searchString}*)`
                }
            },
            "highlight": {
                "fields": {
                    "*": {}
                }
            }
        },
        refresh: '',
        timeout: '5m'
    }, (err, result) => {
        if (err) {
            console.log(err);
            return failure({ status: false, error: err });
        } else {
            console.log(result);
            return success({ status: true, result: result });
        }
    });
    return searchResult; */
}
const listProps = (event) => {
    const orgidParam = event && event.hasOwnProperty('pathParameters') && event.pathParameters.hasOwnProperty('orgid') ? event.pathParameters.orgid : 0;
    const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByOrgId,
        KeyConditionExpression: "org_id = :org_id and #type = :type",
        ExpressionAttributeNames: {
            "#type": "type",
        },
        ExpressionAttributeValues: {
            ":org_id": orgidParam,
            ":type": "property"
        }
    };
    console.log(params);
    return getResources(params);
}
const createProp = (event) => {
    const data = JSON.parse(event.body);
    const org_id = data && data.hasOwnProperty('org_id') ? data.org_id : 0;
    const name = data && data.hasOwnProperty('name') ? data.name : '';
    const mod_dt = Date.now();
    const cdt = Date.now();

    const params = {
        TableName: process.env.entitiesTableName,
        Item: {
            id: uuid.v1(),
            type: 'property',
            org_id: org_id,
            name: name,
            mdt: mod_dt,
            cdt: cdt
        }
    };
    console.log(params);
    return postResources(params);
}
const updateUser = (event) => {
    const data = JSON.parse(event.body);
    const user_id = data && data.hasOwnProperty('user_id') ? data.user_id : 0;
    // const org_id = data && data.hasOwnProperty('org_id') ? data.org_id : 0;
    const propName = data && data.hasOwnProperty('attrn') ? data.attrn : '';
    const propVal = data && data.hasOwnProperty('attrv') ? data.attrv : '';
    const mod_dt = Date.now();

    const params = {
        TableName: process.env.entitiesTableName,
        Key: {
            "id": user_id,
            "type": "customer"
        },
        UpdateExpression: `set ${propName} = :pval, mdt = :modDate`,
        ExpressionAttributeValues: {
            ":pval": propVal,
            ":modDate": mod_dt
        }
    };
    console.log(params);
    return updateResources(params);
}
const deleteUser = (event) => {
    const data = JSON.parse(event.body);
    const user_id = data && data.hasOwnProperty('user_id') ? data.user_id : 0;
    const params = {
        TableName:process.env.entitiesTableName,
        Key:{
            "id": user_id,
            "type": "customer"
        }
    };
    console.log(params);
    return deleteResources(params);
}
const handlers = {
    "users": {
        "list": listUsers,
        "create": createUser,
        "createreg": createUser,
        "get": getUser,        
        "search": searchEntities,
        "gsearch": searchEntities,
        "update": updateUser,
        "delete": deleteUser
    },
    "builders": {
        "list": listBuilders,
        "create": createBuilder
    },
    "props": {
        "list": listProps,
        "create": createProp
    }
};

export async function main(event, context) {
    const resource = event && event.hasOwnProperty('pathParameters') && event.pathParameters.hasOwnProperty('resource') ? event.pathParameters.resource : '';
    const apiName = event && event.hasOwnProperty('pathParameters') && event.pathParameters.hasOwnProperty('action') ? event.pathParameters.action : '';    
    
    if((resource in handlers) && (apiName in handlers[resource])) {
        return handlers[resource][apiName](event, apiName);
    }
    else {
        return failure({ status: false, error: "Invalid API" });
    }
}