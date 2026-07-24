export { REQUEST_URIS, REQUEST_URI_METADATA } from './requests';
export { PUSH_URIS } from './pushes';
export type {
  BuildingDTO,
  BuildingsDTO,
  EquipmentDTO,
  EquipmentsDTO,
  JsonValue,
  MapBlock,
  MapDTO,
  MayorUid,
  NPCDTO,
  NPCUid,
  PlayerDTO,
  PlayerUid,
  Position,
  TownDTO,
  Uid,
} from './dtos';
export type {
  ConfigEntry,
  EmptyData,
  MayorBuildingInfo,
  MayorNPCInfo,
  RequestDataByUri,
  RequestFrame,
  RequestFrameByUri,
  RequestResponseData,
  RequestUri,
  RequestUriMetadata,
  Uri,
} from './requests';
export type { ChatMessage, PushDataByUri, PushFrame, PushFrameByUri, PushUri } from './pushes';

import type { Uid } from './dtos';
import type { PushUri } from './pushes';
import type { RequestUri } from './requests';

export type ResponseEnvelope<T = unknown> = {
  readonly code: number;
  readonly data?: T;
  readonly uid?: Uid;
  readonly msg: string;
  readonly uri?: RequestUri | PushUri;
};
