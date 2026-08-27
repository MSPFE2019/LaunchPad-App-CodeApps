/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * This file is auto-generated. Do not modify it manually.
 * Changes to this file may be overwritten.
 */

export const dataSourcesInfo = {
  "lppac_launchpadapps": {
    "tableId": "",
    "version": "",
    "primaryKey": "lppac_launchpadappid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "lppac_launchpadchoices": {
    "tableId": "",
    "version": "",
    "primaryKey": "lppac_launchpadchoiceid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "roles": {
    "tableId": "",
    "version": "",
    "primaryKey": "roleid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "whoami": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "WhoAmI": {
        "path": "/api/data/v9.2/WhoAmI",
        "method": "GET",
        "parameters": [],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  }
};
