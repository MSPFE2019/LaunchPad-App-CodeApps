export interface IGetOptions {
  select?: string[]
}

export interface IGetAllOptions {
  maxPageSize?: number
  select?: string[]
  filter?: string
  orderBy?: string[]
  top?: number
  skip?: number
  skipToken?: string
}

