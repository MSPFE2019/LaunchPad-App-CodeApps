export interface LaunchPadAppBase {
  lppac_launchpadappid: string
  lppac_title: string
  lppac_appurl: string
  lppac_appdescription: string
  lppac_appowner?: string | null
  lppac_appstatus?: number | null
  lppac_audience: string
  lppac_agencyfilter?: string | null
  lppac_office365group?: string | null
  lppac_licensedesignation?: string | null
  lppac_appid?: string | null
  lppac_apptype: string
  lppac_appversion?: string | null
  lppac_appupdate?: string | null
  lppac_category?: string | null
}

export type LaunchPadAppRecord = LaunchPadAppBase

