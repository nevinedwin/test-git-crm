/* eslint-disable camelcase */
import "../../NPMLayer/nodejs.zip";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { failure, success } from "../libs/response-lib";
import { validateGoal } from "../validation/validation";
import {
  batchWriteItems,
  doPaginatedQueryDB,
  transactWriteItems,
  doPaginatedQueryEllastic,
  listEntitiesElastic,
  getParamsForQuery,
  getResources,
  postResources,
} from "../libs/db";
import { elasticExecuteQuery } from "../search/search";
import { invokeLambda } from "../libs/lambda";

export const deleteGoal = async (data) => {
  try {
    const { id = "", hb_id: hbid } = data;
    if (!id && !hbid)
      return failure({ status: false, error: "Id and hbid are required" });

    // getting all sub-goals
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id =:id and begins_with(#entity, :entity)",
      ExpressionAttributeNames: {
        "#entity": "entity",
        "#id": "id",
      },
      ExpressionAttributeValues: {
        ":entity": `sub_goal#${hbid}`,
        ":id": id,
      },
    };

    console.log("params>>", params);

    const subGoals = await doPaginatedQueryDB({ params });
    console.log(`subGoals: ${JSON.stringify(subGoals)}`);

    const deleteSubGoalArr = subGoals.map((item) => ({
      Delete: {
        Key: {
          id: item.id,
          entity: item.entity,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    }));

    const transArr = [
      {
        Delete: {
          Key: {
            id,
            entity: `goal#${hbid}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
      ...deleteSubGoalArr,
    ];

    console.log(`transArr: ${JSON.stringify(transArr)}`);

    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  } catch (error) {
    console.log("error in deleteGoal", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getGoalCount = async (subGoal, customerIds) => {
  try {
    if (Date.now() < subGoal.start_dt) return subGoal;

    const goalCountQuery = {
      httpMethod: "POST",
      requestPath: "/_count",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "type.keyword": "activity",
                },
              },
              {
                terms: {
                  "rel_id.keyword": customerIds,
                },
              },
              {
                match: {
                  "atype.keyword": "stage_change",
                },
              },
              {
                match: {
                  "newst.keyword": subGoal.stage,
                },
              },
              {
                range: {
                  cdt: {
                    gte: subGoal.start_dt,
                    lte: subGoal.end_dt,
                  },
                },
              },
            ],
          },
        },
      },
    };

    const goalCount = await elasticExecuteQuery(goalCountQuery, true);

    console.log("goalCount==>", goalCount);

    if (!goalCount.status) throw new Error("Goal count fetching Failed");

    return { ...subGoal, crr_goal: goalCount?.body?.count };
  } catch (error) {
    throw new Error(error.message);
  }
};

const updateOlderData = async (subGoals) => {
  try {
    console.log("Inside updateOlderData");
    const commId = subGoals[0].comm_id;
    const hbId = subGoals[0].hb_id;

    console.log(">>", JSON.stringify({ commId, hbId }));

    // get all customer under this community
    const customParams = [
      {
        match: {
          "inte.keyword": commId,
        },
      },
      {
        match: {
          "entity.keyword": `customer#${hbId}`,
        },
      },
    ];

    let customerIds = await doPaginatedQueryEllastic({
      hb_id: hbId,
      isCustomParam: true,
      customParams,
      projectFields: ["id"],
    });

    customerIds = customerIds.map((item) => item.id);

    console.log("customerIds>>", JSON.stringify(customerIds));

    const updatedSubGoals = await Promise.all(
      subGoals.map((item) => getGoalCount(item, customerIds))
    );

    console.log("updatedSubGoals>>>", JSON.stringify(updatedSubGoals));

    return { status: true, data: updatedSubGoals };
  } catch (error) {
    console.log("error in updateOlderData", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const createGoal = async (data) => {
  try {
    if (data.purpose !== "update") {
      const isValid = await validateGoal(data, "create");
      if (!isValid.status)
        return failure({ status: false, error: { msg: isValid.msg } });
    }

    const currentDate = Date.now();

    const goalUUID = uuidv4();

    const goalItem = {
      id: data?.id || goalUUID,
      entity: `goal#${data.hb_id}`,
      type: "goal",
      hb_id: data.hb_id,
      name: data.name,
      cdt: data?.cdt || currentDate,
      mdt: currentDate,
      stage: data.stage,
      comm_id: data.comm_id,
      start_dt: data.start_dt,
      end_dt: data.end_dt,
      recur: data.recur,
      goal: data.goal,
    };

    const goalCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        ...goalItem,
        start_dt: moment(data.start_dt, "DD-MM-YYYY").valueOf(),
        end_dt: moment(data.end_dt, "DD-MM-YYYY").valueOf(),
      },
    };

    console.log("goalCreateItem", JSON.stringify(goalCreateItem));

    // invoking the subGoals lambda function
    const invokeParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "createSubGoal",
      },
      body: JSON.stringify({
        mainGoal: goalItem,
      }),
    };

    console.log(`invokeParams: ${JSON.stringify(invokeParams)}`);

    const invokeResp = await invokeLambda(
      process.env.GOAL_LAMBDA_ARN,
      invokeParams,
      true
    );

    console.log("invokeResp>>", invokeResp);

    return postResources(goalCreateItem);
  } catch (error) {
    console.log("error in goal creation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getSubGoalDates = ({ start, end, recurringVal }) => {
  try {
    const dateFormat = "DD-MM-YYYY, HH:mm:ss, dddd";

    // function for formatted and starting and ending date according to recurring value
    const getMomentDate = ({
      dateString,
      rec = "d",
      isRec = true,
      isStart = true,
      isFormat = true,
    }) => {
      let res = moment(dateString, dateFormat);
      const recDate = isStart ? res.startOf(rec) : res.endOf(rec);
      res = isRec ? recDate : res;
      return isFormat ? res.format(dateFormat) : res;
    };

    const getResult = ({ resArr, endDate }) => {
      const resultObj = [];
      if (resArr.length === 1) {
        resultObj.push({
          startDate: resArr[0],
          endDate: getMomentDate({
            dateString: endDate.format(dateFormat),
            rec: "d",
            isRec: true,
            isStart: false,
          }),
        });
        return resultObj;
      }

      for (let i = 0; i < resArr.length - 1; i += 1) {
        let dateObj = {};

        dateObj = {
          startDate: getMomentDate({ dateString: resArr[i], isRec: true }),
          endDate: getMomentDate({
            dateString: moment(resArr[i + 1], dateFormat)
              .add(-1, "d")
              .format(dateFormat),
            isRec: true,
            isStart: false,
          }),
        };
        resultObj.push(dateObj);
      }

      resultObj.push({
        startDate: getMomentDate({
          dateString: moment(
            resultObj[resultObj.length - 1].endDate,
            dateFormat
          )
            .add(1, "d")
            .format(dateFormat),
          rec: "d",
          isRec: true,
        }),
        endDate: getMomentDate({
          dateString: endDate.format(dateFormat),
          rec: "d",
          isRec: true,
          isStart: false,
        }),
      });
      return resultObj;
    };

    // converting into moment js object
    const startDate = getMomentDate({
      dateString: start,
      rec: "d",
      isRec: true,
      isStart: true,
      isFormat: false,
    });
    const endDate = getMomentDate({
      dateString: end,
      rec: "d",
      isRec: true,
      isStart: false,
      isFormat: false,
    });

    const recurring = {
      DAY: "d",
      WEEK: "week",
      MONTH: "M",
      QUARTER: "Q",
      YEAR: "y",
    };

    const result = [];

    // loop through the dates according to reccuring value
    for (
      let eachDates = moment(startDate);
      eachDates <= moment(endDate);
      eachDates.add(1, recurring[recurringVal])
    ) {
      // storing each looped data
      result.push(eachDates.format(dateFormat));
    }

    const resultParams = {
      resArr: result,
      rec: recurring[recurringVal].rec,
      endDate,
    };

    let response = getResult(resultParams);

    response = response.map((item) => ({
      start_dt: moment(item.startDate, dateFormat).valueOf(),
      end_dt: moment(item.endDate, dateFormat).valueOf(),
    }));

    return response;
  } catch (error) {
    console.log("error in getSubGoalDates", JSON.stringify(error.stacks));
    return [];
  }
};

export const createSubGoal = async ({ mainGoal }) => {
  try {
    const subGoalArr = [];

    if (mainGoal.recur === "NO") {
      const subGoalUUID = uuidv4();
      const subGoalItem = {
        id: mainGoal.id,
        entity: `sub_goal#${mainGoal.hb_id}#${subGoalUUID}`,
        type: "sub_goal",
        hb_id: mainGoal.hb_id,
        name: mainGoal.name,
        stage: mainGoal.stage,
        comm_id: mainGoal.comm_id,
        start_dt: moment(mainGoal.start_dt, "DD-MM-YYYY")
          .startOf("day")
          .valueOf(),
        end_dt: moment(mainGoal.end_dt, "DD-MM-YYYY").endOf("day").valueOf(),
        goal: mainGoal.goal,
        crr_goal: 0,
      };
      subGoalArr.push(subGoalItem);
    } else {
      const subGoalDates = getSubGoalDates({
        start: mainGoal.start_dt,
        end: mainGoal.end_dt,
        recurringVal: mainGoal.recur,
      });

      for (const item of subGoalDates) {
        const subGoalUUID = uuidv4();
        const subGoalItem = {
          id: mainGoal.id,
          entity: `sub_goal#${mainGoal.hb_id}#${subGoalUUID}`,
          type: "sub_goal",
          hb_id: mainGoal.hb_id,
          name: mainGoal.name,
          stage: mainGoal.stage,
          comm_id: mainGoal.comm_id,
          start_dt: item?.start_dt,
          end_dt: item?.end_dt,
          goal: mainGoal.goal,
          crr_goal: 0,
        };
        subGoalArr.push(subGoalItem);
      }
    }

    console.log("subGoalArr", JSON.stringify(subGoalArr));

    if (!subGoalArr.length) {
      return deleteGoal({
        id: mainGoal.id,
        hb_id: mainGoal.hb_id,
      });
    }

    const subGoals = await updateOlderData(subGoalArr);

    if (!subGoals.status) {
      return deleteGoal({
        id: mainGoal.id,
        hb_id: mainGoal.hb_id,
      });
    }

    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };

    if (subGoals.data.length) {
      for (const subGoal of subGoals.data) {
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: subGoal,
          },
        });
      }
    }

    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
      batchWriteBody.resp &&
      batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);

    if (!isBatchSuccess) {
      console.log("Goal creation failed with error(s).");
      return deleteGoal({
        id: mainGoal.id,
        hb_id: mainGoal.hb_id,
      });
    }

    return success({ status: true });
  } catch (error) {
    console.log("error in createSubGoal", JSON.stringify(error.stacks));
    return deleteGoal({
      id: mainGoal.id,
      hb_id: mainGoal.hb_id,
    });
  }
};

const updateGoal = async (data) => {
  try {
    const isValid = await validateGoal(data, "update");
    if (!isValid.status)
      return failure({ status: false, error: { msg: isValid.msg } });

    // delete existing goal
    const deleteExistingGoal = await deleteGoal({
      id: data.id,
      hb_id: data.hb_id,
    });

    if (deleteExistingGoal.statusCode !== 200)
      return failure({ status: false, error: "old goal deletion failed" });

    // creating new goal
    data.purpose = "update";
    const newGoal = await createGoal(data);
    if (newGoal.statusCode !== 200)
      return failure({ status: false, error: "New goal creation failed" });

    return success({ status: true });
  } catch (error) {
    console.log("error in updateGoal", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const listGoal = async (data) => {
  try {
    const filterParams = [];
    // filters = {
    // [
    // {
    //   key : 'Community',
    //   value:[]
    // },
    // ]
    // }
    const { filters = [], listAll = false } = data;

    for (const filter of filters) {
      if (filter.key === "Community" && filter.value && filter.value.length) {
        filterParams.push({
          terms: {
            "comm_id.keyword": filter.value,
          },
        });
      }
    }

    const params = {
      ...data,
      entity: "goal",
      filterParams,
    };

    if (listAll) {
      const allGoals = await doPaginatedQueryEllastic(params);
      return success({ status: true, data: allGoals });
    }

    const goals = await listEntitiesElastic(params);

    if (!goals.status) return failure({ ...goals });

    return success({ ...goals });
  } catch (error) {
    console.log("error in listGoal", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const getGoal = (event) => {
  const params = getParamsForQuery(event, "lot");
  return getResources(params);
};

export const listDashboardGoal = async (data) => {
  try {
    const { hb_id: hbid, listAll = false } = data;
    if (!hbid) return failure({ status: false, error: "Hbid are required" });

    const customParams = [
      {
        match: {
          "type.keyword": "sub_goal",
        },
      },
      {
        range: {
          start_dt: {
            lte: Date.now(),
          },
        },
      },
      {
        range: {
          end_dt: {
            gte: Date.now(),
          },
        },
      },
    ];

    const params = {
      ...data,
      hb_id: hbid,
      isCustomParam: true,
      customParams,
    };

    if (listAll) {
      const allGoals = await doPaginatedQueryEllastic(params);
      return success({ status: true, data: allGoals });
    }

    const goals = await listEntitiesElastic(params);

    if (!goals.status) return failure({ ...goals });

    return success({ ...goals });
  } catch (error) {
    console.log("error in getDashboardGoal", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const incrementGoalCount = async ({ hbId, stage, comm = [] }) => {
  try {
    if (!hbId || !stage || !comm.length)
      return { status: false, error: "Hbid,stage and community are required" };

    const customParams = [
      {
        match: {
          "type.keyword": "sub_goal",
        },
      },
      {
        match: {
          "stage.keyword": stage,
        },
      },
      {
        terms: {
          "comm_id.keyword": comm,
        },
      },
      {
        range: {
          start_dt: {
            lte: Date.now(),
          },
        },
      },
      {
        range: {
          end_dt: {
            gte: Date.now(),
          },
        },
      },
    ];

    const subGoals = await doPaginatedQueryEllastic({
      hb_id: hbId,
      isCustomParam: true,
      customParams,
    });

    console.log("subGoals>>", subGoals);

    if (!subGoals.length)
      return { status: true, msg: "No subGoals to increment" };

    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };

    if (subGoals.length) {
      for (const subGoal of subGoals) {
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: {
              ...subGoal,
              crr_goal: parseInt(subGoal.crr_goal, 10) + 1,
            },
          },
        });
      }
    }

    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
      batchWriteBody.resp &&
      batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);

    if (!isBatchSuccess) {
      return { status: false, msg: "Goal increment failed with error(s)." };
    }

    return { status: true, msg: "subGoals incremented successfully." };
  } catch (error) {
    console.log("error in IncrementGoalCount", JSON.stringify(error.stacks));
    return { status: false, error: error.message };
  }
};

const listSubGoal = async (data) => {
  try {
    const { hb_id: hbId = "", goal_id = "", listAll = false } = data;
    if (!goal_id || !hbId)
      return failure({
        status: false,
        error: { msg: "Goal Id and hb_id are required" },
      });

    const customParams = [
      {
        match: {
          "id.keyword": goal_id,
        },
      },
      {
        match: {
          "type.keyword": "sub_goal",
        },
      },
    ];

    const params = {
      ...data,
      isCustomParam: true,
      customParams,
    };

    if (listAll) {
      const allSubGoals = await doPaginatedQueryEllastic(params);
      return success({ status: true, data: allSubGoals });
    }

    const subGoals = await listEntitiesElastic(params);

    if (!subGoals.status) return failure({ ...subGoals });

    return success({ ...subGoals });
  } catch (error) {
    console.log("error in listSubGoal", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)} `);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "get") {
          response = await getGoal(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createGoal(data);
        } else if (action === "createSubGoal") {
          response = await createSubGoal(data);
        } else if (action === "update") {
          response = await updateGoal(data);
        } else if (action === "list") {
          response = await listGoal(data);
        } else if (action === "list-dashboard") {
          response = await listDashboardGoal(data);
        } else if (action === "list-subGoals") {
          response = await listSubGoal(data);
        }
        break;
      default:
        response = failure();
    }
  } catch (error) {
    console.log(`Exception in goal lambda: ${JSON.stringify(error.stacks)} `);
    return failure({ status: false, error: error.message });
  }
  return response;
}
