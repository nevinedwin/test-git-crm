define({ "api": [
  {
    "type": "get",
    "url": "/api/auth/0/0/0",
    "title": "AWS Amplify Configuration",
    "name": "AWS_Amplify_Configuration",
    "group": "AWS_Amplify_Config",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "apiGatewayURL",
            "description": "<p>https://o09lp5gowj.execute-api.us-east-1.amazonaws.com/dev</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "apiGatewayREGION",
            "description": "<p>us-east-1</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cognitoREGION",
            "description": "<p>us-east-1</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cognitoUSER_POOL_ID",
            "description": "<p>us-east-1_dKUjrz60g</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cognitoAPP_CLIENT_ID",
            "description": "<p>2voh5pi1kijrccv5m0ulmmsfkj</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cognitoIDENTITY_POOL_ID",
            "description": "<p>us-east-1:87814dcb-929e-4b9b-91da-8a01ec76b289</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "custom:org_id",
            "description": "<p>User Pool Custom Attribute org_id</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "AWS_Amplify_Config"
  },
  {
    "type": "post",
    "url": "/api/auth/users/gsearch",
    "title": "Search Customers based on any Field Value(Global Search).",
    "name": "searchcust_0_0",
    "group": "Global",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "search",
            "description": "<p>Search String.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "search",
            "description": "<p>results.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "Global"
  },
  {
    "type": "post",
    "url": "/api/auth/builders/create",
    "title": "Create a Home Builder",
    "name": "CreateHomeBuilder",
    "group": "Home_Builder",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>Type of Home Builder ('builder').</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Name of the Home Builder.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Home Builder.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Home Builder.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "address",
            "description": "<p>Address of the Home Builder.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "item",
            "description": "<p>Details of the newly created home builder.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "Home_Builder"
  },
  {
    "type": "get",
    "url": "/api/public/builders/list",
    "title": "Get List of Home Builders.",
    "name": "ListHomeBuilders",
    "group": "Home_Builder",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>Type of Home Builder ('builder').</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Name of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "address",
            "description": "<p>Address of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "cdt",
            "description": "<p>Created Date of the Home Builder.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "mdt",
            "description": "<p>Modified Date of the Home Builder.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "Home_Builder"
  },
  {
    "type": "get",
    "url": "/api/auth/props/list/:orgid/0",
    "title": "Get List of Properties.",
    "name": "ListProperties",
    "group": "Property",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "orgid",
            "description": "<p>Home Builder Id.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Property.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Name of the Property.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "cdt",
            "description": "<p>Created Date of the Property.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "mdt",
            "description": "<p>Modified Date of the Property.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "Property"
  },
  {
    "type": "post",
    "url": "/api/auth/props/create",
    "title": "Create a Property",
    "name": "createprop",
    "group": "Property",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>Type of Property ('property').</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Name of the Property.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "item",
            "description": "<p>Details of the newly created property.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "Property"
  },
  {
    "type": "post",
    "url": "/api/auth/users/create",
    "title": "Create a User",
    "name": "CreateUser",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>User Type.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "fname",
            "description": "<p>First Name of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "lname",
            "description": "<p>Last Name of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "img",
            "description": "<p>Image URL of the Customer's Profile Picture.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "stage",
            "description": "<p>Current Stage of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "psrc",
            "description": "<p>Primary Source of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cntm",
            "description": "<p>Contact Method of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "grade",
            "description": "<p>Grade of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "inte",
            "description": "<p>Interests of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "infl",
            "description": "<p>Influences of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "rltr",
            "description": "<p>Realtors of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Object",
            "optional": false,
            "field": "desf",
            "description": "<p>Desired Features of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "desm",
            "description": "<p>Desired Move of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "agent",
            "description": "<p>Agent Id of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "acti",
            "description": "<p>Activities of the Customer.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "item",
            "description": "<p>Details of the newly created User.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "post",
    "url": "/api/auth/users/delete",
    "title": "Delete a customer",
    "name": "DeleteCustomer",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "user_id",
            "description": "<p>Id of the user to be deleted.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "get",
    "url": "/api/auth/users/get/:orgid/:id",
    "title": "Get Details of a Customer.",
    "name": "GetUser",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Customer.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>User Type.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "fname",
            "description": "<p>First Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "lname",
            "description": "<p>Last Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "img",
            "description": "<p>Image URL of the Customer's Profile Picture.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "jdt",
            "description": "<p>Joining Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "stage",
            "description": "<p>Current Stage of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "psrc",
            "description": "<p>Primary Source of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "cntm",
            "description": "<p>Contact Method of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "grade",
            "description": "<p>Grade of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "inte",
            "description": "<p>Interests of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "infl",
            "description": "<p>Influences of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "rltr",
            "description": "<p>Realtors of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "desf",
            "description": "<p>Desired Features of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "desm",
            "description": "<p>Desired Move of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "agent",
            "description": "<p>Agent Id of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "acti",
            "description": "<p>Activities of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "cdt",
            "description": "<p>Created Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "mdt",
            "description": "<p>Modified Date of the Customer.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "get",
    "url": "/api/auth/users/list/:orgid/0",
    "title": "Get List of Customers",
    "name": "ListUsers",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "orgid",
            "description": "<p>Home Builder Id.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Customer/Cognito Sub Id of the Signed Up User.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>User Type.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "fname",
            "description": "<p>First Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "lname",
            "description": "<p>Last Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "img",
            "description": "<p>Image URL of the Customer's Profile Picture.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "jdt",
            "description": "<p>Joining Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "stage",
            "description": "<p>Current Stage of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "psrc",
            "description": "<p>Primary Source of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "cntm",
            "description": "<p>Contact Method of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "grade",
            "description": "<p>Grade of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "inte",
            "description": "<p>Interests of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "infl",
            "description": "<p>Influences of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "rltr",
            "description": "<p>Realtors of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "desf",
            "description": "<p>Desired Features of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "desm",
            "description": "<p>Desired Move of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "agent",
            "description": "<p>Agent Id of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "acti",
            "description": "<p>Activities of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "cdt",
            "description": "<p>Created Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "mdt",
            "description": "<p>Modified Date of the Customer.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "post",
    "url": "/api/public/users/createreg",
    "title": "Create a User after SignUp",
    "name": "createuserreg",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "user_id",
            "description": "<p>Cognito Sub Id of the Signed Up User.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>User Type.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "fname",
            "description": "<p>First Name of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "lname",
            "description": "<p>Last Name of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "img",
            "description": "<p>Image URL of the Customer's Profile Picture.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "stage",
            "description": "<p>Current Stage of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "psrc",
            "description": "<p>Primary Source of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "cntm",
            "description": "<p>Contact Method of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "grade",
            "description": "<p>Grade of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "inte",
            "description": "<p>Interests of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "infl",
            "description": "<p>Influences of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "rltr",
            "description": "<p>Realtors of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Object",
            "optional": false,
            "field": "desf",
            "description": "<p>Desired Features of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "desm",
            "description": "<p>Desired Move of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "agent",
            "description": "<p>Agent Id of the Customer.</p>"
          },
          {
            "group": "Parameter",
            "type": "Array",
            "optional": false,
            "field": "acti",
            "description": "<p>Activities of the Customer.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "item",
            "description": "<p>Details of the newly created User.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "post",
    "url": "/api/auth/users/search",
    "title": "Search Customers.",
    "name": "searchcust",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "search",
            "description": "<p>Search String.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Unique Id of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "type",
            "description": "<p>User Type.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "fname",
            "description": "<p>First Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "lname",
            "description": "<p>Last Name of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "phone",
            "description": "<p>Phone Number of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "img",
            "description": "<p>Image URL of the Customer's Profile Picture.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "jdt",
            "description": "<p>Joining Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "stage",
            "description": "<p>Current Stage of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "psrc",
            "description": "<p>Primary Source of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "cntm",
            "description": "<p>Contact Method of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "grade",
            "description": "<p>Grade of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "inte",
            "description": "<p>Interests of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "infl",
            "description": "<p>Influences of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "rltr",
            "description": "<p>Realtors of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "desf",
            "description": "<p>Desired Features of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "desm",
            "description": "<p>Desired Move of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "agent",
            "description": "<p>Agent Id of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Array",
            "optional": false,
            "field": "acti",
            "description": "<p>Activities of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "cdt",
            "description": "<p>Created Date of the Customer.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "mdt",
            "description": "<p>Modified Date of the Customer.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  },
  {
    "type": "post",
    "url": "/api/auth/users/update",
    "title": "Update a User Attribute",
    "name": "upuserdetail",
    "group": "User",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "org_id",
            "description": "<p>Home Builder Id.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "attrn",
            "description": "<p>User Attribute Field to be updated.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "attrv",
            "description": "<p>User Attribute Value to be updated to.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "user_id",
            "description": "<p>User Id.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>true.</p>"
          }
        ]
      }
    },
    "error": {
      "fields": {
        "Error 4xx": [
          {
            "group": "Error 4xx",
            "type": "Boolean",
            "optional": false,
            "field": "status",
            "description": "<p>false.</p>"
          },
          {
            "group": "Error 4xx",
            "type": "String",
            "optional": false,
            "field": "error",
            "description": "<p>Error Message.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "docJs/doc.js",
    "groupTitle": "User"
  }
] });
