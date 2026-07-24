import type { BuildingDTO, JsonValue, NPCUid, PlayerUid, Position, Uid } from './dtos';
import type { RequestResponseData } from './requests';

export const PUSH_URIS = [
  'welcome',
  'movePath',
  'moveTo',
  'NPC-React',
  'newPlan',
  'planToMove',
  'chatWith',
  'interact',
  'newAction',
  'finishAction',
  'changeCash',
  'changeRevenue',
  'increaseBuildingIncome',
  'mayor.npc.Create',
  'mayor.building.Create',
] as const;
export type PushUri = (typeof PUSH_URIS)[number];
export type ChatMessage = {
  readonly content: string;
  readonly speaker: string;
  readonly speakerID: Uid;
};

export type PushDataByUri = {
  readonly welcome: undefined;
  readonly movePath: { readonly uid: Uid; readonly path: readonly Position[] };
  readonly moveTo: {
    readonly uid: Uid;
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
  };
  readonly 'NPC-React': { readonly uid: NPCUid; readonly reaction: JsonValue };
  readonly newPlan: { readonly uid: NPCUid; readonly plan: JsonValue };
  readonly planToMove: {
    readonly uid: NPCUid;
    readonly targetBuilding: string;
    readonly targetBuildingID: number;
  };
  readonly chatWith:
    | { readonly sourceID: Uid; readonly targetID: Uid; readonly content: string }
    | { readonly chats: readonly ChatMessage[] };
  readonly interact: {
    readonly uid: Uid;
    readonly equipment: number;
    readonly operation: string;
    readonly continueTime: number;
    readonly cost: number;
    readonly earn: number;
  };
  readonly newAction: { readonly uid: NPCUid } & Readonly<Record<string, JsonValue>>;
  readonly finishAction: {
    readonly uid: NPCUid;
    readonly action: JsonValue;
    readonly startTime: number;
    readonly endTime: number;
  };
  readonly changeCash: {
    readonly uid: NPCUid;
    readonly cash: number;
    readonly amount: number;
    readonly effect: 'increase' | 'decrease';
  };
  readonly changeRevenue: {
    readonly uid: PlayerUid;
    readonly revenue: number;
    readonly amount: number;
    readonly effect: 'increase' | 'decrease';
  };
  readonly increaseBuildingIncome: {
    readonly uid: PlayerUid;
    readonly building_id: number;
    readonly income: number;
    readonly amount: number;
  };
  readonly 'mayor.npc.Create': RequestResponseData['command.npc.Create'];
  readonly 'mayor.building.Create': BuildingDTO;
};

type PushFrameBase<U extends PushUri> = {
  readonly code: number;
  readonly uri: U;
  readonly uid?: Uid;
  readonly msg?: string;
};
export type PushFrameByUri<U extends PushUri> = U extends 'welcome'
  ? PushFrameBase<U> & { readonly data?: undefined }
  : PushFrameBase<U> & {
      readonly data: PushDataByUri[U];
    };
export type PushFrame = { readonly [U in PushUri]: PushFrameByUri<U> }[PushUri];
