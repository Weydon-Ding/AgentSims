import type { ChatMessage, PushFrame, PushFrameByUri, PushUri } from './pushes';
import { isDispatchablePush, isIncomingFrame, isPushUri } from './push-guards';
import { useChatStore } from '../stores/chat-store';
import { useConnectionStore } from '../stores/connection-store';
import { useEntityStore } from '../stores/entity-store';
import { useLogStore } from '../stores/log-store';
import { useSimStore } from '../stores/sim-store';

type PushHandler<U extends PushUri> = (frame: PushFrameByUri<U>) => void;
type PushHandlers = { readonly [U in PushUri]: PushHandler<U> };

function isChatHistory(
  data: PushFrameByUri<'chatWith'>['data']
): data is { readonly chats: readonly ChatMessage[] } {
  return 'chats' in data;
}

const handlers = {
  welcome: (frame) => useConnectionStore.getState().welcome(frame.uid),
  movePath: (frame) => useEntityStore.getState().setPath(frame.data.uid, frame.data.path),
  moveTo: (frame) => {
    useEntityStore.getState().setPosition(frame.data.uid, { x: frame.data.toX, y: frame.data.toY });
    useEntityStore.getState().patchNpc(frame.data.uid, { x: frame.data.toX, y: frame.data.toY });
  },
  'NPC-React': (frame) => useLogStore.getState().append({ kind: 'npc-reaction', ...frame.data }),
  newPlan: (frame) => useEntityStore.getState().patchNpc(frame.data.uid, { plan: frame.data.plan }),
  planToMove: (frame) =>
    useSimStore.getState().setTargetBuilding({
      uid: frame.data.uid,
      id: frame.data.targetBuildingID,
      name: frame.data.targetBuilding,
    }),
  chatWith: (frame) => {
    if (isChatHistory(frame.data)) {
      useChatStore.getState().replace(frame.data.chats);
      return;
    }
    useChatStore.getState().append({
      content: frame.data.content,
      speaker: frame.data.sourceID,
      speakerID: frame.data.sourceID,
      targetID: frame.data.targetID,
    });
  },
  interact: (frame) => useSimStore.getState().setInteraction(frame.data),
  newAction: (frame) => useSimStore.getState().setAction(frame.data.uid, frame.data),
  finishAction: (frame) => useSimStore.getState().setAction(frame.data.uid, frame.data),
  changeCash: (frame) =>
    useEntityStore.getState().patchNpc(frame.data.uid, { cash: frame.data.cash }),
  changeRevenue: (frame) =>
    useEntityStore.getState().patchPlayer(frame.data.uid, { revenue: frame.data.revenue }),
  increaseBuildingIncome: (frame) => {
    const building = useEntityStore.getState().buildings[frame.data.building_id];
    if (building !== undefined) {
      useEntityStore.getState().upsertBuilding({ ...building, rI: frame.data.income });
    }
  },
  'mayor.npc.Create': (frame) =>
    useEntityStore.getState().patchNpc(frame.data.uid, {
      name: frame.data.nickname,
      cash: frame.data.cash,
      x: frame.data.x,
      y: frame.data.y,
      asset: frame.data.assetName,
      model: frame.data.model,
      memorySystem: frame.data.memorySystem,
      planSystem: frame.data.planSystem,
      home_building: frame.data.homeBuilding,
      work_building: frame.data.workBuilding,
      bio: frame.data.bio,
      goal: frame.data.goal,
    }),
  'mayor.building.Create': (frame) => useEntityStore.getState().upsertBuilding(frame.data),
} satisfies PushHandlers;

export function dispatchPush(frame: PushFrame): void {
  switch (frame.uri) {
    case 'welcome':
      handlers.welcome(frame);
      return;
    case 'movePath':
      handlers.movePath(frame);
      return;
    case 'moveTo':
      handlers.moveTo(frame);
      return;
    case 'NPC-React':
      handlers['NPC-React'](frame);
      return;
    case 'newPlan':
      handlers.newPlan(frame);
      return;
    case 'planToMove':
      handlers.planToMove(frame);
      return;
    case 'chatWith':
      handlers.chatWith(frame);
      return;
    case 'interact':
      handlers.interact(frame);
      return;
    case 'newAction':
      handlers.newAction(frame);
      return;
    case 'finishAction':
      handlers.finishAction(frame);
      return;
    case 'changeCash':
      handlers.changeCash(frame);
      return;
    case 'changeRevenue':
      handlers.changeRevenue(frame);
      return;
    case 'increaseBuildingIncome':
      handlers.increaseBuildingIncome(frame);
      return;
    case 'mayor.npc.Create':
      handlers['mayor.npc.Create'](frame);
      return;
    case 'mayor.building.Create':
      handlers['mayor.building.Create'](frame);
      return;
  }
}

export function dispatchIncomingPush(frame: unknown): void {
  if (!isIncomingFrame(frame)) {
    useLogStore.getState().append({ kind: 'unknown-push', message: 'Malformed push frame' });
    return;
  }
  if (!isPushUri(frame.uri)) {
    useLogStore
      .getState()
      .append({ kind: 'unknown-push', message: `Unknown push URI: ${frame.uri}` });
    return;
  }
  if (!isDispatchablePush(frame)) {
    useLogStore.getState().append({ kind: 'unknown-push', message: 'Malformed push frame' });
    return;
  }
  dispatchPush(frame);
}
