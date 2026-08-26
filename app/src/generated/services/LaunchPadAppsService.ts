import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo'
import type { IGetAllOptions, IGetOptions } from '../models/CommonModels'
import type { LaunchPadAppBase, LaunchPadAppRecord } from '../models/LaunchPadAppsModel'

export class LaunchPadAppsService {
  private static readonly dataSourceName = 'lppac_launchpadapps'
  private static readonly client = getClient(dataSourcesInfo)

  static create(
    record: Omit<LaunchPadAppBase, 'lppac_launchpadappid'>,
  ): Promise<IOperationResult<LaunchPadAppRecord>> {
    return this.client.createRecordAsync<
      Omit<LaunchPadAppBase, 'lppac_launchpadappid'>,
      LaunchPadAppRecord
    >(this.dataSourceName, record)
  }

  static update(
    id: string,
    changedFields: Partial<Omit<LaunchPadAppBase, 'lppac_launchpadappid'>>,
  ): Promise<IOperationResult<LaunchPadAppRecord>> {
    return this.client.updateRecordAsync<
      Partial<Omit<LaunchPadAppBase, 'lppac_launchpadappid'>>,
      LaunchPadAppRecord
    >(this.dataSourceName, id, changedFields)
  }

  static async delete(id: string): Promise<void> {
    await this.client.deleteRecordAsync(this.dataSourceName, id)
  }

  static get(id: string, options?: IGetOptions): Promise<IOperationResult<LaunchPadAppRecord>> {
    return this.client.retrieveRecordAsync<LaunchPadAppRecord>(this.dataSourceName, id, options)
  }

  static getAll(options?: IGetAllOptions): Promise<IOperationResult<LaunchPadAppRecord[]>> {
    return this.client.retrieveMultipleRecordsAsync<LaunchPadAppRecord>(this.dataSourceName, options)
  }
}

